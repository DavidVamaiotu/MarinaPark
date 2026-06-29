const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { DatabaseSync } = require("node:sqlite");
const mysql = require("mysql2/promise");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const databasePath = path.join(dataDir, "marina-park.sqlite");
const backupDir = path.join(dataDir, "backups");
const dailyBackupPath = path.join(backupDir, "marina-park-daily.sqlite");
const weeklyBackupPath = path.join(backupDir, "marina-park-weekly.sqlite");
const backupMetaPath = path.join(backupDir, "backup-meta.json");
const activityLogJsonPath = path.join(dataDir, "activity-log.json");
const activityLogJsonlPath = path.join(dataDir, "activity-log.jsonl");
const legacyReservationsIndexPath = path.join(dataDir, "reservations", "index.json");
const legacyConfigPath = path.join(dataDir, "config.json");
const port = Number(process.env.PORT || 4173);
const mysqlHost = process.env.MARINA_MYSQL_HOST || "81.181.112.114";
const mysqlUser = process.env.MARINA_MYSQL_USER || "david";
const mysqlPassword = process.env.MARINA_MYSQL_PASSWORD || "DavidG2023";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf"
};

fsSync.mkdirSync(dataDir, { recursive: true });
fsSync.mkdirSync(backupDir, { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS reservations (
    key TEXT PRIMARY KEY,
    order_index INTEGER NOT NULL,
    id TEXT NOT NULL,
    guest TEXT NOT NULL,
    group_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);
  CREATE INDEX IF NOT EXISTS idx_reservations_guest ON reservations(guest);
  CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    group_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    pricing_mode TEXT NOT NULL,
    adult_price REAL NOT NULL DEFAULT 0,
    child_price REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_units_group ON units(group_name);
  CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stationing (
    key TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    caravan TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_stationing_dates ON stationing(start_date, end_date);
  CREATE INDEX IF NOT EXISTS idx_stationing_owner ON stationing(owner);
  CREATE TABLE IF NOT EXISTS bar_articles (
    key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stock REAL NOT NULL DEFAULT 0,
    vat_rate INTEGER NOT NULL DEFAULT 21,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_bar_articles_name ON bar_articles(name);
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_key TEXT,
    entity_label TEXT,
    message TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    method TEXT,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
`);

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function reservationRows() {
  return db
    .prepare("SELECT data FROM reservations ORDER BY order_index ASC")
    .all()
    .map((row) => JSON.parse(row.data));
}

function unitRows() {
  return db
    .prepare("SELECT data FROM units ORDER BY group_name ASC, id ASC")
    .all()
    .map((row) => JSON.parse(row.data));
}

function configRow() {
  const row = db.prepare("SELECT data FROM app_config WHERE key = ?").get("app");
  return row ? JSON.parse(row.data) : {};
}

function stationingRows() {
  return db
    .prepare("SELECT data FROM stationing ORDER BY start_date DESC, owner ASC")
    .all()
    .map((row) => JSON.parse(row.data));
}

function barArticleRows() {
  return db
    .prepare("SELECT data FROM bar_articles ORDER BY name ASC")
    .all()
    .map((row) => JSON.parse(row.data));
}

function activityLogRows(limit = 1000) {
  return db
    .prepare("SELECT data FROM activity_log ORDER BY timestamp DESC LIMIT ?")
    .all(Math.max(1, Math.min(5000, Number(limit || 1000))))
    .map((row) => JSON.parse(row.data));
}

function normalizeActivityLogEntry(entry = {}) {
  const timestamp = entry.timestamp || new Date().toISOString();
  const eventType = String(entry.eventType || entry.event_type || "event").trim() || "event";
  const entityType = String(entry.entityType || entry.entity_type || "app").trim() || "app";
  const entityKey = String(entry.entityKey || entry.entity_key || "").trim();
  const entityLabel = String(entry.entityLabel || entry.entity_label || "").trim();
  const message = String(entry.message || "").trim() || "Activitate înregistrată";
  const amount = Math.max(0, Number(entry.amount || 0));
  const method = String(entry.method || "").trim();
  const data = entry.data && typeof entry.data === "object" ? entry.data : {};

  return {
    id: String(entry.id || `log-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    timestamp,
    eventType,
    entityType,
    entityKey,
    entityLabel,
    message,
    amount,
    method,
    data
  };
}

function addActivityLogEntry(entry) {
  const normalized = normalizeActivityLogEntry(entry);
  const result = db.prepare(`
    INSERT OR IGNORE INTO activity_log (id, timestamp, event_type, entity_type, entity_key, entity_label, message, amount, method, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    normalized.id,
    normalized.timestamp,
    normalized.eventType,
    normalized.entityType,
    normalized.entityKey,
    normalized.entityLabel,
    normalized.message,
    normalized.amount,
    normalized.method,
    JSON.stringify(normalized)
  );
  return { entry: normalized, inserted: result.changes > 0 };
}

async function writeActivityLogLocalFiles(entries, options = {}) {
  if (entries.length) {
    const jsonlLines = entries.map((entry) => JSON.stringify(entry)).join(os.EOL);
    await fs.appendFile(activityLogJsonlPath, `${jsonlLines}${os.EOL}`, "utf8");
  }
  if (!entries.length && !options.refreshSnapshot) return;
  await fs.writeFile(activityLogJsonPath, `${JSON.stringify(activityLogRows(5000), null, 2)}${os.EOL}`, "utf8");
}

function stationingEndDate(record) {
  const startDate = String(record.startDate || "");
  const prepaidNights = Math.max(1, Number(record.prepaidNights || 1));
  const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate)
    ? new Date(...startDate.split("-").map((value, index) => Number(value) - (index === 1 ? 1 : 0)))
    : new Date();
  start.setDate(start.getDate() + prepaidNights);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function replaceDatabaseData(stays, config, units = [], stationing = [], barArticles = []) {
  const now = new Date().toISOString();
  const insertReservation = db.prepare(`
    INSERT INTO reservations (key, order_index, id, guest, group_name, kind, start_date, end_date, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertUnit = db.prepare(`
    INSERT INTO units (id, group_name, kind, pricing_mode, adult_price, child_price, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertConfig = db.prepare(`
    INSERT INTO app_config (key, updated_at, data)
    VALUES ('app', ?, ?)
    ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data
  `);
  const insertStationing = db.prepare(`
    INSERT INTO stationing (key, owner, caravan, start_date, end_date, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertBarArticle = db.prepare(`
    INSERT INTO bar_articles (key, name, stock, vat_rate, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM reservations");
    stays.forEach((stay, index) => {
      insertReservation.run(
        String(stay.key || `${stay.id}-${index}`),
        index,
        String(stay.id || ""),
        String(stay.guest || ""),
        String(stay.group || ""),
        String(stay.kind || ""),
        stay.start || null,
        stay.end || null,
        now,
        JSON.stringify(stay)
      );
    });
    db.exec("DELETE FROM units");
    units.forEach((unit) => {
      insertUnit.run(
        String(unit.id || ""),
        String(unit.group || ""),
        String(unit.kind || ""),
        unit.pricingMode === "per-person-night" ? "per-person-night" : "per-night",
        Number(unit.adultPrice || 0),
        Number(unit.childPrice || 0),
        now,
        JSON.stringify(unit)
      );
    });
    db.exec("DELETE FROM stationing");
    stationing.forEach((record, index) => {
      const key = String(record.key || `stationing-${index}`);
      const startDate = String(record.startDate || now.slice(0, 10));
      insertStationing.run(
        key,
        String(record.owner || ""),
        String(record.caravan || ""),
        startDate,
        stationingEndDate({ ...record, startDate }),
        now,
        JSON.stringify({ ...record, key, startDate })
      );
    });
    db.exec("DELETE FROM bar_articles");
    barArticles.forEach((article, index) => {
      const key = String(article.key || `bar-${index}`);
      insertBarArticle.run(
        key,
        String(article.name || "Articol"),
        Number(article.stock || 0),
        Number(article.vatRate || article.vat_rate || 21),
        now,
        JSON.stringify({ ...article, key })
      );
    });
    upsertConfig.run(now, JSON.stringify(config || {}));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function migrateLegacyJsonIfNeeded() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM reservations").get().count;
  if (count > 0) return;

  const stays = await readJson(legacyReservationsIndexPath, null);
  if (!Array.isArray(stays)) return;

  const config = await readJson(legacyConfigPath, {});
  replaceDatabaseData(stays, config);
}

async function readData() {
  await migrateLegacyJsonIfNeeded();
  return {
    stays: reservationRows(),
    units: unitRows(),
    stationing: stationingRows(),
    barArticles: barArticleRows(),
    config: configRow(),
    database: {
      type: "sqlite",
      path: "data/marina-park.sqlite"
    }
  };
}

function requestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function tableCount(tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}

function payloadArray(payload, key, options = {}) {
  const hasValue = Object.prototype.hasOwnProperty.call(payload || {}, key);
  const value = payload?.[key];
  const fallback = options.fallback;
  const arrayValue = hasValue ? value : fallback;
  if (!arrayValue) {
    throw requestError(400, `Payload invalid: '${key}' trebuie să fie o listă.`);
  }
  if (!Array.isArray(arrayValue)) {
    throw requestError(400, `Payload invalid: '${key}' trebuie să fie o listă.`);
  }

  const invalidIndex = arrayValue.findIndex((item) => !item || typeof item !== "object" || Array.isArray(item));
  if (invalidIndex >= 0) {
    throw requestError(400, `Payload invalid: '${key}[${invalidIndex}]' trebuie să fie obiect.`);
  }

  return arrayValue;
}

function ensureRequiredField(items, key, fieldName) {
  const invalidIndex = items.findIndex((item) => !String(item[fieldName] || "").trim());
  if (invalidIndex >= 0) {
    throw requestError(400, `Payload invalid: '${key}[${invalidIndex}].${fieldName}' lipsește.`);
  }
}

function allowEmptyReplacement(payload, key) {
  const setting = payload?.allowEmptyCollections;
  return setting === true || (Array.isArray(setting) && setting.includes(key));
}

function preventAccidentalWipe(payload, key, tableName, nextRows) {
  const existingRows = tableCount(tableName);
  if (existingRows > 0 && nextRows.length === 0 && !allowEmptyReplacement(payload, key)) {
    throw requestError(
      409,
      `Refuz să înlocuiesc ${existingRows} înregistrări din '${key}' cu o listă goală fără confirmare explicită.`
    );
  }
}

async function writeData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw requestError(400, "Payload invalid: corpul cererii trebuie să fie obiect JSON.");
  }

  const submittedConfig = payload.config && typeof payload.config === "object" && !Array.isArray(payload.config)
    ? payload.config
    : {};
  const { units: discardedUnits, ...config } = submittedConfig;
  const stays = payloadArray(payload, "stays");
  const units = payloadArray(payload, "units", { fallback: discardedUnits });
  const stationing = payloadArray(payload, "stationing");
  const barArticles = payloadArray(payload, "barArticles");
  ensureRequiredField(stays, "stays", "id");
  ensureRequiredField(units, "units", "id");
  ensureRequiredField(barArticles, "barArticles", "name");
  preventAccidentalWipe(payload, "stays", "reservations", stays);
  preventAccidentalWipe(payload, "units", "units", units);
  preventAccidentalWipe(payload, "stationing", "stationing", stationing);
  preventAccidentalWipe(payload, "barArticles", "bar_articles", barArticles);
  const currentConfig = configRow();
  const baseSavedAt = String(payload.baseSavedAt || "");
  if (baseSavedAt && currentConfig.savedAt && baseSavedAt !== currentConfig.savedAt) {
    const error = new Error("Baza de date locală a fost modificată în altă fereastră. Reîncarcă aplicația înainte de salvare.");
    error.statusCode = 409;
    throw error;
  }

  const nextConfig = {
    ...config,
    savedAt: config.savedAt || new Date().toISOString()
  };
  replaceDatabaseData(stays, nextConfig, units, stationing, barArticles);
  await enqueueDatabaseBackup({ afterMutation: true });
  return { savedAt: nextConfig.savedAt };
}

async function exportedDatabaseFile() {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  const body = await fs.readFile(databasePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    body,
    filename: `marina-park-database-${timestamp}.sqlite`
  };
}

async function clearActivityLogData() {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM activity_log");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  await fs.writeFile(activityLogJsonPath, "[]\n", "utf8");
  await fs.writeFile(activityLogJsonlPath, "", "utf8");
  return { ok: true, clearedAt: new Date().toISOString() };
}

function receiptAmount(value) {
  const normalizedValue = typeof value === "string" ? value.replace(/\s+/g, "").replace(",", ".") : value;
  const amount = Number(normalizedValue || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Suma pentru bon este invalidă");
  }

  return amount.toFixed(2);
}

function receiptNumber(value) {
  const normalizedValue = typeof value === "string" ? value.replace(/\s+/g, "").replace(",", ".") : value;
  const number = Number(normalizedValue || 0);
  return Number.isFinite(number) ? number : 0;
}

function receiptVat(value) {
  const rawValue = String(value || "19").trim();
  const numericValue = rawValue.replace("%", "").trim();
  return `${numericValue || "19"}%`;
}

function cleanReceiptText(value, fallback = "Articol") {
  const normalized = String(value || fallback)
    .replace(/[;%\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (normalized || fallback).slice(0, 72);
}

function receiptQuantity(value) {
  const quantity = Number(value || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Cantitatea pentru bon este invalidă");
  }
  return quantity.toFixed(3);
}

function receiptVatRate(value) {
  const rate = Number(value);
  if (![11, 21].includes(rate)) {
    throw new Error("TVA invalid pentru articol");
  }
  return `${rate}%`;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlTag(name, value = "") {
  return `<${name}>${xmlEscape(value)}</${name}>`;
}

function money(value) {
  return receiptNumber(value).toFixed(2);
}

function sagaNumber(value, decimals = 2) {
  return receiptNumber(value).toFixed(decimals);
}

function quantity(value) {
  return receiptNumber(value).toFixed(3);
}

function localDateText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localWeekKey(date = new Date()) {
  const cursor = new Date(date);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 3 - ((cursor.getDay() + 6) % 7));
  const weekOne = new Date(cursor.getFullYear(), 0, 4);
  weekOne.setDate(weekOne.getDate() + 3 - ((weekOne.getDay() + 6) % 7));
  const week = 1 + Math.round((cursor.getTime() - weekOne.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${cursor.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyCurrentDatabase(targetPath) {
  await fs.mkdir(backupDir, { recursive: true });
  db.exec("PRAGMA wal_checkpoint(FULL)");
  await fs.copyFile(databasePath, targetPath);
}

async function refreshDatabaseBackups(options = {}) {
  const now = new Date();
  const today = localDateText(now);
  const week = localWeekKey(now);
  const meta = await readJson(backupMetaPath, {});
  const afterMutation = Boolean(options.afterMutation);
  const dailyMissing = !(await fileExists(dailyBackupPath));
  const weeklyMissing = !(await fileExists(weeklyBackupPath));
  const shouldWriteDaily = afterMutation || dailyMissing || meta.dailyDate !== today;
  const shouldWriteWeekly = afterMutation || weeklyMissing || meta.weeklyWeek !== week;
  const nextMeta = { ...meta };

  if (shouldWriteDaily) {
    await copyCurrentDatabase(dailyBackupPath);
    nextMeta.dailyDate = today;
    nextMeta.dailySavedAt = now.toISOString();
    nextMeta.dailyFile = path.relative(rootDir, dailyBackupPath);
  }

  if (shouldWriteWeekly) {
    await copyCurrentDatabase(weeklyBackupPath);
    nextMeta.weeklyWeek = week;
    nextMeta.weeklySavedAt = now.toISOString();
    nextMeta.weeklyFile = path.relative(rootDir, weeklyBackupPath);
  }

  if (shouldWriteDaily || shouldWriteWeekly) {
    await fs.writeFile(backupMetaPath, `${JSON.stringify(nextMeta, null, 2)}${os.EOL}`, "utf8");
  }

  return nextMeta;
}

let backupQueue = Promise.resolve();
let backupsPausedAfterClear = false;

function enqueueDatabaseBackup(options = {}) {
  if (backupsPausedAfterClear && !options.afterMutation) {
    return Promise.resolve(null);
  }
  if (options.afterMutation) {
    backupsPausedAfterClear = false;
  }
  backupQueue = backupQueue
    .catch(() => {})
    .then(() => refreshDatabaseBackups(options))
    .catch((error) => {
      console.error("Database backup failed:", error.message);
      return null;
    });
  return backupQueue;
}

function sagaDate(value) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    ? new Date(...String(value).split("-").map((part, index) => Number(part) - (index === 1 ? 1 : 0)))
    : new Date(value || Date.now());
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function compactDate(value) {
  return String(value || localDateText()).replace(/-/g, "");
}

function safeFilePart(value, fallback = "BAR") {
  const sanitized = String(value || "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return sanitized || fallback;
}

function activityLocalDate(entry) {
  const date = new Date(entry.timestamp || Date.now());
  return Number.isFinite(date.getTime()) ? localDateText(date) : localDateText();
}

function barSalesEntriesForRange(fromDate, toDate, includeAll) {
  return activityLogRows(5000).filter((entry) => {
    if (entry.eventType !== "payment" || entry.entityType !== "bar") return false;
    if (!Array.isArray(entry.data?.items) || !entry.data.items.length) return false;
    if (includeAll) return true;
    const saleDate = activityLocalDate(entry);
    if (fromDate && saleDate < fromDate) return false;
    if (toDate && saleDate > toDate) return false;
    return true;
  });
}

function normalizedFilterText(value) {
  return removeDiacritics(String(value || "").trim().toLowerCase());
}

function groupedBarSaleLines(entries, filters = {}) {
  const groups = new Map();
  const payments = { card: 0, numerar: 0, voucher: 0, other: 0 };
  const productNameFilter = normalizedFilterText(filters.productName);
  const vatFilter = String(filters.vatRate || "").trim();
  const sgrName = "AMBALAJ SGR";
  const sgrNameFilterText = normalizedFilterText(sgrName);

  entries.forEach((entry) => {
    const method = ["card", "numerar", "voucher"].includes(entry.method) ? entry.method : "other";
    let includedPaymentTotal = 0;
    entry.data.items.forEach((item) => {
      const name = cleanReceiptText(item.name);
      const nameFilterText = normalizedFilterText(name);
      const vatRate = Number(item.vatRate || 0);
      const grossUnit = receiptNumber(item.price);
      const qty = receiptNumber(item.quantity);
      if (!name || qty <= 0 || grossUnit <= 0) return;

      const grossTotal = grossUnit * qty;
      const productMatchesName = !productNameFilter || nameFilterText.includes(productNameFilter);
      const productMatchesVat = !vatFilter || String(vatRate) === vatFilter;
      if (productMatchesName && productMatchesVat) {
        const netTotal = vatRate > 0 ? grossTotal / (1 + vatRate / 100) : grossTotal;
        const vatTotal = grossTotal - netTotal;
        const key = `${name}::${vatRate}::${money(grossUnit)}`;
        const group = groups.get(key) || { name, vatRate, unitGross: grossUnit, quantity: 0, grossTotal: 0, netTotal: 0, vatTotal: 0 };
        group.quantity += qty;
        group.grossTotal += grossTotal;
        group.netTotal += netTotal;
        group.vatTotal += vatTotal;
        groups.set(key, group);
        includedPaymentTotal += grossTotal;
      }

      const sgrTotal = receiptNumber(item.sgrTotal ?? (item.hasSgr ? 0.5 * qty : 0));
      const sgrMatchesName = !productNameFilter || nameFilterText.includes(productNameFilter) || sgrNameFilterText.includes(productNameFilter);
      const sgrMatchesVat = !vatFilter || vatFilter === "0";
      if (sgrTotal > 0 && sgrMatchesName && sgrMatchesVat) {
        const sgrKey = `${sgrName}::0::0.50`;
        const sgrGroup = groups.get(sgrKey) || { name: sgrName, vatRate: 0, unitGross: 0.5, quantity: 0, grossTotal: 0, netTotal: 0, vatTotal: 0 };
        sgrGroup.quantity += qty;
        sgrGroup.grossTotal += sgrTotal;
        sgrGroup.netTotal += sgrTotal;
        groups.set(sgrKey, sgrGroup);
        includedPaymentTotal += sgrTotal;
      }
    });
    payments[method] += includedPaymentTotal;
  });

  return {
    lines: [...groups.values()].sort(
      (first, second) =>
        first.name.localeCompare(second.name, "ro-RO", { numeric: true }) ||
        first.vatRate - second.vatRate ||
        first.unitGross - second.unitGross
    ),
    payments
  };
}

function buildSagaBarSalesXml(options = {}) {
  const includeAll = options.all === "1" || options.all === "true";
  const todayText = localDateText();
  const fromDate = includeAll ? "" : String(options.from || todayText);
  const toDate = includeAll ? "" : String(options.to || fromDate || todayText);
  const exportDate = includeAll ? todayText : toDate || todayText;
  const companyCif = String(options.companyCif || "INTRODU_CIF").trim();
  const companyName = String(options.companyName || "Marina Park").trim();
  const clientName = String(options.clientName || "Client generic bar").trim();
  const documentNumber = safeFilePart(options.documentNumber || `BAR-${includeAll ? "ALL" : `${compactDate(fromDate)}-${compactDate(toDate)}`}`);
  const productName = String(options.productName || "").trim();
  const vatRate = ["0", "11", "21"].includes(String(options.vatRate || "")) ? String(options.vatRate) : "";
  const entries = barSalesEntriesForRange(fromDate, toDate, includeAll);
  const grouped = groupedBarSaleLines(entries, { productName, vatRate });

  if (!grouped.lines.length) {
    const error = new Error("Nu există vânzări de bar pentru perioada și filtrele alese");
    error.statusCode = 404;
    throw error;
  }

  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;
  const lineXml = grouped.lines
    .map((line, index) => {
      const lineGross = Math.round(line.grossTotal * 100) / 100;
      const lineNet = line.vatRate > 0 ? Math.round((lineGross / (1 + line.vatRate / 100)) * 100) / 100 : lineGross;
      const lineVat = Math.round((lineGross - lineNet) * 100) / 100;
      totalNet += lineNet;
      totalVat += lineVat;
      totalGross += lineGross;
      const unitNet = line.quantity > 0 ? lineNet / line.quantity : 0;
      const articleCode = safeFilePart(`${line.name}-${line.vatRate}-${money(line.unitGross)}`, "ART");
      return [
        "<Linie>",
        xmlTag("LinieNrCrt", index + 1),
        xmlTag("Descriere", line.name),
        xmlTag("CodArticolClient", articleCode),
        xmlTag("GUID_cod_articol", `MARINA-BAR-${articleCode}`),
        xmlTag("InformatiiSuplimentare", `Pret vanzare cu TVA: ${money(line.unitGross)} lei`),
        xmlTag("UM", "BUC"),
        xmlTag("Cantitate", quantity(line.quantity)),
        xmlTag("Pret", sagaNumber(unitNet, 4)),
        xmlTag("Valoare", money(lineNet)),
        xmlTag("ProcTVA", line.vatRate),
        xmlTag("TVA", money(lineVat)),
        xmlTag("Cont", line.vatRate === 0 ? "7588" : "707"),
        "</Linie>"
      ].join("");
    })
    .join("");

  const periodLabel = includeAll ? "toate vanzarile" : `${fromDate} - ${toDate}`;
  const info = [
    `Export iesiri bar ${periodLabel}`,
    productName ? `Filtru produs: ${productName}` : "",
    vatRate ? `Filtru TVA: ${vatRate}%` : "",
    `Bonuri/plati incluse: ${entries.length}`,
    `Card: ${money(grouped.payments.card)}`,
    `Numerar: ${money(grouped.payments.numerar)}`,
    `Voucher: ${money(grouped.payments.voucher)}`
  ].filter(Boolean).join("; ");
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Facturi>",
    "<Factura>",
    "<Antet>",
    xmlTag("FurnizorNume", companyName),
    xmlTag("FurnizorCIF", companyCif),
    xmlTag("FurnizorTara", "RO"),
    xmlTag("ClientNume", clientName),
    xmlTag("ClientCIF", ""),
    xmlTag("ClientTara", "RO"),
    xmlTag("FacturaNumar", documentNumber),
    xmlTag("FacturaData", sagaDate(exportDate)),
    xmlTag("FacturaScadenta", sagaDate(exportDate)),
    xmlTag("FacturaTaxareInversa", "Nu"),
    xmlTag("FacturaTVAIncasare", "Nu"),
    xmlTag("FacturaTip", "B"),
    xmlTag("FacturaInformatiiSuplimentare", info),
    xmlTag("FacturaMoneda", "RON"),
    "</Antet>",
    "<Detalii><Continut>",
    lineXml,
    "</Continut></Detalii>",
    "<Sumar>",
    xmlTag("TotalValoare", money(totalNet)),
    xmlTag("TotalTVA", money(totalVat)),
    xmlTag("Total", money(totalGross)),
    "</Sumar>",
    "<Observatii>",
    xmlTag("txtObservatii", info),
    xmlTag("SoldClient", money(totalGross)),
    "</Observatii>",
    xmlTag("FacturaID", `MARINA-BAR-${documentNumber}`),
    "</Factura>",
    "</Facturi>"
  ].join(os.EOL);
  const filename = `F_${safeFilePart(companyCif, "CIF")}_${documentNumber}_${compactDate(exportDate)}.xml`;

  return { xml, filename, entries: entries.length, lines: grouped.lines.length, total: money(totalGross) };
}

async function receiptDirectoryFor(config = {}) {
  const receiptDirectory = String(config.receiptDirectory || "").trim();
  if (!receiptDirectory) {
    throw new Error("Nu a fost ales directorul pentru generarea bonurilor");
  }

  if (!path.isAbsolute(receiptDirectory)) {
    throw new Error("Directorul pentru bonuri trebuie să fie o cale absolută");
  }

  const resolvedDirectory = path.resolve(receiptDirectory);
  const stat = await fs.stat(resolvedDirectory).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error("Directorul pentru bonuri nu există");
  }

  return resolvedDirectory;
}

async function appendReceiptInfoLine(line) {
  const infoDir = path.join(rootDir, "bin");
  await fs.mkdir(infoDir, { recursive: true });
  await fs.appendFile(path.join(infoDir, "info.txt"), `${line}${os.EOL}`, "utf8");
  return path.join(infoDir, "info.txt");
}

function receiptTimestampLabel() {
  const now = new Date();
  return {
    date: new Intl.DateTimeFormat("ro-RO").format(now),
    time: new Intl.DateTimeFormat("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(now)
  };
}

async function writeAccommodationReceipt(payload) {
  const stay = payload.stay || {};
  const config = payload.receiptConfig || {};
  const resolvedDirectory = await receiptDirectoryFor(config);
  const method = payload.method === "numerar" ? "numerar" : "card";
  const paymentCode = method === "card" ? String(config.cardPaymentCode || "1") : String(config.cashPaymentCode || "0");
  const amount = receiptAmount(payload.amount);
  const vat = receiptVat(config.receiptVat);
  const receiptPath = path.join(resolvedDirectory, "bon.inp");
  const receiptLines = [
    `S,1,______,_,__;CAZARE;${amount};1.000;1;1;${vat};0;0;buc`,
    `T,1,______,_,__;${paymentCode};${amount};;;;`
  ];

  const { date, time } = receiptTimestampLabel();
  const methodLabel = method === "card" ? "cardul" : "numerar";
  const logLine = `${String(stay.guest || "Client")} a plătit ~${amount}~ lei cu ${methodLabel} la '${date}' +${time}+ (inițial ${receiptAmount(stay.price || payload.amount)} lei)`;
  const logPath = await appendReceiptInfoLine(logLine);
  await fs.writeFile(receiptPath, `${receiptLines.join(os.EOL)}${os.EOL}`, "utf8");

  return {
    ok: true,
    file: receiptPath,
    log: logPath
  };
}

async function writeBarReceipt(payload) {
  const config = payload.receiptConfig || {};
  const resolvedDirectory = await receiptDirectoryFor(config);
  const method = payload.method === "numerar" ? "numerar" : "card";
  const paymentCode = method === "card" ? String(config.cardPaymentCode || "1") : String(config.cashPaymentCode || "0");
  const sale = payload.sale || {};
  const items = Array.isArray(sale.items) ? sale.items : [];
  if (!items.length) {
    throw new Error("Nu există articole pentru bon");
  }
  if (receiptNumber(sale.total ?? payload.amount) <= 0) {
    throw new Error("Totalul bonului de bar este 0. Verifică prețul articolelor din Bar.");
  }

  let productsTotal = 0;
  let sgrTotal = 0;
  const receiptLines = [];
  items.forEach((item) => {
    const name = cleanReceiptText(item.name);
    const quantity = receiptNumber(item.quantity);
    const unitPrice = receiptNumber(item.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`Cantitate invalidă pentru ${name}`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new Error(`Preț invalid pentru ${name}`);
    }
    productsTotal += unitPrice * quantity;
    if (item.hasSgr) {
      sgrTotal += 0.5 * quantity;
    }
    receiptLines.push(`S,1,______,_,__;${name};${receiptAmount(unitPrice)};${receiptQuantity(quantity)};1;1;${receiptVatRate(item.vatRate)};0;0;buc`);
  });

  const normalizedSgrTotal = receiptNumber(sale.sgrTotal ?? sgrTotal);
  if (normalizedSgrTotal > 0) {
    receiptLines.push(`S,1,______,_,__;AMBALAJ SGR;${receiptAmount(normalizedSgrTotal)};1.000;1;1;0%;0;0;buc`);
  }

  const computedTotal = Math.round((productsTotal + normalizedSgrTotal) * 100) / 100;
  const amount = receiptAmount(sale.total ?? computedTotal);
  if (Number(amount) !== computedTotal) {
    throw new Error("Totalul bonului de bar nu corespunde articolelor");
  }

  receiptLines.push(`T,1,______,_,__;${paymentCode};${amount};;;;`);

  const receiptPath = path.join(resolvedDirectory, "bon.inp");
  await fs.writeFile(receiptPath, `${receiptLines.join(os.EOL)}${os.EOL}`, "utf8");

  const { date, time } = receiptTimestampLabel();
  const methodLabel = method === "card" ? "cardul" : "numerar";
  const itemLabel = items.map((item) => `${cleanReceiptText(item.name)} x${Number(item.quantity || 0)}`).join(", ");
  const logPath = await appendReceiptInfoLine(`Bar: ${itemLabel} - total ~${amount}~ lei cu ${methodLabel} la '${date}' +${time}+`);

  return {
    ok: true,
    file: receiptPath,
    log: logPath
  };
}

async function writeReceipt(payload) {
  if (payload?.type === "bar" || Array.isArray(payload?.sale?.items)) {
    return writeBarReceipt(payload);
  }

  return writeAccommodationReceipt(payload);
}

function removeDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseBookingForm(formText) {
  const fields = {};
  String(formText || "")
    .split("~")
    .forEach((entry) => {
      const parts = entry.split("^");
      if (parts.length < 3) return;
      const key = parts[1];
      const value = parts.slice(2).join("^").trim();
      if (key) fields[key] = value;
    });

  const firstName = Object.entries(fields).find(([key]) => key.startsWith("name"))?.[1] || "";
  const lastName = Object.entries(fields).find(([key]) => key.startsWith("secondname"))?.[1] || "";
  const fieldValue = (prefix) => Object.entries(fields).find(([key]) => key.startsWith(prefix))?.[1] || "";

  return {
    guest: removeDiacritics(`${firstName} ${lastName}`.trim()).trim(),
    car: fieldValue("car"),
    phone: fieldValue("phone"),
    costHint: fieldValue("cost_hint"),
    nights: fieldValue("nights_number"),
    adults: fieldValue("visitors"),
    children: fieldValue("children"),
    datesText: fieldValue("selected_short"),
    fields
  };
}

function isTruthyBookingValue(value) {
  const normalized = removeDiacritics(value).toLowerCase().trim();
  if (!normalized) return false;
  if (/^(0|nu|no|false|fara|none|off|n\/a|-)$/.test(normalized)) return false;
  if (/\b(nu|no|fara|without)\b/.test(normalized)) return false;
  return /^(1|da|yes|true|on)$/.test(normalized) || /[1-9]/.test(normalized) || normalized.length > 1;
}

function detectRequestedFacilities(form, mode) {
  const textMatches = (key, value, pattern) => pattern.test(removeDiacritics(`${key} ${value}`).toLowerCase());
  const facilities = [];
  const entries = Object.entries(form.fields || {});

  const hasElectricity =
    mode === "camping" &&
    entries.some(([key, value]) => textMatches(key, value, /electric|curent|energie|priza|220/) && isTruthyBookingValue(value));

  const hasExtraBed =
    mode === "room" &&
    entries.some(([key, value]) => textMatches(key, value, /extra|pat|bed|suplimentar/) && isTruthyBookingValue(value));

  if (hasElectricity) {
    facilities.push({
      key: "electricitate",
      name: "Electricitate",
      pricePerNight: 20,
      includedInBasePrice: true,
      source: "mysql"
    });
  }

  if (hasExtraBed) {
    facilities.push({
      key: "pat-suplimentar",
      name: "Pat suplimentar",
      pricePerNight: 15,
      includedInBasePrice: true,
      source: "mysql"
    });
  }

  return facilities;
}

const roMonthNumbers = {
  ian: 0,
  ianuarie: 0,
  feb: 1,
  februarie: 1,
  mar: 2,
  martie: 2,
  apr: 3,
  aprilie: 3,
  mai: 4,
  iun: 5,
  iunie: 5,
  iul: 6,
  iulie: 6,
  aug: 7,
  august: 7,
  sep: 8,
  septembrie: 8,
  oct: 9,
  octombrie: 9,
  noi: 10,
  noiembrie: 10,
  dec: 11,
  decembrie: 11
};

function toISODateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseRomanianDateRange(text) {
  const normalized = removeDiacritics(text).toLowerCase();
  const regex = /([0-9]{1,2})\s+(ian(?:uarie)?|feb(?:ruarie)?|mar(?:tie)?|apr(?:ilie)?|mai|iun(?:ie)?|iul(?:ie)?|aug(?:ust)?|sep(?:tembrie)?|oct(?:ombrie)?|noi(?:embrie)?|dec(?:embrie)?)\s+([0-9]{4})/g;
  const matches = [...normalized.matchAll(regex)];
  if (matches.length < 2) return null;

  const parsed = matches.slice(0, 2).map((match) => {
    const day = Number(match[1]);
    const month = roMonthNumbers[match[2]];
    const year = Number(match[3]);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
    return new Date(Date.UTC(year, month, day));
  });

  if (!parsed[0] || !parsed[1]) return null;
  return {
    start: toISODateOnly(parsed[0]),
    end: toISODateOnly(parsed[1])
  };
}

function parseMoney(value) {
  const normalized = String(value || "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  const match = normalized.match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]).toFixed(2) : "0.00";
}

function parseRoomPrices(remark) {
  const numbers = String(remark || "").match(/[0-9]+(?:[.,][0-9]+)?/g) || [];
  return {
    initialTotal: numbers[0] ? parseMoney(numbers[0]) : "0.00",
    deposit: numbers[1] ? parseMoney(numbers[1]) : "0.00",
    price: numbers[2] ? parseMoney(numbers[2]) : "0.00"
  };
}

function dateValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function modifiedValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function sortSourceBookings(first, second) {
  const todayText = localISODate();
  const todayValue = dateValue(todayText);
  const firstStart = dateValue(first.start);
  const secondStart = dateValue(second.start);
  const firstGroup = first.start === todayText ? 0 : firstStart > todayValue ? 1 : 2;
  const secondGroup = second.start === todayText ? 0 : secondStart > todayValue ? 1 : 2;

  if (firstGroup !== secondGroup) return firstGroup - secondGroup;

  const startCompare = firstGroup === 2 ? secondStart - firstStart : firstStart - secondStart;
  if (startCompare !== 0) return startCompare;

  return modifiedValue(second.modifiedAt) - modifiedValue(first.modifiedAt);
}

const bookingTypeMap = {
  6: { kind: "Cameră cvadruplă", unitHint: "cvdr 1" },
  7: { kind: "Cameră cvadruplă", unitHint: "cvdr 4" },
  8: { kind: "Cameră dublă", unitHint: "dubla 2" },
  9: { kind: "Cameră dublă", unitHint: "dubla 3" },
  10: { kind: "Cameră dublă", unitHint: "dubla 5" },
  11: { kind: "Cameră dublă", unitHint: "dubla 6" },
  12: { kind: "Cameră dublă", unitHint: "dubla 7" },
  13: { kind: "Cameră dublă", unitHint: "dubla 8" },
  14: { kind: "Bungalou", unitHint: "bungalow 9" },
  17: { kind: "Bungalou", unitHint: "bungalow 10" },
  18: { kind: "Bungalou", unitHint: "bungalow 11" },
  19: { kind: "Bungalou", unitHint: "bungalow 12" },
  20: { kind: "Bungalou", unitHint: "bungalow 14" },
  21: { kind: "Bungalou", unitHint: "bungalow 15" },
  22: { kind: "Bungalou", unitHint: "bungalow 16" },
  23: { kind: "Bungalou", unitHint: "bungalow 17" },
  24: { kind: "Bungalou", unitHint: "bungalow 18" },
  25: { kind: "Bungalou", unitHint: "bungalow 19" },
  26: { kind: "Bungalou", unitHint: "bungalow 20" },
  27: { kind: "Bungalou", unitHint: "bungalow 21" }
};

async function fetchSourceBookings(mode) {
  const isCamping = mode === "camping";
  const connection = await mysql.createConnection({
    host: mysqlHost,
    user: mysqlUser,
    password: mysqlPassword,
    database: isCamping ? "marina_camping" : "marina",
    connectTimeout: 10000
  });

  try {
    const [rows] = await connection.execute(
      isCamping
        ? "SELECT form, modification_date FROM wp_booking ORDER BY modification_date DESC LIMIT 5000"
        : "SELECT remark, form, cost, booking_type, modification_date FROM wp_booking ORDER BY modification_date DESC LIMIT 5000"
    );

    return rows
      .map((row, index) => {
        const form = parseBookingForm(row.form);
        const range = parseRomanianDateRange(form.datesText);
        if (!range || !form.guest) return null;

        const adults = Number(form.adults || 0);
        const children = Number(form.children || 0);
        const roomType = bookingTypeMap[row.booking_type] || {};
        const roomPrices = isCamping ? null : parseRoomPrices(row.remark);
        const initialTotal = isCamping ? parseMoney(form.costHint) : roomPrices.initialTotal;
        const deposit = isCamping ? "0.00" : roomPrices.deposit;
        const price = isCamping ? initialTotal : Math.max(0, Number(initialTotal) - Number(deposit)).toFixed(2);
        const facilities = detectRequestedFacilities(form, isCamping ? "camping" : "room").map((facility) => ({
          ...facility,
          nights: Math.max(1, Number(form.nights || 0) || 1),
          total: 0
        }));

        return {
          id: index + 1,
          source: isCamping ? "camping" : "camere",
          guest: form.guest,
          phone: form.phone,
          car: form.car,
          adults,
          children,
          party: Math.max(1, adults + children),
          nights: Number(form.nights || 0),
          start: range.start,
          end: range.end,
          datesText: form.datesText,
          basePrice: price,
          facilities,
          price,
          deposit: "0.00",
          balance: price,
          group: isCamping ? "camping" : "room",
          kind: isCamping ? "Camping" : "Camere",
          unitHint: roomType.unitHint || "",
          note: isCamping
            ? form.car
              ? `Mașină: ${form.car}`
              : ""
            : `Total inițial: ${initialTotal} lei\nAvans: ${deposit} lei\nPreț de încasat: ${price} lei${roomType.unitHint ? `\nSugestie: ${roomType.unitHint}` : ""}`,
          modifiedAt: row.modification_date || ""
        };
      })
      .filter(Boolean)
      .sort(sortSourceBookings)
      .slice(0, 300);
  } finally {
    await connection.end();
  }
}

function pickReceiptDirectory() {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Alege directorul pentru bonuri'
$dialog.ShowNewFolderButton = $true
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.SelectedPath
}
`;

  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", script],
      { windowsHide: false, timeout: 120000 },
      (error, stdout) => {
        if (error) {
          if (error.killed) {
            resolve({ ok: false, path: "" });
            return;
          }
          reject(error);
          return;
        }

        resolve({ ok: true, path: stdout.trim() });
      }
    );
  });
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname === "/log" ? "/activity.html" : url.pathname);
  const filePath = path.resolve(rootDir, `.${requestedPath}`);

  if (!filePath.startsWith(rootDir)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    send(response, 200, body, contentTypes[path.extname(filePath)] || "application/octet-stream");
  } catch {
    send(response, 404, "Not found", "text/plain; charset=utf-8");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/data") && request.method === "GET") {
      send(response, 200, JSON.stringify(await readData()));
      return;
    }

    if (request.url.startsWith("/api/data") && request.method === "POST") {
      const result = await writeData(JSON.parse(await requestBody(request)));
      send(response, 200, JSON.stringify({ ok: true, database: "data/marina-park.sqlite", ...result }));
      return;
    }

    if (request.url.startsWith("/api/export-database") && request.method === "GET") {
      const result = await exportedDatabaseFile();
      response.writeHead(200, {
        "Content-Type": "application/vnd.sqlite3",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.body.length
      });
      response.end(result.body);
      return;
    }

    if (
      (request.url.startsWith("/api/clear-activity-log") || request.url.startsWith("/api/clear-database")) &&
      request.method === "POST"
    ) {
      const payload = JSON.parse(await requestBody(request) || "{}");
      if (payload.confirm !== "STERGE LOG") {
        send(response, 400, JSON.stringify({ ok: false, error: "Confirmarea pentru ștergerea jurnalului este invalidă" }));
        return;
      }
      send(response, 200, JSON.stringify(await clearActivityLogData()));
      return;
    }

    if (request.url.startsWith("/api/log") && request.method === "GET") {
      const url = new URL(request.url, `http://${request.headers.host}`);
      send(response, 200, JSON.stringify({ ok: true, entries: activityLogRows(url.searchParams.get("limit")) }));
      return;
    }

    if (request.url.startsWith("/api/log") && request.method === "POST") {
      const payload = JSON.parse(await requestBody(request));
      const entries = Array.isArray(payload.entries) ? payload.entries : [payload];
      const results = entries.map(addActivityLogEntry);
      const saved = results.map((result) => result.entry);
      const inserted = results.filter((result) => result.inserted).map((result) => result.entry);
      await writeActivityLogLocalFiles(inserted, { refreshSnapshot: true });
      await enqueueDatabaseBackup({ afterMutation: true });
      send(response, 200, JSON.stringify({ ok: true, entries: saved }));
      return;
    }

    if (request.url.startsWith("/api/receipt") && request.method === "POST") {
      send(response, 200, JSON.stringify(await writeReceipt(JSON.parse(await requestBody(request)))));
      return;
    }


    if (request.url.startsWith("/api/saga/bar-sales") && request.method === "GET") {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const result = buildSagaBarSalesXml(Object.fromEntries(url.searchParams.entries()));
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.filename}"`
      });
      response.end(result.xml);
      return;
    }

    if (request.url.startsWith("/api/source-bookings") && request.method === "GET") {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const mode = url.searchParams.get("mode") === "camping" ? "camping" : "room";
      send(response, 200, JSON.stringify({ ok: true, bookings: await fetchSourceBookings(mode) }));
      return;
    }

    if (request.url.startsWith("/api/pick-receipt-directory") && request.method === "POST") {
      send(response, 200, JSON.stringify(await pickReceiptDirectory()));
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    send(response, error.statusCode || 500, JSON.stringify({ ok: false, error: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Marina Park app: http://localhost:${port}`);
  console.log("Database: data/marina-park.sqlite");
});

enqueueDatabaseBackup({ reason: "startup" });
const backupInterval = setInterval(() => enqueueDatabaseBackup({ reason: "interval" }), 60 * 60 * 1000);
backupInterval.unref?.();
