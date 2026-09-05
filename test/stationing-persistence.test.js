const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

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
    manualPrepaidNights: 2,
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
  assert.equal(restored.manualPrepaidNights, 2);
  assert.equal(restored.endDate, "2026-07-04");
});

test("automatic reservation stationing deductions are atomic and idempotent across restart", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-stationing-reservation-"));
  let server = null;
  context.after(async () => {
    if (server) await server.stop().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  });
  server = await startServer(root);

  const seeded = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [],
      units: [],
      stationing: [{
        key: "station-atomic",
        schemaVersion: 2,
        owner: "Ana",
        caravan: "R1",
        startDate: "2026-07-01",
        endDate: "2026-07-10",
        openEnded: false,
        pricePerDayCents: 2000,
        paymentTransactions: [],
        deductions: [],
        stayLinks: []
      }],
      barArticles: [],
      config: { savedAt: "stationing-atomic-seed" },
      allowEmptyCollections: true
    })
  });
  assert.equal(seeded.status, 200);

  const stay = {
    key: "stay-atomic",
    id: "RV-atomic",
    guest: "Ana",
    group: "camping",
    kind: "Campare rulotă",
    start: "2026-07-02",
    end: "2026-07-05",
    stationingDeduction: {
      recordKey: "station-atomic",
      recordLabel: "Ana (R1)",
      selectedAt: "2026-07-01T08:00:00.000Z",
      nights: 3,
      subtractDays: true
    }
  };
  const failed = await request(server.url, "/api/reservation", {
    method: "POST",
    body: JSON.stringify({
      stay: {
        ...stay,
        key: "stay-invalid",
        stationingDeduction: {
          ...stay.stationingDeduction,
          recordKey: "station-missing"
        }
      },
      stationingDeduction: {
        ...stay.stationingDeduction,
        recordKey: "station-missing"
      }
    })
  });
  assert.equal(failed.status, 404);
  const afterFailure = await request(server.url, "/api/data");
  assert.ok(!afterFailure.body.stays.some((item) => item.key === "stay-invalid"));

  const save = (reservation) => request(server.url, "/api/reservation", {
    method: "POST",
    body: JSON.stringify({
      stay: reservation,
      stationingDeduction: reservation.stationingDeduction
    })
  });

  const first = await save(stay);
  assert.equal(first.status, 200);
  assert.equal(first.body.stay.stationingDeduction.appliedNights, 3);
  assert.ok(first.body.stay.stationingDeduction.appliedAt);
  assert.equal(first.body.stationing.deductions.length, 1);
  assert.equal(first.body.stationing.stayLinks.length, 1);
  assert.equal(first.body.stationing.stayLinks[0].stayKey, "stay-atomic");

  const second = await save(stay);
  assert.equal(second.status, 200);
  assert.equal(
    second.body.stay.stationingDeduction.appliedAt,
    first.body.stay.stationingDeduction.appliedAt,
  );
  assert.equal(second.body.stationing.deductions.length, 1);
  assert.equal(second.body.stationing.stayLinks.length, 1);

  const beforeRestart = await request(server.url, "/api/data");
  const savedStay = beforeRestart.body.stays.find((item) => item.key === "stay-atomic");
  const savedStationing = beforeRestart.body.stationing.find((item) => item.key === "station-atomic");
  assert.equal(savedStay.stationingDeduction.appliedNights, 3);
  assert.equal(savedStationing.deductions.length, 1);
  assert.equal(savedStationing.stayLinks.length, 1);

  await server.stop();
  server = await startServer(root);
  const afterRestart = await request(server.url, "/api/data");
  const restoredStay = afterRestart.body.stays.find((item) => item.key === "stay-atomic");
  const restoredStationing = afterRestart.body.stationing.find((item) => item.key === "station-atomic");
  assert.deepEqual(restoredStay.stationingDeduction, savedStay.stationingDeduction);
  assert.deepEqual(restoredStationing.deductions, savedStationing.deductions);
  assert.deepEqual(restoredStationing.stayLinks, savedStationing.stayLinks);
});

test("confirmed final bar, stationing, and unit deletions persist across restart", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-final-deletions-"));
  let server = null;
  context.after(async () => {
    if (server) await server.stop().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  });
  server = await startServer(root);

  const seeded = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [],
      units: [{ id: "D-final", group: "room", kind: "Room" }],
      stationing: [{
        key: "station-final",
        owner: "Final Owner",
        caravan: "RV",
        startDate: "2026-09-01",
        openEnded: true,
      }],
      barArticles: [{ key: "bar-final", name: "Final article", stock: 1 }],
      config: {},
      allowEmptyCollections: true,
    }),
  });
  assert.equal(seeded.status, 200);

  const original = await request(server.url, "/api/data");
  const refused = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      ...original.body,
      barArticles: [],
      baseSavedAt: original.body.config.savedAt,
    }),
  });
  assert.equal(refused.status, 409);

  let current = original.body;
  for (const [collection, value] of [
    ["barArticles", []],
    ["stationing", []],
    ["units", []],
  ]) {
    const saved = await request(server.url, "/api/data", {
      method: "POST",
      body: JSON.stringify({
        ...current,
        [collection]: value,
        baseSavedAt: current.config.savedAt,
        allowEmptyCollections: [collection],
      }),
    });
    assert.equal(saved.status, 200);
    current = (await request(server.url, "/api/data")).body;
  }

  await server.stop();
  server = await startServer(root);
  const restored = await request(server.url, "/api/data");
  assert.deepEqual(restored.body.units, []);
  assert.deepEqual(restored.body.stationing, []);
  assert.deepEqual(restored.body.barArticles, []);
});
