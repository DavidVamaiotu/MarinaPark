const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

async function startTestServer() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "parkline-payment-test-"));
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  const receiptDir = path.join(root, "receipts");
  await Promise.all([dataDir, runtimeDir, receiptDir].map((directory) => fs.mkdir(directory, { recursive: true })));

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
    root,
    runtimeDir,
    receiptDir,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

async function request(url, pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers
  });
  return { status: response.status, body: await response.json() };
}

test("payments are authoritative, idempotent, and proportionally allocated", async (t) => {
  const server = await startTestServer();
  t.after(server.stop);
  const receiptConfig = {
    receiptDirectory: server.receiptDir,
    receiptVat: "11",
    cardPaymentCode: "1",
    cashPaymentCode: "0"
  };
  const seed = {
    stays: [
      { key: "stay-a", id: "D-1", guest: "Linked", personId: "person-1", group: "room", kind: "Room", price: 100, balance: 100 },
      { key: "stay-b", id: "D-2", guest: "Linked", personId: "person-1", group: "room", kind: "Room", price: 900, balance: 900 },
      { key: "stay-c", id: "D-3", guest: "Rounding", personId: "person-2", group: "room", kind: "Room", price: 1, balance: 1 },
      { key: "stay-d", id: "D-4", guest: "Rounding", personId: "person-2", group: "room", kind: "Room", price: 1, balance: 1 },
      { key: "stay-e", id: "D-5", guest: "Rounding", personId: "person-2", group: "room", kind: "Room", price: 1, balance: 0, paid: true, settledPrice: 1, actualPaidAmount: 1 },
      { key: "stay-zero", id: "D-6", guest: "Complimentary", personId: "person-3", group: "room", kind: "Room", price: 0, balance: 0, paid: false },
      { key: "stay-edit", id: "D-7", guest: "Edited Price", personId: "person-4", group: "room", kind: "Room", price: 100, balance: 100 }
    ],
    units: [{ id: "D-1", group: "room", kind: "Room" }, { id: "D-2", group: "room", kind: "Room" }],
    stationing: [
      { key: "station-a", owner: "Owner", caravan: "RV", startDate: "2026-07-01", prepaidNights: 10, nightlyPrice: 10, totalPrice: 100, paidAmount: 0, balance: 100 },
      {
        key: "station-deducted",
        owner: "Linked Nights",
        caravan: "RV Linked",
        startDate: "2026-07-01",
        prepaidNights: 10,
        nightlyPrice: 10,
        totalPrice: 100,
        paidAmount: 0,
        balance: 100,
        deductions: [{ key: "deduction-a", stayKey: "stay-a", guest: "Linked", unitId: "RV-1", start: "2026-08-01", end: "2026-08-03", nights: 2, amount: 0, appliedAt: "2026-07-01T00:00:00.000Z" }]
      }
    ],
    barArticles: [{ key: "water", name: "Water", price: 5, stock: 5, vatRate: 11, hasSgr: true }],
    config: { savedAt: "seed", roomUnitCatalogSeeded: true }
  };
  const seeded = await request(server.url, "/api/data", { method: "POST", body: JSON.stringify(seed) });
  assert.equal(seeded.status, 200);

  const forged = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "bar-forged-test", type: "bar", method: "card", amount: 1, items: [{ key: "water", quantity: 2, price: 0.01 }], receiptConfig })
  });
  assert.equal(forged.status, 409);

  const barPayload = { paymentId: "bar-valid-test", type: "bar", method: "card", amount: 11, items: [{ key: "water", quantity: 2 }], receiptConfig };
  const firstBar = await request(server.url, "/api/payment", { method: "POST", body: JSON.stringify(barPayload) });
  const retriedBar = await request(server.url, "/api/payment", { method: "POST", body: JSON.stringify(barPayload) });
  assert.equal(firstBar.status, 200);
  assert.equal(firstBar.body.sale.total, 11);
  assert.equal(firstBar.body.barArticles[0].stock, 3);
  assert.equal(retriedBar.body.barArticles[0].stock, 3);
  const receipt = await fs.readFile(path.join(server.receiptDir, "bon.inp"), "utf8");
  assert.match(receipt, /Water;5\.00;2\.000/);
  assert.match(receipt, /AMBALAJ SGR;0\.50;2\.000/);

  const rounded = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "linked-rounding-test", type: "stay", method: "voucher", amount: 0.01, linkedKeys: ["stay-c", "stay-d", "stay-e"] })
  });
  assert.equal(rounded.status, 200);
  assert.deepEqual(rounded.body.allocations.map((item) => item.allocatedAmount), [0.01, 0, 0]);

  const linked = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "linked-valid-test", type: "stay", method: "voucher", amount: 500, stayKey: "stay-a", linkedKeys: ["stay-a", "stay-b"] })
  });
  assert.equal(linked.status, 200);
  assert.deepEqual(linked.body.allocations.map((item) => item.allocatedAmount), [50, 450]);
  const activity = await request(server.url, "/api/log?limit=20");
  const linkedLog = activity.body.entries.find((entry) => entry.id === "payment-linked-valid-test");
  assert.equal(linkedLog.message, "Linked a plătit în total 500.00 lei pentru 2 rezervări prin voucher.");

  const zeroPrice = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "stay-zero-price-test", type: "stay", method: "voucher", amount: 0, stayKey: "stay-zero" })
  });
  assert.equal(zeroPrice.status, 200);
  assert.equal(zeroPrice.body.stays[0].paid, true);
  assert.equal(zeroPrice.body.stays[0].price, 0);
  assert.equal(zeroPrice.body.allocations[0].allocatedAmount, 0);

  const editedPrice = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({
      paymentId: "stay-edited-price-test",
      type: "stay",
      method: "voucher",
      amount: 120,
      stayKey: "stay-edit",
      draftStay: { price: 120, balance: 120 }
    })
  });
  assert.equal(editedPrice.status, 200);
  const editedPriceActivity = await request(server.url, "/api/log?limit=20");
  const editedPriceLog = editedPriceActivity.body.entries.find((entry) => entry.id === "payment-stay-edited-price-test");
  assert.match(editedPriceLog.message, /Preț inițial client: 100\.00 lei; plătit efectiv: 120\.00 lei\./);
  assert.equal(editedPriceLog.data.originalCustomerPrice, 100);
  assert.equal(editedPriceLog.data.customerPriceAtPayment, 120);

  const repeated = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "stay-repeat-test", type: "stay", method: "voucher", amount: 1, stayKey: "stay-e" })
  });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.stays[0].paid, true);
  assert.equal(repeated.body.stays[0].balance, 0);
  assert.equal(repeated.body.stays[0].actualPaidAmount, 2);
  assert.equal(repeated.body.stays[0].lastPaidAmount, 1);
  assert.equal(repeated.body.allocations[0].allocatedAmount, 1);
  const repeatedRetry = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "stay-repeat-test", type: "stay", method: "voucher", amount: 1, stayKey: "stay-e" })
  });
  assert.equal(repeatedRetry.body.stays[0].actualPaidAmount, 2);

  const repeatedOverpayment = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "stay-repeat-over-test", type: "stay", method: "voucher", amount: 1.01, stayKey: "stay-e" })
  });
  assert.equal(repeatedOverpayment.status, 400);

  const overpayment = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "station-over-test", type: "stationing", method: "voucher", amount: 150, stationingKey: "station-a" })
  });
  assert.equal(overpayment.status, 400);

  const stationingWithLinkedNights = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({ paymentId: "station-linked-nights-test", type: "stationing", method: "voucher", amount: 100, stationingKey: "station-deducted" })
  });
  assert.equal(stationingWithLinkedNights.status, 200);
  assert.equal(stationingWithLinkedNights.body.stationing.totalPrice, 100);
  assert.equal(stationingWithLinkedNights.body.stationing.paidAmount, 100);
  assert.equal(stationingWithLinkedNights.body.stationing.balance, 0);
  assert.equal(stationingWithLinkedNights.body.stationing.deductions[0].amount, 0);

  const data = await request(server.url, "/api/data");
  assert.equal(data.body.barArticles[0].stock, 3);
  assert.deepEqual(data.body.stays.filter((stay) => ["stay-a", "stay-b"].includes(stay.key)).map((stay) => stay.actualPaidAmount), [50, 450]);
  assert.deepEqual(data.body.stays.filter((stay) => ["stay-a", "stay-b"].includes(stay.key)).map((stay) => stay.lastPaidAmount), [50, 450]);
  assert.equal(data.body.stays.find((stay) => stay.key === "stay-zero").paid, true);
  assert.equal(data.body.stationing.find((record) => record.key === "station-a").paidAmount, 0);
  assert.equal(data.body.stationing.find((record) => record.key === "station-deducted").balance, 0);

  const retiredEndpoint = await request(server.url, "/api/receipt", { method: "POST", body: "{}" });
  assert.equal(retiredEndpoint.status, 410);
});

