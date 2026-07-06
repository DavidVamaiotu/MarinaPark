const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { DatabaseSync } = require("node:sqlite");
const mysql = require("mysql2/promise");

const rootDir = path.resolve(process.env.MARINA_APP_ROOT || __dirname);
const dataDir = path.resolve(process.env.MARINA_DATA_DIR || path.join(rootDir, "data"));
const runtimeDir = path.resolve(process.env.MARINA_RUNTIME_DIR || rootDir);
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
  ".ico": "image/x-icon",
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
  CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    entity_key TEXT NOT NULL,
    method TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL,
    receipt_directory TEXT,
    receipt_content TEXT,
    info_line TEXT,
    result TEXT NOT NULL,
    last_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status, updated_at);
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
    nextMeta.dailyFile = path.relative(dataDir, dailyBackupPath);
  }

  if (shouldWriteWeekly) {
    await copyCurrentDatabase(weeklyBackupPath);
    nextMeta.weeklyWeek = week;
    nextMeta.weeklySavedAt = now.toISOString();
    nextMeta.weeklyFile = path.relative(dataDir, weeklyBackupPath);
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
  const infoDir = path.join(runtimeDir, "bin");
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

function paymentRequestId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)) {
    throw requestError(400, "Identificatorul plății este invalid");
  }
  return id;
}

function normalizedPaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();
  if (!["card", "numerar", "voucher"].includes(method)) {
    throw requestError(400, "Metoda de plată este invalidă");
  }
  return method;
}

function paymentTransactionRow(id) {
  return db.prepare("SELECT * FROM payment_transactions WHERE id = ?").get(id) || null;
}

function parsePaymentResult(row) {
  try {
    return JSON.parse(row?.result || "{}");
  } catch {
    return {};
  }
}

function setPaymentStatus(id, status, error = "") {
  db.prepare(`
    UPDATE payment_transactions
    SET status = ?, last_error = ?, updated_at = ?
    WHERE id = ?
  `).run(status, String(error || ""), new Date().toISOString(), id);
}

async function appendReceiptInfoLineOnce(line, paymentId) {
  if (!line) return "";
  const infoDir = path.join(runtimeDir, "bin");
  const infoPath = path.join(infoDir, "info.txt");
  const marker = `[payment:${paymentId}]`;
  await fs.mkdir(infoDir, { recursive: true });
  const existing = await fs.readFile(infoPath, "utf8").catch(() => "");
  if (!existing.includes(marker)) {
    await fs.appendFile(infoPath, `${line} ${marker}${os.EOL}`, "utf8");
  }
  return infoPath;
}

async function publishPaymentOutbox(paymentId) {
  let row = paymentTransactionRow(paymentId);
  if (!row || row.status === "completed") return row;
  if (row.method === "voucher") {
    setPaymentStatus(paymentId, "completed");
    return paymentTransactionRow(paymentId);
  }

  try {
    if (!["receipt_written", "completed"].includes(row.status)) {
      const directory = await receiptDirectoryFor({ receiptDirectory: row.receipt_directory });
      const receiptPath = path.join(directory, "bon.inp");
      const tempPath = path.join(directory, `.bon-${safeFilePart(paymentId, "payment")}.tmp`);
      await fs.writeFile(tempPath, row.receipt_content, "utf8");
      await fs.rename(tempPath, receiptPath);
      setPaymentStatus(paymentId, "receipt_written");
      row = paymentTransactionRow(paymentId);
    }

    if (row.status === "receipt_written") {
      await appendReceiptInfoLineOnce(row.info_line, paymentId);
      setPaymentStatus(paymentId, "completed");
    }
  } catch (error) {
    setPaymentStatus(paymentId, row.status === "receipt_written" ? "receipt_written" : "receipt_pending", error.message);
  }

  return paymentTransactionRow(paymentId);
}

