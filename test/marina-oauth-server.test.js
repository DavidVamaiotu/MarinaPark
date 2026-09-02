const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const OAuth = require("../marina-oauth");

async function startOAuthFixture() {
  const tokenRequests = [];
  const apiRequests = [];
  const state = { forceRefresh: false };
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
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
    if (url.pathname === "/oauth/token") {
      const body = await new Promise((resolve) => {
        let value = "";
        request.on("data", (chunk) => { value += chunk; });
        request.on("end", () => resolve(value));
      });
      const values = Object.fromEntries(new URLSearchParams(body));
      tokenRequests.push(values);
      response.end(JSON.stringify(values.grant_type === "refresh_token"
        ? { access_token: "access-token-refreshed", refresh_token: "refresh-token-rotated", expires_in: 3600 }
        : { access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600 }));
      return;
    }
    if (url.pathname === "/v1/resources") {
      apiRequests.push({ authorization: request.headers.authorization, workspaceId: request.headers["x-workspace-id"] || "" });
      if (state.forceRefresh && request.headers.authorization === "Bearer access-token") {
        state.forceRefresh = false;
        response.statusCode = 401;
        response.end(JSON.stringify({ error: "invalid_token" }));
        return;
      }
      if (!["Bearer access-token", "Bearer access-token-refreshed"].includes(request.headers.authorization)) {
        response.statusCode = 401;
        response.end(JSON.stringify({ error: "invalid_token" }));
        return;
      }
      response.end(JSON.stringify({ data: [{ id: 1, name: "Dubla 1" }] }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    tokenRequests,
    apiRequests,
    state,
    stop: () => new Promise((resolve) => server.close(resolve))
  };
}

test("Marina OAuth callback exchanges PKCE code and authenticates API requests", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marina-oauth-server-test-"));
  const fixture = await startOAuthFixture();
  process.env.PORT = "0";
  process.env.MARINA_DATA_DIR = path.join(root, "data");
  process.env.MARINA_RUNTIME_DIR = path.join(root, "runtime");
  delete process.env.MARINA_API_URL;
  delete process.env.MARINA_API_BASE_URL;
  await Promise.all([process.env.MARINA_DATA_DIR, process.env.MARINA_RUNTIME_DIR].map((directory) => fs.mkdir(directory, { recursive: true })));
  const serverController = require("../server");
  const stored = { refreshToken: "" };
  serverController.setMarinaOAuthStorage({
    hasRefreshTokenSync: () => Boolean(stored.refreshToken),
    async getRefreshToken() { return stored.refreshToken; },
    async setRefreshToken(value) { stored.refreshToken = String(value); },
    async clearRefreshToken() { stored.refreshToken = ""; }
  });
  const app = await serverController.startServer({ host: "127.0.0.1", localHost: "127.0.0.1", port: 0 });
  context.after(async () => {
    await serverController.stopServer();
    await fixture.stop();
    await fs.rm(root, { recursive: true, force: true });
  });

  const saveResponse = await fetch(`${app.url}/api/marina-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiBaseUrl: fixture.url, oauthClientId: "desktop-client", roomsWorkspaceId: 11, campingWorkspaceId: 22 })
  });
  assert.equal(saveResponse.status, 200);
  const startResponse = await fetch(`${app.url}/api/marina-oauth/start`, { method: "POST" });
  assert.equal(startResponse.status, 200);
  const authorization = await startResponse.json();
  const authorizationUrl = new URL(authorization.authorizationUrl);
  assert.equal(authorizationUrl.searchParams.get("client_id"), "desktop-client");
  assert.equal(authorizationUrl.searchParams.get("redirect_uri"), OAuth.DESKTOP_REDIRECT_URI);
  const state = authorizationUrl.searchParams.get("state");
  const callback = await serverController.handleMarinaOAuthCallback(`${OAuth.DESKTOP_REDIRECT_URI}?code=code-1&state=${encodeURIComponent(state)}`);
  assert.equal(callback.oauthConnected, true);
  assert.equal(stored.refreshToken, "refresh-token");

  const testResponse = await fetch(`${app.url}/api/marina-settings/test`, { method: "POST" });
  assert.equal(testResponse.status, 200);
  assert.deepEqual((await testResponse.json()).workspaces, [{ workspaceId: 11, resources: 1 }, { workspaceId: 22, resources: 1 }]);
  assert.deepEqual(fixture.tokenRequests.map((request) => request.grant_type), ["authorization_code"]);
  assert.deepEqual(fixture.apiRequests, [
    { authorization: "Bearer access-token", workspaceId: "11" },
    { authorization: "Bearer access-token", workspaceId: "22" }
  ]);

  fixture.state.forceRefresh = true;
  const refreshedResponse = await fetch(`${app.url}/api/marina-settings/test`, { method: "POST" });
  assert.equal(refreshedResponse.status, 200);
  assert.equal(stored.refreshToken, "refresh-token-rotated");
  assert.deepEqual(fixture.tokenRequests.map((request) => request.grant_type), ["authorization_code", "refresh_token"]);
  assert.deepEqual(fixture.apiRequests.slice(-3), [
    { authorization: "Bearer access-token", workspaceId: "11" },
    { authorization: "Bearer access-token-refreshed", workspaceId: "11" },
    { authorization: "Bearer access-token-refreshed", workspaceId: "22" }
  ]);
});
