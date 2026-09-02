"use strict";

const crypto = require("node:crypto");

const DESKTOP_REDIRECT_URI = "ro.marinapark.booking.desktop://oauth/callback";
const DEFAULT_SCOPES = ["resources:read", "resources:write", "bookings:read", "bookings:write"];

class MarinaOAuthError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "MarinaOAuthError";
    Object.assign(this, options);
  }
}

function base64Url(value) {
  return Buffer.from(value).toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomToken(byteLength = 32) {
  return base64Url(crypto.randomBytes(byteLength));
}

function createPkcePair() {
  const codeVerifier = randomToken(48);
  const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

function createState() {
  return randomToken(32);
}

function buildAuthorizationUrl({ authorizationEndpoint, clientId, redirectUri = DESKTOP_REDIRECT_URI, scopes = DEFAULT_SCOPES, state, codeChallenge }) {
  if (!authorizationEndpoint || !clientId || !redirectUri || !state || !codeChallenge) {
    throw new MarinaOAuthError("Parametrii OAuth Marina sunt incompleți.", { code: "marina_oauth_config_incomplete" });
  }
  let url;
  try {
    url = new URL(String(authorizationEndpoint));
  } catch {
    throw new MarinaOAuthError("Endpoint-ul de autorizare OAuth Marina este invalid.", { code: "marina_oauth_endpoint_invalid" });
  }
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: String(clientId),
    redirect_uri: String(redirectUri),
    scope: Array.isArray(scopes) ? scopes.join(" ") : String(scopes || ""),
    state: String(state),
    code_challenge: String(codeChallenge),
    code_challenge_method: "S256"
  }).toString();
  return url.toString();
}

function parseCallbackUrl(value, { protocol = "ro.marinapark.booking.desktop:", pathname = "/callback" } = {}) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new MarinaOAuthError("Callback-ul OAuth Marina este invalid.", { code: "marina_invalid_callback" });
  }
  if (protocol && url.protocol !== protocol) {
    throw new MarinaOAuthError("Schema callback-ului OAuth Marina este invalidă.", { code: "marina_invalid_callback" });
  }
  if (pathname && url.pathname !== pathname) {
    throw new MarinaOAuthError("Calea callback-ului OAuth Marina este invalidă.", { code: "marina_invalid_callback" });
  }
  const error = url.searchParams.get("error");
  if (error) {
    throw new MarinaOAuthError(url.searchParams.get("error_description") || "Autentificarea Marina a fost anulată.", {
      code: `marina_oauth_${error}`,
      oauthError: error
    });
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    throw new MarinaOAuthError("Callback-ul OAuth Marina nu conține codul și starea necesare.", { code: "marina_callback_incomplete" });
  }
  return { code, state };
}

function validateState(expected, received) {
  const expectedValue = Buffer.from(String(expected || ""));
  const receivedValue = Buffer.from(String(received || ""));
  if (!expectedValue.length || expectedValue.length !== receivedValue.length || !crypto.timingSafeEqual(expectedValue, receivedValue)) {
    throw new MarinaOAuthError("Starea OAuth Marina nu corespunde cererii inițiale.", { code: "marina_state_mismatch" });
  }
  return true;
}

function formBody(values) {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && value !== "")).toString();
}

module.exports = {
  DEFAULT_SCOPES,
  DESKTOP_REDIRECT_URI,
  MarinaOAuthError,
  base64Url,
  buildAuthorizationUrl,
  createPkcePair,
  createState,
  formBody,
  parseCallbackUrl,
  randomToken,
  validateState
};
