const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("clients page has a persistent per-mode identity header", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(html, /id="clientModeIdentity"/);
  assert.match(html, /id="clientModeImageInput"[^>]+accept="image\/\*"/);
  assert.match(app, /clientModeImages\[mode\]/);
  assert.match(app, /clientModeImages,\s*\n\s*roomUnitCatalogSeeded/);
  assert.match(app, /renderClientModeIdentity\(\);/);
});