async function retryPendingPaymentOutbox() {
  const pending = db
    .prepare("SELECT id FROM payment_transactions WHERE status <> 'completed' ORDER BY created_at ASC LIMIT 100")
    .all();
  for (const row of pending) {
    await publishPaymentOutbox(row.id);
  }
}

function bumpPaymentSavedAt(now) {
  const config = { ...configRow(), savedAt: now };
  db.prepare(`
    INSERT INTO app_config (key, updated_at, data)
    VALUES ('app', ?, ?)
    ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data
  `).run(now, JSON.stringify(config));
  return now;
}

function reservationByKey(key) {
  const row = db.prepare("SELECT data FROM reservations WHERE key = ?").get(String(key || ""));
  return row ? JSON.parse(row.data) : null;
}

function stationingByKey(key) {
  const row = db.prepare("SELECT data FROM stationing WHERE key = ?").get(String(key || ""));
  return row ? JSON.parse(row.data) : null;
}

function updateReservationRow(stay, now) {
  const result = db.prepare(`
    UPDATE reservations
    SET id = ?, guest = ?, group_name = ?, kind = ?, start_date = ?, end_date = ?, updated_at = ?, data = ?
    WHERE key = ?
  `).run(
    String(stay.id || ""),
    String(stay.guest || ""),
    String(stay.group || ""),
    String(stay.kind || ""),
    stay.start || null,
    stay.end || null,
    now,
    JSON.stringify(stay),
    String(stay.key || "")
  );
  if (!result.changes) throw requestError(404, `Rezervarea ${stay.key || ""} nu există`);
}

function updateStationingRow(record, now) {
  const startDate = String(record.startDate || now.slice(0, 10));
  const result = db.prepare(`
    UPDATE stationing
    SET owner = ?, caravan = ?, start_date = ?, end_date = ?, updated_at = ?, data = ?
    WHERE key = ?
  `).run(
    String(record.owner || ""),
    String(record.caravan || ""),
    startDate,
    stationingEndDate({ ...record, startDate }),
    now,
    JSON.stringify(record),
    String(record.key || "")
  );
  if (!result.changes) throw requestError(404, `Staționarea ${record.key || ""} nu există`);
}

function coveredReservationAmount(stay) {
  const price = Math.max(0, receiptNumber(stay?.price));
  const explicitSettled = Math.max(0, receiptNumber(stay?.settledPrice ?? stay?.paidThroughPrice));
  if (explicitSettled > 0) return Math.min(price, explicitSettled);
  return stay?.paid === true || stay?.isPaid === true || stay?.paymentStatus === "paid" ? price : 0;
}

function reservationOutstanding(stay) {
  return Math.max(0, Math.round((receiptNumber(stay?.price) - coveredReservationAmount(stay)) * 100) / 100);
}

