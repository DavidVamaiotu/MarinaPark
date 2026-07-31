const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

async function startTestServer() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "marina-saga-bar-test-"));
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

async function jsonRequest(url, pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers
  });
  return { status: response.status, body: await response.json() };
}

test("SAGA export uses the authoritative unexported ledger and only separate reservation bar items", async (context) => {
  const server = await startTestServer();
  context.after(server.stop);
  const attachedItem = {
    id: "attached-water",
    articleKey: "water",
    name: "Water",
    price: 5,
    quantity: 2,
    vatRate: 11,
    hasSgr: true,
    subtotal: 10,
    sgrTotal: 1,
    lineTotal: 11
  };
  const seed = await jsonRequest(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [
        { key: "stay-combined", id: "D-1", guest: "Combined", group: "room", kind: "Room", price: 111, balance: 111, barItems: [attachedItem] },
        { key: "stay-separate", id: "D-2", guest: "Separate", group: "room", kind: "Room", price: 111, balance: 111, barItems: [{ ...attachedItem, id: "attached-water-separate" }] }
      ],
      units: [],
      stationing: [],
      barArticles: [{ key: "water", name: "Water", price: 5, stock: 10, vatRate: 11, hasSgr: true }],
      config: { savedAt: "seed", roomUnitCatalogSeeded: true }
    })
  });
  assert.equal(seed.status, 200);

  const direct = await jsonRequest(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "direct-bar", type: "bar", method: "voucher", amount: 11, items: [{ key: "water", quantity: 2 }] })
  });
  assert.equal(direct.status, 200);
  const combined = await jsonRequest(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "combined-stay", type: "stay", method: "voucher", amount: 111, stayKey: "stay-combined", receiptBarMode: "combined" })
  });
  assert.equal(combined.status, 200);
  const combinedThenSeparate = await jsonRequest(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({
      paymentId: "combined-stay-repeat",
      type: "stay",
      method: "voucher",
      amount: 1,
      stayKey: "stay-combined",
      receiptBarMode: "separate",
      receiptAccommodationAmount: 0
    })
  });
  assert.equal(combinedThenSeparate.status, 200);
  const separate = await jsonRequest(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({
      paymentId: "separate-stay",
      type: "stay",
      method: "voucher",
      amount: 111,
      stayKey: "stay-separate",
      receiptBarMode: "separate",
      receiptAccommodationAmount: 100
    })
  });
  assert.equal(separate.status, 200);

  const noise = Array.from({ length: 5001 }, (_, index) => ({
    id: `noise-${index}`,
    timestamp: new Date(Date.now() + index).toISOString(),
    eventType: "update",
    entityType: "settings",
    message: "Noise"
  }));
  assert.equal((await jsonRequest(server.url, "/api/log", { method: "POST", body: JSON.stringify({ entries: noise }) })).status, 200);
  assert.equal((await jsonRequest(server.url, "/api/clear-activity-log", {
    method: "POST",
    body: JSON.stringify({ confirm: "STERGE LOG", scope: "all" })
  })).status, 200);

  const exportResponse = await fetch(`${server.url}/api/saga/bar-sales?all=1&companyCif=RO123&companyName=Marina&clientName=Client`);
  const xml = await exportResponse.text();
  assert.equal(exportResponse.status, 200);
  assert.match(xml, /<Descriere>Water<\/Descriere>/);
  assert.match(xml, /<Cantitate>4\.000<\/Cantitate>/);
  assert.match(xml, /<Descriere>AMBALAJ SGR<\/Descriere>/);
  assert.match(xml, /Bonuri\/plati incluse: 2/);
  assert.doesNotMatch(xml, /Bonuri\/plati incluse: 3/);
  assert.ok(exportResponse.headers.get("x-saga-exported-at"));

  const database = new DatabaseSync(path.join(server.dataDir, "marina-park.sqlite"), { readOnly: true });
  try {
    const rows = database.prepare("SELECT payment_id, exported_at FROM bar_export_lines ORDER BY payment_id, id").all();
    assert.equal(rows.length, 4);
    assert.deepEqual([...new Set(rows.map((row) => row.payment_id))], ["direct-bar", "separate-stay"]);
    assert.ok(rows.every((row) => row.exported_at));
  } finally {
    database.close();
  }

  const forgedLog = await jsonRequest(server.url, "/api/log", {
    method: "POST",
    body: JSON.stringify({
      id: "forged-bar-payment",
      eventType: "payment",
      entityType: "bar",
      method: "card",
      message: "Forged",
      data: { items: [{ key: "fake", name: "Fake", price: 999, quantity: 1, vatRate: 21 }] }
    })
  });
  assert.equal(forgedLog.status, 200);
  const repeated = await fetch(`${server.url}/api/saga/bar-sales?all=1&companyCif=RO123`);
  assert.equal(repeated.status, 404);
  assert.match(await repeated.text(), /neexportate/);
});
