const http = require("http");
const { createHash } = require("node:crypto");
const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const {
  DEFAULT_SCOPES: MARINA_OAUTH_DEFAULT_SCOPES,
  DESKTOP_REDIRECT_URI: MARINA_OAUTH_REDIRECT_URI,
  buildAuthorizationUrl,
  createPkcePair,
  createState,
  formBody,
  parseCallbackUrl,
  validateState,
} = require("./marina-oauth");
const { DatabaseSync } = require("node:sqlite");
const {
  ClientHistoryStore,
  mergeClientDirectory,
  normalizeClientName,
} = require("./client-directory");
const stationingCalculator = require("./stationing-calculator");

const rootDir = path.resolve(process.env.MARINA_APP_ROOT || __dirname);
const dataDir = path.resolve(
  process.env.MARINA_DATA_DIR || path.join(rootDir, "data"),
);
const runtimeDir = path.resolve(process.env.MARINA_RUNTIME_DIR || rootDir);
const databasePath = path.join(dataDir, "marina-park.sqlite");
const clientHistoryDatabasePath = path.resolve(
  process.env.MARINA_CLIENT_HISTORY_DATABASE ||
    path.join(dataDir, "client-history.sqlite"),
);
const sourceBookingsFixturePath = process.env.MARINA_SOURCE_BOOKINGS_FIXTURE
  ? path.resolve(process.env.MARINA_SOURCE_BOOKINGS_FIXTURE)
  : "";
const backupDir = path.join(dataDir, "backups");
const dailyBackupPath = path.join(backupDir, "marina-park-daily.sqlite");
const weeklyBackupPath = path.join(backupDir, "marina-park-weekly.sqlite");
const clientHistoryDailyBackupPath = path.join(
  backupDir,
  "client-history-daily.sqlite",
);
const clientHistoryWeeklyBackupPath = path.join(
  backupDir,
  "client-history-weekly.sqlite",
);
const backupMetaPath = path.join(backupDir, "backup-meta.json");
const activityLogJsonPath = path.join(dataDir, "activity-log.json");
const activityLogJsonlPath = path.join(dataDir, "activity-log.jsonl");
const legacyReservationsIndexPath = path.join(
  dataDir,
  "reservations",
  "index.json",
);
const legacyConfigPath = path.join(dataDir, "config.json");
const port = Number(process.env.PORT || 4173);
const defaultMarinaApiBaseUrl = "https://booking.husi.ro";
const barReceiptStateRebuildVersion = 1;
const marinaOAuthMetadataPath = "/.well-known/oauth-authorization-server";
const marinaOAuthPendingMaxAgeMs = 10 * 60 * 1000;
const marinaOAuthAccessSkewMs = 60 * 1000;
const marinaOAuthTerminalRefreshErrors = new Set([
  "invalid_grant",
  "invalid_token",
  "invalid_client",
  "unauthorized_client",
]);
let liveScreenCaptureProvider = null;
let liveScreenFramePromise = null;
let pdfRenderProvider = null;
let marinaOAuthStorage = null;
let marinaOAuthPending = null;
let marinaOAuthAccessToken = "";
let marinaOAuthAccessTokenExpiresAt = 0;
let marinaOAuthRefreshPromise = null;
let marinaOAuthMetadataCache = null;
let marinaOAuthLastError = "";
let marinaOAuthMemoryRefreshToken = "";

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
  ".ttf": "font/ttf",
};