function allocateProportionally(amount, balances) {
  const amountCents = Math.round(receiptNumber(amount) * 100);
  const weights = balances.map((value) => Math.max(0, Math.round(receiptNumber(value) * 100)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (amountCents <= 0 || totalWeight <= 0) return balances.map(() => 0);
  const distributable = Math.min(amountCents, totalWeight);
  const exactShares = weights.map((weight) => (distributable * weight) / totalWeight);
  const allocated = exactShares.map(Math.floor);
  let remaining = distributable - allocated.reduce((sum, value) => sum + value, 0);
  const remainderOrder = exactShares
    .map((share, index) => ({ index, fraction: share - allocated[index] }))
    .filter(({ index }) => weights[index] > 0)
    .sort((first, second) => second.fraction - first.fraction || first.index - second.index);

  for (const { index } of remainderOrder) {
    if (remaining <= 0) break;
    if (allocated[index] >= weights[index]) continue;
    allocated[index] += 1;
    remaining -= 1;
  }

  return allocated.map((cents) => cents / 100);
}

function accommodationReceiptOutbox(stay, method, amount, config, paymentId) {
  if (method === "voucher") return { receiptDirectory: "", receiptContent: "", infoLine: "" };
  const paymentCode = method === "card" ? String(config.cardPaymentCode || "1") : String(config.cashPaymentCode || "0");
  const normalizedAmount = receiptAmount(amount);
  const vat = receiptVat(config.receiptVat);
  const receiptContent = [
    `S,1,______,_,__;CAZARE;${normalizedAmount};1.000;1;1;${vat};0;0;buc`,
    `T,1,______,_,__;${paymentCode};${normalizedAmount};;;;`
  ].join(os.EOL) + os.EOL;
  const { date, time } = receiptTimestampLabel();
  const methodLabel = method === "card" ? "cardul" : "numerar";
  const infoLine = `${String(stay.guest || "Client")} a plătit ~${normalizedAmount}~ lei cu ${methodLabel} la '${date}' +${time}+ (inițial ${receiptAmount(stay.price || amount)} lei)`;
  return { receiptDirectory: config.receiptDirectory, receiptContent, infoLine, paymentId };
}

function barReceiptOutbox(sale, method, config, paymentId) {
  if (method === "voucher") return { receiptDirectory: "", receiptContent: "", infoLine: "" };
  const paymentCode = method === "card" ? String(config.cardPaymentCode || "1") : String(config.cashPaymentCode || "0");
  const receiptLines = sale.items.map(
    (item) => `S,1,______,_,__;${cleanReceiptText(item.name)};${receiptAmount(item.price)};${receiptQuantity(item.quantity)};1;1;${receiptVatRate(item.vatRate)};0;0;buc`
  );
  if (sale.sgrQuantity > 0) {
    receiptLines.push(`S,1,______,_,__;AMBALAJ SGR;0.50;${receiptQuantity(sale.sgrQuantity)};1;1;0%;0;0;buc`);
  }
  receiptLines.push(`T,1,______,_,__;${paymentCode};${receiptAmount(sale.total)};;;;`);
  const { date, time } = receiptTimestampLabel();
  const methodLabel = method === "card" ? "cardul" : "numerar";
  const itemLabel = sale.items.map((item) => `${cleanReceiptText(item.name)} x${item.quantity}`).join(", ");
  return {
    receiptDirectory: config.receiptDirectory,
    receiptContent: `${receiptLines.join(os.EOL)}${os.EOL}`,
    infoLine: `Bar: ${itemLabel} - total ~${receiptAmount(sale.total)}~ lei cu ${methodLabel} la '${date}' +${time}+`,
    paymentId
  };
}

function prepareBarPayment(payload, context) {
  const requestedItems = Array.isArray(payload.items) ? payload.items : [];
  if (!requestedItems.length) throw requestError(400, "Checkout-ul de bar este gol");
  const articleMap = new Map(barArticleRows().map((article) => [String(article.key || ""), article]));
  const seen = new Set();
  const items = requestedItems.map((requested) => {
    const key = String(requested.key || "");
    if (!key || seen.has(key)) throw requestError(400, "Articole duplicate sau fără identificator în checkout");
    seen.add(key);
    const article = articleMap.get(key);
    if (!article) throw requestError(404, `Articolul ${key} nu mai există`);
    const quantity = Number(requested.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw requestError(400, `Cantitate invalidă pentru ${article.name}`);
    const stock = Math.max(0, Math.floor(Number(article.stock || 0)));
    if (quantity > stock) throw requestError(409, `Stoc insuficient pentru ${article.name}`);
    const price = receiptNumber(article.price);
    if (price <= 0) throw requestError(400, `Preț invalid pentru ${article.name}`);
    const vatRate = Number(article.vatRate || article.vat_rate);
    if (![11, 21].includes(vatRate)) throw requestError(400, `TVA invalid pentru ${article.name}`);
    const hasSgr = article.hasSgr === true || article.hasSgr === "true" || article.hasSgr === 1;
    return {
      key,
      name: String(article.name || "Articol"),
      price,
      quantity,
      vatRate,
      hasSgr,
      subtotal: Math.round(price * quantity * 100) / 100,
      sgrTotal: hasSgr ? Math.round(0.5 * quantity * 100) / 100 : 0,
      previousStock: stock,
      newStock: stock - quantity,
      article
    };
  });
  const productsTotal = Math.round(items.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
  const sgrTotal = Math.round(items.reduce((sum, item) => sum + item.sgrTotal, 0) * 100) / 100;
  const sgrQuantity = items.reduce((sum, item) => sum + (item.hasSgr ? item.quantity : 0), 0);
  const total = Math.round((productsTotal + sgrTotal) * 100) / 100;
  if (payload.amount != null && Math.abs(receiptNumber(payload.amount) - total) > 0.001) {
    throw requestError(409, "Totalul barului s-a schimbat. Reîncarcă checkout-ul.");
  }

  const updatedArticles = items.map((item) => {
    const next = { ...item.article, stock: item.newStock, updatedAt: context.now };
    db.prepare("UPDATE bar_articles SET stock = ?, updated_at = ?, data = ? WHERE key = ?")
      .run(item.newStock, context.now, JSON.stringify(next), item.key);
    return next;
  });
  const sale = { items: items.map(({ article, previousStock, newStock, ...item }) => item), productsTotal, sgrTotal, sgrQuantity, total };
  const stockChanges = items.map((item) => ({ key: item.key, name: item.name, quantity: item.quantity, previousStock: item.previousStock, newStock: item.newStock }));
  const activity = normalizeActivityLogEntry({
    id: `payment-${context.paymentId}`,
    timestamp: context.now,
    eventType: "payment",
    entityType: "bar",
    entityKey: "bar-checkout",
    entityLabel: "Checkout bar",
    amount: total,
    method: context.method,
    message: `Bar a încasat ${money(total)} lei prin ${context.method}.`,
    data: { method: context.method, items: sale.items, productsTotal, sgrTotal, total, stockChanges, voucherOnly: context.method === "voucher" }
  });
  return {
    entityKey: "bar-checkout",
    amount: total,
    result: { type: "bar", sale, stockChanges, barArticles: updatedArticles },
    activity,
    outbox: barReceiptOutbox(sale, context.method, context.config, context.paymentId)
  };
}

function prepareStayPayment(payload, context) {
  const linkedKeys = Array.isArray(payload.linkedKeys) ? [...new Set(payload.linkedKeys.map(String).filter(Boolean))] : [];
  const isLinked = linkedKeys.length > 0;
  const keys = isLinked ? linkedKeys : [String(payload.stayKey || "")];
  if (!keys[0]) throw requestError(400, "Rezervarea lipsește din plată");
  const currentStays = keys.map((key) => reservationByKey(key));
  if (currentStays.some((stay) => !stay || stay.guest === "Disponibil")) throw requestError(404, "Una dintre rezervări nu mai există");

  const paymentStays = currentStays.map((current, index) => {
    if (isLinked || index > 0 || !payload.draftStay) return { ...current };
    const draft = payload.draftStay && typeof payload.draftStay === "object" ? payload.draftStay : {};
    return {
      ...current,
      ...draft,
      key: current.key,
      actualPaidAmount: current.actualPaidAmount,
      settledPrice: current.settledPrice,
      paid: current.paid,
      paymentMethod: current.paymentMethod
    };
  });
  const outstanding = paymentStays.map(reservationOutstanding);
  const totalOutstanding = Math.round(outstanding.reduce((sum, value) => sum + value, 0) * 100) / 100;
  const repeatPayment = !isLinked && totalOutstanding <= 0 && receiptNumber(paymentStays[0].price) > 0;
  const zeroPriceMarkPaid =
    !isLinked &&
    context.method === "voucher" &&
    receiptNumber(paymentStays[0].price) === 0 &&
    paymentStays[0].paid !== true;
  if (totalOutstanding <= 0 && !repeatPayment && !zeroPriceMarkPaid) throw requestError(409, "Rezervarea este deja achitată");
  const availableAmount = repeatPayment ? receiptNumber(paymentStays[0].price) : totalOutstanding;
  const amount = receiptNumber(payload.amount == null ? availableAmount : payload.amount);
  if ((zeroPriceMarkPaid ? amount !== 0 : amount <= 0) || amount - availableAmount > 0.001) {
    throw requestError(400, "Suma depășește suma disponibilă pentru plată");
  }
  const allocations = repeatPayment || zeroPriceMarkPaid ? [amount] : allocateProportionally(amount, outstanding);

  const updatedStays = paymentStays.map((stay, index) => {
    const price = Math.round(receiptNumber(stay.price) * 100) / 100;
    if (price <= 0 && !zeroPriceMarkPaid) throw requestError(400, `Preț invalid pentru rezervarea ${stay.id || stay.key}`);
    const next = {
      ...stay,
      paymentMethod: context.method,
      settledPrice: price,
      actualPaidAmount: Math.round((receiptNumber(stay.actualPaidAmount) + allocations[index]) * 100) / 100,
      lastPaidAmount: allocations[index],
      balance: 0,
      deposit: price,
      paid: true
    };
    updateReservationRow(next, context.now);
    return next;
  });
  const first = updatedStays[0];
  const activity = normalizeActivityLogEntry({
    id: `payment-${context.paymentId}`,
    timestamp: context.now,
    eventType: "payment",
    entityType: "client",
    entityKey: first.key,
    entityLabel: isLinked ? `${first.guest} (${updatedStays.length} rezervări)` : `${first.guest} (${first.id})`,
    amount,
    method: context.method,
    message: zeroPriceMarkPaid
      ? `${first.guest} a fost marcat ca achitat prin voucher.`
      : isLinked
      ? `${first.guest} a plătit în total ${money(amount)} lei pentru ${updatedStays.length} rezervări prin ${context.method}.`
      : `${first.guest} a plătit ${money(amount)} lei prin ${context.method}.`,
    data: {
      method: context.method,
      amount,
      repeatPayment,
      zeroPriceMarkPaid,
      linkedPayment: isLinked,
      allocations: updatedStays.map((stay, index) => ({ key: stay.key, id: stay.id, outstanding: outstanding[index], allocatedAmount: allocations[index] }))
    }
  });
  const receiptStay = { ...first, price: paymentStays.reduce((sum, stay) => sum + receiptNumber(stay.price), 0) };
  return {
    entityKey: first.key,
    amount,
    result: { type: "stay", stays: updatedStays, allocations: activity.data.allocations },
    activity,
    outbox: accommodationReceiptOutbox(receiptStay, context.method, amount, context.config, context.paymentId)
  };
}

function normalizeStationingPaymentRecord(record) {
  const prepaidNights = Math.max(1, Math.min(1095, Math.round(Number(record.prepaidNights || 1))));
  const nightlyPrice = Math.max(0, Math.round(receiptNumber(record.nightlyPrice) * 100) / 100);
  const deductions = Array.isArray(record.deductions) ? record.deductions : [];
  const deductedNights = Math.min(prepaidNights, deductions.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.nights || 0))), 0));
  const billableNights = Math.max(0, prepaidNights - deductedNights);
  const totalPrice = Math.round((deductions.length ? nightlyPrice * billableNights : receiptNumber(record.totalPrice) || nightlyPrice * prepaidNights) * 100) / 100;
  const paidAmount = Math.min(totalPrice, Math.max(0, Math.round(receiptNumber(record.paidAmount) * 100) / 100));
  return { ...record, prepaidNights, nightlyPrice, totalPrice, paidAmount, balance: Math.max(0, Math.round((totalPrice - paidAmount) * 100) / 100), deductions };
}

