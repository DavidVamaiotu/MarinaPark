const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function removeDiacritics(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeClientName(value) {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function clientDateValue(client = {}) {
  return String(client.end || client.lastEnd || client.start || client.lastStart || "");
}

function richerClientDetails(primary = {}, fallback = {}) {
  const merged = { ...fallback, ...primary };
  for (const field of ["phone", "car", "note", "personId"]) {
    if (!String(primary[field] || "").trim() && String(fallback[field] || "").trim()) {
      merged[field] = fallback[field];
    }
  }
  return merged;
}

function newestClient(first, second) {
  if (!first) return second;
  if (!second) return first;
  const firstDate = clientDateValue(first);
  const secondDate = clientDateValue(second);
  return secondDate > firstDate ? richerClientDetails(second, first) : richerClientDetails(first, second);
}

function clientHistoryDetails(client = {}) {
  return {
    guest: String(client.guest || "").trim(),
    phone: String(client.phone || "").trim(),
    car: String(client.car || "").trim(),
    room: String(client.room || client.id || client.unitHint || "").trim(),
    category: String(client.category || client.kind || "").trim(),
    adults: Math.max(0, Number(client.adults || 0)) || 0,
    children: Math.max(0, Number(client.children || 0)) || 0
  };
}

function directoryKey(prefix, parts) {
  const digest = crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
  return `${prefix}-${digest}`;
}

class ClientHistoryStore {
  constructor(databasePath) {
    this.databasePath = path.resolve(databasePath);
    fs.mkdirSync(path.dirname(this.databasePath), { recursive: true });
    this.db = new DatabaseSync(this.databasePath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS clients (
        normalized_name TEXT PRIMARY KEY,
        guest TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        car TEXT NOT NULL DEFAULT '',
        group_name TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL DEFAULT '',
        last_start TEXT,
        last_end TEXT,
        first_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_clients_guest ON clients(guest);
      CREATE INDEX IF NOT EXISTS idx_clients_group ON clients(group_name);
    `);
    this._cachedClients = null;
    this.sanitizeStoredClients();
  }

  sanitizeStoredClients() {
    const rows = this.db.prepare(`
      SELECT normalized_name, guest, phone, car, group_name, kind, last_start, last_end,
             first_seen_at, updated_at, data
      FROM clients
    `).all();
    if (!rows.length) return 0;

    const update = this.db.prepare(`
      UPDATE clients
      SET guest = ?, phone = ?, car = ?, group_name = '', kind = ?,
          last_start = NULL, last_end = NULL, data = ?
      WHERE normalized_name = ?
    `);
    let changed = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const row of rows) {
        let current = {};
        try {
          current = JSON.parse(row.data);
        } catch {
          current = {};
        }
        const details = clientHistoryDetails({
          ...current,
          guest: current.guest || row.guest,
          phone: current.phone || row.phone,
          car: current.car || row.car,
          category: current.category || current.kind || row.kind
        });
        const stored = {
          ...details,
          historySource: "local",
          historyNormalizedName: row.normalized_name,
          historyFirstSeenAt: current.historyFirstSeenAt || row.first_seen_at,
          historyUpdatedAt: current.historyUpdatedAt || row.updated_at
        };
        const nextData = JSON.stringify(stored);
        const alreadySanitized =
          !row.group_name && row.kind === details.category && !row.last_start && !row.last_end &&
          row.guest === details.guest && row.phone === details.phone && row.car === details.car &&
          row.data === nextData;
        if (alreadySanitized) continue;
        update.run(details.guest, details.phone, details.car, details.category, nextData, row.normalized_name);
        changed += 1;
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    return changed;
  }

  existingClient(normalizedName) {
    const row = this.db.prepare("SELECT data FROM clients WHERE normalized_name = ?").get(normalizedName);
    return row ? JSON.parse(row.data) : null;
  }

  syncReservations(reservations = []) {
    const candidates = new Map();
    for (const reservation of reservations) {
      if (!reservation || reservation.guest === "Disponibil") continue;
      const normalizedName = normalizeClientName(reservation.guest);
      if (!normalizedName) continue;
      candidates.set(normalizedName, newestClient(candidates.get(normalizedName), reservation));
    }
    if (!candidates.size) return 0;

    const now = new Date().toISOString();
    const upsert = this.db.prepare(`
      INSERT INTO clients
        (normalized_name, guest, phone, car, group_name, kind, last_start, last_end, first_seen_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(normalized_name) DO UPDATE SET
        guest = excluded.guest,
        phone = excluded.phone,
        car = excluded.car,
        group_name = excluded.group_name,
        kind = excluded.kind,
        last_start = excluded.last_start,
        last_end = excluded.last_end,
        updated_at = excluded.updated_at,
        data = excluded.data
    `);

    this.db.exec("BEGIN IMMEDIATE");
    let changed = 0;
    try {
      for (const [normalizedName, candidate] of candidates) {
        const current = this.existingClient(normalizedName);
        const client = newestClient(current, candidate);
        const firstSeenAt = current?.historyFirstSeenAt || now;
        const stored = {
          ...clientHistoryDetails(client),
          historySource: "local",
          historyNormalizedName: normalizedName,
          historyFirstSeenAt: firstSeenAt,
          historyUpdatedAt: now
        };
        const currentFingerprint = current ? JSON.stringify({ ...current, historyUpdatedAt: "" }) : "";
        const storedFingerprint = JSON.stringify({ ...stored, historyUpdatedAt: "" });
        if (currentFingerprint === storedFingerprint) continue;
        upsert.run(
          normalizedName,
          String(stored.guest || ""),
          String(stored.phone || ""),
          String(stored.car || ""),
          "",
          String(stored.category || ""),
          null,
          null,
          firstSeenAt,
          now,
          JSON.stringify(stored)
        );
        changed += 1;
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    if (changed > 0) this._cachedClients = null;
    return changed;
  }

  clients() {
    if (this._cachedClients) return this._cachedClients;
    this._cachedClients = this.db
      .prepare("SELECT normalized_name, data FROM clients ORDER BY guest COLLATE NOCASE")
      .all()
      .map((row) => ({ normalizedName: row.normalized_name, ...JSON.parse(row.data) }));
    return this._cachedClients;
  }

  searchClients(query, limit = 300) {
    const normalized = normalizeClientName(query);
    if (!normalized) return this.clients();
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (!tokens.length) return this.clients();

    const whereClauses = tokens.map(() => "(normalized_name LIKE ? OR guest LIKE ? OR phone LIKE ? OR car LIKE ?)");
    const params = [];
    tokens.forEach((token) => {
      const p = `%${token}%`;
      params.push(p, p, p, p);
    });
    params.push(limit);

    const rows = this.db
      .prepare(`
        SELECT normalized_name, data
        FROM clients
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY guest COLLATE NOCASE
        LIMIT ?
      `)
      .all(...params);
    return rows.map((row) => ({ normalizedName: row.normalized_name, ...JSON.parse(row.data) }));
  }

  checkpoint() {
    this.db.exec("PRAGMA wal_checkpoint(FULL)");
  }

  close() {
    this.db.close();
  }
}

function marinaDirectoryEntry(booking = {}) {
  const normalizedName = normalizeClientName(booking.guest);
  return {
    ...booking,
    key: directoryKey("marina", [booking.source, booking.providerBookingId, booking.guest, booking.phone, booking.start, booking.end, booking.unitHint]),
    id: booking.unitHint || "-",
    kind: booking.kind || (booking.group === "camping" ? "Camping" : "Camere"),
    directorySource: "marina",
    directoryReadOnly: true,
    normalizedName
  };
}

function localDirectoryEntry(client = {}) {
  const normalizedName = client.normalizedName || normalizeClientName(client.guest);
  return {
    ...client,
    key: directoryKey("local", [normalizedName]),
    id: client.id || "Istoric local",
    directorySource: "local-history",
    directoryReadOnly: true,
    normalizedName
  };
}

function mergeClientDirectory(marinaBookings = [], localClients = []) {
  const validMarinaBookings = marinaBookings.filter((booking) => normalizeClientName(booking?.guest));
  const marinaNames = new Set(validMarinaBookings.map((booking) => normalizeClientName(booking.guest)));
  const marinaEntries = validMarinaBookings.map(marinaDirectoryEntry);
  const localByName = new Map();
  localClients.forEach((client) => {
    const normalizedName = client.normalizedName || normalizeClientName(client.guest);
    if (!normalizedName || marinaNames.has(normalizedName)) return;
    localByName.set(normalizedName, newestClient(localByName.get(normalizedName), { ...client, normalizedName }));
  });
  const localEntries = [...localByName.values()]
    .map(localDirectoryEntry);
  return [...marinaEntries, ...localEntries];
}

module.exports = {
  ClientHistoryStore,
  mergeClientDirectory,
  normalizeClientName
};
