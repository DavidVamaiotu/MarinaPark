const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "..");

async function request(url, pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
  });
  return { status: response.status, body: await response.json() };
}

async function startServer(root) {
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  await Promise.all(
    [dataDir, runtimeDir].map((directory) =>
      fs.mkdir(directory, { recursive: true }),
    ),
  );
  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: "0",
      MARINA_DATA_DIR: dataDir,
      MARINA_RUNTIME_DIR: runtimeDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const url = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(
      () => reject(new Error(`Server startup timed out: ${output}`)),
      10000,
    );
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
    runtimeDir,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

async function seedAndPay(server) {
  const item = {
    id: "stay-water-1",
    articleKey: "water",
    name: "Water",
    price: 5,
    quantity: 2,
    vatRate: 11,
    hasSgr: true,
    subtotal: 10,
    sgrTotal: 1,
    lineTotal: 11,
  };
  const seed = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [
        {
          key: "stay-restart",
          id: "D-1",
          guest: "Restart Guest",
          group: "room",
          kind: "Room",
          price: 111,
          balance: 111,
          barItems: [item],
        },
      ],
      units: [],
      stationing: [],
      barArticles: [
        {
          key: "water",
          name: "Water",
          price: 5,
          stock: 10,
          vatRate: 11,
          hasSgr: true,
        },
      ],
      config: { savedAt: "bar-restart-seed", roomUnitCatalogSeeded: true },
    }),
  });
  assert.equal(seed.status, 200);
  const payment = await request(server.url, "/api/payment", {
    method: "POST",
    body: JSON.stringify({
      paymentId: "stay-restart-payment",
      type: "stay",
      method: "numerar",
      amount: 111,
      stayKey: "stay-restart",
      receiptBarMode: "separate",
      receiptAccommodationAmount: 100,
      receiptConfig: { receiptDirectory: server.runtimeDir },
    }),
  });
  assert.equal(payment.status, 200);
}

function readState(dataDir) {
  const database = new DatabaseSync(
    path.join(dataDir, "marina-park.sqlite"),
    { readOnly: true },
  );
  try {
    return {
      transactions: database
        .prepare(
          `SELECT id, type, entity_key, method, amount, status, receipt_directory,
                  receipt_content, info_line, result, last_error, created_at, updated_at
           FROM payment_transactions ORDER BY id`,
        )
        .all(),
      barLines: database
        .prepare(
          `SELECT id, payment_id, sale_timestamp, sale_date, method, source_type,
                  article_key, name, filter_name, unit_gross, quantity, vat_rate,
                  gross_total, exported_at, export_batch_id, created_at
           FROM bar_export_lines ORDER BY id`,
        )
        .all(),
      receiptState: database
        .prepare(
          `SELECT stay_key, item_id, handled_quantity, handled_sgr_total, updated_at
           FROM reservation_bar_receipt_state ORDER BY stay_key, item_id`,
        )
        .all(),
      marker: database
        .prepare(
          `SELECT rebuild_version, transaction_fingerprint, last_error, updated_at
           FROM reservation_bar_receipt_state_meta WHERE id = 1`,
        )
        .get(),
    };
  } finally {
    database.close();
  }
}

test("bar receipt derived state and export status survive a clean restart", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-bar-restart-"));
  let server = null;
  context.after(async () => {
    if (server) await server.stop().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  });
  server = await startServer(root);
  await seedAndPay(server);

  const before = readState(path.join(root, "data"));
  assert.equal(before.transactions.length, 1);
  assert.equal(before.barLines.length, 2);
  assert.equal(before.receiptState.length, 1);
  assert.equal(before.marker.rebuild_version, 1);
  assert.ok(before.marker.transaction_fingerprint);

  const writer = new DatabaseSync(path.join(root, "data", "marina-park.sqlite"));
  writer
    .prepare(
      "UPDATE bar_export_lines SET exported_at = ?, export_batch_id = ? WHERE id = ?",
    )
    .run("2026-08-20T12:00:00.000Z", "batch-before-restart", before.barLines[0].id);
  writer.close();
  const beforeRestart = readState(path.join(root, "data"));

  await server.stop();
  server = await startServer(root);
  const after = readState(path.join(root, "data"));
  assert.deepEqual(after.transactions, beforeRestart.transactions);
  assert.deepEqual(after.barLines, beforeRestart.barLines);
  assert.deepEqual(after.receiptState, beforeRestart.receiptState);
  assert.deepEqual(after.marker, beforeRestart.marker);
});

test("malformed payment results retain the last valid bar receipt state", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-bar-malformed-"));
  let server = null;
  context.after(async () => {
    if (server) await server.stop().catch(() => {});
    await fs.rm(root, { recursive: true, force: true });
  });
  server = await startServer(root);
  await seedAndPay(server);
  const before = readState(path.join(root, "data"));

  const writer = new DatabaseSync(path.join(root, "data", "marina-park.sqlite"));
  writer
    .prepare("UPDATE payment_transactions SET result = ? WHERE id = ?")
    .run("{", "stay-restart-payment");
  writer.close();
  await server.stop();
  server = await startServer(root);

  const after = readState(path.join(root, "data"));
  assert.equal(after.transactions[0].result, "{");
  assert.deepEqual(after.barLines, before.barLines);
  assert.deepEqual(after.receiptState, before.receiptState);
  assert.deepEqual(after.marker, before.marker);
});
