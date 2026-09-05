const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

test("booking details are logged before persistence so failed reservations remain recoverable", () => {
  const submitStart = appSource.indexOf('bookingForm.addEventListener("submit"');
  const submitEnd = appSource.indexOf("async function initializeApp", submitStart);
  const submitSource = appSource.slice(submitStart, submitEnd);
  const logPosition = submitSource.indexOf("logActivity({");
  const savePosition = submitSource.indexOf("await saveBookingReservation(nextStay, previousStay)");

  assert.ok(submitStart >= 0 && submitEnd > submitStart, "booking submit handler exists");
  assert.ok(logPosition >= 0, "booking attempt is logged");
  assert.ok(savePosition > logPosition, "logging happens regardless of the persistence result");
  assert.doesNotMatch(submitSource, /showToast\([^)]*(?:log|jurnal)/i);
});

test("automatic stationing deductions use the atomic reservation persistence boundary", () => {
  const saveSource = appSource.match(
    /async function saveBookingReservation\(stay, previousStay = null\) \{[\s\S]*?\n\}\n\nfunction /,
  )?.[0];
  const submitStart = appSource.indexOf('bookingForm.addEventListener("submit"');
  const submitEnd = appSource.indexOf("async function initializeApp", submitStart);
  const submitSource = appSource.slice(submitStart, submitEnd);

  assert.ok(saveSource, "saveBookingReservation should exist");
  assert.match(saveSource, /previousStationingKey/);
  assert.match(saveSource, /stationingDeduction/);
  assert.match(saveSource, /result\.stationing/);
  assert.doesNotMatch(
    submitSource,
    /await applyStationingDeductionForStay\(nextStay, \{ ask: false \}\)/,
  );
  assert.match(submitSource, /reservationSaved\.stationing/);
});

test("reservation upserts remain writable after the full-database revision changes", async (context) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "marina-reservation-test-"));
  context.after(() => fsp.rm(root, { recursive: true, force: true }));

  const script = `
    const { startServer, stopServer } = require("./server");
    const stay = (key, guest) => ({
      key, id: key, guest, group: "room", kind: "Cameră dublă",
      start: "2026-07-22", end: "2026-07-23", price: 100
    });
    const request = async (url, options = {}) => {
      const response = await fetch(url, options);
      return { status: response.status, body: await response.json() };
    };
    (async () => {
      const started = await startServer({ host: "127.0.0.1", port: 0 });
      const base = started.url;
      try {
        await request(base + "/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stays: [stay("seed", "Seed Client")], units: [], stationing: [], barArticles: [],
            config: { savedAt: "2026-07-22T10:00:00.000Z" }, allowEmptyCollections: true
          })
        });
        const original = await request(base + "/api/data");
        const first = await request(base + "/api/reservation", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stay: stay("new-a", "Client A"), baseSavedAt: original.body.config.savedAt })
        });
        const stale = await request(base + "/api/data", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...original.body,
            config: { ...original.body.config, savedAt: "2026-07-22T10:01:00.000Z" },
            baseSavedAt: original.body.config.savedAt,
            allowEmptyCollections: true
          })
        });
        const second = await request(base + "/api/reservation", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stay: stay("new-b", "Client B"), baseSavedAt: first.body.savedAt })
        });
        const finalState = await request(base + "/api/data");
        process.stdout.write("RESULT=" + JSON.stringify({
          first: first.status,
          stale: stale.status,
          second: second.status,
          keys: finalState.body.stays.map((entry) => entry.key)
        }) + "\\n");
      } finally {
        await stopServer();
      }
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  `;

  const child = spawn(process.execPath, ["--no-warnings", "-e", script], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      MARINA_DATA_DIR: path.join(root, "data"),
      MARINA_RUNTIME_DIR: path.join(root, "runtime")
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const exitCode = await new Promise((resolve) => child.once("close", resolve));
  if (exitCode !== 0) assert.fail(output || `child exited with ${exitCode}`);

  const resultLine = output.split("\n").find((line) => line.startsWith("RESULT="));
  assert.ok(resultLine, output);
  const result = JSON.parse(resultLine.slice("RESULT=".length));
  assert.equal(result.first, 200);
  assert.equal(result.stale, 409);
  assert.equal(result.second, 200);
  assert.deepEqual(new Set(result.keys), new Set(["seed", "new-a", "new-b"]));
});
