const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("renderer pages use the in-app dialog instead of native JavaScript dialogs", () => {
  for (const filename of ["app.js", "activity.js"]) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    assert.doesNotMatch(source, /window\.(?:alert|confirm|prompt)\s*\(/);
  }

  for (const filename of ["index.html", "activity.html"]) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    const dialogScript = source.indexOf('src="app-dialog.js"');
    const pageScript = source.indexOf(filename === "index.html" ? 'src="app.js' : 'src="activity.js"');
    assert.ok(dialogScript >= 0, `${filename} loads app-dialog.js`);
    assert.ok(dialogScript < pageScript, `${filename} loads app-dialog.js before its page script`);
  }

  const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.match(serverSource, /"\/app-dialog\.css"/);
  assert.match(serverSource, /"\/app-dialog\.js"/);

  for (const filename of ["electron-builder.yml", "scripts/New-MarinaParkRelease.ps1"]) {
    const source = fs.readFileSync(path.join(root, filename), "utf8");
    assert.match(source, /app-dialog\.css/);
    assert.match(source, /app-dialog\.js/);
  }
});
