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

async function startTestServer() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-unit-data-test-"));
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  await Promise.all([dataDir, runtimeDir].map((directory) => fs.mkdir(directory, { recursive: true })));

  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "0",
      MARINA_DATA_DIR: dataDir,
      MARINA_RUNTIME_DIR: runtimeDir
    },
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
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

test("unit saves normalize category, pricing mode, money, and daily prices", async (context) => {
  const server = await startTestServer();
  context.after(server.stop);

  const saved = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [{ key: "rv-stay", id: "RV-01", guest: "Client", group: "camping", kind: "Campare rulotă" }],
      units: [
        {
          id: "RV-01",
          group: "rv",
          kind: "Campare rulotă",
          pricingMode: "per-person-night",
          adultPrice: "120,50",
          childPrice: "60,25",
          dailyPrices: {
            "2026-08-03": { adultPrice: "130,40" },
            "2026-08-04": "0",
            "2026-08-05": "90",
            invalid: "50"
          }
        },
        {
          id: "T-01",
          group: "tent",
          kind: "Campare cort",
          pricingMode: "unknown",
          dailyPrices: { "2026-08-01": "45" }
        },
        {
          id: "D-01",
          group: "room",
          kind: "Cameră dublă",
          dailyPrices: []
        }
      ],
      stationing: [],
      barArticles: [],
      config: { savedAt: "unit-seed", roomUnitCatalogSeeded: true }
    })
  });
  assert.equal(saved.status, 200);

  const loaded = await request(server.url, "/api/data");
  assert.equal(loaded.status, 200);

  const rv = loaded.body.units.find((unit) => unit.id === "RV-01");
  assert.equal(rv.group, "camping");
  assert.equal(rv.pricingMode, "per-person-night");
  assert.equal(rv.adultPrice, 120.5);
  assert.equal(rv.childPrice, 60.25);
  assert.deepEqual(rv.dailyPrices, {
    "2026-08-03": 130.4,
    "2026-08-05": 90
  });

  const tent = loaded.body.units.find((unit) => unit.id === "T-01");
  assert.equal(tent.group, "camping");
  assert.equal(tent.pricingMode, "per-night");
  assert.equal(tent.adultPrice, 45);
  assert.equal(tent.childPrice, 22.5);

  const room = loaded.body.units.find((unit) => unit.id === "D-01");
  assert.equal(room.group, "room");
  assert.deepEqual(room.dailyPrices, {});

  const db = new DatabaseSync(path.join(server.dataDir, "marina-park.sqlite"), { readOnly: true });
  try {
    const rows = db
      .prepare("SELECT id, group_name, pricing_mode, adult_price, child_price FROM units ORDER BY id")
      .all()
      .map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { id: "D-01", group_name: "room", pricing_mode: "per-night", adult_price: 0, child_price: 0 },
      { id: "RV-01", group_name: "camping", pricing_mode: "per-person-night", adult_price: 120.5, child_price: 60.25 },
      { id: "T-01", group_name: "camping", pricing_mode: "per-night", adult_price: 45, child_price: 22.5 }
    ]);
  } finally {
    db.close();
  }
});