fsSync.mkdirSync(dataDir, { recursive: true });
fsSync.mkdirSync(backupDir, { recursive: true });
const db = new DatabaseSync(databasePath);
if (clientHistoryDatabasePath === databasePath) {
  throw new Error(
    "Baza istoricului de clienți trebuie să fie un fișier SQLite separat.",
  );
}
const clientHistoryStore = new ClientHistoryStore(clientHistoryDatabasePath);
const clientDirectoryCacheMs = 10 * 60 * 1000;
const roomAvailabilityCacheMs = 60 * 1000;
let clientDirectoryCache = null;
let roomAvailabilityCache = null;
const marinaSourceCache = new Map();
const inFlightMarinaRequests = new Map();
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
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
  CREATE TABLE IF NOT EXISTS marina_api_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    api_base_url TEXT NOT NULL,
    -- Kept for SQLite compatibility with pre-OAuth installations; never read for authentication.
    api_token TEXT NOT NULL DEFAULT '',
    oauth_client_id TEXT NOT NULL DEFAULT '',
    oauth_scopes TEXT NOT NULL DEFAULT '',
    rooms_workspace_id INTEGER,
    camping_workspace_id INTEGER,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stationing (
    key TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    caravan TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    price_per_day_cents INTEGER NOT NULL DEFAULT 0,
    open_ended INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_stationing_dates ON stationing(start_date, end_date);
  CREATE INDEX IF NOT EXISTS idx_stationing_owner ON stationing(owner);
  CREATE TABLE IF NOT EXISTS stationing_payments (
    payment_id TEXT PRIMARY KEY,
    stationing_key TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'payment',
    voided_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(stationing_key) REFERENCES stationing(key) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_stationing_payments_record ON stationing_payments(stationing_key, payment_date, created_at);
  CREATE TABLE IF NOT EXISTS stationing_stay_links (
    stationing_key TEXT NOT NULL,
    stay_key TEXT NOT NULL,
    subtract_days INTEGER NOT NULL DEFAULT 0,
    linked_at TEXT NOT NULL,
    PRIMARY KEY(stationing_key, stay_key),
    FOREIGN KEY(stationing_key) REFERENCES stationing(key) ON DELETE CASCADE
  );
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
  CREATE TABLE IF NOT EXISTS activity_log_purges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_inclusive TEXT,
    end_exclusive TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_log_purges_range ON activity_log_purges(start_inclusive, end_exclusive);
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
  CREATE TABLE IF NOT EXISTS bar_export_lines (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    sale_timestamp TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    method TEXT NOT NULL,
    source_type TEXT NOT NULL,
    article_key TEXT NOT NULL,
    name TEXT NOT NULL,
    filter_name TEXT NOT NULL,
    unit_gross REAL NOT NULL,
    quantity REAL NOT NULL,
    vat_rate INTEGER NOT NULL,
    gross_total REAL NOT NULL,
    exported_at TEXT,
    export_batch_id TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(payment_id) REFERENCES payment_transactions(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_bar_export_lines_pending ON bar_export_lines(exported_at, sale_date);
  CREATE INDEX IF NOT EXISTS idx_bar_export_lines_payment ON bar_export_lines(payment_id);
  CREATE TABLE IF NOT EXISTS reservation_bar_receipt_state (
    stay_key TEXT NOT NULL,
    item_id TEXT NOT NULL,
    handled_quantity REAL NOT NULL DEFAULT 0,
    handled_sgr_total REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(stay_key, item_id)
  );
  CREATE TABLE IF NOT EXISTS reservation_bar_receipt_state_meta (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    rebuild_version INTEGER NOT NULL,
    transaction_fingerprint TEXT NOT NULL,
    last_error TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
`);

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!columns.some((column) => column.name === columnName))
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

ensureColumn("stationing", "price_per_day_cents", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("stationing", "open_ended", "INTEGER NOT NULL DEFAULT 1");
ensureColumn(
  "marina_api_settings",
  "oauth_client_id",
  "TEXT NOT NULL DEFAULT ''",
);
ensureColumn("marina_api_settings", "oauth_scopes", "TEXT NOT NULL DEFAULT ''");

function send(
  response,
  status,
  body,
  contentType = "application/json; charset=utf-8",
  headers = {},
) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

function setLiveScreenCaptureProvider(provider) {
  liveScreenCaptureProvider = typeof provider === "function" ? provider : null;
}

function setPdfRenderProvider(provider) {
  pdfRenderProvider = typeof provider === "function" ? provider : null;
}

async function renderPdfDocument(html) {
  if (!pdfRenderProvider) {
    throw requestError(
      503,
      "Exportul PDF este disponibil numai în aplicația Marina Park instalată",
    );
  }
  const pdf = await pdfRenderProvider(html);
  if (!Buffer.isBuffer(pdf) || pdf.length === 0) {
    throw requestError(503, "Raportul PDF nu a putut fi generat");
  }
  return pdf;
}

async function captureLiveScreenFrame() {
  if (!liveScreenCaptureProvider)
    throw requestError(
      503,
      "Captura este disponibilă numai în aplicația Marina Park",
    );
  if (!liveScreenFramePromise) {
    liveScreenFramePromise = Promise.resolve()
      .then(() => liveScreenCaptureProvider())
      .then((capture) => {
        const frame = Buffer.isBuffer(capture) ? capture : capture?.frame;
        if (!Buffer.isBuffer(frame) || frame.length === 0)
          throw requestError(
            503,
            "Fereastra Marina Park nu poate fi capturată momentan",
          );
        const pointer = Buffer.isBuffer(capture) ? {} : capture?.pointer || {};
        return {
          frame,
          pointer: {
            visible: pointer.visible === true,
            x: Math.max(0, Math.min(1, Number(pointer.x || 0))),
            y: Math.max(0, Math.min(1, Number(pointer.y || 0))),
            width: Math.max(0, Math.min(0.2, Number(pointer.width || 0))),
            height: Math.max(0, Math.min(0.2, Number(pointer.height || 0))),
          },
        };
      })
      .finally(() => {
        liveScreenFramePromise = null;
      });
  }
  return liveScreenFramePromise;
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function reservationRows() {
  return db
    .prepare("SELECT data FROM reservations ORDER BY order_index ASC")
    .all()
    .map((row) => safeJsonParse(row.data))
    .filter(Boolean);
}

function unitRows() {
  return db
    .prepare("SELECT data FROM units ORDER BY group_name ASC, id ASC")
    .all()
    .map((row) => safeJsonParse(row.data))
    .filter(Boolean);
}

function configRow() {
  const row = db
    .prepare("SELECT data FROM app_config WHERE key = ?")
    .get("app");
  return row ? (safeJsonParse(row.data) ?? {}) : {};
}

function stationingRows() {
  return db
    .prepare("SELECT data FROM stationing ORDER BY start_date DESC, owner ASC")
    .all()
    .map((row) => safeJsonParse(row.data))
    .filter(Boolean);
}

function barArticleRows() {
  return db
    .prepare("SELECT data FROM bar_articles ORDER BY name ASC")
    .all()
    .map((row) => safeJsonParse(row.data))
    .filter(Boolean);
}

function activityLogRows(limit = 1000, offset = 0) {
  const numericLimit = Number(limit);
  const numericOffset = Number(offset);
  return db
    .prepare(
      "SELECT data FROM activity_log ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?",
    )
    .all(
      Number.isFinite(numericLimit)
        ? Math.max(1, Math.min(5000, Math.floor(numericLimit)))
        : 1000,
      Number.isFinite(numericOffset)
        ? Math.max(0, Math.floor(numericOffset))
        : 0,
    )
    .map((row) => safeJsonParse(row.data))
    .filter(Boolean);
}

function allActivityLogRows() {
  return db
    .prepare("SELECT data FROM activity_log ORDER BY timestamp DESC")
    .all()
    .map((row) => safeJsonParse(row.data))
    .filter(Boolean);
}

function normalizeActivityLogEntry(entry = {}) {
  const timestamp = entry.timestamp || new Date().toISOString();
  const eventType =
    String(entry.eventType || entry.event_type || "event").trim() || "event";
  const entityType =
    String(entry.entityType || entry.entity_type || "app").trim() || "app";
  const entityKey = String(entry.entityKey || entry.entity_key || "").trim();
  const entityLabel = String(
    entry.entityLabel || entry.entity_label || "",
  ).trim();
  const message =
    String(entry.message || "").trim() || "Activitate înregistrată";
  const amount = Math.max(0, Number(entry.amount || 0));
  const method = String(entry.method || "").trim();
  const data = entry.data && typeof entry.data === "object" ? entry.data : {};

  return {
    id: String(
      entry.id || `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ),
    timestamp,
    eventType,
    entityType,
    entityKey,
    entityLabel,
    message,
    amount,
    method,
    data,
  };
}

function isPurgeableActivityLogEntry(entry) {
  return (
    entry?.entityType === "client" ||
    (entry?.entityType === "bar" &&
      entry?.eventType === "payment" &&
      String(entry?.method || "").toLowerCase() === "voucher")
  );
}

function activityLogPurgeRanges(targetDb = db) {
  return targetDb
    .prepare(
      "SELECT start_inclusive AS startInclusive, end_exclusive AS endExclusive FROM activity_log_purges ORDER BY id ASC",
    )
    .all();
}

function wasActivityLogEntryPurged(entry) {
  if (!isPurgeableActivityLogEntry(entry)) return false;
  const timestamp = new Date(entry?.timestamp || "");
  if (!Number.isFinite(timestamp.getTime())) return false;
  const normalizedTimestamp = timestamp.toISOString();
  return Boolean(
    db
      .prepare(`
    SELECT 1
    FROM activity_log_purges
    WHERE (start_inclusive IS NULL OR ? >= start_inclusive)
      AND ? < end_exclusive
    LIMIT 1
  `)
      .get(normalizedTimestamp, normalizedTimestamp),
  );
}

function addActivityLogEntry(entry) {
  const normalized = normalizeActivityLogEntry(entry);
  if (wasActivityLogEntryPurged(normalized)) {
    return { entry: normalized, inserted: false, purged: true };
  }
  const result = db
    .prepare(`
    INSERT OR IGNORE INTO activity_log (id, timestamp, event_type, entity_type, entity_key, entity_label, message, amount, method, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .run(
      normalized.id,
      normalized.timestamp,
      normalized.eventType,
      normalized.entityType,
      normalized.entityKey,
      normalized.entityLabel,
      normalized.message,
      normalized.amount,
      normalized.method,
      JSON.stringify(normalized),
    );
  return { entry: normalized, inserted: result.changes > 0 };
}

let activityLogSnapshotTimer = null;

async function writeActivityLogLocalFiles(entries, options = {}) {
  if (entries.length) {
    const jsonlLines = entries
      .map((entry) => JSON.stringify(entry))
      .join(os.EOL);
    await fs.appendFile(activityLogJsonlPath, `${jsonlLines}${os.EOL}`, "utf8");
  }
  if (!entries.length && !options.refreshSnapshot) return;
  if (options.immediate) {
    if (activityLogSnapshotTimer) {
      clearTimeout(activityLogSnapshotTimer);
      activityLogSnapshotTimer = null;
    }
    await fs.writeFile(
      activityLogJsonPath,
      `${JSON.stringify(activityLogRows(5000), null, 2)}${os.EOL}`,
      "utf8",
    );
  } else if (!activityLogSnapshotTimer) {
    activityLogSnapshotTimer = setTimeout(async () => {
      activityLogSnapshotTimer = null;
      try {
        await fs.writeFile(
          activityLogJsonPath,
          `${JSON.stringify(activityLogRows(5000), null, 2)}${os.EOL}`,
          "utf8",
        );
      } catch {}
    }, 1500);
  }
}

async function rewriteActivityLogLocalFiles() {
  if (activityLogSnapshotTimer) {
    clearTimeout(activityLogSnapshotTimer);
    activityLogSnapshotTimer = null;
  }
  const entries = allActivityLogRows();
  await fs.writeFile(
    activityLogJsonPath,
    `${JSON.stringify(entries.slice(0, 5000), null, 2)}${os.EOL}`,
    "utf8",
  );
  const jsonl = entries.length
    ? `${entries
        .slice()
        .reverse()
        .map((entry) => JSON.stringify(entry))
        .join(os.EOL)}${os.EOL}`
    : "";
  await fs.writeFile(activityLogJsonlPath, jsonl, "utf8");
}

function normalizeMoneyValue(value) {
  const normalizedValue =
    typeof value === "string"
      ? value.replace(/\s+/g, "").replace(",", ".")
      : value;
  const amount = Math.max(0, Number(normalizedValue || 0));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function normalizedModeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeTimelineMode(mode) {
  const value = normalizedModeText(mode);
  if (
    value === "rv" ||
    value === "rulote" ||
    value === "rulota" ||
    value.includes("rulot")
  )
    return "rv";
  if (
    value === "camping" ||
    value === "cort" ||
    value === "tent" ||
    value.includes("cort") ||
    value.includes("campare")
  )
    return "tent";
  return "room";
}

function groupForMode(mode) {
  return normalizeTimelineMode(mode) === "room" ? "room" : "camping";
}

function groupFromKind(kind) {
  const value = normalizedModeText(kind);
  if (
    value === "camping" ||
    value === "tent" ||
    value === "cort" ||
    value === "rv" ||
    value.includes("camping") ||
    value.includes("campare") ||
    value.includes("rulot")
  ) {
    return "camping";
  }
  return "room";
}

function normalizeDailyPrices(dailyPrices = {}) {
  const normalized = {};
  if (
    !dailyPrices ||
    typeof dailyPrices !== "object" ||
    Array.isArray(dailyPrices)
  )
    return normalized;

  Object.entries(dailyPrices)
    .sort(([first], [second]) => first.localeCompare(second))
    .forEach(([date, rawPrice]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const priceValue =
        typeof rawPrice === "object" && rawPrice !== null
          ? (rawPrice.price ?? rawPrice.adultPrice)
          : rawPrice;
      const price = normalizeMoneyValue(priceValue);
      if (price > 0) normalized[date] = price;
    });
  return normalized;
}

function normalizeUnitForStorage(unit = {}) {
  const id = String(unit.id || "").trim();
  const kind = String(unit.kind || "Cameră dublă").trim();
  const rawGroup = unit.group || groupFromKind(kind);
  const explicitModeSource =
    unit.mode ||
    unit.unitType ||
    (["room", "tent", "rv"].includes(rawGroup) ? rawGroup : "");
  let mode = normalizeTimelineMode(explicitModeSource || `${id} ${kind}`);
  if (!explicitModeSource && rawGroup === "camping" && mode === "room")
    mode = "tent";
  const group = groupForMode(mode);
  const dailyPrices = normalizeDailyPrices(unit.dailyPrices);
  const firstDailyPrice =
    Object.values(dailyPrices).find((price) => Number(price || 0) > 0) || 0;
  const hasAdultPrice =
    unit.adultPrice !== undefined &&
    unit.adultPrice !== null &&
    String(unit.adultPrice).trim() !== "";
  const adultPrice = hasAdultPrice
    ? normalizeMoneyValue(unit.adultPrice)
    : firstDailyPrice;
  const hasChildPrice =
    unit.childPrice !== undefined &&
    unit.childPrice !== null &&
    String(unit.childPrice).trim() !== "";
  const childPrice = hasChildPrice
    ? normalizeMoneyValue(unit.childPrice)
    : normalizeMoneyValue(adultPrice / 2);

  return {
    ...unit,
    id,
    kind,
    group,
    mode,
    pricingMode:
      unit.pricingMode === "per-person-night"
        ? "per-person-night"
        : "per-night",
    adultPrice,
    childPrice,
    dailyPrices,
  };
}

function replaceDatabaseData(
  stays,
  config,
  units = [],
  stationing = [],
  barArticles = [],
) {
  const now = new Date().toISOString();
  const normalizedUnits = units.map(normalizeUnitForStorage);
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
    INSERT INTO stationing (key, owner, caravan, start_date, end_date, price_per_day_cents, open_ended, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertStationingPayment = db.prepare(`
    INSERT INTO stationing_payments
      (payment_id, stationing_key, payment_date, amount_cents, method, note, kind, voided_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertStationingStayLink = db.prepare(`
    INSERT INTO stationing_stay_links (stationing_key, stay_key, subtract_days, linked_at)
    VALUES (?, ?, ?, ?)
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
        JSON.stringify(stay),
      );
    });
    db.exec("DELETE FROM units");
    normalizedUnits.forEach((unit) => {
      insertUnit.run(
        String(unit.id || ""),
        String(unit.group || ""),
        String(unit.kind || ""),
        unit.pricingMode === "per-person-night"
          ? "per-person-night"
          : "per-night",
        Number(unit.adultPrice || 0),
        Number(unit.childPrice || 0),
        now,
        JSON.stringify(unit),
      );
    });
    db.exec("DELETE FROM stationing_payments");
    db.exec("DELETE FROM stationing_stay_links");
    db.exec("DELETE FROM stationing");
    stationing.forEach((record, index) => {
      const key = String(record.key || `stationing-${index}`);
      const startDate = String(record.startDate || now.slice(0, 10));
      const normalized = stationingCalculator.normalizeRecord({
        ...record,
        key,
        startDate,
      });
      const stored = { ...normalized, key, startDate };
      insertStationing.run(
        key,
        String(stored.owner || ""),
        String(stored.caravan || ""),
        startDate,
        stored.endDate || "",
        stored.pricePerDayCents,
        stored.openEnded ? 1 : 0,
        now,
        JSON.stringify(stored),
      );
      stored.paymentTransactions.forEach((payment) => {
        insertStationingPayment.run(
          payment.id,
          key,
          payment.paymentDate,
          payment.amountCents,
          payment.method,
          payment.note,
          payment.kind,
          payment.voidedAt,
          payment.createdAt,
        );
      });
      stored.stayLinks.forEach((link) => {
        insertStationingStayLink.run(
          key,
          link.stayKey,
          link.subtractDays ? 1 : 0,
          link.linkedAt || now,
        );
      });
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
        JSON.stringify({ ...article, key }),
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
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM reservations")
    .get().count;
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
      path: "data/marina-park.sqlite",
    },
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
  const hasValue = Object.hasOwn(payload || {}, key);
  const value = payload?.[key];
  const fallback = options.fallback;
  const arrayValue = hasValue ? value : fallback;
  if (!arrayValue) {
    throw requestError(
      400,
      `Payload invalid: '${key}' trebuie să fie o listă.`,
    );
  }
  if (!Array.isArray(arrayValue)) {
    throw requestError(
      400,
      `Payload invalid: '${key}' trebuie să fie o listă.`,
    );
  }

  const invalidIndex = arrayValue.findIndex(
    (item) => !item || typeof item !== "object" || Array.isArray(item),
  );
  if (invalidIndex >= 0) {
    throw requestError(
      400,
      `Payload invalid: '${key}[${invalidIndex}]' trebuie să fie obiect.`,
    );
  }

  return arrayValue;
}

function ensureRequiredField(items, key, fieldName) {
  const invalidIndex = items.findIndex(
    (item) => !String(item[fieldName] || "").trim(),
  );
  if (invalidIndex >= 0) {
    throw requestError(
      400,
      `Payload invalid: '${key}[${invalidIndex}].${fieldName}' lipsește.`,
    );
  }
}

function allowEmptyReplacement(payload, key) {
  const setting = payload?.allowEmptyCollections;
  return setting === true || (Array.isArray(setting) && setting.includes(key));
}

function preventAccidentalWipe(payload, key, tableName, nextRows) {
  const existingRows = tableCount(tableName);
  if (
    existingRows > 0 &&
    nextRows.length === 0 &&
    !allowEmptyReplacement(payload, key)
  ) {
    throw requestError(
      409,
      `Refuz să înlocuiesc ${existingRows} înregistrări din '${key}' cu o listă goală fără confirmare explicită.`,
    );
  }
}

async function writeData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw requestError(
      400,
      "Payload invalid: corpul cererii trebuie să fie obiect JSON.",
    );
  }

  const submittedConfig =
    payload.config &&
    typeof payload.config === "object" &&
    !Array.isArray(payload.config)
      ? payload.config
      : {};
  const { units: discardedUnits, ...config } = submittedConfig;
  const stays = payloadArray(payload, "stays");
  const units = payloadArray(payload, "units", {
    fallback: discardedUnits,
  }).map(normalizeUnitForStorage);
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
  if (
    baseSavedAt &&
    currentConfig.savedAt &&
    baseSavedAt !== currentConfig.savedAt
  ) {
    const error = new Error(
      "Baza de date locală a fost modificată în altă fereastră. Reîncarcă aplicația înainte de salvare.",
    );
    error.statusCode = 409;
    throw error;
  }

  const nextConfig = {
    ...config,
    savedAt: config.savedAt || new Date().toISOString(),
  };
  replaceDatabaseData(stays, nextConfig, units, stationing, barArticles);
  clientHistoryStore.syncReservations(stays);
  clientDirectoryCache = null;
  await enqueueDatabaseBackup({ afterMutation: true });
  return { savedAt: nextConfig.savedAt };
}

function reservationDeductionNights(stay, deduction) {
  const requested = Number(deduction?.nights);
  if (Number.isFinite(requested) && requested > 0) {
    return Math.min(3660, Math.max(1, Math.round(requested)));
  }
  const start = String(stay?.start || "");
  const end = String(stay?.end || "");
  if (stationingCalculator.validISODate(start) && stationingCalculator.validISODate(end)) {
    const startTime = Date.parse(`${start}T12:00:00Z`);
    const endTime = Date.parse(`${end}T12:00:00Z`);
    if (endTime > startTime) {
      return Math.min(3660, Math.max(1, Math.round((endTime - startTime) / 86400000)));
    }
  }
  return 1;
}

function reservationStationingDeduction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (value.subtractDays !== true) return null;
  const recordKey = String(value.recordKey || "").trim();
  if (!recordKey) {
    throw requestError(
      400,
      "Legătura de staționare trebuie să conțină recordKey.",
    );
  }
  return { ...value, recordKey };
}

function stationingRecordWithoutStay(record, stayKey) {
  const normalizedStayKey = String(stayKey || "").trim();
  const deductions = Array.isArray(record?.deductions)
    ? record.deductions.filter(
        (deduction) => String(deduction?.stayKey || "") !== normalizedStayKey,
      )
    : [];
  const stayLinks = Array.isArray(record?.stayLinks)
    ? record.stayLinks.filter(
        (link) => String(link?.stayKey || "") !== normalizedStayKey,
      )
    : [];
  return stationingCalculator.normalizeRecord({
    ...record,
    deductions,
    stayLinks,
  });
}

function stationingRecordWithStayDeduction(record, stay, requested, now) {
  const existingDeduction = Array.isArray(record?.deductions)
    ? record.deductions.find(
        (deduction) => String(deduction?.stayKey || "") === String(stay.key),
      )
    : null;
  const existingLink = stationingCalculator
    .normalizeStayLinks(record)
    .find((link) => link.stayKey === String(stay.key));
  const appliedAt = String(
    existingDeduction?.appliedAt || existingLink?.linkedAt || requested.appliedAt || now,
  );
  const nights = reservationDeductionNights(stay, requested);
  const entry = {
    key: String(
      existingDeduction?.key || `stationing-deduction-${String(stay.key)}`,
    ),
    stayKey: String(stay.key),
    guest: String(stay.guest || "").trim(),
    unitId: String(stay.id || "").trim(),
    start: String(stay.start || ""),
    end: String(stay.end || ""),
    nights,
    amount: 0,
    subtractDays: true,
    appliedAt,
  };
  const withoutStay = stationingRecordWithoutStay(record, stay.key);
  const nextRecord = stationingCalculator.normalizeRecord({
    ...withoutStay,
    deductions: [...(Array.isArray(withoutStay.deductions) ? withoutStay.deductions : []), entry],
    stayLinks: [
      ...stationingCalculator.normalizeStayLinks(withoutStay),
      { stayKey: String(stay.key), subtractDays: true, linkedAt: appliedAt },
    ],
  });
  const currentDeduction =
    stay.stationingDeduction && typeof stay.stationingDeduction === "object"
      ? stay.stationingDeduction
      : {};
  const deduction = {
    ...currentDeduction,
    recordKey: String(record.key),
    recordLabel:
      String(
        requested.recordLabel || `${record.owner || ""} (${record.caravan || ""})`,
      ).trim(),
    selectedAt: String(currentDeduction.selectedAt || requested.selectedAt || appliedAt),
    appliedAt,
    appliedNights: nights,
    appliedAmount: 0,
    subtractDays: true,
    nights,
  };
  return { record: nextRecord, deduction, entry };
}

function persistReservationStationing(
  stay,
  previousReservation,
  payload,
  now,
) {
  const requested = reservationStationingDeduction(
    payload.stationingDeduction === undefined
      ? stay.stationingDeduction
      : payload.stationingDeduction,
  );
  const nextRecordKey = requested?.recordKey || "";
  const previousRecordKeys = new Set(
    [
      payload.previousStationingKey,
      previousReservation?.stationingDeduction?.recordKey,
    ]
      .map((key) => String(key || "").trim())
      .filter(Boolean),
  );
  const nextRecords = new Map();

  for (const recordKey of previousRecordKeys) {
    if (recordKey === nextRecordKey) continue;
    const record = stationingByKey(recordKey);
    if (record) nextRecords.set(recordKey, stationingRecordWithoutStay(record, stay.key));
  }

  let stationing = null;
  let persistedStay = { ...stay };
  if (nextRecordKey) {
    const current = stationingByKey(nextRecordKey);
    if (!current) {
      throw requestError(404, `Staționarea ${nextRecordKey} nu mai există`);
    }
    const next = stationingRecordWithStayDeduction(
      nextRecords.get(nextRecordKey) || current,
      stay,
      requested,
      now,
    );
    nextRecords.set(nextRecordKey, next.record);
    persistedStay = { ...stay, stationingDeduction: next.deduction };
    stationing = next.record;
  }

  for (const record of nextRecords.values()) updateStationingRow(record, now);
  return { stay: persistedStay, stationing };
}

async function writeReservation(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw requestError(
      400,
      "Payload invalid: rezervarea trebuie să fie un obiect JSON.",
    );
  }

  const stay =
    payload.stay &&
    typeof payload.stay === "object" &&
    !Array.isArray(payload.stay)
      ? payload.stay
      : null;
  if (!stay) throw requestError(400, "Payload invalid: rezervarea lipsește.");

  const key = String(stay.key || "").trim();
  const id = String(stay.id || "").trim();
  const guest = String(stay.guest || "").trim();
  if (!key || !id || !guest) {
    throw requestError(400, "Rezervarea trebuie să conțină key, id și guest.");
  }

  const previousKey = String(payload.previousKey || key).trim() || key;
  const existing =
    db
      .prepare("SELECT order_index FROM reservations WHERE key = ?")
      .get(previousKey) ||
    db.prepare("SELECT order_index FROM reservations WHERE key = ?").get(key);
  const firstOrder = db
    .prepare("SELECT MIN(order_index) AS value FROM reservations")
    .get()?.value;
  const orderIndex = existing
    ? Number(existing.order_index)
    : Number(firstOrder ?? 0) - 1;
  const now = new Date().toISOString();
  const previousReservation =
    reservationByKey(previousKey) || reservationByKey(key);

  let stationingMutation;
  db.exec("BEGIN IMMEDIATE");
  try {
    stationingMutation = persistReservationStationing(
      { ...stay, key, id, guest },
      previousReservation,
      payload,
      now,
    );
    if (previousKey !== key) {
      db.prepare("DELETE FROM reservations WHERE key = ?").run(previousKey);
    }
    db.prepare(`
      INSERT INTO reservations (key, order_index, id, guest, group_name, kind, start_date, end_date, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        order_index = excluded.order_index,
        id = excluded.id,
        guest = excluded.guest,
        group_name = excluded.group_name,
        kind = excluded.kind,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = excluded.updated_at,
        data = excluded.data
    `).run(
      key,
      orderIndex,
      id,
      guest,
      String(stay.group || ""),
      String(stay.kind || ""),
      stay.start || null,
      stay.end || null,
      now,
      JSON.stringify(stationingMutation.stay),
    );
    bumpDatabaseSavedAt(now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  clientHistoryStore.syncReservations([stationingMutation.stay]);
  clientDirectoryCache = null;
  void enqueueDatabaseBackup({ afterMutation: true });
  return {
    savedAt: now,
    stay: stationingMutation.stay,
    stationing: stationingMutation.stationing,
  };
}

async function exportedDatabaseFile() {
  db.exec("PRAGMA wal_checkpoint(FULL)");
  const body = await fs.readFile(databasePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    body,
    filename: `marina-park-database-${timestamp}.sqlite`,
  };
}

const purgeableActivityLogSql = `(
  entity_type = 'client'
  OR (entity_type = 'bar' AND event_type = 'payment' AND LOWER(COALESCE(method, '')) = 'voucher')
)`;

function ensureActivityLogPurgeSchema(targetDb) {
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS activity_log_purges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_inclusive TEXT,
      end_exclusive TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_activity_log_purges_range ON activity_log_purges(start_inclusive, end_exclusive);
  `);
}

function securelyPurgeActivityLogDatabase(targetDb, options) {
  const { startInclusive, endExclusive, clearedAt } = options;
  ensureActivityLogPurgeSchema(targetDb);
  targetDb.exec("PRAGMA secure_delete = ON");
  const rangeSql = startInclusive
    ? " AND julianday(timestamp) >= julianday(?) AND julianday(timestamp) < julianday(?)"
    : "";
  targetDb.exec("BEGIN IMMEDIATE");
  let deleted = 0;
  try {
    targetDb
      .prepare(`
      INSERT INTO activity_log_purges (start_inclusive, end_exclusive, created_at)
      VALUES (?, ?, ?)
    `)
      .run(startInclusive || null, endExclusive, clearedAt);
    const statement = targetDb.prepare(
      `DELETE FROM activity_log WHERE ${purgeableActivityLogSql}${rangeSql}`,
    );
    const result = startInclusive
      ? statement.run(startInclusive, endExclusive)
      : statement.run();
    deleted = Number(result.changes || 0);
    targetDb.exec("COMMIT");
  } catch (error) {
    targetDb.exec("ROLLBACK");
    throw error;
  }
  targetDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  targetDb.exec("VACUUM");
  targetDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  return deleted;
}

async function overwriteFileContents(filePath) {
  const stats = await fs.stat(filePath).catch(() => null);
  if (!stats?.size) return;
  const handle = await fs.open(filePath, "r+");
  try {
    const zeros = Buffer.alloc(Math.min(stats.size, 64 * 1024));
    for (let offset = 0; offset < stats.size; offset += zeros.length) {
      await handle.write(
        zeros,
        0,
        Math.min(zeros.length, stats.size - offset),
        offset,
      );
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function securelyRewriteActivityLogLocalFiles() {
  await Promise.all([
    overwriteFileContents(activityLogJsonPath),
    overwriteFileContents(activityLogJsonlPath),
  ]);
  await rewriteActivityLogLocalFiles();
}

async function securelyPurgeManagedBackups(options) {
  backupsPausedAfterClear = true;
  const purgeJob = backupQueue
    .catch(() => {})
    .then(async () => {
      let purgedBackups = 0;
      for (const backupPath of [dailyBackupPath, weeklyBackupPath]) {
        if (!(await fileExists(backupPath))) continue;
        const backupDb = new DatabaseSync(backupPath);
        try {
          securelyPurgeActivityLogDatabase(backupDb, options);
          purgedBackups += 1;
        } finally {
          backupDb.close();
        }
      }
      return purgedBackups;
    });
  backupQueue = purgeJob.catch((error) => {
    console.error("Activity-log backup purge failed:", error.message);
    throw error;
  });
  return backupQueue;
}

async function clearActivityLogData(scope = "all", options = {}) {
  const normalizedScope = scope === "range" ? "range" : "all";
  const startInclusive = new Date(options.startInclusive || "");
  const endExclusive = new Date(options.endExclusive || "");
  if (
    normalizedScope === "range" &&
    (!Number.isFinite(startInclusive.getTime()) ||
      !Number.isFinite(endExclusive.getTime()) ||
      startInclusive.getTime() >= endExclusive.getTime())
  ) {
    throw requestError(
      400,
      "Intervalul pentru ștergerea jurnalului este invalid",
    );
  }
  const clearedAt = new Date().toISOString();
  const purgeOptions = {
    startInclusive:
      normalizedScope === "range" ? startInclusive.toISOString() : null,
    endExclusive:
      normalizedScope === "range"
        ? endExclusive.toISOString()
        : new Date(Date.now() + 1).toISOString(),
    clearedAt,
  };
  const deleted = securelyPurgeActivityLogDatabase(db, purgeOptions);
  const purgedBackups = await securelyPurgeManagedBackups(purgeOptions);
  await securelyRewriteActivityLogLocalFiles();
  return {
    ok: true,
    scope: normalizedScope,
    deleted,
    purgedBackups,
    ...(normalizedScope === "range"
      ? {
          startInclusive: startInclusive.toISOString(),
          endExclusive: endExclusive.toISOString(),
        }
      : {}),
    clearedAt,
  };
}

function receiptAmount(value) {
  const normalizedValue =
    typeof value === "string"
      ? value.replace(/\s+/g, "").replace(",", ".")
      : value;
  const amount = Number(normalizedValue || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Suma pentru bon este invalidă");
  }

  return amount.toFixed(2);
}

function receiptNumber(value) {
  const normalizedValue =
    typeof value === "string"
      ? value.replace(/\s+/g, "").replace(",", ".")
      : value;
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
  const week =
    1 +
    Math.round(
      (cursor.getTime() - weekOne.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
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

async function copyClientHistoryDatabase(targetPath) {
  await fs.mkdir(backupDir, { recursive: true });
  clientHistoryStore.checkpoint();
  await fs.copyFile(clientHistoryDatabasePath, targetPath);
}

async function refreshDatabaseBackups(options = {}) {
  const now = new Date();
  const today = localDateText(now);
  const week = localWeekKey(now);
  const meta = await readJson(backupMetaPath, {});
  const afterMutation = Boolean(options.afterMutation);
  const dailyMissing = !(await fileExists(dailyBackupPath));
  const weeklyMissing = !(await fileExists(weeklyBackupPath));
  const shouldWriteDaily =
    afterMutation || dailyMissing || meta.dailyDate !== today;
  const shouldWriteWeekly = weeklyMissing || meta.weeklyWeek !== week;
  const nextMeta = { ...meta };

  if (shouldWriteDaily) {
    await copyCurrentDatabase(dailyBackupPath);
    await copyClientHistoryDatabase(clientHistoryDailyBackupPath);
    nextMeta.dailyDate = today;
    nextMeta.dailySavedAt = now.toISOString();
    nextMeta.dailyFile = path.relative(dataDir, dailyBackupPath);
    nextMeta.clientHistoryDailyFile = path.relative(
      dataDir,
      clientHistoryDailyBackupPath,
    );
  }

  if (shouldWriteWeekly) {
    await copyCurrentDatabase(weeklyBackupPath);
    await copyClientHistoryDatabase(clientHistoryWeeklyBackupPath);
    nextMeta.weeklyWeek = week;
    nextMeta.weeklySavedAt = now.toISOString();
    nextMeta.weeklyFile = path.relative(dataDir, weeklyBackupPath);
    nextMeta.clientHistoryWeeklyFile = path.relative(
      dataDir,
      clientHistoryWeeklyBackupPath,
    );
  }

  if (shouldWriteDaily || shouldWriteWeekly) {
    await fs.writeFile(
      backupMetaPath,
      `${JSON.stringify(nextMeta, null, 2)}${os.EOL}`,
      "utf8",
    );
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
    ? new Date(
        ...String(value)
          .split("-")
          .map((part, index) => Number(part) - (index === 1 ? 1 : 0)),
      )
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

function normalizedFilterText(value) {
  return removeDiacritics(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

function barExportDate(timestamp) {
  const date = new Date(timestamp || Date.now());
  return Number.isFinite(date.getTime())
    ? localDateText(date)
    : localDateText();
}

function barExportLineRowsForRange(fromDate, toDate, includeAll, filters = {}) {
  const rows = db
    .prepare(`
      SELECT *
      FROM bar_export_lines
      WHERE method <> 'voucher'
        AND (? = 1 OR sale_date >= ?)
        AND (? = 1 OR sale_date <= ?)
      ORDER BY sale_timestamp ASC, id ASC
    `)
    .all(includeAll ? 1 : 0, fromDate || "", includeAll ? 1 : 0, toDate || "");
  const productNameFilter = normalizedFilterText(filters.productName);
  const vatFilter = String(filters.vatRate || "").trim();
  return rows.filter((row) => {
    const productMatches =
      !productNameFilter ||
      normalizedFilterText(row.name).includes(productNameFilter) ||
      normalizedFilterText(row.filter_name).includes(productNameFilter);
    const vatMatches = !vatFilter || String(row.vat_rate) === vatFilter;
    return productMatches && vatMatches;
  });
}

function groupedBarExportLines(rows) {
  const groups = new Map();
  const payments = { card: 0, numerar: 0, voucher: 0, other: 0 };
  rows.forEach((row) => {
    const method = ["card", "numerar", "voucher"].includes(row.method)
      ? row.method
      : "other";
    const name = cleanReceiptText(row.name);
    const vatRate = Number(row.vat_rate);
    const unitGross = receiptNumber(row.unit_gross);
    const qty = receiptNumber(row.quantity);
    const grossTotal = receiptNumber(row.gross_total);
    if (
      !name ||
      qty <= 0 ||
      unitGross <= 0 ||
      grossTotal <= 0 ||
      ![0, 11, 21].includes(vatRate)
    )
      return;
    const key = `${row.article_key}::${name}::${vatRate}::${money(unitGross)}`;
    const group = groups.get(key) || {
      articleKey: String(row.article_key || ""),
      name,
      vatRate,
      unitGross,
      quantity: 0,
      grossTotal: 0,
    };
    group.quantity += qty;
    group.grossTotal += grossTotal;
    groups.set(key, group);
    payments[method] += grossTotal;
  });

  return {
    lines: [...groups.values()].sort(
      (first, second) =>
        first.name.localeCompare(second.name, "ro-RO", { numeric: true }) ||
        first.vatRate - second.vatRate ||
        first.unitGross - second.unitGross,
    ),
    payments,
  };
}

function insertBarExportLines(paymentId, lines, context) {
  if (!Array.isArray(lines) || !lines.length) return;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO bar_export_lines
      (id, payment_id, sale_timestamp, sale_date, method, source_type, article_key, name, filter_name,
       unit_gross, quantity, vat_rate, gross_total, exported_at, export_batch_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
  `);
  lines.forEach((line) => {
    insert.run(
      line.id,
      paymentId,
      context.now,
      barExportDate(context.now),
      context.method,
      line.sourceType,
      line.articleKey,
      line.name,
      line.filterName || line.name,
      line.unitGross,
      line.quantity,
      line.vatRate,
      line.grossTotal,
      context.now,
    );
  });
}

function directBarExportLines(items, paymentId) {
  const lines = [];
  items.forEach((item) => {
    const quantityValue = receiptNumber(item.quantity);
    const productTotal = receiptNumber(
      item.subtotal ?? receiptNumber(item.price) * quantityValue,
    );
    lines.push({
      id: `${paymentId}:product:${item.key}`,
      sourceType: "bar",
      articleKey: String(item.key || ""),
      name: String(item.name || "Articol bar"),
      filterName: String(item.name || "Articol bar"),
      unitGross: receiptNumber(item.price),
      quantity: quantityValue,
      vatRate: Number(item.vatRate),
      grossTotal: productTotal,
    });
    const sgrTotal = receiptNumber(item.sgrTotal);
    if (sgrTotal > 0) {
      lines.push({
        id: `${paymentId}:sgr:${item.key}`,
        sourceType: "bar",
        articleKey: "AMBALAJ-SGR",
        name: "AMBALAJ SGR",
        filterName: String(item.name || "Articol bar"),
        unitGross: 0.5,
        quantity: sgrTotal / 0.5,
        vatRate: 0,
        grossTotal: sgrTotal,
      });
    }
  });
  return lines;
}

function reservationBarReceiptLines(stays, mode, context) {
  const lines = [];
  const stateRow = db.prepare(`
    SELECT handled_quantity, handled_sgr_total
    FROM reservation_bar_receipt_state
    WHERE stay_key = ? AND item_id = ?
  `);
  const saveState = db.prepare(`
    INSERT INTO reservation_bar_receipt_state
      (stay_key, item_id, handled_quantity, handled_sgr_total, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(stay_key, item_id) DO UPDATE SET
      handled_quantity = excluded.handled_quantity,
      handled_sgr_total = excluded.handled_sgr_total,
      updated_at = excluded.updated_at
  `);

  stays.forEach((stay) => {
    reservationReceiptBarItems(stay).forEach((item) => {
      const previous = stateRow.get(stay.key, item.id) || {
        handled_quantity: 0,
        handled_sgr_total: 0,
      };
      const quantityDelta = Math.max(
        0,
        receiptNumber(item.quantity) - receiptNumber(previous.handled_quantity),
      );
      const sgrDelta = Math.max(
        0,
        receiptNumber(item.sgrTotal) -
          receiptNumber(previous.handled_sgr_total),
      );
      if (mode === "separate" && quantityDelta > 0) {
        const lineBase = `${context.paymentId}:reservation:${stay.key}:${item.id}`;
        lines.push({
          id: `${lineBase}:product`,
          sourceType: "reservation-separate",
          articleKey: item.articleKey,
          name: item.name,
          filterName: item.name,
          unitGross: item.price,
          quantity: quantityDelta,
          vatRate: item.vatRateValue,
          grossTotal: Math.round(item.price * quantityDelta * 100) / 100,
        });
        if (sgrDelta > 0) {
          lines.push({
            id: `${lineBase}:sgr`,
            sourceType: "reservation-separate",
            articleKey: "AMBALAJ-SGR",
            name: "AMBALAJ SGR",
            filterName: item.name,
            unitGross: 0.5,
            quantity: sgrDelta / 0.5,
            vatRate: 0,
            grossTotal: sgrDelta,
          });
        }
      }
      saveState.run(
        stay.key,
        item.id,
        item.quantity,
        item.sgrTotal,
        context.now,
      );
    });
  });
  return lines;
}

function barReceiptStateTransactions() {
  return db
    .prepare(`
      SELECT id, type, method, result, created_at
      FROM payment_transactions
      WHERE type IN ('bar', 'stay')
      ORDER BY created_at ASC, id ASC
    `)
    .all();
}

function barReceiptStateFingerprint(transactions) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        transactions.map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          method: transaction.method,
          result: transaction.result,
          created_at: transaction.created_at,
        })),
      ),
    )
    .digest("hex");
}

function validateBarReceiptItems(items, label) {
  if (!Array.isArray(items)) {
    throw new Error(`${label} trebuie să fie o listă`);
  }
  items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${label}[${index}] este invalid`);
    }
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`${label}[${index}] are cantitate invalidă`);
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`${label}[${index}] are preț invalid`);
    }
    if (
      item.sgrTotal !== undefined &&
      (!Number.isFinite(Number(item.sgrTotal)) || Number(item.sgrTotal) < 0)
    ) {
      throw new Error(`${label}[${index}] are SGR invalid`);
    }
  });
}

function validatedBarReceiptTransactions(transactions) {
  return transactions.map((transaction) => {
    let result;
    try {
      result = JSON.parse(transaction.result || "");
    } catch {
      throw new Error(`Rezultatul plății ${transaction.id} nu este JSON valid`);
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error(`Rezultatul plății ${transaction.id} este invalid`);
    }
    if (transaction.type === "bar") {
      if (result.type !== "bar" || !result.sale || typeof result.sale !== "object") {
        throw new Error(`Rezultatul plății bar ${transaction.id} este incomplet`);
      }
      validateBarReceiptItems(result.sale.items, `Plata bar ${transaction.id}`);
    } else if (transaction.type === "stay") {
      if (result.type !== "stay" || !Array.isArray(result.stays)) {
        throw new Error(`Rezultatul plății de cazare ${transaction.id} este incomplet`);
      }
      result.stays.forEach((stay, index) => {
        if (!stay || typeof stay !== "object" || Array.isArray(stay)) {
          throw new Error(`Rezervarea din plata ${transaction.id}[${index}] este invalidă`);
        }
        if (stay.barItems !== undefined) {
          validateBarReceiptItems(
            stay.barItems,
            `Articolele bar din plata ${transaction.id}[${index}]`,
          );
        }
      });
    }
    return { transaction, result };
  });
}

function saveBarReceiptStateMarker(transactions, now) {
  validatedBarReceiptTransactions(transactions);
  db.prepare(`
    INSERT INTO reservation_bar_receipt_state_meta
      (id, rebuild_version, transaction_fingerprint, last_error, updated_at)
    VALUES (1, ?, ?, '', ?)
    ON CONFLICT(id) DO UPDATE SET
      rebuild_version = excluded.rebuild_version,
      transaction_fingerprint = excluded.transaction_fingerprint,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).run(
    barReceiptStateRebuildVersion,
    barReceiptStateFingerprint(transactions),
    now,
  );
}

function backfillBarExportLedger() {
  const transactions = barReceiptStateTransactions();
  const fingerprint = barReceiptStateFingerprint(transactions);
  const marker = db
    .prepare(
      "SELECT rebuild_version, transaction_fingerprint FROM reservation_bar_receipt_state_meta WHERE id = 1",
    )
    .get();
  if (
    marker?.rebuild_version === barReceiptStateRebuildVersion &&
    marker.transaction_fingerprint === fingerprint
  ) {
    return { rebuilt: false };
  }

  let validated;
  try {
    validated = validatedBarReceiptTransactions(transactions);
  } catch (error) {
    console.error(
      "Bar receipt state reconstruction skipped:",
      error.message,
    );
    return { rebuilt: false, error: error.message };
  }

  let transactionStarted = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    db.exec("DELETE FROM reservation_bar_receipt_state");
    validated.forEach(({ transaction, result }) => {
      const context = {
        paymentId: transaction.id,
        method: transaction.method,
        now: transaction.created_at,
      };
      if (transaction.type === "bar" && Array.isArray(result.sale?.items)) {
        insertBarExportLines(
          transaction.id,
          directBarExportLines(result.sale.items, transaction.id),
          context,
        );
        return;
      }
      if (transaction.type === "stay" && Array.isArray(result.stays)) {
        const mode = normalizedReceiptBarMode(result.receiptBarMode);
        insertBarExportLines(
          transaction.id,
          reservationBarReceiptLines(result.stays, mode, context),
          context,
        );
      }
    });
    saveBarReceiptStateMarker(transactions, new Date().toISOString());
    db.exec("COMMIT");
    return { rebuilt: true };
  } catch (error) {
    if (transactionStarted) db.exec("ROLLBACK");
    console.error(
      "Bar receipt state reconstruction skipped:",
      error.message,
    );
    return { rebuilt: false, error: error.message };
  }
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
  const productName = String(options.productName || "").trim();
  const vatRate = ["0", "11", "21"].includes(String(options.vatRate || ""))
    ? String(options.vatRate)
    : "";
  const rows = barExportLineRowsForRange(fromDate, toDate, includeAll, {
    productName,
    vatRate,
  });
  const grouped = groupedBarExportLines(rows);

  if (!grouped.lines.length) {
    const error = new Error(
      "Nu există vânzări de bar pentru perioada și filtrele alese",
    );
    error.statusCode = 404;
    throw error;
  }

  const exportedAt = new Date().toISOString();
  const batchId = safeFilePart(
    `BAR-${compactDate(exportDate)}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  );
  const documentNumber = safeFilePart(options.documentNumber || batchId);
  let totalNet = 0;
  let totalVat = 0;
  let totalGross = 0;
  const lineXml = grouped.lines
    .map((line, index) => {
      const lineGross = Math.round(line.grossTotal * 100) / 100;
      const lineNet =
        line.vatRate > 0
          ? Math.round((lineGross / (1 + line.vatRate / 100)) * 100) / 100
          : lineGross;
      const lineVat = Math.round((lineGross - lineNet) * 100) / 100;
      totalNet += lineNet;
      totalVat += lineVat;
      totalGross += lineGross;
      const unitNet = line.quantity > 0 ? lineNet / line.quantity : 0;
      const articleCode = safeFilePart(line.articleKey, "ART");
      return [
        "<Linie>",
        xmlTag("LinieNrCrt", index + 1),
        xmlTag("Descriere", line.name),
        xmlTag("CodArticolClient", articleCode),
        xmlTag("GUID_cod_articol", `MARINA-BAR-${articleCode}`),
        xmlTag(
          "InformatiiSuplimentare",
          `Pret vanzare cu TVA: ${money(line.unitGross)} lei`,
        ),
        xmlTag("UM", "BUC"),
        xmlTag("Cantitate", quantity(line.quantity)),
        xmlTag("Pret", sagaNumber(unitNet, 4)),
        xmlTag("Valoare", money(lineNet)),
        xmlTag("ProcTVA", line.vatRate),
        xmlTag("TVA", money(lineVat)),
        xmlTag("Cont", line.vatRate === 0 ? "7588" : "707"),
        "</Linie>",
      ].join("");
    })
    .join("");

  const periodLabel = includeAll
    ? "toate vanzarile"
    : `${fromDate} - ${toDate}`;
  const info = [
    `Export iesiri bar ${periodLabel}`,
    productName ? `Filtru produs: ${productName}` : "",
    vatRate ? `Filtru TVA: ${vatRate}%` : "",
    `Bonuri/plati incluse: ${new Set(rows.map((row) => row.payment_id)).size}`,
    `Card: ${money(grouped.payments.card)}`,
    `Numerar: ${money(grouped.payments.numerar)}`,
    `Voucher: ${money(grouped.payments.voucher)}`,
  ]
    .filter(Boolean)
    .join("; ");
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
    "</Facturi>",
  ].join(os.EOL);
  const filename = `F_${safeFilePart(companyCif, "CIF")}_${documentNumber}_${compactDate(exportDate)}.xml`;
  return {
    xml,
    filename,
    entries: new Set(rows.map((row) => row.payment_id)).size,
    lines: grouped.lines.length,
    total: money(totalGross),
    exportedAt,
    batchId,
  };
}

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSagaBarSalesReportHtml(report) {
  const fontPath = path.join(rootDir, "fonts", "Rubik-Variable.ttf");
  const fontData = fsSync.existsSync(fontPath)
    ? fsSync.readFileSync(fontPath).toString("base64")
    : "";
  const lineRows = report.grouped.lines
    .map(
      (line, index) => `
        <tr>
          <td class="row-number">${index + 1}</td>
          <td class="product">
            <strong>${htmlEscape(line.name)}</strong>
            <small>${htmlEscape(line.articleKey || "Fără cod")}</small>
          </td>
          <td class="number">${htmlEscape(quantity(line.quantity))}</td>
          <td class="number">${htmlEscape(money(line.unitGross))}</td>
          <td class="number">${htmlEscape(String(line.vatRate))}%</td>
          <td class="number total">${htmlEscape(money(line.grossTotal))}</td>
        </tr>`,
    )
    .join("");
  const filterParts = [
    report.productName ? `Produs: ${report.productName}` : "",
    report.vatRate ? `TVA: ${report.vatRate}%` : "",
  ].filter(Boolean);

  return `<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8" />
  <style>
    ${fontData ? `@font-face { font-family: "Rubik"; src: url(data:font/ttf;base64,${fontData}) format("truetype"); font-weight: 300 900; }` : ""}
    * { box-sizing: border-box; }
    html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body {
      margin: 0;
      color: #172033;
      font-family: ${fontData ? '"Rubik"' : "Arial"}, sans-serif;
      font-size: 10.5px;
      line-height: 1.45;
    }
    header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0d7b66;
    }
    .eyebrow {
      margin: 0 0 5px;
      color: #0d7b66;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }
    h1 { margin: 0; font-size: 24px; line-height: 1.15; }
    .company { max-width: 220px; text-align: right; }
    .company strong { display: block; font-size: 13px; }
    .company span { color: #667085; }
    .meta-grid, .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .meta-card, .summary-card {
      min-width: 0;
      padding: 10px 12px;
      border: 1px solid #d9e2e7;
      border-radius: 8px;
      background: #f7faf9;
    }
    .meta-card span, .summary-card span {
      display: block;
      margin-bottom: 3px;
      color: #667085;
      font-size: 8.5px;
      font-weight: 700;
      letter-spacing: .45px;
      text-transform: uppercase;
    }
    .meta-card strong, .summary-card strong {
      display: block;
      overflow-wrap: anywhere;
      font-size: 12px;
    }
    .summary-card.highlight {
      color: #fff;
      border-color: #0d7b66;
      background: #0d7b66;
    }
    .summary-card.highlight span { color: #d5f3eb; }
    h2 { margin: 18px 0 8px; font-size: 14px; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid-page; page-break-inside: avoid; }
    th {
      padding: 8px 7px;
      color: #fff;
      background: #243447;
      font-size: 8.5px;
      letter-spacing: .3px;
      text-align: left;
      text-transform: uppercase;
    }
    td {
      padding: 8px 7px;
      border-bottom: 1px solid #e3e8eb;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #f8fafb; }
    .row-number { width: 5%; color: #667085; }
    .product { width: 43%; overflow-wrap: anywhere; word-break: break-word; }
    .product strong, .product small { display: block; }
    .product small { margin-top: 2px; color: #7b8494; font-size: 8.5px; }
    .number { width: 13%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .total { font-weight: 700; }
    .payment-summary {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
      break-inside: avoid;
    }
    .payment-summary div {
      padding: 8px 9px;
      border-top: 2px solid #c9d4da;
      background: #f8fafb;
    }
    .payment-summary span { display: block; color: #667085; font-size: 8px; text-transform: uppercase; }
    .payment-summary strong { display: block; margin-top: 3px; font-size: 11px; }
    .note { margin: 14px 0 0; color: #667085; font-size: 8.5px; }
  </style>
</head>
<body>
  <header>
    <div>
      <p class="eyebrow">Raport comercial</p>
      <h1>Raport vânzări bar</h1>
    </div>
    <div class="company">
      <strong>${htmlEscape(report.companyName)}</strong>
      <span>CIF ${htmlEscape(report.companyCif)} · ${htmlEscape(report.clientName)}</span>
    </div>
  </header>

  <section class="meta-grid">
    <div class="meta-card"><span>Data exportului</span><strong>${htmlEscape(report.exportDate)}</strong></div>
    <div class="meta-card"><span>Perioada raportată</span><strong>${htmlEscape(report.periodLabel)}</strong></div>
    <div class="meta-card"><span>Filtre</span><strong>${htmlEscape(filterParts.join(" · ") || "Fără filtre")}</strong></div>
  </section>

  <section class="summary-grid">
    <div class="summary-card"><span>Produse distincte</span><strong>${report.grouped.lines.length}</strong></div>
    <div class="summary-card"><span>Cantitate totală</span><strong>${htmlEscape(quantity(report.totalQuantity))}</strong></div>
    <div class="summary-card highlight"><span>Valoare totală</span><strong>${htmlEscape(money(report.totalGross))} lei</strong></div>
  </section>

  <h2>Produse vândute</h2>
  <table>
    <thead>
      <tr>
        <th class="row-number">Nr.</th>
        <th class="product">Produs / cod articol</th>
        <th class="number">Cantitate</th>
        <th class="number">Preț unitar</th>
        <th class="number">TVA</th>
        <th class="number">Valoare totală</th>
      </tr>
    </thead>
    <tbody>${lineRows}</tbody>
  </table>

  <section class="payment-summary">
    <div><span>Bonuri / plăți</span><strong>${report.entries}</strong></div>
    <div><span>Card</span><strong>${htmlEscape(money(report.grouped.payments.card))} lei</strong></div>
    <div><span>Numerar</span><strong>${htmlEscape(money(report.grouped.payments.numerar))} lei</strong></div>
    <div><span>Voucher</span><strong>${htmlEscape(money(report.grouped.payments.voucher))} lei</strong></div>
    <div><span>Alte metode</span><strong>${htmlEscape(money(report.grouped.payments.other))} lei</strong></div>
  </section>
  <p class="note">Prețurile unitare și valorile totale includ TVA. Vânzările achitate cu voucher nu sunt incluse.</p>
</body>
</html>`;
}

async function buildSagaBarSalesPdf(options = {}) {
  const includeAll = options.all === "1" || options.all === "true";
  const todayText = localDateText();
  const fromDate = includeAll ? "" : String(options.from || todayText);
  const toDate = includeAll ? "" : String(options.to || fromDate || todayText);
  const exportDate = todayText;
  const companyCif = String(options.companyCif || "INTRODU_CIF").trim();
  const companyName = String(options.companyName || "Marina Park").trim();
  const clientName = String(options.clientName || "Client generic bar").trim();
  const productName = String(options.productName || "").trim();
  const vatRate = ["0", "11", "21"].includes(String(options.vatRate || ""))
    ? String(options.vatRate)
    : "";
  const rows = barExportLineRowsForRange(fromDate, toDate, includeAll, {
    productName,
    vatRate,
  });
  const grouped = groupedBarExportLines(rows);

  if (!grouped.lines.length) {
    const error = new Error(
      "Nu există vânzări de bar pentru perioada și filtrele alese",
    );
    error.statusCode = 404;
    throw error;
  }

  const exportedAt = new Date().toISOString();
  const periodLabel = includeAll
    ? "Toate vânzările"
    : `${fromDate} - ${toDate}`;
  const entries = new Set(rows.map((row) => row.payment_id)).size;
  const totalQuantity = grouped.lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );
  const totalGross = grouped.lines.reduce(
    (sum, line) => sum + line.grossTotal,
    0,
  );
  const batchId = safeFilePart(
    `BAR-PDF-${compactDate(exportDate)}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  );
  const report = {
    companyCif,
    companyName,
    clientName,
    productName,
    vatRate,
    exportDate,
    periodLabel,
    entries,
    grouped,
    totalQuantity,
    totalGross,
  };
  const pdf = await renderPdfDocument(buildSagaBarSalesReportHtml(report));
  const filenamePeriod = includeAll
    ? "toate"
    : `${compactDate(fromDate)}-${compactDate(toDate)}`;
  const filename = `Raport_vanzari_bar_${safeFilePart(filenamePeriod, "perioada")}_${compactDate(exportDate)}.pdf`;
  return {
    pdf,
    filename,
    entries,
    lines: grouped.lines.length,
    total: money(totalGross),
    exportedAt,
    batchId,
  };
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

function receiptTimestampLabel() {
  const now = new Date();
  return {
    date: new Intl.DateTimeFormat("ro-RO").format(now),
    time: new Intl.DateTimeFormat("ro-RO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now),
  };
}

function paymentRequestId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(id)) {
    throw requestError(400, "Identificatorul plății este invalid");
  }
  return id;
}

function normalizedPaymentMethod(value) {
  const method = String(value || "")
    .trim()
    .toLowerCase();
  if (!["card", "numerar", "voucher"].includes(method)) {
    throw requestError(400, "Metoda de plată este invalidă");
  }
  return method;
}

function paymentTransactionRow(id) {
  return (
    db.prepare("SELECT * FROM payment_transactions WHERE id = ?").get(id) ||
    null
  );
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
      const directory = await receiptDirectoryFor({
        receiptDirectory: row.receipt_directory,
      });
      const receiptPath = path.join(directory, "bon.inp");
      const tempPath = path.join(
        directory,
        `.bon-${safeFilePart(paymentId, "payment")}.tmp`,
      );
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
    setPaymentStatus(
      paymentId,
      row.status === "receipt_written" ? "receipt_written" : "receipt_pending",
      error.message,
    );
  }

  return paymentTransactionRow(paymentId);
}

async function retryPendingPaymentOutbox() {
  const pending = db
    .prepare(
      "SELECT id FROM payment_transactions WHERE status <> 'completed' ORDER BY created_at ASC LIMIT 100",
    )
    .all();
  for (const row of pending) {
    await publishPaymentOutbox(row.id);
  }
}

function bumpDatabaseSavedAt(now) {
  const config = { ...configRow(), savedAt: now };
  db.prepare(`
    INSERT INTO app_config (key, updated_at, data)
    VALUES ('app', ?, ?)
    ON CONFLICT(key) DO UPDATE SET updated_at = excluded.updated_at, data = excluded.data
  `).run(now, JSON.stringify(config));
  return now;
}

function reservationByKey(key) {
  const row = db
    .prepare("SELECT data FROM reservations WHERE key = ?")
    .get(String(key || ""));
  return row ? safeJsonParse(row.data) : null;
}

function stationingByKey(key) {
  const row = db
    .prepare("SELECT data FROM stationing WHERE key = ?")
    .get(String(key || ""));
  return row ? safeJsonParse(row.data) : null;
}

function updateReservationRow(stay, now) {
  const result = db
    .prepare(`
    UPDATE reservations
    SET id = ?, guest = ?, group_name = ?, kind = ?, start_date = ?, end_date = ?, updated_at = ?, data = ?
    WHERE key = ?
  `)
    .run(
      String(stay.id || ""),
      String(stay.guest || ""),
      String(stay.group || ""),
      String(stay.kind || ""),
      stay.start || null,
      stay.end || null,
      now,
      JSON.stringify(stay),
      String(stay.key || ""),
    );
  if (!result.changes)
    throw requestError(404, `Rezervarea ${stay.key || ""} nu există`);
}

function updateStationingRow(record, now) {
  const normalized = stationingCalculator.normalizeRecord(record);
  const startDate = String(normalized.startDate || now.slice(0, 10));
  const result = db
    .prepare(`
    UPDATE stationing
    SET owner = ?, caravan = ?, start_date = ?, end_date = ?, price_per_day_cents = ?, open_ended = ?, updated_at = ?, data = ?
    WHERE key = ?
  `)
    .run(
      String(normalized.owner || ""),
      String(normalized.caravan || ""),
      startDate,
      normalized.endDate || "",
      normalized.pricePerDayCents,
      normalized.openEnded ? 1 : 0,
      now,
      JSON.stringify(normalized),
      String(normalized.key || ""),
    );
  if (!result.changes)
    throw requestError(404, `Staționarea ${normalized.key || ""} nu există`);
  db.prepare("DELETE FROM stationing_payments WHERE stationing_key = ?").run(
    normalized.key,
  );
  const insertPayment = db.prepare(`
    INSERT INTO stationing_payments
      (payment_id, stationing_key, payment_date, amount_cents, method, note, kind, voided_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  normalized.paymentTransactions.forEach((payment) => {
    insertPayment.run(
      payment.id,
      normalized.key,
      payment.paymentDate,
      payment.amountCents,
      payment.method,
      payment.note,
      payment.kind,
      payment.voidedAt,
      payment.createdAt,
    );
  });
  db.prepare("DELETE FROM stationing_stay_links WHERE stationing_key = ?").run(
    normalized.key,
  );
  const insertLink = db.prepare(`
    INSERT INTO stationing_stay_links (stationing_key, stay_key, subtract_days, linked_at)
    VALUES (?, ?, ?, ?)
  `);
  normalized.stayLinks.forEach((link) => {
    insertLink.run(
      normalized.key,
      link.stayKey,
      link.subtractDays ? 1 : 0,
      link.linkedAt || now,
    );
  });
}

function coveredReservationAmount(stay) {
  const price = Math.max(0, receiptNumber(stay?.price));
  const explicitSettled = Math.max(
    0,
    receiptNumber(stay?.settledPrice ?? stay?.paidThroughPrice),
  );
  if (explicitSettled > 0) return Math.min(price, explicitSettled);
  return stay?.paid === true ||
    stay?.isPaid === true ||
    stay?.paymentStatus === "paid"
    ? price
    : 0;
}

function reservationOutstanding(stay) {
  return Math.max(
    0,
    Math.round(
      (receiptNumber(stay?.price) - coveredReservationAmount(stay)) * 100,
    ) / 100,
  );
}

function allocateProportionally(amount, balances) {
  const amountCents = Math.round(receiptNumber(amount) * 100);
  const weights = balances.map((value) =>
    Math.max(0, Math.round(receiptNumber(value) * 100)),
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (amountCents <= 0 || totalWeight <= 0) return balances.map(() => 0);
  const distributable = Math.min(amountCents, totalWeight);
  const exactShares = weights.map(
    (weight) => (distributable * weight) / totalWeight,
  );
  const allocated = exactShares.map(Math.floor);
  let remaining =
    distributable - allocated.reduce((sum, value) => sum + value, 0);
  const remainderOrder = exactShares
    .map((share, index) => ({ index, fraction: share - allocated[index] }))
    .filter(({ index }) => weights[index] > 0)
    .sort(
      (first, second) =>
        second.fraction - first.fraction || first.index - second.index,
    );

  for (const { index } of remainderOrder) {
    if (remaining <= 0) break;
    if (allocated[index] >= weights[index]) continue;
    allocated[index] += 1;
    remaining -= 1;
  }

  return allocated.map((cents) => cents / 100);
}

function normalizedReceiptBarMode(value) {
  return String(value || "").trim() === "separate" ? "separate" : "combined";
}

function reservationReceiptBarItems(stay = {}) {
  if (!Array.isArray(stay.barItems)) return [];
  return stay.barItems
    .map((item, index) => {
      const quantity = Math.max(0, receiptNumber(item.quantity));
      const price = receiptNumber(item.price);
      const hasSgr =
        item.hasSgr === true || item.hasSgr === "true" || item.hasSgr === 1;
      const subtotal = receiptNumber(item.subtotal ?? price * quantity);
      const sgrTotal = receiptNumber(
        item.sgrTotal ?? (hasSgr ? 0.5 * quantity : 0),
      );
      const lineTotal = receiptNumber(item.lineTotal ?? subtotal + sgrTotal);
      return {
        id: String(item.id || `bar-${index}`),
        articleKey: String(
          item.articleKey || item.key || item.id || `bar-${index}`,
        ),
        name: String(item.name || "Articol bar").trim() || "Articol bar",
        price,
        quantity,
        vatRate: receiptVatRate(item.vatRate || item.vat_rate),
        vatRateValue: Number(item.vatRate || item.vat_rate),
        hasSgr,
        subtotal,
        sgrTotal,
        lineTotal,
      };
    })
    .filter(
      (item) => item.price > 0 && item.quantity > 0 && item.lineTotal > 0,
    );
}

function reservationReceiptBarTotal(items = []) {
  return receiptNumber(
    items.reduce((sum, item) => sum + receiptNumber(item.lineTotal), 0),
  );
}

function separateAccommodationReceiptLines(stay, amount, config, options = {}) {
  const normalizedAmount = receiptNumber(amount);
  const vat = receiptVat(config.receiptVat);
  const items = reservationReceiptBarItems(stay);
  const barTotal = reservationReceiptBarTotal(items);
  if (barTotal <= 0 || normalizedAmount <= 0) {
    return [
      `S,1,______,_,__;CAZARE;${receiptAmount(normalizedAmount)};1.000;1;1;${vat};0;0;buc`,
    ];
  }

  const accommodationAmount =
    options.accommodationAmount == null
      ? receiptNumber(normalizedAmount - barTotal)
      : receiptNumber(options.accommodationAmount);
  if (accommodationAmount < 0)
    throw requestError(400, "Suma pentru cazare este invalidă");
  if (
    Math.abs(receiptNumber(accommodationAmount + barTotal) - normalizedAmount) >
    0.001
  ) {
    throw requestError(
      400,
      "Totalul bonului separat nu corespunde cu suma de cazare și articolele de bar",
    );
  }

  const lines = [];

  if (accommodationAmount > 0) {
    lines.push(
      `S,1,______,_,__;CAZARE;${receiptAmount(accommodationAmount)};1.000;1;1;${vat};0;0;buc`,
    );
  }

  let sgrQuantity = 0;
  items.forEach((item) => {
    lines.push(
      `S,1,______,_,__;${cleanReceiptText(item.name)};${receiptAmount(item.price)};${receiptQuantity(item.quantity)};1;1;${item.vatRate};0;0;buc`,
    );
    if (item.hasSgr) sgrQuantity += item.quantity;
  });
  if (sgrQuantity > 0) {
    lines.push(
      `S,1,______,_,__;AMBALAJ SGR;0.50;${receiptQuantity(sgrQuantity)};1;1;0%;0;0;buc`,
    );
  }

  return lines.length
    ? lines
    : [
        `S,1,______,_,__;CAZARE;${receiptAmount(normalizedAmount)};1.000;1;1;${vat};0;0;buc`,
      ];
}

function accommodationReceiptOutbox(
  stay,
  method,
  amount,
  config,
  paymentId,
  options = {},
) {
  if (method === "voucher")
    return { receiptDirectory: "", receiptContent: "", infoLine: "" };
  const paymentCode =
    method === "card"
      ? String(config.cardPaymentCode || "1")
      : String(config.cashPaymentCode || "0");
  const normalizedAmount = receiptAmount(amount);
  const vat = receiptVat(config.receiptVat);
  const receiptLines =
    normalizedReceiptBarMode(options.barMode) === "separate"
      ? separateAccommodationReceiptLines(stay, amount, config, {
          accommodationAmount: options.accommodationAmount,
        })
      : [`S,1,______,_,__;CAZARE;${normalizedAmount};1.000;1;1;${vat};0;0;buc`];
  const receiptContent =
    [
      ...receiptLines,
      `T,1,______,_,__;${paymentCode};${normalizedAmount};;;;`,
    ].join(os.EOL) + os.EOL;
  const { date, time } = receiptTimestampLabel();
  const methodLabel = method === "card" ? "cardul" : "numerar";
  const infoLine = `${String(stay.guest || "Client")} a plătit ~${normalizedAmount}~ lei cu ${methodLabel} la '${date}' +${time}+ (inițial ${receiptAmount(stay.price || amount)} lei)`;
  return {
    receiptDirectory: config.receiptDirectory,
    receiptContent,
    infoLine,
    paymentId,
  };
}

function barReceiptOutbox(sale, method, config, paymentId) {
  if (method === "voucher")
    return { receiptDirectory: "", receiptContent: "", infoLine: "" };
  const paymentCode =
    method === "card"
      ? String(config.cardPaymentCode || "1")
      : String(config.cashPaymentCode || "0");
  const receiptLines = sale.items.map(
    (item) =>
      `S,1,______,_,__;${cleanReceiptText(item.name)};${receiptAmount(item.price)};${receiptQuantity(item.quantity)};1;1;${receiptVatRate(item.vatRate)};0;0;buc`,
  );
  if (sale.sgrQuantity > 0) {
    receiptLines.push(
      `S,1,______,_,__;AMBALAJ SGR;0.50;${receiptQuantity(sale.sgrQuantity)};1;1;0%;0;0;buc`,
    );
  }
  receiptLines.push(
    `T,1,______,_,__;${paymentCode};${receiptAmount(sale.total)};;;;`,
  );
  const { date, time } = receiptTimestampLabel();
  const methodLabel = method === "card" ? "cardul" : "numerar";
  const itemLabel = sale.items
    .map((item) => `${cleanReceiptText(item.name)} x${item.quantity}`)
    .join(", ");
  return {
    receiptDirectory: config.receiptDirectory,
    receiptContent: `${receiptLines.join(os.EOL)}${os.EOL}`,
    infoLine: `Bar: ${itemLabel} - total ~${receiptAmount(sale.total)}~ lei cu ${methodLabel} la '${date}' +${time}+`,
    paymentId,
  };
}

function prepareBarPayment(payload, context) {
  const requestedItems = Array.isArray(payload.items) ? payload.items : [];
  if (!requestedItems.length)
    throw requestError(400, "Checkout-ul de bar este gol");
  const articleMap = new Map(
    barArticleRows().map((article) => [String(article.key || ""), article]),
  );
  const seen = new Set();
  const items = requestedItems.map((requested) => {
    const key = String(requested.key || "");
    if (!key || seen.has(key))
      throw requestError(
        400,
        "Articole duplicate sau fără identificator în checkout",
      );
    seen.add(key);
    const article = articleMap.get(key);
    if (!article) throw requestError(404, `Articolul ${key} nu mai există`);
    const quantity = Number(requested.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw requestError(400, `Cantitate invalidă pentru ${article.name}`);
    const stock = Math.max(0, Math.floor(Number(article.stock || 0)));
    if (quantity > stock)
      throw requestError(409, `Stoc insuficient pentru ${article.name}`);
    const price = receiptNumber(article.price);
    if (price <= 0)
      throw requestError(400, `Preț invalid pentru ${article.name}`);
    const vatRate = Number(article.vatRate || article.vat_rate);
    if (![11, 21].includes(vatRate))
      throw requestError(400, `TVA invalid pentru ${article.name}`);
    const hasSgr =
      article.hasSgr === true ||
      article.hasSgr === "true" ||
      article.hasSgr === 1;
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
      article,
    };
  });
  const productsTotal =
    Math.round(items.reduce((sum, item) => sum + item.subtotal, 0) * 100) / 100;
  const sgrTotal =
    Math.round(items.reduce((sum, item) => sum + item.sgrTotal, 0) * 100) / 100;
  const sgrQuantity = items.reduce(
    (sum, item) => sum + (item.hasSgr ? item.quantity : 0),
    0,
  );
  const total = Math.round((productsTotal + sgrTotal) * 100) / 100;
  if (
    payload.amount != null &&
    Math.abs(receiptNumber(payload.amount) - total) > 0.001
  ) {
    throw requestError(
      409,
      "Totalul barului s-a schimbat. Reîncarcă checkout-ul.",
    );
  }

  const updatedArticles = items.map((item) => {
    const next = {
      ...item.article,
      stock: item.newStock,
      updatedAt: context.now,
    };
    db.prepare(
      "UPDATE bar_articles SET stock = ?, updated_at = ?, data = ? WHERE key = ?",
    ).run(item.newStock, context.now, JSON.stringify(next), item.key);
    return next;
  });
  const sale = {
    items: items.map(
      ({
        article: _article,
        previousStock: _previousStock,
        newStock: _newStock,
        ...item
      }) => item,
    ),
    productsTotal,
    sgrTotal,
    sgrQuantity,
    total,
  };
  const barExportLines = directBarExportLines(sale.items, context.paymentId);
  const stockChanges = items.map((item) => ({
    key: item.key,
    name: item.name,
    quantity: item.quantity,
    previousStock: item.previousStock,
    newStock: item.newStock,
  }));
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
    data: {
      method: context.method,
      items: sale.items,
      productsTotal,
      sgrTotal,
      total,
      stockChanges,
      voucherOnly: context.method === "voucher",
    },
  });
  return {
    entityKey: "bar-checkout",
    amount: total,
    result: { type: "bar", sale, stockChanges, barArticles: updatedArticles },
    activity,
    barExportLines,
    outbox: barReceiptOutbox(
      sale,
      context.method,
      context.config,
      context.paymentId,
    ),
  };
}

function prepareStayPayment(payload, context) {
  const linkedKeys = Array.isArray(payload.linkedKeys)
    ? [...new Set(payload.linkedKeys.map(String).filter(Boolean))]
    : [];
  const isLinked = linkedKeys.length > 0;
  const keys = isLinked ? linkedKeys : [String(payload.stayKey || "")];
  if (!keys[0]) throw requestError(400, "Rezervarea lipsește din plată");
  const currentStays = keys.map((key) => reservationByKey(key));
  if (currentStays.some((stay) => !stay || stay.guest === "Disponibil"))
    throw requestError(404, "Una dintre rezervări nu mai există");

  const paymentStays = currentStays.map((current, index) => {
    if (isLinked || index > 0 || !payload.draftStay) return { ...current };
    const draft =
      payload.draftStay && typeof payload.draftStay === "object"
        ? payload.draftStay
        : {};
    return {
      ...current,
      ...draft,
      key: current.key,
      actualPaidAmount: current.actualPaidAmount,
      settledPrice: current.settledPrice,
      paid: current.paid,
      paymentMethod: current.paymentMethod,
    };
  });
  const outstanding = paymentStays.map(reservationOutstanding);
  const totalOutstanding =
    Math.round(outstanding.reduce((sum, value) => sum + value, 0) * 100) / 100;
  const repeatPayment =
    !isLinked &&
    totalOutstanding <= 0 &&
    receiptNumber(paymentStays[0].price) > 0;
  const zeroPriceMarkPaid =
    !isLinked &&
    context.method === "voucher" &&
    receiptNumber(paymentStays[0].price) === 0 &&
    paymentStays[0].paid !== true;
  if (totalOutstanding <= 0 && !repeatPayment && !zeroPriceMarkPaid)
    throw requestError(409, "Rezervarea este deja achitată");
  const availableAmount = repeatPayment
    ? receiptNumber(paymentStays[0].price)
    : totalOutstanding;
  const amount = receiptNumber(
    payload.amount == null ? availableAmount : payload.amount,
  );
  if (zeroPriceMarkPaid ? amount !== 0 : amount <= 0) {
    throw requestError(400, "Suma trebuie să fie mai mare decât 0");
  }
  const overpaymentAmount = zeroPriceMarkPaid
    ? 0
    : repeatPayment
      ? amount
      : Math.max(0, Math.round((amount - totalOutstanding) * 100) / 100);
  const allocations =
    repeatPayment || zeroPriceMarkPaid
      ? [amount]
      : allocateProportionally(Math.min(amount, totalOutstanding), outstanding);
  if (!repeatPayment && overpaymentAmount > 0) {
    const creditIndex = Math.max(
      0,
      outstanding.findIndex((value) => value > 0),
    );
    allocations[creditIndex] =
      Math.round((allocations[creditIndex] + overpaymentAmount) * 100) / 100;
  }

  const updatedStays = paymentStays.map((stay, index) => {
    const price = Math.round(receiptNumber(stay.price) * 100) / 100;
    if (price <= 0 && !zeroPriceMarkPaid)
      throw requestError(
        400,
        `Preț invalid pentru rezervarea ${stay.id || stay.key}`,
      );
    const next = {
      ...stay,
      paymentMethod: context.method,
      settledPrice: price,
      actualPaidAmount:
        Math.round(
          (receiptNumber(stay.actualPaidAmount) + allocations[index]) * 100,
        ) / 100,
      lastPaidAmount: allocations[index],
      balance: 0,
      deposit: price,
      paid: true,
    };
    updateReservationRow(next, context.now);
    return next;
  });
  const first = updatedStays[0];
  const storedCustomerPrice =
    Math.round(
      currentStays.reduce((sum, stay) => sum + receiptNumber(stay.price), 0) *
        100,
    ) / 100;
  const suppliedInitialEditPrice = Number(payload.initialEditPrice);
  const initialEditPrice =
    !isLinked &&
    payload.initialEditPrice != null &&
    Number.isFinite(suppliedInitialEditPrice) &&
    suppliedInitialEditPrice >= 0
      ? Math.round(suppliedInitialEditPrice * 100) / 100
      : null;
  const originalCustomerPrice = initialEditPrice ?? storedCustomerPrice;
  const customerPriceAtPayment =
    Math.round(
      paymentStays.reduce((sum, stay) => sum + receiptNumber(stay.price), 0) *
        100,
    ) / 100;
  const receiptBarMode = isLinked
    ? "combined"
    : normalizedReceiptBarMode(payload.receiptBarMode);
  const receiptAccommodationAmount =
    receiptBarMode === "separate"
      ? receiptNumber(payload.receiptAccommodationAmount)
      : null;
  const barExportLines = reservationBarReceiptLines(
    updatedStays,
    receiptBarMode,
    context,
  );
  const effectivePaymentLine = ` Preț inițial client: ${money(originalCustomerPrice)} lei; plătit efectiv: ${money(amount)} lei.`;
  const activity = normalizeActivityLogEntry({
    id: `payment-${context.paymentId}`,
    timestamp: context.now,
    eventType: "payment",
    entityType: "client",
    entityKey: first.key,
    entityLabel: isLinked
      ? `${first.guest} (${updatedStays.length} rezervări)`
      : `${first.guest} (${first.id})`,
    amount,
    method: context.method,
    message: zeroPriceMarkPaid
      ? `${first.guest} a fost marcat ca achitat prin voucher.${effectivePaymentLine}`
      : isLinked
        ? `${first.guest} a plătit în total ${money(amount)} lei pentru ${updatedStays.length} rezervări prin ${context.method}.`
        : `${first.guest} a plătit ${money(amount)} lei prin ${context.method}.${effectivePaymentLine}`,
    data: {
      personId: first.personId,
      method: context.method,
      amount,
      originalCustomerPrice,
      initialEditPrice,
      customerPriceAtPayment,
      actualPaidAmount: amount,
      previousPrice: originalCustomerPrice,
      newPrice: customerPriceAtPayment,
      repeatPayment,
      zeroPriceMarkPaid,
      overpaymentAmount,
      receiptBarMode,
      receiptAccommodationAmount,
      linkedPayment: isLinked,
      allocations: updatedStays.map((stay, index) => ({
        key: stay.key,
        id: stay.id,
        outstanding: outstanding[index],
        allocatedAmount: allocations[index],
        appliedAmount: Math.min(outstanding[index], allocations[index]),
        creditAmount: Math.max(
          0,
          Math.round((allocations[index] - outstanding[index]) * 100) / 100,
        ),
      })),
    },
  });
  const receiptStay = {
    ...first,
    price: paymentStays.reduce(
      (sum, stay) => sum + receiptNumber(stay.price),
      0,
    ),
  };
  return {
    entityKey: first.key,
    amount,
    result: {
      type: "stay",
      stays: updatedStays,
      allocations: activity.data.allocations,
      overpaymentAmount,
      receiptBarMode,
      receiptAccommodationAmount,
    },
    activity,
    barExportLines,
    outbox: accommodationReceiptOutbox(
      receiptStay,
      context.method,
      amount,
      context.config,
      context.paymentId,
      {
        barMode: receiptBarMode,
        accommodationAmount: receiptAccommodationAmount,
      },
    ),
  };
}

function normalizeStationingPaymentRecord(record) {
  const normalized = stationingCalculator.normalizeRecord(record);
  const calculation = stationingCalculator.calculate(
    normalized,
    reservationRows(),
    { allowZeroPrice: true },
  );
  return {
    ...normalized,
    totalPrice: calculation.generatedTotalCents / 100,
    totalPriceCents: calculation.generatedTotalCents,
    paidAmount: calculation.amountPaidCents / 100,
    paidAmountCents: calculation.amountPaidCents,
    appliedPaymentCents: calculation.appliedPaymentCents,
    balance: calculation.remainingBalanceCents / 100,
    balanceCents: calculation.remainingBalanceCents,
    credit: calculation.creditCents / 100,
    creditCents: calculation.creditCents,
  };
}

function prepareStationingPayment(payload, context) {
  const current = stationingByKey(payload.stationingKey);
  if (!current) throw requestError(404, "Staționarea nu mai există");
  const draft =
    payload.draftStationing && typeof payload.draftStationing === "object"
      ? payload.draftStationing
      : {};
  const source = normalizeStationingPaymentRecord({
    ...current,
    ...draft,
    key: current.key,
  });
  const amountNeeded = Math.max(
    0,
    Math.round((source.balance - source.credit) * 100) / 100,
  );
  const amount = receiptNumber(
    payload.amount == null ? amountNeeded : payload.amount,
  );
  if (amount <= 0 || (!source.openEnded && amount - amountNeeded > 0.001)) {
    throw requestError(400, "Suma depășește restul staționării");
  }
  const payment = stationingCalculator.normalizePayment({
    id: context.paymentId,
    paymentDate: stationingCalculator.localDateISO(),
    amountCents: Math.round(amount * 100),
    method: context.method,
    note: String(payload.note || ""),
    createdAt: context.now,
  });
  const next = normalizeStationingPaymentRecord({
    ...source,
    paymentTransactions: [...source.paymentTransactions, payment],
  });
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
    data: {
      method: context.method,
      amount,
      previousPaidAmount: source.paidAmount,
      newPaidAmount: next.paidAmount,
      previousBalance: source.balance,
      newBalance: next.balance,
    },
  });
  return {
    entityKey: next.key,
    amount,
    result: { type: "stationing", stationing: next },
    activity,
    outbox: accommodationReceiptOutbox(
      { guest: next.owner, price: next.totalPrice },
      context.method,
      amount,
      context.config,
      context.paymentId,
    ),
  };
}

async function commitPayment(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw requestError(400, "Payload de plată invalid");
  const paymentId = paymentRequestId(payload.paymentId);
  const method = normalizedPaymentMethod(payload.method);
  const type = String(payload.type || "").trim();
  if (!["stay", "stationing", "bar"].includes(type))
    throw requestError(400, "Tipul plății este invalid");

  let existing = paymentTransactionRow(paymentId);
  if (existing) {
    if (existing.type !== type || existing.method !== method)
      throw requestError(
        409,
        "Identificatorul plății a fost deja folosit pentru altă operațiune",
      );
    existing = await publishPaymentOutbox(paymentId);
    return {
      ok: true,
      committed: true,
      receiptPending: existing.status !== "completed",
      paymentId,
      status: existing.status,
      ...parsePaymentResult(existing),
    };
  }

  const config =
    payload.receiptConfig && typeof payload.receiptConfig === "object"
      ? payload.receiptConfig
      : {};
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
    mutation =
      type === "bar"
        ? prepareBarPayment(payload, context)
        : type === "stationing"
          ? prepareStationingPayment(payload, context)
          : prepareStayPayment(payload, context);
    const savedAt = bumpDatabaseSavedAt(now);
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
      now,
    );
    insertBarExportLines(paymentId, mutation.barExportLines, context);
    if (type === "bar" || type === "stay") {
      saveBarReceiptStateMarker(barReceiptStateTransactions(), now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  if (activityResult?.inserted) {
    await writeActivityLogLocalFiles([activityResult.entry], {
      refreshSnapshot: true,
    }).catch(() => {});
  }
  await enqueueDatabaseBackup({ afterMutation: true });
  const published = await publishPaymentOutbox(paymentId);
  return {
    ok: true,
    committed: true,
    receiptPending: published.status !== "completed",
    paymentId,
    status: published.status,
    warning:
      published.status === "completed"
        ? ""
        : published.last_error ||
          "Bonul este în așteptare și va fi reîncercat automat",
    ...mutation.result,
  };
}

function removeDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function localISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const firstGroup =
    first.start === todayText ? 0 : firstStart > todayValue ? 1 : 2;
  const secondGroup =
    second.start === todayText ? 0 : secondStart > todayValue ? 1 : 2;

  if (firstGroup !== secondGroup) return firstGroup - secondGroup;

  const startCompare =
    firstGroup === 2 ? secondStart - firstStart : firstStart - secondStart;
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
  for (let column = 0; column < columns; column += 1)
    distances[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost,
      );

      if (
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        distances[row][column] = Math.min(
          distances[row][column],
          distances[row - 2][column - 2] + 1,
        );
      }
    }
  }

  return distances[first.length][second.length];
}

function fuzzyTokenScore(queryToken, targetToken) {
  if (!queryToken || !targetToken) return Infinity;
  if (queryToken === targetToken) return 0;
  if (targetToken.startsWith(queryToken))
    return clampScore(4 + Math.max(0, targetToken.length - queryToken.length));
  if (targetToken.includes(queryToken))
    return clampScore(12 + Math.max(0, targetToken.length - queryToken.length));
  if (
    queryToken.includes(targetToken) &&
    targetToken.length >= Math.min(4, queryToken.length)
  )
    return 18;
  if (queryToken.length <= 2) return Infinity;

  const allowedDistance =
    queryToken.length <= 4
      ? 2
      : Math.min(3, Math.ceil(queryToken.length * 0.35));

  if (targetToken.startsWith(queryToken[0])) {
    const prefix = targetToken.slice(
      0,
      Math.min(targetToken.length, Math.max(queryToken.length + 1, 4)),
    );
    const prefixDistance = fuzzyDistance(queryToken, prefix);
    if (prefixDistance <= allowedDistance) {
      return clampScore(
        24 + (prefixDistance / Math.max(queryToken.length, 1)) * 45,
      );
    }
  }

  const distance = fuzzyDistance(queryToken, targetToken);
  if (distance > allowedDistance) return Infinity;

  return clampScore(
    34 + (distance / Math.max(queryToken.length, targetToken.length, 1)) * 55,
  );
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
    Math.min(
      ...targetTokens.map((targetToken) =>
        fuzzyTokenScore(queryToken, targetToken),
      ),
    ),
  );
  if (tokenScores.some((score) => !Number.isFinite(score))) return Infinity;

  const averageScore =
    tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const compactWindow = compactText.slice(
    0,
    Math.max(compactQuery.length + 3, 6),
  );
  const compactDistance =
    compactQuery.length >= 4
      ? fuzzyDistance(compactQuery, compactWindow)
      : Infinity;
  const compactScore =
    compactDistance <= Math.ceil(compactQuery.length * 0.34)
      ? 22 + (compactDistance / Math.max(compactQuery.length, 1)) * 48
      : Infinity;

  return Math.min(averageScore, compactScore);
}

async function sourceBookingFixture(mode) {
  if (!sourceBookingsFixturePath) return null;
  const fixture = await readJson(sourceBookingsFixturePath, {});
  const bookings = fixture?.[mode];
  if (!Array.isArray(bookings))
    throw new Error(`Fixture Marina invalid pentru '${mode}'`);
  return bookings;
}

function normalizeMarinaApiBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || defaultMarinaApiBaseUrl).trim());
  } catch {
    throw requestError(400, "Adresa API Marina nu este validă");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw requestError(
      400,
      "Adresa API Marina trebuie să folosească HTTPS (HTTP este permis numai local)",
    );
  }
  return url.toString().replace(/\/$/, "");
}