function prepareStationingPayment(payload, context) {
  const current = stationingByKey(payload.stationingKey);
  if (!current) throw requestError(404, "Staționarea nu mai există");
  const draft = payload.draftStationing && typeof payload.draftStationing === "object" ? payload.draftStationing : {};
  const source = normalizeStationingPaymentRecord({ ...current, ...draft, key: current.key });
  const amount = receiptNumber(payload.amount == null ? source.balance : payload.amount);
  if (amount <= 0 || amount - source.balance > 0.001) throw requestError(400, "Suma depășește restul staționării");
  const next = normalizeStationingPaymentRecord({ ...source, paidAmount: source.paidAmount + amount });
  updateStationingRow(next, context.now);
  const activity = normalizeActivityLogEntry({
    id: `payment-${context.paymentId}`,
    timestamp: context.now,
    eventType: "payment",
    entityType: "stationing",
    entityKey: next.key,
    entityLabel: `${next.owner} (${next.caravan})`,
    amount,
    method: context.method,
    message: `${next.owner} a plătit ${money(amount)} lei pentru staționare prin ${context.method}.`,
    data: { method: context.method, amount, previousPaidAmount: source.paidAmount, newPaidAmount: next.paidAmount, previousBalance: source.balance, newBalance: next.balance }
  });
  return {
    entityKey: next.key,
    amount,
    result: { type: "stationing", stationing: next },
    activity,
    outbox: accommodationReceiptOutbox({ guest: next.owner, price: next.totalPrice }, context.method, amount, context.config, context.paymentId)
  };
}

