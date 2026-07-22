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

test("log options expose the clear-all action on local and LAN pages", () => {
  const html = fs.readFileSync(path.join(projectRoot, "activity.html"), "utf8");
  const source = fs.readFileSync(path.join(projectRoot, "activity.js"), "utf8");

  assert.match(html, /<details class="log-maintenance">[\s\S]*id="clearActivityLog">Șterge tot jurnalul<\/button>/);
  assert.doesNotMatch(source, /clearActivityLogButton\.hidden\s*=\s*true/);
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