function normalizeMarinaWorkspaceId(value, label) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === "" ||
    Number(value) === 0
  )
    return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw requestError(400, `${label} trebuie să fie un număr întreg pozitiv`);
  return id;
}

function setMarinaOAuthStorage(storage) {
  marinaOAuthStorage = storage && typeof storage === "object" ? storage : null;
}

function activeMarinaOAuthStorage() {
  return (
    marinaOAuthStorage || {
      async getRefreshToken() {
        return marinaOAuthMemoryRefreshToken;
      },
      async setRefreshToken(value) {
        marinaOAuthMemoryRefreshToken = String(value || "");
      },
      async clearRefreshToken() {
        marinaOAuthMemoryRefreshToken = "";
      },
      hasRefreshTokenSync() {
        return Boolean(marinaOAuthMemoryRefreshToken);
      },
    }
  );
}

async function marinaOAuthRefreshToken() {
  try {
    return String(
      (await activeMarinaOAuthStorage().getRefreshToken()) || "",
    ).trim();
  } catch (error) {
    if (error?.code === "marina_secure_storage_unavailable") throw error;
    return "";
  }
}

async function storeMarinaOAuthRefreshToken(value) {
  const token = String(value || "").trim();
  await activeMarinaOAuthStorage().setRefreshToken(token);
  marinaOAuthMemoryRefreshToken = token;
}

