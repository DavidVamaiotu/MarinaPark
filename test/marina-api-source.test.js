const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

async function jsonRequest(url, pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers
  });
  return { status: response.status, body: await response.json() };
}

async function startFakeMarinaApi() {
  const requests = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const workspaceId = request.headers["x-workspace-id"] || "";
    requests.push({ pathname: url.pathname, search: url.search, workspaceId, authorization: request.headers.authorization });
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/.well-known/oauth-authorization-server") {
      const base = `http://${request.headers.host}`;
      response.end(JSON.stringify({
        issuer: base,
        authorization_endpoint: `${base}/oauth/authorize`,
        token_endpoint: `${base}/oauth/token`,
        revocation_endpoint: `${base}/oauth/revoke`
      }));
      return;
    }
    if (request.headers.authorization !== "Bearer oauth-access-token") {
      response.statusCode = 401;
      response.end(JSON.stringify({ message: "unauthorized" }));
      return;
    }
    if (url.pathname === "/v1/resources") {
      const data = workspaceId === "22"
        ? [{ id: 31, name: "Cort 1" }, { id: 32, name: "Rulotă 1" }]
        : [{ id: 15, name: "Dubla 2" }];
      response.end(JSON.stringify({ data }));
      return;
    }
    if (url.pathname === "/v1/bookings/508" && workspaceId === "11") {
      response.end(JSON.stringify({ data: {
        id: 508,
        resource_id: 15,
        status: "approved",
        periods: [{ start_date: "2026-09-22", end_date: "2026-09-22" }],
        customer: { first_name: "Notes", last_name: "Fetched" },
        price: { total_minor: 0 },
        internal_note: "Sosire după ora 18"
      } }));
      return;
    }
    if (url.pathname === "/v1/bookings/508/notes" && workspaceId === "11") {
      response.end(JSON.stringify({ data: [
        { body: "Cost total: 230 RON, Depozit: 30 RON, Rest: 200 RON" },
        { body: "Atenție la acces" }
      ] }));
      return;
    }
    if (url.pathname === "/v1/bookings" && workspaceId === "11") {
      if (!url.searchParams.get("after")) {
        response.end(JSON.stringify({
          data: [{
            id: 501,
            resource_id: 15,
            status: "approved",
            periods: [
              { start_date: "2026-09-10", end_date: "2026-09-11" },
              { start_date: "2026-09-12", end_date: "2026-09-12" }
            ],
            customer: { first_name: "Ana", last_name: "Marin", phone: "0712345678", custom_fields: { car_plates: "VS-01-API" } },
            guests: { adults: 2, children: 1 },
            price: { total_minor: 40000, balance_minor: 25000 },
            internal_note: "Sosire după ora 18",
            updated_at: "2026-09-01T10:00:00Z"
          }, {
            id: 503,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-16", end_date: "2026-09-16" }],
            customer: { first_name: "Fallback", last_name: "Minor" },
            price: { total_minor: 50000, deposit_minor: 15000 }
          }, {
            id: 504,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-17", end_date: "2026-09-17" }],
            customer: { first_name: "Fallback", last_name: "Major" },
            price: { total: 100, deposit: 30 }
          }, {
            id: 505,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-18", end_date: "2026-09-18" }],
            customer: { first_name: "Fallback", last_name: "Pricing" },
            pricing: { total_minor: 70000 },
            cost: 180,
            internal_note: "Cost total: 700 RON, Depozit: 180 RON, Rest: 520 RON"
          }, {
            id: 506,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-19", end_date: "2026-09-19" }],
            customer: { first_name: "Fallback", last_name: "Remark" },
            cost: 20,
            remark: "Avans: 20 lei, Cost: 100 lei, Rest: 80 lei"
          }, {
            id: 507,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-21", end_date: "2026-09-21" }],
            customer: { first_name: "Notes", last_name: "Only" },
            notes: [
              { body: "Sosire după ora 18" },
              { body: "Cost total 150 RON, Depozit = 50 RON, Rest - 100 RON" }
            ]
          }, {
            id: 509,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-23", end_date: "2026-09-23" }],
            customer: { first_name: "Notes", last_name: "Preferred" },
            price: { total_minor: 10000, balance_minor: 9000 },
            internal_note: "Cost total: 100 RON, Avans: 20 RON, Rest: 80 RON"
          }, {
            id: 510,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-04T21:00:00.000Z", end_date: "2026-09-05T21:00:00.000Z" }],
            customer: { first_name: "Timezone", last_name: "Booking" },
            price: { total_minor: 10000 }
          }, {
            id: 508,
            resource_id: 15,
            status: "approved",
            periods: [{ start_date: "2026-09-22", end_date: "2026-09-22" }],
            customer: { first_name: "Notes", last_name: "Fetched" },
            price: { total_minor: 0 },
            internal_note: ""
          }],
          next_cursor: "rooms-page-2"
        }));
      } else {
        response.end(JSON.stringify({ data: [{
          id: 502,
          resource_id: 15,
          status: "cancelled",
          periods: [{ start_date: "2026-09-20", end_date: "2026-09-20" }],
          customer: { first_name: "Rezervare", last_name: "Anulată" }
        }] }));
      }
      return;
    }
    if (url.pathname === "/v1/bookings" && workspaceId === "22") {
      response.end(JSON.stringify({ data: [{
        id: 601,
        resource_id: 32,
        status: "pending",
        periods: [{ start_date: "2026-09-14", end_date: "2026-09-15" }],
        customer: { first_name: "Radu", last_name: "Rulotă", phone: "0722000000" },
        guests: { adults: 2, children: 0 },
        price: { total_minor: 30000 }
      }] }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ message: "not found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    stop: () => new Promise((resolve) => server.close(resolve))
  };
}

async function startAppServer() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "parkline-marina-source-test-"));
  const dataDir = path.join(root, "data");
  const runtimeDir = path.join(root, "runtime");
  await Promise.all([dataDir, runtimeDir].map((directory) => fs.mkdir(directory, { recursive: true })));
  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "0",
      NODE_ENV: "test",
      TZ: "Europe/Bucharest",
      MARINA_DATA_DIR: dataDir,
      MARINA_RUNTIME_DIR: runtimeDir,
      MARINA_OAUTH_TEST_ACCESS_TOKEN: "oauth-access-token",
      MARINA_API_URL: "",
      MARINA_API_BASE_URL: "",
      MARINA_WORKSPACE_ID: "",
      MARINA_ROOMS_WORKSPACE_ID: "",
      MARINA_CAMPING_WORKSPACE_ID: ""
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

