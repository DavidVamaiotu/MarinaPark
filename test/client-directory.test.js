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

async function startFixtureServer() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-client-directory-test-"));
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  const fixturePath = path.join(root, "sql-bookings.json");
  const historyPath = path.join(dataDir, "client-history.sqlite");
  await Promise.all([dataDir, runtimeDir].map((directory) => fs.mkdir(directory, { recursive: true })));
  await fs.writeFile(fixturePath, JSON.stringify({
    room: [
      { guest: "ÁLICE POPESCU", phone: "0700", group: "room", kind: "Camere", source: "camere", start: "2026-08-01", end: "2026-08-03", price: 500 },
      { guest: "SQL Only", phone: "0711", group: "room", kind: "Camere", source: "camere", start: "2026-08-04", end: "2026-08-06", price: 600 }
    ],
    camping: [
      { guest: "Tent Guest", phone: "0722", group: "camping", mode: "tent", kind: "Camping", source: "camping", start: "2026-08-07", end: "2026-08-09", price: 200 },
      { guest: "RV Guest", phone: "0723", group: "camping", mode: "rv", kind: "Camping rulotă", source: "camping", start: "2026-08-10", end: "2026-08-12", price: 300 }
    ]
  }));

  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "0",
      MARINA_DATA_DIR: dataDir,
      MARINA_RUNTIME_DIR: runtimeDir,
      MARINA_CLIENT_HISTORY_DATABASE: historyPath,
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
    root,
    historyPath,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((resolve) => child.once("exit", resolve));
      await fs.rm(root, { recursive: true, force: true });
    }
  };
}

