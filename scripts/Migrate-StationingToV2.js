#!/usr/bin/env node

const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const stationingCalculator = require("../stationing-calculator.js");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function tableColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function assertSourceSchema(db) {
  const columns = tableColumns(db, "stationing");
  if (!columns.has("data")) throw new Error("Source database has no legacy stationing data column");
  if (columns.has("price_per_day_cents") || columns.has("open_ended")) {
    throw new Error("Source is not a pre-upgrade stationing database");
  }
}

function assertTargetSchema(db) {
  const columns = tableColumns(db, "stationing");
  for (const required of ["data", "price_per_day_cents", "open_ended"]) {
    if (!columns.has(required)) throw new Error(`Target stationing schema is missing ${required}`);
  }
  for (const table of ["stationing_payments", "stationing_stay_links"]) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    if (!row) throw new Error(`Target database is missing ${table}`);
  }
}

function migratedRecord(row) {
  const legacy = JSON.parse(row.data);
  return stationingCalculator.normalizeRecord({
    ...legacy,
    key: String(legacy.key || row.key),
    owner: String(legacy.owner || row.owner || "").trim(),
    caravan: String(legacy.caravan || row.caravan || "Rulotă staționată").trim(),
    startDate: String(legacy.startDate || row.start_date || ""),
    pricePerDayCents: 1500
  });
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const replace = args.includes("--replace");
  const positional = args.filter((arg) => arg !== "--dry-run" && arg !== "--replace");
  if (positional.length !== 2) {
    fail("Usage: node scripts/Migrate-StationingToV2.js [--dry-run] [--replace] <pre-upgrade.sqlite> <target.sqlite>");
    return;
  }

  const sourcePath = path.resolve(positional[0]);
  const targetPath = path.resolve(positional[1]);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const target = new DatabaseSync(targetPath);

  try {
    assertSourceSchema(source);
    assertTargetSchema(target);
    const records = source
      .prepare("SELECT key, owner, caravan, start_date, end_date, data FROM stationing ORDER BY start_date, owner")
      .all()
      .map(migratedRecord);
    if (!records.length) throw new Error("Source contains no stationing records");

    const summary = {
      source: sourcePath,
      target: targetPath,
      records: records.length,
      payments: records.reduce((total, record) => total + record.paymentTransactions.length, 0),
      stayLinks: records.reduce((total, record) => total + record.stayLinks.length, 0),
      dailyPriceCents: [...new Set(records.map((record) => record.pricePerDayCents))],
      mode: replace ? "replace" : "merge",
      dryRun
    };

    if (dryRun) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const now = new Date().toISOString();
    const insertStationing = target.prepare(`
      INSERT INTO stationing
        (key, owner, caravan, start_date, end_date, price_per_day_cents, open_ended, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPayment = target.prepare(`
      INSERT INTO stationing_payments
        (payment_id, stationing_key, payment_date, amount_cents, method, note, kind, voided_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStayLink = target.prepare(`
      INSERT INTO stationing_stay_links (stationing_key, stay_key, subtract_days, linked_at)
      VALUES (?, ?, ?, ?)
    `);

    target.exec("PRAGMA foreign_keys = ON; BEGIN IMMEDIATE");
    try {
      if (replace) {
        target.exec("DELETE FROM stationing_payments; DELETE FROM stationing_stay_links; DELETE FROM stationing");
      }
      for (const record of records) {
        if (!replace) {
          target.prepare("DELETE FROM stationing_payments WHERE stationing_key = ?").run(record.key);
          target.prepare("DELETE FROM stationing_stay_links WHERE stationing_key = ?").run(record.key);
          target.prepare("DELETE FROM stationing WHERE key = ?").run(record.key);
        }
        insertStationing.run(
          record.key,
          record.owner,
          record.caravan,
          record.startDate,
          record.endDate,
          record.pricePerDayCents,
          record.openEnded ? 1 : 0,
          now,
          JSON.stringify(record)
        );
        for (const payment of record.paymentTransactions) {
          insertPayment.run(
            payment.id,
            record.key,
            payment.paymentDate,
            payment.amountCents,
            payment.method,
            payment.note,
            payment.kind,
            payment.voidedAt,
            payment.createdAt
          );
        }
        for (const link of record.stayLinks) {
          insertStayLink.run(record.key, link.stayKey, link.subtractDays ? 1 : 0, link.linkedAt || now);
        }
      }
      target.exec("COMMIT");
    } catch (error) {
      target.exec("ROLLBACK");
      throw error;
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    source.close();
    target.close();
  }
}

try {
  main();
} catch (error) {
  fail(error.stack || error.message);
}