async function clearMarinaOAuthSession() {
  marinaOAuthPending = null;
  marinaOAuthAccessToken = "";
  marinaOAuthAccessTokenExpiresAt = 0;
  marinaOAuthLastError = "";
  marinaOAuthMemoryRefreshToken = "";
  try {
    await activeMarinaOAuthStorage().clearRefreshToken();
  } catch {}
}

function normalizeMarinaOAuthClientId(value) {
  const clientId = String(value || "").trim();
  if (clientId.length > 512)
    throw requestError(400, "Client ID-ul OAuth Marina este prea lung");
  return clientId;
}

function normalizeMarinaOAuthScopes(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(/[\s,]+/);
  const scopes = [
    ...new Set(values.map((scope) => String(scope).trim()).filter(Boolean)),
  ];
  return scopes.length ? scopes : [...MARINA_OAUTH_DEFAULT_SCOPES];
}

function storedMarinaApiSettings() {
  return (
    db
      .prepare(`
    SELECT api_base_url, oauth_client_id, oauth_scopes, rooms_workspace_id, camping_workspace_id, updated_at
    FROM marina_api_settings WHERE id = 1
  `)
      .get() || {
      api_base_url: defaultMarinaApiBaseUrl,
      oauth_client_id: "",
      oauth_scopes: MARINA_OAUTH_DEFAULT_SCOPES.join(" "),
      rooms_workspace_id: null,
      camping_workspace_id: null,
      updated_at: "",
    }
  );
}

