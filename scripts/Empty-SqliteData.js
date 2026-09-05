const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.resolve(__dirname, "..");
const fullyProtectedTables = new Set(["app_config", "bar_articles"]);

function parseArguments(argv) {
  const options = {
    database: path.join(rootDir, "marina-park.sqlite2"),
    confirmed: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--yes") {
      options.confirmed = true;
      continue;
    }
    if (argument === "--database") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --database.");
      options.database = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      console.log(`Usage:
  npm run empty:database -- --yes [--database marina-park.sqlite2]

Deletes non-bar records from every user table, including all reservations. Bar
inventory, standalone bar payments, bar activity, and shared app configuration
are kept. The schema remains unchanged and a timestamped backup is created first.`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function schemaSnapshot(db) {
  return JSON.stringify(db.prepare(`
    SELECT type, name, tbl_name, rootpage, sql
    FROM sqlite_schema
    ORDER BY type, name
  `).all());
}

function userTables(db) {
  return db.prepare(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);
}

function tableCounts(db, tables) {
  return tables.map((table) => {
    const total = db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count;
    let protectedCount = 0;
    if (fullyProtectedTables.has(table)) protectedCount = total;
    if (table === "activity_log") {
      protectedCount = db.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE LOWER(entity_type) = 'bar'").get().count;
    }
    if (table === "payment_transactions") {
      protectedCount = db.prepare("SELECT COUNT(*) AS count FROM payment_transactions WHERE LOWER(type) = 'bar'").get().count;
    }
    if (table === "bar_export_lines") {
      protectedCount = db.prepare("SELECT COUNT(*) AS count FROM bar_export_lines WHERE LOWER(source_type) = 'bar'").get().count;
    }
    return { table, total, protectedCount, deleteCount: total - protectedCount };
  });
}

function protectedDataSnapshot(db) {
  return JSON.stringify({
    appConfig: db.prepare("SELECT * FROM app_config ORDER BY key").all(),
    barArticles: db.prepare("SELECT * FROM bar_articles ORDER BY key").all(),
    barActivity: db.prepare("SELECT * FROM activity_log WHERE LOWER(entity_type) = 'bar' ORDER BY id").all(),
    barPayments: db.prepare("SELECT * FROM payment_transactions WHERE LOWER(type) = 'bar' ORDER BY id").all(),
    barExportLines: db.prepare("SELECT * FROM bar_export_lines WHERE LOWER(source_type) = 'bar' ORDER BY id").all()
  });
}

function deleteNonBarRows(db, table) {
  if (fullyProtectedTables.has(table)) return;
  if (table === "activity_log") {
    db.exec("DELETE FROM activity_log WHERE LOWER(entity_type) <> 'bar'");
    return;
  }
  if (table === "payment_transactions") {
    db.exec("DELETE FROM payment_transactions WHERE LOWER(type) <> 'bar'");
    return;
  }
  if (table === "bar_export_lines") {
    db.exec("DELETE FROM bar_export_lines WHERE LOWER(source_type) <> 'bar'");
    return;
  }
  db.exec(`DELETE FROM ${quoteIdentifier(table)}`);
}

function backupDatabase(databasePath) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const backupPath = `${databasePath}.backup-before-empty-${stamp}.sqlite`;
  fs.copyFileSync(databasePath, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!fs.existsSync(options.database)) throw new Error(`Database does not exist: ${options.database}`);

  let db = new DatabaseSync(options.database);
  const integrityBefore = db.prepare("PRAGMA integrity_check").get().integrity_check;
  if (integrityBefore !== "ok") throw new Error(`SQLite integrity check failed: ${integrityBefore}`);

  const tables = userTables(db);
  if (tables.length === 0) throw new Error("The database has no user tables.");
  const requiredTables = ["reservations", "app_config", "bar_articles", "activity_log", "payment_transactions"];
  for (const table of requiredTables) {
    if (!tables.includes(table)) throw new Error(`Required table is missing: ${table}`);
  }

  const counts = tableCounts(db, tables);
  const deleteTotal = counts.reduce((sum, entry) => sum + entry.deleteCount, 0);
  const protectedTotal = counts.reduce((sum, entry) => sum + entry.protectedCount, 0);

  console.log(`Database: ${options.database}`);
  for (const entry of counts) {
    console.log(`  ${entry.table}: ${entry.deleteCount} to delete, ${entry.protectedCount} bar/shared protected`);
  }
  console.log(`Records to delete: ${deleteTotal}`);
  console.log(`Protected records: ${protectedTotal}`);

  if (!options.confirmed) {
    db.close();
    console.log("No data was deleted. Run again with --yes to confirm.");
    return;
  }

  db.exec("PRAGMA wal_checkpoint(FULL)");
  const schemaBefore = schemaSnapshot(db);
  const protectedBefore = protectedDataSnapshot(db);
  db.close();

  const backupPath = backupDatabase(options.database);
  db = new DatabaseSync(options.database);
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const table of tables) deleteNonBarRows(db, table);

    const countsAfter = tableCounts(db, tables);
    for (const table of countsAfter) {
      if (table.deleteCount !== 0) throw new Error(`Non-bar records remain in table: ${table.table}`);
    }
    if (protectedDataSnapshot(db) !== protectedBefore) throw new Error("Protected bar data changed unexpectedly.");
    if (schemaSnapshot(db) !== schemaBefore) throw new Error("The database schema changed unexpectedly.");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close();
  }

  db = new DatabaseSync(options.database, { readOnly: true });
  const integrityAfter = db.prepare("PRAGMA integrity_check").get().integrity_check;
  db.close();
  if (integrityAfter !== "ok") throw new Error(`SQLite integrity check failed after deletion: ${integrityAfter}`);

  console.log(`Deleted ${deleteTotal} non-bar records from ${tables.length} tables.`);
  console.log(`Preserved ${protectedTotal} bar/shared records. Schema unchanged.`);
  console.log(`Backup: ${backupPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
