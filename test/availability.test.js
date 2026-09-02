const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

async function startAvailabilityServer() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-availability-test-"));
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  const fixturePath = path.join(root, "source-bookings.json");
  await Promise.all([dataDir, runtimeDir].map((directory) => fs.mkdir(directory, { recursive: true })));
  await fs.writeFile(fixturePath, JSON.stringify({
    room: [
      { guest: "Starts today", group: "room", start: "2026-07-10", end: "2026-07-12", unitHint: "dubla 2" },
      { guest: "Leaves today", group: "room", start: "2026-07-08", end: "2026-07-10", unitHint: "dubla 3" },
      { guest: "Future", group: "room", start: "2026-07-11", end: "2026-07-13", unitHint: "dubla 5" },
      { guest: "No exact room", group: "room", start: "2026-07-09", end: "2026-07-11", unitHint: "" }
    ],
    camping: []
  }));

  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "0",
      MARINA_DATA_DIR: dataDir,
      MARINA_RUNTIME_DIR: runtimeDir,
      MARINA_SOURCE_BOOKINGS_FIXTURE: fixturePath
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
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited with ${code}: ${output}`));
    });
  });

  return {
    url,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

test("room availability includes arrivals and excludes same-day departures and future bookings", async (context) => {
  const server = await startAvailabilityServer();
  context.after(server.stop);

  const response = await fetch(`${server.url}/api/availability?date=2026-07-10`);
  assert.equal(response.status, 200);
  const result = await response.json();

  assert.equal(result.ok, true);
  assert.equal(result.marinaAvailable, true);
  assert.equal(result.date, "2026-07-10");
  assert.deepEqual(result.occupiedUnitIds, ["dubla 2"]);
});