function effectiveMarinaApiSettings() {
  const stored = storedMarinaApiSettings();
  const environmentWorkspace = process.env.MARINA_WORKSPACE_ID;
  const environmentClientId = String(
    process.env.MARINA_OAUTH_CLIENT_ID || "",
  ).trim();
  const environmentScopes = String(
    process.env.MARINA_OAUTH_SCOPES || "",
  ).trim();
  const apiBaseUrlValue =
    process.env.MARINA_API_URL ||
    process.env.MARINA_API_BASE_URL ||
    stored.api_base_url ||
    defaultMarinaApiBaseUrl;
  return {
    apiBaseUrl: normalizeMarinaApiBaseUrl(apiBaseUrlValue),
    oauthClientId: normalizeMarinaOAuthClientId(
      environmentClientId || stored.oauth_client_id,
    ),
    oauthScopes: normalizeMarinaOAuthScopes(
      environmentScopes || stored.oauth_scopes,
    ),
    roomsWorkspaceId: normalizeMarinaWorkspaceId(
      process.env.MARINA_ROOMS_WORKSPACE_ID ||
        environmentWorkspace ||
        stored.rooms_workspace_id,
      "Workspace-ul pentru Camere",
    ),
    campingWorkspaceId: normalizeMarinaWorkspaceId(
      process.env.MARINA_CAMPING_WORKSPACE_ID ||
        environmentWorkspace ||
        stored.camping_workspace_id,
      "Workspace-ul pentru Camping",
    ),
    oauthClientManagedByEnvironment: Boolean(environmentClientId),
    oauthScopesManagedByEnvironment: Boolean(environmentScopes),
    apiUrlManagedByEnvironment: Boolean(
      process.env.MARINA_API_URL || process.env.MARINA_API_BASE_URL,
    ),
    workspacesManagedByEnvironment: Boolean(
      process.env.MARINA_ROOMS_WORKSPACE_ID ||
        process.env.MARINA_CAMPING_WORKSPACE_ID ||
        process.env.MARINA_WORKSPACE_ID,
    ),
    updatedAt: stored.updated_at || "",
  };
}