async function commitPayment(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw requestError(400, "Payload de plată invalid");
  const paymentId = paymentRequestId(payload.paymentId);
  const method = normalizedPaymentMethod(payload.method);
  const type = String(payload.type || "").trim();
  if (!["stay", "stationing", "bar"].includes(type)) throw requestError(400, "Tipul plății este invalid");

  let existing = paymentTransactionRow(paymentId);
  if (existing) {
    if (existing.type !== type || existing.method !== method) throw requestError(409, "Identificatorul plății a fost deja folosit pentru altă operațiune");
    existing = await publishPaymentOutbox(paymentId);
    return { ok: true, committed: true, receiptPending: existing.status !== "completed", paymentId, status: existing.status, ...parsePaymentResult(existing) };
  }

  const config = payload.receiptConfig && typeof payload.receiptConfig === "object" ? payload.receiptConfig : {};
  if (method !== "voucher") {
    config.receiptDirectory = await receiptDirectoryFor(config);
  }
  const now = new Date().toISOString();
  let mutation;
  let activityResult;
  db.exec("BEGIN IMMEDIATE");
  try {
    existing = paymentTransactionRow(paymentId);
    if (existing) throw requestError(409, "Plata este deja în curs");
    const context = { paymentId, method, config, now };
    mutation = type === "bar"
      ? prepareBarPayment(payload, context)
      : type === "stationing"
        ? prepareStationingPayment(payload, context)
        : prepareStayPayment(payload, context);
    const savedAt = bumpPaymentSavedAt(now);
    mutation.result.savedAt = savedAt;
    activityResult = addActivityLogEntry(mutation.activity);
    const initialStatus = method === "voucher" ? "completed" : "committed";
    db.prepare(`
      INSERT INTO payment_transactions
        (id, type, entity_key, method, amount, status, receipt_directory, receipt_content, info_line, result, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)
    `).run(
      paymentId,
      type,
      mutation.entityKey,
      method,
      mutation.amount,
      initialStatus,
      mutation.outbox.receiptDirectory || "",
      mutation.outbox.receiptContent || "",
      mutation.outbox.infoLine || "",
      JSON.stringify(mutation.result),
      now,
      now
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  if (activityResult?.inserted) {
    await writeActivityLogLocalFiles([activityResult.entry], { refreshSnapshot: true }).catch(() => {});
  }
  await enqueueDatabaseBackup({ afterMutation: true });
  const published = await publishPaymentOutbox(paymentId);
  return {
    ok: true,
    committed: true,
    receiptPending: published.status !== "completed",
    paymentId,
    status: published.status,
    warning: published.status !== "completed" ? published.last_error || "Bonul este în așteptare și va fi reîncercat automat" : "",
    ...mutation.result
  };
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

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function searchTokens(value) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function fuzzyDistance(first, second) {
  const rows = first.length + 1;
  const columns = second.length + 1;
  const distances = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) distances[row][0] = row;
  for (let column = 0; column < columns; column += 1) distances[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost
      );

      if (row > 1 && column > 1 && first[row - 1] === second[column - 2] && first[row - 2] === second[column - 1]) {
        distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1);
      }
    }
  }

  return distances[first.length][second.length];
}

