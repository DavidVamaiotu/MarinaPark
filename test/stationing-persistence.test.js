const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

async function request(url, pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers
  });
  return { status: response.status, body: await response.json() };
}

async function startServer(root) {
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  await Promise.all([dataDir, runtimeDir].map((directory) => fs.mkdir(directory, { recursive: true })));
  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.resolve(__dirname, ".."),
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
    child.stderr.on("data", (chunk) => { output += chunk; });
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
    }
  };
}

test("stationing payments and idempotent stay links survive an application restart", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-stationing-persistence-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  let server = await startServer(root);

  const stationing = {
    key: "station-1",
    schemaVersion: 2,
    owner: "Ana",
    caravan: "R1",
    startDate: "2026-07-01",
    endDate: "2026-07-04",
    openEnded: false,
    pricePerDayCents: 2000,
    paymentTransactions: [{ id: "cash-1", paymentDate: "2026-07-01", amountCents: 4000, method: "cash", createdAt: "2026-07-01T10:00:00Z" }],
    stayLinks: [
      { stayKey: "stay-1", subtractDays: true, linkedAt: "2026-07-01T09:00:00Z" },
      { stayKey: "stay-1", subtractDays: true, linkedAt: "2026-07-01T09:00:00Z" }
    ]
  };
  const saved = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [{ key: "stay-1", id: "RV-1", guest: "Ana", group: "camping", kind: "Campare rulotă", start: "2026-07-02", end: "2026-07-03" }],
      units: [],
      stationing: [stationing],
      barArticles: [],
      config: { savedAt: "stationing-seed" }
    })
  });
  assert.equal(saved.status, 200);

  const db = new DatabaseSync(path.join(server.dataDir, "marina-park.sqlite"), { readOnly: true });
  try {
    assert.deepEqual({ ...db.prepare("SELECT price_per_day_cents, open_ended, end_date FROM stationing WHERE key = ?").get("station-1") }, {
      price_per_day_cents: 2000,
      open_ended: 0,
      end_date: "2026-07-04"
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stationing_payments WHERE stationing_key = ?").get("station-1").count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM stationing_stay_links WHERE stationing_key = ?").get("station-1").count, 1);
  } finally {
    db.close();
  }

  await server.stop();
  server = await startServer(root);
  context.after(server.stop);
  const loaded = await request(server.url, "/api/data");
  assert.equal(loaded.status, 200);
  const restored = loaded.body.stationing.find((item) => item.key === "station-1");
  assert.equal(restored.paymentTransactions[0].amountCents, 4000);
  assert.deepEqual(restored.stayLinks.map((link) => link.stayKey), ["stay-1"]);
  assert.equal(restored.openEnded, false);
  assert.equal(restored.endDate, "2026-07-04");
});