function marinaOAuthConnectedSync() {
  const storage = activeMarinaOAuthStorage();
  return Boolean(
    (marinaOAuthAccessToken && marinaOAuthAccessTokenExpiresAt > Date.now()) ||
      marinaOAuthMemoryRefreshToken ||
      storage.hasRefreshTokenSync?.(),
  );
}

function publicMarinaApiSettings() {
  const settings = effectiveMarinaApiSettings();
  return {
    ok: true,
    configured: Boolean(settings.oauthClientId),
    oauthConfigured: Boolean(settings.oauthClientId),
    oauthConnected: Boolean(
      settings.oauthClientId && marinaOAuthConnectedSync(),
    ),
    oauthConnecting: Boolean(marinaOAuthPending),
    oauthError: marinaOAuthLastError,
    oauthClientId: settings.oauthClientId,
    oauthScopes: settings.oauthScopes,
    redirectUri: MARINA_OAUTH_REDIRECT_URI,
    apiBaseUrl: settings.apiBaseUrl,
    roomsWorkspaceId: settings.roomsWorkspaceId,
    campingWorkspaceId: settings.campingWorkspaceId,
    oauthClientManagedByEnvironment: settings.oauthClientManagedByEnvironment,
    oauthScopesManagedByEnvironment: settings.oauthScopesManagedByEnvironment,
    apiUrlManagedByEnvironment: settings.apiUrlManagedByEnvironment,
    workspacesManagedByEnvironment: settings.workspacesManagedByEnvironment,
    updatedAt: settings.updatedAt,
  };
}