function fuzzyTokenScore(queryToken, targetToken) {
  if (!queryToken || !targetToken) return Infinity;
  if (queryToken === targetToken) return 0;
  if (targetToken.startsWith(queryToken)) return clampScore(4 + Math.max(0, targetToken.length - queryToken.length));
  if (targetToken.includes(queryToken)) return clampScore(12 + Math.max(0, targetToken.length - queryToken.length));
  if (queryToken.includes(targetToken) && targetToken.length >= Math.min(4, queryToken.length)) return 18;
  if (queryToken.length <= 2) return Infinity;

  const allowedDistance = queryToken.length <= 4 ? 2 : Math.min(3, Math.ceil(queryToken.length * 0.35));

  if (targetToken.startsWith(queryToken[0])) {
    const prefix = targetToken.slice(0, Math.min(targetToken.length, Math.max(queryToken.length + 1, 4)));
    const prefixDistance = fuzzyDistance(queryToken, prefix);
    if (prefixDistance <= allowedDistance) {
      return clampScore(24 + (prefixDistance / Math.max(queryToken.length, 1)) * 45);
    }
  }

  const distance = fuzzyDistance(queryToken, targetToken);
  if (distance > allowedDistance) return Infinity;

  return clampScore(34 + (distance / Math.max(queryToken.length, targetToken.length, 1)) * 55);
}