test("client directory fuses SQL bookings with persistent unmatched local clients", async (context) => {
  const server = await startFixtureServer();
  context.after(server.stop);

  const seed = {
    stays: [
      { key: "local-alice", id: "D-1", guest: "Alice Popescu", phone: "0701", group: "room", kind: "Cameră", start: "2026-05-01", end: "2026-05-03" },
      { key: "local-only-old", id: "D-2", guest: "Local Only", phone: "0733", car: "B-01-OLD", group: "room", kind: "Cameră", start: "2025-05-01", end: "2025-05-03" },
      { key: "local-only-new", id: "D-3", guest: "Local Only", phone: "", car: "", group: "room", kind: "Cameră", start: "2026-05-01", end: "2026-05-03" },
      { key: "local-camp", id: "C-1", guest: "Camp Local", phone: "0744", group: "camping", kind: "Campare cort", start: "2026-04-01", end: "2026-04-03" }
    ],
    units: [{ id: "D-1", group: "room", kind: "Cameră" }],
    stationing: [],
    barArticles: [],
    config: { savedAt: "directory-seed", roomUnitCatalogSeeded: true }
  };
  const seeded = await request(server.url, "/api/data", { method: "POST", body: JSON.stringify(seed) });
  assert.equal(seeded.status, 200);

  const fused = await request(server.url, "/api/client-directory");
  assert.equal(fused.status, 200);
  assert.equal(fused.body.sqlAvailable, true);
  assert.equal(fused.body.sources.sql, 4);
  assert.equal(fused.body.sources.local, 2);
  assert.equal(fused.body.clients.length, 6);
  assert.equal(fused.body.clients.filter((client) => client.normalizedName === "alice popescu").length, 1);
  assert.equal(fused.body.clients.find((client) => client.normalizedName === "alice popescu").directorySource, "sql");
  const localOnly = fused.body.clients.find((client) => client.normalizedName === "local only");
  assert.equal(localOnly.directorySource, "local-history");
  assert.equal(localOnly.phone, "0733");
  assert.equal(localOnly.car, "B-01-OLD");

  const history = new DatabaseSync(server.historyPath, { readOnly: true });
  assert.equal(history.prepare("SELECT COUNT(*) count FROM clients").get().count, 3);
  assert.ok(history.prepare("SELECT data FROM clients WHERE normalized_name = ?").get("alice popescu"));
  history.close();

  const cleared = await request(server.url, "/api/data", {
    method: "POST",
    body: JSON.stringify({
      stays: [],
      units: seed.units,
      stationing: [],
      barArticles: [],
      config: { savedAt: "directory-cleared", roomUnitCatalogSeeded: true },
      allowEmptyCollections: ["stays"]
    })
  });
  assert.equal(cleared.status, 200);

  const afterClear = await request(server.url, "/api/client-directory");
  assert.equal(afterClear.body.sources.local, 2);
  assert.ok(afterClear.body.clients.some((client) => client.normalizedName === "local only"));
  assert.ok(afterClear.body.clients.some((client) => client.normalizedName === "camp local"));

  const localSourceSearch = await request(server.url, "/api/source-bookings?mode=room&query=Local%20Only");
  assert.equal(localSourceSearch.status, 200);
  const localSourceClient = localSourceSearch.body.bookings.find((booking) => booking.guest === "Local Only");
  assert.equal(localSourceClient.directorySource, "local-history");
  assert.equal(localSourceClient.detailsOnly, true);
  assert.equal(localSourceClient.phone, "0733");
  assert.equal(localSourceClient.car, "B-01-OLD");
  assert.equal(localSourceClient.price, 0);

  const roomLocalFromCampingSearch = await request(server.url, "/api/source-bookings?mode=tent&query=Local%20Only");
  assert.equal(roomLocalFromCampingSearch.status, 200);
  assert.ok(roomLocalFromCampingSearch.body.bookings.some((booking) => booking.guest === "Local Only" && booking.directorySource === "local-history"));

  const campingLocalFromRoomSearch = await request(server.url, "/api/source-bookings?mode=room&query=Camp%20Local");
  assert.equal(campingLocalFromRoomSearch.status, 200);
  assert.ok(campingLocalFromRoomSearch.body.bookings.some((booking) => booking.guest === "Camp Local" && booking.directorySource === "local-history"));

  const tentSources = await request(server.url, "/api/source-bookings?mode=tent");
  assert.equal(tentSources.status, 200);
  assert.ok(tentSources.body.bookings.some((booking) => booking.guest === "Tent Guest" && booking.directorySource === "sql"));
  assert.ok(!tentSources.body.bookings.some((booking) => booking.guest === "RV Guest" && booking.directorySource === "sql"));
  assert.ok(tentSources.body.bookings.some((booking) => booking.guest === "Local Only" && booking.directorySource === "local-history"));
  assert.ok(tentSources.body.bookings.some((booking) => booking.guest === "Camp Local" && booking.directorySource === "local-history"));
  assert.ok(tentSources.body.bookings.some((booking) => booking.guest === "Alice Popescu" && booking.directorySource === "local-history"));

  const rvSources = await request(server.url, "/api/source-bookings?mode=rv");
  assert.equal(rvSources.status, 200);
  assert.ok(rvSources.body.bookings.some((booking) => booking.guest === "RV Guest" && booking.directorySource === "sql"));
  assert.ok(!rvSources.body.bookings.some((booking) => booking.guest === "Tent Guest" && booking.directorySource === "sql"));
  assert.ok(rvSources.body.bookings.some((booking) => booking.guest === "Local Only" && booking.directorySource === "local-history"));
  assert.ok(rvSources.body.bookings.some((booking) => booking.guest === "Camp Local" && booking.directorySource === "local-history"));
  assert.ok(rvSources.body.bookings.some((booking) => booking.guest === "Alice Popescu" && booking.directorySource === "local-history"));

  const sqlSourceSearch = await request(server.url, "/api/source-bookings?mode=room&query=Alice");
  assert.equal(sqlSourceSearch.status, 200);
  assert.ok(sqlSourceSearch.body.bookings.some((booking) => booking.normalizedName === "alice popescu" && booking.directorySource === "sql"));
  assert.ok(!sqlSourceSearch.body.bookings.some((booking) => booking.normalizedName === "alice popescu" && booking.directorySource === "local-history"));

  const roomSources = await request(server.url, "/api/source-bookings?mode=room");
  assert.ok(roomSources.body.bookings.some((booking) => booking.guest === "Local Only" && booking.directorySource === "local-history"));
  assert.ok(roomSources.body.bookings.some((booking) => booking.guest === "Camp Local" && booking.directorySource === "local-history"));
});