function saveMarinaApiSettings(payload = {}) {
  const current = storedMarinaApiSettings();
  const apiBaseUrl = normalizeMarinaApiBaseUrl(
    payload.apiBaseUrl ?? current.api_base_url,
  );
  const oauthClientId = normalizeMarinaOAuthClientId(
    payload.oauthClientId ?? current.oauth_client_id,
  );
  const oauthScopes = normalizeMarinaOAuthScopes(
    payload.oauthScopes ?? current.oauth_scopes,
  ).join(" ");
  const roomsWorkspaceId = normalizeMarinaWorkspaceId(
    payload.roomsWorkspaceId,
    "Workspace-ul pentru Camere",
  );
  const campingWorkspaceId = normalizeMarinaWorkspaceId(
    payload.campingWorkspaceId,
    "Workspace-ul pentru Camping",
  );
  const clientChanged =
    String(current.oauth_client_id || "").trim() !== oauthClientId;
  const baseUrlChanged =
    String(current.api_base_url || "").trim() !== apiBaseUrl;
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO marina_api_settings
      (id, api_base_url, api_token, oauth_client_id, oauth_scopes, rooms_workspace_id, camping_workspace_id, updated_at)
    VALUES (1, ?, '', ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      api_token = '',
      api_base_url = excluded.api_base_url,
      oauth_client_id = excluded.oauth_client_id,
      oauth_scopes = excluded.oauth_scopes,
      rooms_workspace_id = excluded.rooms_workspace_id,
      camping_workspace_id = excluded.camping_workspace_id,
      updated_at = excluded.updated_at
  `).run(
    apiBaseUrl,
    oauthClientId,
    oauthScopes,
    roomsWorkspaceId,
    campingWorkspaceId,
    updatedAt,
  );
  if (baseUrlChanged) marinaOAuthMetadataCache = null;
  if (clientChanged || baseUrlChanged) void clearMarinaOAuthSession();
  marinaSourceCache.clear();
  clientDirectoryCache = null;
  roomAvailabilityCache = null;
  return publicMarinaApiSettings();
}

function marinaCollection(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["data", ...keys])
    if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}

function marinaEntity(payload, keys = []) {
  const candidates = [
    payload?.data?.booking,
    payload?.data,
    ...keys.map((key) => payload?.[key]),
    payload?.booking,
    payload,
  ];
  return (
    candidates.find(
      (value) => value && typeof value === "object" && !Array.isArray(value),
    ) || {}
  );
}

function marinaNoteRecords(payload) {
  const candidates = [payload?.data, payload, payload?.booking].filter(Boolean);
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    for (const key of ["notes", "internal_notes"]) {
      if (Array.isArray(candidate?.[key])) return candidate[key];
    }
  }
  return [];
}

function marinaApiErrorMessage(status, payload) {
  if (status === 401)
    return "Conectarea OAuth Marina nu mai este validă. Reconectează contul.";
  if (status === 403)
    return "Contul OAuth Marina nu are permisiunea bookings:read/resources:read";
  if (status === 404)
    return "Workspace-ul Marina nu este disponibil pentru această conexiune";
  if (status === 429)
    return "API-ul Marina a limitat temporar numărul de cereri";
  return String(
    payload?.detail ||
      payload?.message ||
      payload?.error ||
      `API Marina: HTTP ${status}`,
  );
}

function marinaOAuthEndpoint(value, label, settings) {
  let endpoint;
  try {
    endpoint = new URL(String(value || ""), `${settings.apiBaseUrl}/`);
  } catch {
    throw requestError(502, `Endpoint-ul OAuth Marina ${label} este invalid`);
  }
  let base;
  try {
    base = new URL(settings.apiBaseUrl);
  } catch {
    throw requestError(502, "Base URL-ul Marina configurat este invalid");
  }
  if (
    endpoint.origin !== base.origin ||
    endpoint.protocol !== base.protocol ||
    endpoint.username ||
    endpoint.password
  ) {
    throw requestError(
      502,
      `Endpoint-ul OAuth Marina ${label} nu aparține serverului configurat`,
    );
  }
  return endpoint.toString();
}

async function marinaFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    try {
      return await fetch(url, {
        ...options,
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      throw requestError(
        502,
        error?.name === "AbortError"
          ? "Cererea către API-ul Marina a expirat"
          : "API-ul Marina nu poate fi accesat momentan",
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

async function marinaOAuthDiscovery(settings, { force = false } = {}) {
  const cacheKey = `${settings.apiBaseUrl}|${settings.oauthClientId}`;
  if (!force && marinaOAuthMetadataCache?.key === cacheKey)
    return marinaOAuthMetadataCache.metadata;
  let response;
  try {
    response = await marinaFetch(
      `${settings.apiBaseUrl}${marinaOAuthMetadataPath}`,
      { method: "GET", headers: { Accept: "application/json" } },
    );
  } catch (error) {
    throw requestError(
      502,
      `Descoperirea OAuth Marina a eșuat: ${error.message}`,
    );
  }
  let payload = {};
  const body = await response.text();
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = {};
  }
  if (!response.ok && ![404, 405].includes(response.status)) {
    throw requestError(
      502,
      `Descoperirea OAuth Marina a eșuat (HTTP ${response.status})`,
    );
  }
  const metadata = Object.freeze({
    issuer: marinaOAuthEndpoint(
      payload.issuer || settings.apiBaseUrl,
      "issuer",
      settings,
    ),
    authorizationEndpoint: marinaOAuthEndpoint(
      payload.authorization_endpoint || "/oauth/authorize",
      "de autorizare",
      settings,
    ),
    tokenEndpoint: marinaOAuthEndpoint(
      payload.token_endpoint || "/oauth/token",
      "token",
      settings,
    ),
    revocationEndpoint: marinaOAuthEndpoint(
      payload.revocation_endpoint || "/oauth/revoke",
      "revocare",
      settings,
    ),
  });
  marinaOAuthMetadataCache = { key: cacheKey, metadata };
  return metadata;
}

async function marinaOAuthTokenRequest(settings, values) {
  const metadata = await marinaOAuthDiscovery(settings);
  const response = await marinaFetch(metadata.tokenEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody(values),
  });
  const body = await response.text();
  let payload = {};
  try {
    payload = body ? JSON.parse(body) : {};
  } catch {
    payload = {};
  }
  if (!response.ok || !payload.access_token) {
    const error = requestError(
      response.status || 502,
      payload.error_description || "Schimbul tokenului OAuth Marina a eșuat",
    );
    error.code = String(payload.error || "marina_oauth_token_failed");
    error.auth = true;
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function applyMarinaOAuthToken(payload) {
  marinaOAuthAccessToken = String(payload.access_token || "");
  const expiresIn = Number(payload.expires_in);
  const lifetimeMs =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? expiresIn * 1000
      : 5 * 60 * 1000;
  marinaOAuthAccessTokenExpiresAt = Date.now() + lifetimeMs;
  if (payload.refresh_token)
    await storeMarinaOAuthRefreshToken(payload.refresh_token);
}

function marinaTestOAuthAccessToken() {
  return process.env.NODE_ENV === "test"
    ? String(process.env.MARINA_OAUTH_TEST_ACCESS_TOKEN || "").trim()
    : "";
}

async function refreshMarinaOAuthAccessToken() {
  if (marinaOAuthRefreshPromise) return marinaOAuthRefreshPromise;
  marinaOAuthRefreshPromise = (async () => {
    const settings = effectiveMarinaApiSettings();
    if (!settings.oauthClientId)
      throw requestError(
        503,
        "Configurează Client ID-ul OAuth Marina în Setări",
      );
    const refreshToken = await marinaOAuthRefreshToken();
    if (!refreshToken)
      throw requestError(
        401,
        "Conectează contul Marina prin OAuth înainte de a încărca rezervările",
      );
    try {
      const payload = await marinaOAuthTokenRequest(settings, {
        grant_type: "refresh_token",
        client_id: settings.oauthClientId,
        refresh_token: refreshToken,
      });
      await applyMarinaOAuthToken(payload);
      marinaOAuthLastError = "";
      return marinaOAuthAccessToken;
    } catch (error) {
      marinaOAuthAccessToken = "";
      marinaOAuthAccessTokenExpiresAt = 0;
      if (
        marinaOAuthTerminalRefreshErrors.has(error.code) ||
        error.status === 401
      ) {
        try {
          await activeMarinaOAuthStorage().clearRefreshToken();
        } catch {}
        marinaOAuthMemoryRefreshToken = "";
      }
      throw error;
    }
  })();
  try {
    return await marinaOAuthRefreshPromise;
  } finally {
    marinaOAuthRefreshPromise = null;
  }
}

async function marinaOAuthAccessTokenForApi() {
  const testToken = marinaTestOAuthAccessToken();
  if (testToken) return testToken;
  const settings = effectiveMarinaApiSettings();
  if (!settings.oauthClientId)
    throw requestError(503, "Configurează Client ID-ul OAuth Marina în Setări");
  if (
    marinaOAuthAccessToken &&
    marinaOAuthAccessTokenExpiresAt > Date.now() + marinaOAuthAccessSkewMs
  )
    return marinaOAuthAccessToken;
  return refreshMarinaOAuthAccessToken();
}

async function marinaApiRequest(pathname, { workspaceId = null } = {}) {
  const settings = effectiveMarinaApiSettings();
  let token = await marinaOAuthAccessTokenForApi();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    };
    if (workspaceId !== null) headers["X-Workspace-ID"] = String(workspaceId);
    const response = await marinaFetch(`${settings.apiBaseUrl}${pathname}`, {
      method: "GET",
      headers,
    });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    if (response.ok) return payload;
    if (
      response.status === 401 &&
      attempt === 0 &&
      !marinaTestOAuthAccessToken()
    ) {
      marinaOAuthAccessToken = "";
      marinaOAuthAccessTokenExpiresAt = 0;
      token = await refreshMarinaOAuthAccessToken();
      continue;
    }
    throw requestError(
      response.status,
      marinaApiErrorMessage(response.status, payload),
    );
  }
  throw requestError(
    401,
    "Conectarea OAuth Marina nu mai este validă. Reconectează contul.",
  );
}

async function startMarinaOAuth() {
  const settings = effectiveMarinaApiSettings();
  if (!settings.oauthClientId)
    throw requestError(
      400,
      "Introdu Client ID-ul OAuth Marina înainte de conectare",
    );
  const metadata = await marinaOAuthDiscovery(settings, { force: true });
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = createState();
  marinaOAuthPending = { codeVerifier, state, createdAt: Date.now(), settings };
  marinaOAuthLastError = "";
  const authorizationUrl = buildAuthorizationUrl({
    authorizationEndpoint: metadata.authorizationEndpoint,
    clientId: settings.oauthClientId,
    redirectUri: MARINA_OAUTH_REDIRECT_URI,
    scopes: settings.oauthScopes,
    state,
    codeChallenge,
  });
  return {
    ok: true,
    authorizationUrl,
    redirectUri: MARINA_OAUTH_REDIRECT_URI,
    scopes: settings.oauthScopes,
  };
}

async function handleMarinaOAuthCallback(callbackUrl) {
  const pending = marinaOAuthPending;
  if (!pending || Date.now() - pending.createdAt > marinaOAuthPendingMaxAgeMs) {
    marinaOAuthPending = null;
    throw requestError(
      400,
      "Nu există o autentificare Marina în curs sau cererea a expirat",
    );
  }
  let callback;
  try {
    callback = parseCallbackUrl(callbackUrl, {
      protocol: "ro.marinapark.booking.desktop:",
      pathname: "/callback",
    });
    validateState(pending.state, callback.state);
  } catch (error) {
    marinaOAuthPending = null;
    marinaOAuthLastError = error.message;
    throw requestError(400, error.message);
  }
  marinaOAuthPending = null;
  try {
    const payload = await marinaOAuthTokenRequest(pending.settings, {
      grant_type: "authorization_code",
      client_id: pending.settings.oauthClientId,
      code: callback.code,
      redirect_uri: MARINA_OAUTH_REDIRECT_URI,
      code_verifier: pending.codeVerifier,
    });
    await applyMarinaOAuthToken(payload);
    marinaOAuthLastError = "";
    marinaSourceCache.clear();
    inFlightMarinaRequests.clear();
    clientDirectoryCache = null;
    roomAvailabilityCache = null;
    return publicMarinaApiSettings();
  } catch (error) {
    marinaOAuthAccessToken = "";
    marinaOAuthAccessTokenExpiresAt = 0;
    marinaOAuthLastError = error.message;
    throw error;
  }
}

async function disconnectMarinaOAuth() {
  const settings = effectiveMarinaApiSettings();
  const refreshToken = await marinaOAuthRefreshToken();
  try {
    if (refreshToken && settings.oauthClientId) {
      const metadata = await marinaOAuthDiscovery(settings);
      await marinaFetch(metadata.revocationEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody({
          token: refreshToken,
          token_type_hint: "refresh_token",
          client_id: settings.oauthClientId,
        }),
      });
    }
  } catch {
    // The local session is still cleared when revocation is not reachable.
  } finally {
    await clearMarinaOAuthSession();
    marinaSourceCache.clear();
    inFlightMarinaRequests.clear();
    clientDirectoryCache = null;
    roomAvailabilityCache = null;
  }
  return publicMarinaApiSettings();
}

async function testMarinaApiConnection() {
  const settings = effectiveMarinaApiSettings();
  if (!settings.oauthClientId && !marinaTestOAuthAccessToken())
    throw requestError(
      400,
      "Introdu Client ID-ul OAuth Marina înainte de testare",
    );
  const workspaces = [
    ...new Set([settings.roomsWorkspaceId, settings.campingWorkspaceId]),
  ];
  const results = [];
  for (const workspaceId of workspaces) {
    const payload = await marinaApiRequest("/v1/resources", { workspaceId });
    results.push({
      workspaceId,
      resources: marinaCollection(payload, ["resources"]).length,
    });
  }
  return { ok: true, connected: true, workspaces: results };
}

function marinaDatePart(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isFinite(parsed.getTime())) return localISODate(parsed);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function addMarinaDays(value, days) {
  const date = marinaDatePart(value);
  if (!date) return "";
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function marinaBookingPeriods(booking = {}) {
  for (const periods of [
    booking.periods,
    booking.booking_periods,
    booking.bookingPeriods,
    booking.allocations,
    booking.segments,
  ]) {
    if (Array.isArray(periods)) return periods;
  }
  return [];
}

function marinaFieldValue(value) {
  if (value && typeof value === "object" && "value" in value)
    return value.value;
  return value;
}

function marinaNumericAmount(value) {
  const unwrapped = marinaFieldValue(value);
  if (
    unwrapped === undefined ||
    unwrapped === null ||
    unwrapped === "" ||
    typeof unwrapped === "boolean" ||
    typeof unwrapped === "object"
  )
    return null;
  const text =
    typeof unwrapped === "string"
      ? unwrapped
          .trim()
          .replace(/\s+/g, "")
          .replace(/\.(?=\d{3}(?:,|$))/g, "")
          .replace(",", ".")
      : unwrapped;
  const numericText =
    typeof text === "string" ? text.match(/^\d+(?:\.\d+)?/)?.[0] || text : text;
  const amount = Number(numericText);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function marinaCustomField(booking, names) {
  const customer = booking.customer || booking.guest || {};
  const containers = [
    booking.form_data,
    booking.formData,
    customer.custom_fields,
    booking.custom_fields,
  ];
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
    for (const name of names) {
      const value = marinaFieldValue(container[name]);
      if (value !== undefined && value !== null && String(value).trim())
        return String(value).trim();
    }
  }
  return "";
}

function marinaMinorAmount(booking, names) {
  const sources = [
    booking?.price,
    booking?.price?.formatted,
    booking?.pricing,
    booking?.pricing?.formatted,
    booking?.amounts,
    booking?.amounts?.formatted,
    booking?.payment,
    booking?.payment?.formatted,
    booking?.formatted,
    booking,
  ];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const name of names) {
      const value = marinaNumericAmount(source[name]);
      if (value !== null) return value;
    }
  }
  return null;
}

function marinaMajorAmount(booking, names) {
  return marinaMinorAmount(booking, names);
}

function marinaNoteValues(value) {
  if (Array.isArray(value))
    return value.flatMap((item) => marinaNoteValues(item));
  if (value && typeof value === "object") {
    const direct = ["body", "note", "text", "content", "value"].find((key) =>
      Object.hasOwn(value, key),
    );
    if (direct) return marinaNoteValues(value[direct]);
    return ["data", "items", "notes", "internal_notes"].flatMap((key) =>
      marinaNoteValues(value[key]),
    );
  }
  const text = String(marinaFieldValue(value) ?? "").trim();
  return text ? [text] : [];
}

function marinaBookingNotes(booking = {}) {
  const values = [];
  const add = (value) => {
    marinaNoteValues(value).forEach((note) => {
      if (!values.includes(note)) values.push(note);
    });
  };
  const containers = [booking, booking?.data, booking?.booking].filter(
    (value) => value && typeof value === "object",
  );
  containers.forEach((container) => {
    [
      container.internal_note,
      container.internalNote,
      container.note,
      container.remark,
      container.notes,
      container.internal_notes,
      container.internalNotes,
    ].forEach(add);
  });
  return values;
}

function marinaNoteAmount(note, names) {
  const labelPattern = names
    .map((name) => String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const match = String(note || "").match(
    new RegExp(
      `(?:^|\\b)(?:${labelPattern})(?:\\b)\\s*(?::|=|-)?\\s*([0-9][0-9.\\s]*(?:,[0-9]+)?)`,
      "iu",
    ),
  );
  return match ? marinaNumericAmount(match[1]) : null;
}

function marinaBookingPrice(booking) {
  let noteBalance = null;
  let noteTotal = null;
  let noteDeposit = null;
  for (const note of marinaBookingNotes(booking)) {
    noteBalance ??= marinaNoteAmount(note, [
      "Rest",
      "Balance",
      "Sold",
      "Remaining",
      "Amount due",
    ]);
    noteTotal ??= marinaNoteAmount(note, [
      "Cost total",
      "Total initial",
      "Total",
      "Cost",
    ]);
    noteDeposit ??= marinaNoteAmount(note, [
      "Avans",
      "Depozit",
      "Advance",
      "Deposit",
      "Paid",
      "Achitat",
    ]);
  }

  if (noteBalance !== null) return noteBalance;
  if (noteTotal !== null && noteDeposit !== null)
    return Math.max(0, noteTotal - noteDeposit);
  if (noteTotal !== null) return noteTotal;

  const balanceMinor = marinaMinorAmount(booking, [
    "balance_minor",
    "balanceMinor",
    "remaining_minor",
    "remainingMinor",
    "amount_due_minor",
    "amountDueMinor",
    "due_minor",
    "dueMinor",
    "rest_minor",
    "restMinor",
    "outstanding_minor",
    "outstandingMinor",
  ]);
  if (balanceMinor !== null) return balanceMinor / 100;

  const totalMinor = marinaMinorAmount(booking, [
    "total_minor",
    "totalMinor",
    "amount_minor",
    "amountMinor",
    "gross_total_minor",
    "grossTotalMinor",
    "grand_total_minor",
    "grandTotalMinor",
    "total_price_minor",
    "totalPriceMinor",
    "amount_total_minor",
    "amountTotalMinor",
  ]);
  const depositMinor = marinaMinorAmount(booking, [
    "deposit_minor",
    "depositMinor",
    "advance_minor",
    "advanceMinor",
    "avans_minor",
    "avansMinor",
    "paid_minor",
    "paidMinor",
    "amount_paid_minor",
    "amountPaidMinor",
    "prepaid_minor",
    "prepaidMinor",
  ]);
  const balanceMajor = marinaMajorAmount(booking, [
    "balance",
    "remaining",
    "remaining_amount",
    "remainingAmount",
    "amount_due",
    "amountDue",
    "due",
    "rest",
    "outstanding",
  ]);
  if (balanceMajor !== null) return balanceMajor;

  const totalMajor = marinaMajorAmount(booking, [
    "total",
    "total_amount",
    "totalAmount",
    "total_price",
    "totalPrice",
    "gross_total",
    "grossTotal",
    "grand_total",
    "grandTotal",
    "price_total",
    "priceTotal",
    "amount_total",
    "amountTotal",
    "amount",
  ]);
  const depositMajor = marinaMajorAmount(booking, [
    "deposit",
    "deposit_amount",
    "depositAmount",
    "advance",
    "advance_amount",
    "advanceAmount",
    "avans",
    "avans_amount",
    "avansAmount",
    "paid",
    "paid_amount",
    "paidAmount",
    "prepaid",
    "prepaid_amount",
    "prepaidAmount",
    "cost",
  ]);
  if (totalMinor !== null && totalMinor > 0 && depositMinor !== null)
    return Math.max(0, totalMinor - depositMinor) / 100;
  if (totalMinor !== null && totalMinor > 0 && depositMajor !== null)
    return Math.max(0, totalMinor - Math.round(depositMajor * 100)) / 100;
  if (totalMajor !== null && totalMajor > 0 && depositMajor !== null)
    return Math.max(0, totalMajor - depositMajor);
  if (totalMajor !== null && totalMajor > 0 && depositMinor !== null)
    return Math.max(0, totalMajor - depositMinor / 100);

  if (totalMinor !== null && totalMinor > 0 && noteDeposit !== null)
    return Math.max(0, totalMinor - Math.round(noteDeposit * 100)) / 100;
  if (totalMajor !== null && totalMajor > 0 && noteDeposit !== null)
    return Math.max(0, totalMajor - noteDeposit);
  if (totalMinor !== null && totalMinor > 0) return totalMinor / 100;
  if (totalMajor !== null && totalMajor > 0) return totalMajor;
  return 0;
}

function marinaBookingNote(booking) {
  return marinaBookingNotes(booking).join("\n\n");
}

function marinaBookingIsTrashed(booking) {
  const status = String(booking?.status || "pending").toLowerCase();
  const trash = booking?.trash ?? booking?.trashed;
  const explicitTrash =
    trash === true ||
    trash === 1 ||
    ["1", "true", "trash", "trashed"].includes(
      String(trash || "").toLowerCase(),
    );
  return (
    explicitTrash ||
    ["trash", "cancelled", "canceled", "deleted"].includes(status)
  );
}

function marinaSourceBooking(booking, resources, mode) {
  if (!booking || marinaBookingIsTrashed(booking)) return null;
  const periods = marinaBookingPeriods(booking);
  const firstPeriod = periods[0] || {};
  const resourceId = String(
    booking.resource_id ??
      booking.resourceId ??
      booking.resource?.id ??
      firstPeriod.resource_id ??
      firstPeriod.resourceId ??
      firstPeriod.resource?.id ??
      "",
  );
  const resource =
    resources.find(
      (item) => String(item.id ?? item.resource_id) === resourceId,
    ) ||
    booking.resource ||
    {};
  const resourceTitle = String(
    resource.title || resource.name || resource.label || "",
  ).trim();
  const customer = booking.customer || booking.guest || {};
  const firstName = String(
    customer.first_name ??
      customer.firstName ??
      booking.first_name ??
      booking.name ??
      "",
  ).trim();
  const lastName = String(
    customer.last_name ??
      customer.lastName ??
      booking.last_name ??
      booking.secondname ??
      "",
  ).trim();
  const guest =
    `${firstName} ${lastName}`.trim() ||
    (typeof booking.guest === "string" ? booking.guest.trim() : "");
  const periodRanges = periods
    .map((period) => {
      const periodStart =
        period.start_date ??
        period.startDate ??
        period.start_at ??
        period.startAt ??
        period.starts_at ??
        period.startsAt;
      const dateOnlyEnd = period.end_date ?? period.endDate;
      const timedEnd =
        period.end_at ?? period.endAt ?? period.ends_at ?? period.endsAt;
      return {
        start: marinaDatePart(periodStart),
        end: dateOnlyEnd
          ? addMarinaDays(dateOnlyEnd, 1)
          : marinaDatePart(timedEnd),
      };
    })
    .filter((period) => period.start && period.end);
  const topLevelEndDate = booking.end_date ?? booking.endDate;
  const start =
    periodRanges.map((period) => period.start).sort()[0] ||
    marinaDatePart(
      booking.start_date ??
        booking.startDate ??
        booking.start_at ??
        booking.startAt,
    );
  const end =
    periodRanges
      .map((period) => period.end)
      .sort()
      .at(-1) ||
    (topLevelEndDate
      ? addMarinaDays(topLevelEndDate, 1)
      : marinaDatePart(
          booking.end_at ?? booking.endAt ?? booking.ends_at ?? booking.endsAt,
        ));
  if (!guest || !start || !end) return null;
  const adults = Math.max(
    0,
    Number(
      booking.guests?.adults ??
        booking.adults ??
        marinaCustomField(booking, ["visitors", "adults"]),
    ) || 0,
  );
  const children = Math.max(
    0,
    Number(
      booking.guests?.children ??
        booking.children ??
        marinaCustomField(booking, ["children"]),
    ) || 0,
  );
  const price = marinaBookingPrice(booking);
  const campingText = removeDiacritics(
    `${resourceTitle} ${marinaCustomField(booking, ["booking_type", "type"])}`,
  ).toLowerCase();
  const bookingMode =
    mode === "camping" && /rulot|caravan|camper|autorulot/.test(campingText)
      ? "rv"
      : mode === "camping"
        ? "tent"
        : "room";
  return {
    id:
      booking.id ??
      booking.booking_id ??
      booking.uuid ??
      `${resourceId}:${start}:${guest}`,
    providerBookingId: booking.id ?? booking.booking_id ?? booking.uuid ?? "",
    source: "marina",
    directorySource: "marina",
    normalizedName: normalizeClientName(guest),
    guest,
    phone: String(customer.phone ?? booking.phone ?? "").trim(),
    car: marinaCustomField(booking, [
      "car_plates",
      "car",
      "vehicle_registration",
      "registration_number",
    ]),
    adults,
    children,
    party: Math.max(1, adults + children),
    nights: Math.max(
      1,
      Math.round(
        (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
          86400000,
      ),
    ),
    start,
    end,
    basePrice: price,
    facilities: [],
    price,
    deposit: "0.00",
    balance: price,
    group: mode === "camping" ? "camping" : "room",
    mode: bookingMode,
    kind: resourceTitle || (mode === "camping" ? "Camping" : "Camere"),
    unitHint: resourceTitle,
    note: marinaBookingNote(booking),
    modifiedAt:
      booking.updated_at ??
      booking.updatedAt ??
      booking.created_at ??
      booking.createdAt ??
      "",
  };
}

async function fetchMarinaWorkspaceBookings(
  mode,
  { limit = 300, maxPages = 2, force = false } = {},
) {
  const settings = effectiveMarinaApiSettings();
  const workspaceId =
    mode === "camping"
      ? settings.campingWorkspaceId
      : settings.roomsWorkspaceId;
  const cacheKey = `${mode}:${workspaceId ?? "default"}`;
  const cached = marinaSourceCache.get(cacheKey);
  if (!force && cached?.expiresAt > Date.now()) return cached.bookings;

  if (inFlightMarinaRequests.has(cacheKey)) {
    return inFlightMarinaRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    try {
      const batchLimit = Math.max(1, Math.min(200, Number(limit) || 200));
      const firstParams = new URLSearchParams({ limit: String(batchLimit) });

      await marinaOAuthAccessTokenForApi();
      const [resources, firstPayload] = await Promise.all([
        fetchMarinaWorkspaceResources(mode),
        marinaApiRequest(`/v1/bookings?${firstParams}`, { workspaceId }),
      ]);

      const rows = [...marinaCollection(firstPayload, ["bookings"])];
      let after = String(
        firstPayload?.next_cursor ??
          firstPayload?.pagination?.next_cursor ??
          firstPayload?.meta?.next_cursor ??
          "",
      );
      let pageCount = 1;

      while (after && rows.length < limit && pageCount < maxPages) {
        const nextParams = new URLSearchParams({
          limit: String(batchLimit),
          after,
        });
        const nextPayload = await marinaApiRequest(
          `/v1/bookings?${nextParams}`,
          { workspaceId },
        );
        rows.push(...marinaCollection(nextPayload, ["bookings"]));
        after = String(
          nextPayload?.next_cursor ??
            nextPayload?.pagination?.next_cursor ??
            nextPayload?.meta?.next_cursor ??
            "",
        );
        pageCount += 1;
      }

      const bookings = rows
        .map((booking) => marinaSourceBooking(booking, resources, mode))
        .filter(Boolean);
      marinaSourceCache.set(cacheKey, {
        ...marinaSourceCache.get(cacheKey),
        expiresAt: Date.now() + clientDirectoryCacheMs,
        bookings,
        resources,
      });
      return bookings;
    } finally {
      inFlightMarinaRequests.delete(cacheKey);
    }
  })();

  inFlightMarinaRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function fetchMarinaWorkspaceResources(mode) {
  const settings = effectiveMarinaApiSettings();
  const workspaceId =
    mode === "camping"
      ? settings.campingWorkspaceId
      : settings.roomsWorkspaceId;
  const cacheKey = String(mode) + ":" + (workspaceId ?? "default");
  const cached = marinaSourceCache.get(cacheKey);
  if (
    Array.isArray(cached?.resources) &&
    cached?.resourcesExpiresAt > Date.now()
  )
    return cached.resources;
  const resourcePayload = await marinaApiRequest("/v1/resources", {
    workspaceId,
  });
  const resources = marinaCollection(resourcePayload, ["resources"]);
  marinaSourceCache.set(cacheKey, {
    ...cached,
    resources,
    resourcesExpiresAt: Date.now() + 60 * 60 * 1000,
  });
  return resources;
}

async function fetchMarinaSourceBookingDetails(mode, providerBookingId) {
  const sourceMode = mode === "tent" || mode === "rv" ? "camping" : "room";
  const settings = effectiveMarinaApiSettings();
  const workspaceId =
    sourceMode === "camping"
      ? settings.campingWorkspaceId
      : settings.roomsWorkspaceId;
  const resources = await fetchMarinaWorkspaceResources(sourceMode);
  const bookingPath = "/v1/bookings/" + encodeURIComponent(providerBookingId);
  const payload = await marinaApiRequest(bookingPath, { workspaceId });
  const rawBooking = marinaEntity(payload, ["booking"]);
  if (!rawBooking || typeof rawBooking !== "object") {
    throw requestError(
      502,
      "API-ul Marina nu a returnat rezervarea solicitată",
    );
  }

  let booking = {
    ...rawBooking,
    id: rawBooking.id ?? rawBooking.booking_id ?? providerBookingId,
  };
  if (!marinaBookingNotes(booking).length || marinaBookingPrice(booking) <= 0) {
    try {
      const notesPayload = await marinaApiRequest(bookingPath + "/notes", {
        workspaceId,
      });
      const notes = marinaNoteRecords(notesPayload);
      if (notes.length)
        booking = {
          ...booking,
          notes: [
            ...(Array.isArray(booking.notes) ? booking.notes : []),
            ...notes,
          ],
        };
    } catch {
      // Details and existing list data remain usable when the optional notes endpoint is unavailable.
    }
  }

  const normalized = marinaSourceBooking(booking, resources, sourceMode);
  if (!normalized)
    throw requestError(
      502,
      "API-ul Marina nu a returnat o rezervare într-un format invalid",
    );
  return normalized;
}

function filteredSourceBookings(bookings, query, limit) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    const ranked = [...bookings].sort(sortSourceBookings);
    const kept = ranked.slice(0, limit);
    // Active stays started earlier must never fall out of the capped pool:
    // they occupy today and are needed for availability and the client directory.
    const todayText = localISODate();
    for (const booking of ranked.slice(limit)) {
      if (sourceBookingOccupiesDate(booking, todayText)) kept.push(booking);
    }
    return kept;
  }
  return bookings
    .map((booking) => ({
      booking,
      score: fuzzyMatchScore(query, booking.guest),
    }))
    .filter((match) => Number.isFinite(match.score))
    .sort((first, second) => {
      const firstPhone = String(first.booking.phone || "").replace(/\D/g, "");
      const secondPhone = String(second.booking.phone || "").replace(/\D/g, "");
      const sameClient =
        normalizeClientName(first.booking.guest) ===
          normalizeClientName(second.booking.guest) ||
        (firstPhone && firstPhone === secondPhone);
      return (
        (sameClient ? 0 : first.score - second.score) ||
        sortSourceBookings(first.booking, second.booking)
      );
    })
    .slice(0, limit)
    .map((match) => match.booking);
}

async function fetchSourceBookings(mode, query = "", options = {}) {
  const isCamping = mode === "camping";
  const limit = Math.max(1, Math.min(50000, Number(options.limit || 300)));
  const fixtureBookings = await sourceBookingFixture(
    isCamping ? "camping" : "room",
  );
  if (fixtureBookings) {
    const normalized = fixtureBookings.map((b) => ({
      ...b,
      directorySource: "marina",
    }));
    return filteredSourceBookings(normalized, query, limit);
  }
  const maxPages = options.all ? 100 : Math.max(1, Math.ceil(limit / 200));
  return filteredSourceBookings(
    await fetchMarinaWorkspaceBookings(isCamping ? "camping" : "room", {
      limit,
      maxPages,
      force: options.force === true,
    }),
    query,
    limit,
  );
}

async function fetchClientDirectory(options = {}) {
  const now = Date.now();
  if (
    !options.force &&
    clientDirectoryCache &&
    clientDirectoryCache.expiresAt > now
  ) {
    return clientDirectoryCache.result;
  }

  const sources = await Promise.allSettled([
    fetchSourceBookings("room", "", { limit: 300 }),
    fetchSourceBookings("camping", "", { limit: 300 }),
  ]);
  const marinaBookings = sources.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const warnings = sources
    .filter((result) => result.status === "rejected")
    .map((result) =>
      String(result.reason?.message || result.reason || "Marina indisponibil"),
    );
  const localReservations = reservationRows().filter((stay) =>
    normalizeClientName(stay.guest),
  );
  clientHistoryStore.syncReservations(localReservations);
  const localClients = clientHistoryStore.clients();
  const clients = mergeClientDirectory(marinaBookings, localClients);
  const result = {
    ok: true,
    clients,
    marinaAvailable: warnings.length === 0,
    warnings,
    sources: {
      marina: marinaBookings.length,
      local: clients.filter(
        (client) => client.directorySource === "local-history",
      ).length,
    },
  };
  clientDirectoryCache = { expiresAt: now + clientDirectoryCacheMs, result };
  return result;
}

function sourceBookingFromDirectoryClient(client = {}, fallbackMode = "room") {
  const localHistory = client.directorySource === "local-history";
  const group =
    client.group === "camping" || client.group === "room"
      ? client.group
      : fallbackMode === "room"
        ? "room"
        : "camping";
  const mode =
    client.mode === "rv" || client.mode === "tent" || client.mode === "room"
      ? client.mode
      : group === "camping" &&
          /rulot|caravan|camper|autorulot/.test(
            removeDiacritics(
              `${client.kind || ""} ${client.source || ""}`,
            ).toLowerCase(),
          )
        ? "rv"
        : group === "camping"
          ? "tent"
          : "room";
  const start = client.start || client.lastStart || client.last_start || "";
  const end = client.end || client.lastEnd || client.last_end || "";
  const price = localHistory ? 0 : Number(client.price || 0);
  const adults = Math.max(0, Number(client.adults || 0));
  const children = Math.max(0, Number(client.children || 0));
  const previousRoom = localHistory ? String(client.room || "").trim() : "";
  const previousCategory = localHistory
    ? String(client.category || "").trim()
    : "";
  const normalizedName =
    client.normalizedName || normalizeClientName(client.guest);
  return {
    ...client,
    normalizedName,
    directorySource: localHistory
      ? "local-history"
      : client.directorySource || "marina",
    source: localHistory
      ? "istoric local"
      : client.source || (group === "camping" ? "camping" : "camere"),
    guest: client.guest || "",
    phone: client.phone || "",
    car: client.car || "",
    adults,
    children,
    party: Math.max(0, Number(client.party || adults + children || 0)),
    start,
    end,
    basePrice: price,
    price,
    deposit: "0.00",
    balance: price,
    group,
    mode,
    kind: client.kind || (group === "camping" ? "Camping" : "Camere"),
    unitHint: localHistory ? "" : client.unitHint || "",
    previousRoom,
    previousCategory,
    note: localHistory ? String(client.note || "").trim() : client.note || "",
    modifiedAt:
      client.modifiedAt || client.historyUpdatedAt || client.updatedAt || "",
    detailsOnly: localHistory,
  };
}

function transferPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function localHistoryBookingNote(client = {}, reservations = []) {
  const normalizedName = normalizeClientName(client.guest);
  if (!normalizedName) return "";
  const candidates = reservations.filter(
    (stay) =>
      stay &&
      stay.guest !== "Disponibil" &&
      normalizeClientName(stay.guest) === normalizedName,
  );
  if (!candidates.length) return "";

  const preferredRoom = String(client.room || "").trim();
  const preferredPhone = transferPhoneDigits(client.phone);
  const preferred = candidates.filter((stay) => {
    const roomMatches =
      preferredRoom && String(stay.id || "").trim() === preferredRoom;
    const phoneMatches =
      preferredPhone && transferPhoneDigits(stay.phone) === preferredPhone;
    return roomMatches || phoneMatches;
  });
  const source = [...(preferred.length ? preferred : candidates)].sort(
    (first, second) =>
      String(second.end || second.start || "").localeCompare(
        String(first.end || first.start || ""),
      ) ||
      String(second.start || "").localeCompare(String(first.start || "")) ||
      String(second.updatedAt || "").localeCompare(String(first.updatedAt || "")),
  )[0];
  return String(source?.note || "").trim();
}

async function fetchFusedSourceBookings(mode, query = "") {
  const isCamping = mode === "camping" || mode === "rv" || mode === "tent";
  const sourceMode = isCamping ? "camping" : "room";

  let marinaBookings = [];
  let marinaAvailable = true;
  const warnings = [];

  try {
    const rawBookings = await fetchSourceBookings(sourceMode, "", {
      limit: 300,
    });
    marinaBookings = rawBookings
      .map((booking) => sourceBookingFromDirectoryClient(booking, mode))
      .filter((booking) =>
        isCamping
          ? booking.mode === mode || mode === "camping"
          : booking.group === "room",
      );
  } catch (error) {
    marinaAvailable = false;
    warnings.push(String(error?.message || error || "Marina indisponibil"));
  }

  const marinaNames = new Set(
    marinaBookings.map((booking) => normalizeClientName(booking.guest)),
  );
  const localClients =
    query && typeof clientHistoryStore.searchClients === "function"
      ? (() => {
          const sqlMatches = clientHistoryStore.searchClients(query, 300);
          return sqlMatches.length ? sqlMatches : clientHistoryStore.clients();
        })()
      : clientHistoryStore.clients();
  const localReservations = reservationRows();
  const localBookings = localClients
    .map((client) =>
      sourceBookingFromDirectoryClient(
        {
          ...client,
          note: localHistoryBookingNote(client, localReservations),
          directorySource: "local-history",
        },
        mode,
      ),
    )
    .filter((booking) => !marinaNames.has(normalizeClientName(booking.guest)));
  const filteredMarinaBookings = filteredSourceBookings(
    marinaBookings,
    query,
    300,
  );
  const filteredLocalBookings = filteredSourceBookings(
    localBookings,
    query,
    query ? Math.max(1, localBookings.length) : 100,
  );
  const filteredBookings = [
    ...filteredMarinaBookings,
    ...filteredLocalBookings,
  ];
  return {
    ok: true,
    bookings: filteredBookings,
    marinaAvailable,
    warnings,
    sources: {
      marina: filteredBookings.filter(
        (booking) => booking.directorySource === "marina",
      ).length,
      local: filteredBookings.filter(
        (booking) => booking.directorySource === "local-history",
      ).length,
    },
  };
}

function normalizedAvailabilityDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return localISODate();
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return localISODate(parsed) === text ? text : localISODate();
}

function sourceBookingOccupiesDate(booking, dateText) {
  return Boolean(
    booking?.start &&
      booking?.end &&
      booking.start <= dateText &&
      booking.end > dateText,
  );
}

async function fetchRoomAvailability(dateValue) {
  const date = normalizedAvailabilityDate(dateValue);
  const now = Date.now();
  if (
    roomAvailabilityCache?.date === date &&
    roomAvailabilityCache.expiresAt > now
  ) {
    return roomAvailabilityCache.result;
  }

  let result;
  try {
    // Fresh pool on every availability recompute so externally booked units
    // appear within the 60s availability TTL, not the 10-minute directory TTL.
    const bookings = await fetchSourceBookings("room", "", {
      limit: 300,
      force: true,
    });
    const occupiedUnitIds = [
      ...new Set(
        bookings
          .filter((booking) => sourceBookingOccupiesDate(booking, date))
          .map((booking) => String(booking.unitHint || "").trim())
          .filter(Boolean),
      ),
    ].sort((first, second) =>
      first.localeCompare(second, "ro-RO", { numeric: true }),
    );
    result = {
      ok: true,
      date,
      occupiedUnitIds,
      marinaAvailable: true,
      warnings: [],
    };
  } catch (error) {
    result = {
      ok: true,
      date,
      occupiedUnitIds: [],
      marinaAvailable: false,
      warnings: [
        String(
          error?.message || error || "Sursa rezervărilor nu este disponibilă",
        ),
      ],
    };
  }

  roomAvailabilityCache = {
    date,
    expiresAt: now + roomAvailabilityCacheMs,
    result,
  };
  return result;
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
      },
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
  const requestedPath = decodeURIComponent(
    url.pathname === "/"
      ? "/index.html"
      : url.pathname === "/log"
        ? "/activity.html"
        : url.pathname === "/screen"
          ? "/screen.html"
          : url.pathname,
  );
  const filePath = path.resolve(rootDir, `.${requestedPath}`);

  if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    send(
      response,
      200,
      body,
      contentTypes[path.extname(filePath)] || "application/octet-stream",
    );
  } catch {
    send(response, 404, "Not found", "text/plain; charset=utf-8");
  }
}

backfillBarExportLedger();

const server = http.createServer(async (request, response) => {
  try {
    if (
      request.url.startsWith("/api/live-screen/frame") &&
      request.method === "GET"
    ) {
      const { frame, pointer } = await captureLiveScreenFrame();
      if (request.aborted || response.destroyed) return;
      response.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": frame.length,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Live-Screen-Pointer-Visible": pointer.visible ? "1" : "0",
        "X-Live-Screen-Pointer-X": pointer.x.toFixed(6),
        "X-Live-Screen-Pointer-Y": pointer.y.toFixed(6),
        "X-Live-Screen-Pointer-Width": pointer.width.toFixed(6),
        "X-Live-Screen-Pointer-Height": pointer.height.toFixed(6),
      });
      response.end(frame);
      return;
    }

    if (request.url.startsWith("/api/data") && request.method === "GET") {
      send(response, 200, JSON.stringify(await readData()));
      return;
    }

    if (request.url.startsWith("/api/data") && request.method === "POST") {
      const result = await writeData(JSON.parse(await requestBody(request)));
      send(
        response,
        200,
        JSON.stringify({
          ok: true,
          database: "data/marina-park.sqlite",
          ...result,
        }),
      );
      return;
    }

    if (
      request.url.startsWith("/api/reservation") &&
      request.method === "POST"
    ) {
      const result = await writeReservation(
        JSON.parse(await requestBody(request)),
      );
      send(
        response,
        200,
        JSON.stringify({
          ok: true,
          database: "data/marina-park.sqlite",
          ...result,
        }),
      );
      return;
    }

    if (
      request.url.startsWith("/api/export-database") &&
      request.method === "GET"
    ) {
      const result = await exportedDatabaseFile();
      response.writeHead(200, {
        "Content-Type": "application/vnd.sqlite3",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": result.body.length,
      });
      response.end(result.body);
      return;
    }

    if (
      (request.url.startsWith("/api/clear-activity-log") ||
        request.url.startsWith("/api/clear-database")) &&
      request.method === "POST"
    ) {
      const payload = JSON.parse((await requestBody(request)) || "{}");
      const scope = payload.scope === "range" ? "range" : "all";
      const requiredConfirmation =
        scope === "range" ? "STERGE INTERVAL" : "STERGE LOG";
      if (payload.confirm !== requiredConfirmation) {
        send(
          response,
          400,
          JSON.stringify({
            ok: false,
            error: "Confirmarea pentru ștergerea jurnalului este invalidă",
          }),
        );
        return;
      }
      send(
        response,
        200,
        JSON.stringify(await clearActivityLogData(scope, payload)),
      );
      return;
    }

    if (request.url.startsWith("/api/log") && request.method === "GET") {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const requestedLimit = Number(url.searchParams.get("limit") || 250);
      const requestedOffset = Number(url.searchParams.get("offset") || 0);
      const limit = Number.isFinite(requestedLimit)
        ? Math.max(1, Math.min(500, Math.floor(requestedLimit)))
        : 250;
      const offset = Number.isFinite(requestedOffset)
        ? Math.max(0, Math.floor(requestedOffset))
        : 0;
      const rows = activityLogRows(limit + 1, offset);
      const entries = rows.slice(0, limit);
      send(
        response,
        200,
        JSON.stringify({
          ok: true,
          entries,
          purges: activityLogPurgeRanges(),
          hasMore: rows.length > limit,
          nextOffset: offset + entries.length,
        }),
      );
      return;
    }

    if (request.url.startsWith("/api/log") && request.method === "POST") {
      const payload = JSON.parse(await requestBody(request));
      const entries = Array.isArray(payload.entries)
        ? payload.entries
        : [payload];
      const results = entries.map(addActivityLogEntry);
      const saved = results.map((result) => result.entry);
      const inserted = results
        .filter((result) => result.inserted)
        .map((result) => result.entry);
      await writeActivityLogLocalFiles(inserted, { refreshSnapshot: true });
      await enqueueDatabaseBackup({ afterMutation: true });
      send(response, 200, JSON.stringify({ ok: true, entries: saved }));
      return;
    }

    if (request.url.startsWith("/api/payment") && request.method === "POST") {
      send(
        response,
        200,
        JSON.stringify(
          await commitPayment(JSON.parse(await requestBody(request))),
        ),
      );
      return;
    }

    if (request.url.startsWith("/api/receipt") && request.method === "POST") {
      throw requestError(
        410,
        "Endpoint retras: folosește /api/payment pentru plată și persistență atomică",
      );
      return;
    }

    if (
      request.url.startsWith("/api/saga/bar-sales.pdf") &&
      request.method === "GET"
    ) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const result = await buildSagaBarSalesPdf(
        Object.fromEntries(url.searchParams.entries()),
      );
      response.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": result.pdf.length,
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Saga-Export-Batch": result.batchId,
        "X-Saga-Exported-At": result.exportedAt,
      });
      response.end(result.pdf);
      return;
    }

    if (
      request.url.startsWith("/api/saga/bar-sales") &&
      request.method === "GET"
    ) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const result = buildSagaBarSalesXml(
        Object.fromEntries(url.searchParams.entries()),
      );
      response.writeHead(200, {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Saga-Export-Batch": result.batchId,
        "X-Saga-Exported-At": result.exportedAt,
      });
      response.end(result.xml);
      return;
    }

    if (
      request.url.startsWith("/api/availability") &&
      request.method === "GET"
    ) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      send(
        response,
        200,
        JSON.stringify(
          await fetchRoomAvailability(url.searchParams.get("date")),
        ),
      );
      return;
    }

    if (
      request.url.startsWith("/api/source-booking-details") &&
      request.method === "GET"
    ) {
      const url = new URL(request.url, "http://" + request.headers.host);
      const requestedMode = url.searchParams.get("mode");
      const mode =
        requestedMode === "tent" || requestedMode === "rv"
          ? requestedMode
          : "room";
      const providerBookingId = String(url.searchParams.get("id") || "").trim();
      if (!providerBookingId || providerBookingId.length > 200)
        throw requestError(
          400,
          "Identificatorul rezervării Marina este invalid",
        );
      const booking = await fetchMarinaSourceBookingDetails(
        mode,
        providerBookingId,
      );
      send(response, 200, JSON.stringify({ ok: true, booking }));
      return;
    }

    if (
      request.url.startsWith("/api/source-bookings") &&
      request.method === "GET"
    ) {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const requestedMode = url.searchParams.get("mode");
      const mode =
        requestedMode === "tent" || requestedMode === "rv"
          ? requestedMode
          : "room";
      const query = String(url.searchParams.get("query") || "")
        .trim()
        .slice(0, 120);
      send(
        response,
        200,
        JSON.stringify(await fetchFusedSourceBookings(mode, query)),
      );
      return;
    }

    if (request.url === "/api/marina-settings" && request.method === "GET") {
      send(response, 200, JSON.stringify(publicMarinaApiSettings()));
      return;
    }

    if (request.url === "/api/marina-settings" && request.method === "POST") {
      send(
        response,
        200,
        JSON.stringify(
          saveMarinaApiSettings(
            JSON.parse((await requestBody(request)) || "{}"),
          ),
        ),
      );
      return;
    }

    if (
      request.url === "/api/marina-oauth/start" &&
      ["GET", "POST"].includes(request.method)
    ) {
      send(response, 200, JSON.stringify(await startMarinaOAuth()));
      return;
    }

    if (
      request.url === "/api/marina-oauth/status" &&
      request.method === "GET"
    ) {
      send(response, 200, JSON.stringify(publicMarinaApiSettings()));
      return;
    }

    if (
      request.url === "/api/marina-oauth/disconnect" &&
      request.method === "POST"
    ) {
      send(response, 200, JSON.stringify(await disconnectMarinaOAuth()));
      return;
    }

    if (
      request.url === "/api/marina-settings/test" &&
      request.method === "POST"
    ) {
      send(response, 200, JSON.stringify(await testMarinaApiConnection()));
      return;
    }

    if (
      request.url.startsWith("/api/client-directory") &&
      request.method === "GET"
    ) {
      send(response, 200, JSON.stringify(await fetchClientDirectory()));
      return;
    }

    if (
      request.url.startsWith("/api/pick-receipt-directory") &&
      request.method === "POST"
    ) {
      send(response, 200, JSON.stringify(await pickReceiptDirectory()));
      return;
    }

    await serveStatic(request, response);
  } catch (error) {
    send(
      response,
      error.statusCode || 500,
      JSON.stringify({ ok: false, error: error.message }),
    );
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
  const portAttempts = Math.max(
    1,
    Math.floor(Number(options.portAttempts || 1)),
  );
  let listenPort = firstPort;

  for (let attempt = 0; attempt < portAttempts; attempt += 1) {
    try {
      await listenOnPort(listenPort, listenHost);
      break;
    } catch (error) {
      const canTryNextPort =
        error.code === "EADDRINUSE" &&
        listenPort > 0 &&
        listenPort < 65535 &&
        attempt + 1 < portAttempts;
      if (!canTryNextPort) throw error;
      listenPort += 1;
    }
  }

  const address = server.address();
  const activePort =
    typeof address === "object" && address ? address.port : listenPort;
  const localHost = String(
    options.localHost ||
      (["0.0.0.0", "::"].includes(listenHost) ? "127.0.0.1" : listenHost),
  );
  const url = `http://${localHost}:${activePort}`;
  const lanUrls = Object.values(os.networkInterfaces())
    .flat()
    .filter(
      (entry) =>
        entry &&
        !entry.internal &&
        (entry.family === "IPv4" || entry.family === 4),
    )
    .map((entry) => `http://${entry.address}:${activePort}`)
    .filter((entry, index, entries) => entries.indexOf(entry) === index);
  const logUrls = lanUrls.map((lanUrl) => `${lanUrl}/log`);
  console.log(`Marina Park app: ${url}`);
  for (const lanUrl of lanUrls) console.log(`Marina Park în rețea: ${lanUrl}`);
  console.log(`Database: ${databasePath}`);
  console.log(`Client history: ${clientHistoryDatabasePath}`);
  retryPendingPaymentOutbox().catch((error) =>
    console.error("Pending receipt retry failed:", error.message),
  );
  enqueueDatabaseBackup({ reason: "startup" });
  backupInterval = setInterval(
    () => enqueueDatabaseBackup({ reason: "interval" }),
    60 * 60 * 1000,
  );
  backupInterval.unref?.();
  return { server, port: activePort, host: listenHost, url, lanUrls, logUrls };
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

module.exports = {
  buildSagaBarSalesReportHtml,
  handleMarinaOAuthCallback,
  setMarinaOAuthStorage,
  setLiveScreenCaptureProvider,
  setPdfRenderProvider,
  startServer,
  stopServer,
};