test("Marina settings stay server-side and drive paginated workspace booking imports", async (context) => {
  const marina = await startFakeMarinaApi();
  const app = await startAppServer();
  context.after(async () => {
    await app.stop();
    await marina.stop();
  });

  const saved = await jsonRequest(app.url, "/api/marina-settings", {
    method: "POST",
    body: JSON.stringify({
      apiBaseUrl: marina.url,
      oauthClientId: "test-client",
      roomsWorkspaceId: 11,
      campingWorkspaceId: 22
    })
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.configured, true);
  assert.equal("apiToken" in saved.body, false);

  const readBack = await jsonRequest(app.url, "/api/marina-settings");
  assert.equal(readBack.body.oauthConfigured, true);
  assert.equal(readBack.body.oauthConnected, false);
  assert.equal("apiToken" in readBack.body, false);

  const tested = await jsonRequest(app.url, "/api/marina-settings/test", { method: "POST" });
  assert.equal(tested.status, 200);
  assert.deepEqual(tested.body.workspaces, [{ workspaceId: 11, resources: 1 }, { workspaceId: 22, resources: 2 }]);

  const roomSources = await jsonRequest(app.url, "/api/source-bookings?mode=room");
  assert.equal(roomSources.status, 200);
  const ana = roomSources.body.bookings.find((booking) => booking.guest === "Ana Marin");
  assert.ok(ana);
  assert.equal(ana.directorySource, "marina");
  assert.equal(ana.unitHint, "Dubla 2");
  assert.equal(ana.start, "2026-09-10");
  assert.equal(ana.end, "2026-09-13");
  assert.equal(ana.price, 250);
  assert.equal(ana.car, "VS-01-API");
  assert.equal(roomSources.body.bookings.find((booking) => booking.guest === "Fallback Minor")?.price, 350);
  assert.equal(roomSources.body.bookings.find((booking) => booking.guest === "Fallback Major")?.price, 70);
  assert.equal(roomSources.body.bookings.find((booking) => booking.guest === "Fallback Pricing")?.price, 520);
  assert.equal(roomSources.body.bookings.find((booking) => booking.guest === "Fallback Remark")?.price, 80);
  const timezoneBooking = roomSources.body.bookings.find((booking) => booking.guest === "Timezone Booking");
  assert.equal(timezoneBooking?.start, "2026-09-05");
  assert.equal(timezoneBooking?.end, "2026-09-07");
  const notesOnly = roomSources.body.bookings.find((booking) => booking.guest === "Notes Only");
  assert.equal(notesOnly?.price, 100);
  assert.equal(notesOnly?.note, "Sosire după ora 18\n\nCost total 150 RON, Depozit = 50 RON, Rest - 100 RON");
  assert.equal(roomSources.body.bookings.find((booking) => booking.guest === "Notes Preferred")?.price, 80);
  assert.equal(roomSources.body.bookings.some((booking) => booking.guest === "Rezervare Anulată"), false);

  const fetchedDetails = await jsonRequest(app.url, "/api/source-booking-details?mode=room&id=508");
  assert.equal(fetchedDetails.status, 200);
  assert.equal(fetchedDetails.body.booking.price, 200);
  assert.equal(fetchedDetails.body.booking.note, "Sosire după ora 18\n\nCost total: 230 RON, Depozit: 30 RON, Rest: 200 RON\n\nAtenție la acces");
  assert.ok(marina.requests.some((request) => request.pathname === "/v1/bookings/508/notes"));

  const rvSources = await jsonRequest(app.url, "/api/source-bookings?mode=rv");
  assert.equal(rvSources.status, 200);
  assert.ok(rvSources.body.bookings.some((booking) => booking.guest === "Radu Rulotă" && booking.mode === "rv"));

  assert.ok(marina.requests.some((request) => request.pathname === "/v1/bookings" && request.search.includes("after=rooms-page-2")));
  assert.ok(marina.requests.filter((request) => request.pathname !== "/.well-known/oauth-authorization-server").every((request) => request.authorization === "Bearer oauth-access-token"));
  assert.ok(marina.requests.some((request) => request.workspaceId === "11"));
  assert.ok(marina.requests.some((request) => request.workspaceId === "22"));
});
