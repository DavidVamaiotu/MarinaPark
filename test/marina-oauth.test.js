const assert = require("node:assert/strict");
const test = require("node:test");
const OAuth = require("../marina-oauth");

test("Marina OAuth builds a PKCE authorization request and validates the callback state", () => {
  const { codeVerifier, codeChallenge } = OAuth.createPkcePair();
  assert.ok(codeVerifier.length >= 43);
  assert.ok(codeChallenge.length >= 43);
  const state = OAuth.createState();
  const authorizationUrl = OAuth.buildAuthorizationUrl({
    authorizationEndpoint: "https://booking.husi.ro/oauth/authorize",
    clientId: "desktop-client",
    redirectUri: OAuth.DESKTOP_REDIRECT_URI,
    scopes: OAuth.DEFAULT_SCOPES,
    state,
    codeChallenge
  });
  const parsed = new URL(authorizationUrl);
  assert.equal(parsed.searchParams.get("client_id"), "desktop-client");
  assert.equal(parsed.searchParams.get("redirect_uri"), OAuth.DESKTOP_REDIRECT_URI);
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  const callback = OAuth.parseCallbackUrl(`${OAuth.DESKTOP_REDIRECT_URI}?code=abc&state=${encodeURIComponent(state)}`);
  assert.equal(callback.code, "abc");
  assert.equal(OAuth.validateState(state, callback.state), true);
  assert.throws(() => OAuth.validateState(state, "wrong"), /starea OAuth/i);
});