test("a receipt output failure is retryable without applying the payment twice", async (t) => {
  const server = await startTestServer();
  t.after(server.stop);
  await fs.writeFile(path.join(server.runtimeDir, "bin"), "blocks the info directory", "utf8");

  const seed = {
    stays: [],
    units: [],
    stationing: [],
    barArticles: [{ key: "juice", name: "Juice", price: 8, stock: 2, vatRate: 11, hasSgr: false }],
    config: { savedAt: "seed", roomUnitCatalogSeeded: true }
  };
  assert.equal((await request(server.url, "/api/data", { method: "POST", body: JSON.stringify(seed) })).status, 200);

  const payload = {
    paymentId: "bar-outbox-retry-test",
    type: "bar",
    method: "card",
    amount: 8,
    items: [{ key: "juice", quantity: 1 }],
    receiptConfig: { receiptDirectory: server.receiptDir, receiptVat: "11", cardPaymentCode: "1" }
  };
  const first = await request(server.url, "/api/payment", { method: "POST", body: JSON.stringify(payload) });
  assert.equal(first.status, 200);
  assert.equal(first.body.receiptPending, true);
  assert.equal(first.body.barArticles[0].stock, 1);
  assert.match(await fs.readFile(path.join(server.receiptDir, "bon.inp"), "utf8"), /Juice;8\.00;1\.000/);

  await fs.rm(path.join(server.runtimeDir, "bin"));
  const retried = await request(server.url, "/api/payment", { method: "POST", body: JSON.stringify(payload) });
  assert.equal(retried.status, 200);
  assert.equal(retried.body.receiptPending, false);
  assert.equal(retried.body.barArticles[0].stock, 1);
  assert.match(await fs.readFile(path.join(server.runtimeDir, "bin", "info.txt"), "utf8"), /\[payment:bar-outbox-retry-test\]/);
});
