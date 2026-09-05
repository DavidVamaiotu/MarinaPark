const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

async function request(url, pathname, options = {}) {
  if (options.body && ["/api/data", "/api/reservation", "/api/payment"].includes(pathname)) {
    const payload = JSON.parse(options.body);
    if (!Object.hasOwn(payload, "baseSavedAt")) {
      const current = await fetch(`${url}/api/data`).then((response) => response.json());
      if (current.config?.savedAt) payload.baseSavedAt = current.config.savedAt;
      options = { ...options, body: JSON.stringify(payload) };
    }
  }
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers
  });
  return { status: response.status, body: await response.json() };
}

async function startTestServer() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "marina-log-clear-test-"));
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  await Promise.all([dataDir, runtimeDir].map((directory) => fsp.mkdir(directory, { recursive: true })));

  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: "0", MARINA_DATA_DIR: dataDir, MARINA_RUNTIME_DIR: runtimeDir },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/Marina Park app: (http:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}: ${output}`));
    });
  });

  return {
    url,
    dataDir,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
      await fsp.rm(root, { recursive: true, force: true });
    }
  };
}

test("log options expose only the full and date-range reservation-log purge actions", () => {
  const html = fs.readFileSync(path.join(projectRoot, "activity.html"), "utf8");
  const source = fs.readFileSync(path.join(projectRoot, "activity.js"), "utf8");

  assert.match(html, /<details class="log-maintenance">[\s\S]*id="clearActivityLog">Șterge jurnalele rezervărilor<\/button>/);
  assert.doesNotMatch(html, /id="clearReservationLogs"|id="clearBarLogs"/);
  assert.match(html, /id="clearLogFromDate" type="date"/);
  assert.match(html, /id="clearLogToDate" type="date"/);
  assert.match(html, /id="clearActivityLogRange">Șterge intervalul<\/button>/);
  assert.match(html, /id="loadMoreLog" hidden>Încarcă mai multe<\/button>/);
  assert.doesNotMatch(source, /clearActivityLogButton\.hidden\s*=\s*true/);
});

test("date-range purge deletes only reservation and voucher-bar logs inside the requested interval", async (context) => {
  const server = await startTestServer();
  context.after(server.stop);
  const entries = [
    { id: "before-range", timestamp: "2026-07-09T23:59:59.999Z", eventType: "update", entityType: "client", message: "Before" },
    { id: "range-client", timestamp: "2026-07-10T00:00:00.000Z", eventType: "update", entityType: "client", message: "Reservation" },
    { id: "range-voucher", timestamp: "2026-07-11T12:00:00.000Z", eventType: "payment", entityType: "bar", method: "voucher", message: "Voucher bar" },
    { id: "range-cash", timestamp: "2026-07-11T13:00:00.000Z", eventType: "payment", entityType: "bar", method: "numerar", message: "Cash bar" },
    { id: "range-card", timestamp: "2026-07-11T14:00:00.000Z", eventType: "payment", entityType: "bar", method: "card", message: "Card bar" },
    { id: "range-bar-article", timestamp: "2026-07-12T10:00:00.000Z", eventType: "update", entityType: "bar_article", message: "Article edit" },
    { id: "range-stationing", timestamp: "2026-07-12T11:00:00.000Z", eventType: "update", entityType: "stationing", message: "Stationing" },
    { id: "after-range", timestamp: "2026-07-13T00:00:00.000Z", eventType: "update", entityType: "client", message: "After" }
  ];
  assert.equal((await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({ entries })
  })).status, 200);

  const rejected = await request(server.url, "/api/clear-activity-log", {
    method: "POST",
    body: JSON.stringify({
      confirm: "STERGE INTERVAL",
      scope: "range",
      startInclusive: "2026-07-13T00:00:00.000Z",
      endExclusive: "2026-07-10T00:00:00.000Z"
    })
  });
  assert.equal(rejected.status, 400);

  const cleared = await request(server.url, "/api/clear-activity-log", {
    method: "POST",
    body: JSON.stringify({
      confirm: "STERGE INTERVAL",
      scope: "range",
      startInclusive: "2026-07-10T00:00:00.000Z",
      endExclusive: "2026-07-13T00:00:00.000Z"
    })
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.deleted, 2);

  const log = await request(server.url, "/api/log?limit=20");
  assert.deepEqual(log.body.entries.map((entry) => entry.id).sort(), [
    "after-range",
    "before-range",
    "range-bar-article",
    "range-card",
    "range-cash",
    "range-stationing"
  ]);

  assert.equal((await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({ entries: [entries[1], entries[2]] })
  })).status, 200);
  const afterStaleRetry = await request(server.url, "/api/log?limit=20");
  assert.doesNotMatch(afterStaleRetry.body.entries.map((entry) => entry.id).join(" "), /range-client|range-voucher/);
});

test("activity log pages return stable offsets and report when older entries remain", async (context) => {
  const server = await startTestServer();
  context.after(server.stop);
  const entries = Array.from({ length: 5 }, (_, index) => ({
    id: `page-${index}`,
    timestamp: new Date(Date.UTC(2026, 6, 1, 0, 0, index)).toISOString(),
    eventType: "update",
    entityType: "settings",
    message: `Page ${index}`
  }));
  assert.equal((await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({ entries })
  })).status, 200);

  const first = await request(server.url, "/api/log?limit=2&offset=0");
  assert.deepEqual(first.body.entries.map((entry) => entry.id), ["page-4", "page-3"]);
  assert.equal(first.body.hasMore, true);
  assert.equal(first.body.nextOffset, 2);

  const last = await request(server.url, "/api/log?limit=2&offset=4");
  assert.deepEqual(last.body.entries.map((entry) => entry.id), ["page-0"]);
  assert.equal(last.body.hasMore, false);
  assert.equal(last.body.nextOffset, 5);
});

test("full purge removes reservation and voucher-bar logs from live storage and every managed backup", async (context) => {
  const server = await startTestServer();
  context.after(server.stop);
  const entries = [
    { id: "client-log", timestamp: "2026-07-20T10:00:00.000Z", eventType: "update", entityType: "client", message: "Reservation" },
    { id: "bar-voucher-log", timestamp: "2026-07-20T10:01:00.000Z", eventType: "payment", entityType: "bar", method: "voucher", message: "Voucher bar" },
    { id: "bar-cash-log", timestamp: "2026-07-20T10:02:00.000Z", eventType: "payment", entityType: "bar", method: "numerar", message: "Cash bar" },
    { id: "bar-card-log", timestamp: "2026-07-20T10:03:00.000Z", eventType: "payment", entityType: "bar", method: "card", message: "Card bar" },
    { id: "bar-article-log", timestamp: "2026-07-20T10:04:00.000Z", eventType: "update", entityType: "bar_article", message: "Bar article" },
    { id: "stationing-log", timestamp: "2026-07-20T10:05:00.000Z", eventType: "update", entityType: "stationing", message: "Stationing" }
  ];
  assert.equal((await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({ entries })
  })).status, 200);

  const cleared = await request(server.url, "/api/clear-activity-log", {
    method: "POST",
    body: JSON.stringify({ confirm: "STERGE LOG", scope: "all" })
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.deleted, 2);
  assert.equal(cleared.body.purgedBackups, 2);

  const retainedIds = ["bar-article-log", "bar-card-log", "bar-cash-log", "stationing-log"];
  const log = await request(server.url, "/api/log?limit=20");
  assert.deepEqual(log.body.entries.map((entry) => entry.id).sort(), retainedIds);

  for (const filename of ["marina-park-daily.sqlite", "marina-park-weekly.sqlite"]) {
    const backupPath = path.join(server.dataDir, "backups", filename);
    const backupDb = new DatabaseSync(backupPath, { readOnly: true });
    try {
      assert.deepEqual(
        backupDb.prepare("SELECT id FROM activity_log ORDER BY id ASC").all().map((row) => row.id),
        retainedIds
      );
      assert.equal(backupDb.prepare("SELECT COUNT(*) AS count FROM activity_log_purges").get().count, 1);
    } finally {
      backupDb.close();
    }
    assert.equal((await fsp.readFile(backupPath)).includes(Buffer.from("client-log")), false);
    assert.equal((await fsp.readFile(backupPath)).includes(Buffer.from("bar-voucher-log")), false);
  }

  const liveDatabase = await fsp.readFile(path.join(server.dataDir, "marina-park.sqlite"));
  assert.equal(liveDatabase.includes(Buffer.from("client-log")), false);
  assert.equal(liveDatabase.includes(Buffer.from("bar-voucher-log")), false);

  const snapshot = await fsp.readFile(path.join(server.dataDir, "activity-log.json"), "utf8");
  const journal = await fsp.readFile(path.join(server.dataDir, "activity-log.jsonl"), "utf8");
  assert.doesNotMatch(`${snapshot}\n${journal}`, /client-log|bar-voucher-log/);
  assert.match(`${snapshot}\n${journal}`, /bar-cash-log/);

  assert.equal((await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({ entries: [entries[0], entries[1]] })
  })).status, 200);
  const afterStaleRetry = await request(server.url, "/api/log?limit=20");
  assert.deepEqual(afterStaleRetry.body.entries.map((entry) => entry.id).sort(), retainedIds);

  const freshClientLog = {
    id: "fresh-client-log",
    timestamp: new Date(Date.parse(cleared.body.clearedAt) + 1000).toISOString(),
    eventType: "update",
    entityType: "client",
    message: "Fresh reservation activity"
  };
  assert.equal((await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify(freshClientLog)
  })).status, 200);
  const afterFreshEntry = await request(server.url, "/api/log?limit=20");
  assert.match(afterFreshEntry.body.entries.map((entry) => entry.id).join(" "), /fresh-client-log/);
});

test("clearing the log deletes only activity rows and preserves the SQLite file and schema", async (context) => {
  const server = await startTestServer();
  context.after(server.stop);

  const seededData = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [{ key: "stay-kept", id: "D-1", guest: "Client păstrat", group: "room", kind: "Cameră" }],
      units: [{ id: "D-1", group: "room", kind: "Cameră" }],
      stationing: [],
      barArticles: [],
      config: { savedAt: "log-clear-test", roomUnitCatalogSeeded: true }
    })
  });
  assert.equal(seededData.status, 200);

  const seededLog = await request(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({
      id: "log-clear-entry",
      timestamp: "2026-07-23T08:00:00.000Z",
      eventType: "update",
      entityType: "client",
      message: "Intrare de test"
    })
  });
  assert.equal(seededLog.status, 200);

  const databasePath = path.join(server.dataDir, "marina-park.sqlite");
  const beforeStat = await fsp.stat(databasePath);
  const beforeDb = new DatabaseSync(databasePath, { readOnly: true });
  const activitySchema = beforeDb.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'activity_log'").get().sql;
  assert.equal(beforeDb.prepare("SELECT COUNT(*) AS count FROM activity_log").get().count, 1);
  beforeDb.close();

  const rejected = await request(server.url, "/api/clear-activity-log", {
    method: "POST",
    body: JSON.stringify({ confirm: "wrong" })
  });
  assert.equal(rejected.status, 400);

  const cleared = await request(server.url, "/api/clear-activity-log", {
    method: "POST",
    body: JSON.stringify({ confirm: "STERGE LOG" })
  });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.ok, true);

  const afterStat = await fsp.stat(databasePath);
  const afterDb = new DatabaseSync(databasePath, { readOnly: true });
  try {
    assert.equal(afterStat.ino, beforeStat.ino, "the SQLite database file is retained");
    assert.equal(afterDb.prepare("SELECT COUNT(*) AS count FROM activity_log").get().count, 0);
    assert.equal(
      afterDb.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'activity_log'").get().sql,
      activitySchema,
      "the activity_log schema is retained"
    );
    assert.equal(afterDb.prepare("SELECT COUNT(*) AS count FROM reservations WHERE key = 'stay-kept'").get().count, 1);
  } finally {
    afterDb.close();
  }

  const log = await request(server.url, "/api/log?limit=20");
  assert.deepEqual(log.body.entries, []);
});