function fuzzyMatchScore(query, text) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
  if (!normalizedQuery) return 0;
  if (!normalizedText) return Infinity;
  if (normalizedText === normalizedQuery) return 0;
  if (normalizedText.startsWith(normalizedQuery)) return 2;
  if (normalizedText.includes(normalizedQuery)) return 8;

  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const compactText = normalizedText.replaceAll(" ", "");
  if (compactText === compactQuery) return 0;
  if (compactText.startsWith(compactQuery)) return 5;
  if (compactQuery.length >= 3 && compactText.includes(compactQuery)) return 12;

  const queryTokens = searchTokens(normalizedQuery);
  const targetTokens = searchTokens(normalizedText);
  if (!queryTokens.length || !targetTokens.length) return Infinity;

  const tokenScores = queryTokens.map((queryToken) =>
    Math.min(...targetTokens.map((targetToken) => fuzzyTokenScore(queryToken, targetToken)))
  );
  if (tokenScores.some((score) => !Number.isFinite(score))) return Infinity;

  const averageScore = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const compactWindow = compactText.slice(0, Math.max(compactQuery.length + 3, 6));
  const compactDistance = compactQuery.length >= 4 ? fuzzyDistance(compactQuery, compactWindow) : Infinity;
  const compactScore =
    compactDistance <= Math.ceil(compactQuery.length * 0.34)
      ? 22 + (compactDistance / Math.max(compactQuery.length, 1)) * 48
      : Infinity;

  return Math.min(averageScore, compactScore);
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

async function fetchSourceBookings(mode, query = "") {
  const isCamping = mode === "camping";
  const searchAllRows = Boolean(normalizeSearchText(query));
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
        ? `SELECT form, modification_date FROM wp_booking ORDER BY modification_date DESC${searchAllRows ? "" : " LIMIT 5000"}`
        : `SELECT remark, form, cost, booking_type, modification_date FROM wp_booking ORDER BY modification_date DESC${searchAllRows ? "" : " LIMIT 5000"}`
    );

    const bookings = rows
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
      .filter(Boolean);

    if (!normalizeSearchText(query)) return bookings.sort(sortSourceBookings).slice(0, 300);

    return bookings
      .map((booking) => ({ booking, score: fuzzyMatchScore(query, booking.guest) }))
      .filter((match) => Number.isFinite(match.score))
      .sort((first, second) => first.score - second.score || sortSourceBookings(first.booking, second.booking))
      .slice(0, 300)
      .map((match) => match.booking);
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

const lanLogPaths = new Set([
  "/log",
  "/activity.html",
  "/activity.css",
  "/activity.js",
  "/assets/marina-park-logo.png",
  "/fonts/Rubik-Variable.ttf",
  "/api/log"
]);

function isLoopbackAddress(address) {
  const normalized = String(address || "").toLowerCase();
  return normalized === "127.0.0.1" || normalized === "::1" || normalized === "::ffff:127.0.0.1";
}

function isAllowedLanLogRequest(request) {
  if (request.method !== "GET") return false;
  const pathname = new URL(request.url, "http://localhost").pathname;
  return lanLogPaths.has(pathname);
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname === "/log" ? "/activity.html" : url.pathname);
  const filePath = path.resolve(rootDir, `.${requestedPath}`);

  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
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
    if (!isLoopbackAddress(request.socket.remoteAddress) && !isAllowedLanLogRequest(request)) {
      send(response, 403, JSON.stringify({ ok: false, error: "Doar jurnalul poate fi accesat din rețeaua locală" }));
      return;
    }

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

    if (request.url.startsWith("/api/payment") && request.method === "POST") {
      send(response, 200, JSON.stringify(await commitPayment(JSON.parse(await requestBody(request)))));
      return;
    }

    if (request.url.startsWith("/api/receipt") && request.method === "POST") {
      throw requestError(410, "Endpoint retras: folosește /api/payment pentru plată și persistență atomică");
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
      const query = String(url.searchParams.get("query") || "").trim().slice(0, 120);
      send(response, 200, JSON.stringify({ ok: true, bookings: await fetchSourceBookings(mode, query) }));
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

let backupInterval = null;

function listenOnPort(listenPort, listenHost) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(listenPort, listenHost);
  });
}

async function startServer(options = {}) {
  const firstPort = Number(options.port ?? port);
  const listenHost = String(options.host || process.env.HOST || "0.0.0.0");
  const portAttempts = Math.max(1, Math.floor(Number(options.portAttempts || 1)));
  let listenPort = firstPort;

  for (let attempt = 0; attempt < portAttempts; attempt += 1) {
    try {
      await listenOnPort(listenPort, listenHost);
      break;
    } catch (error) {
      const canTryNextPort = error.code === "EADDRINUSE" && listenPort > 0 && listenPort < 65535 && attempt + 1 < portAttempts;
      if (!canTryNextPort) throw error;
      listenPort += 1;
    }
  }

  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : listenPort;
  const localHost = String(options.localHost || (["0.0.0.0", "::"].includes(listenHost) ? "127.0.0.1" : listenHost));
  const url = `http://${localHost}:${activePort}`;
  const logUrls = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && !entry.internal && (entry.family === "IPv4" || entry.family === 4))
    .map((entry) => `http://${entry.address}:${activePort}/log`)
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
  console.log(`Marina Park app: ${url}`);
  for (const logUrl of logUrls) console.log(`Jurnal în rețea: ${logUrl}`);
  console.log(`Database: ${databasePath}`);
  retryPendingPaymentOutbox().catch((error) => console.error("Pending receipt retry failed:", error.message));
  enqueueDatabaseBackup({ reason: "startup" });
  backupInterval = setInterval(() => enqueueDatabaseBackup({ reason: "interval" }), 60 * 60 * 1000);
  backupInterval.unref?.();
  return { server, port: activePort, host: listenHost, url, logUrls };
}

function stopServer() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(resolve));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { startServer, stopServer };
