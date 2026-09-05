const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("calendar navigation is removed and clients is the default page", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.doesNotMatch(html, /class="nav-item[^"]*"[^>]+data-page="calendar"/);
  assert.match(html, /class="nav-item is-active"[^>]+data-page="clients"/);
  assert.match(app, /let activePage = "clients";/);
});

test("clients search ignores the selected category only while searching", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const visibleClients = app.match(/function visibleClientStays\(\) \{[\s\S]*?\n\}\n\nfunction /)?.[0];

  assert.ok(visibleClients, "visibleClientStays should exist");
  assert.match(visibleClients, /\(searchTerm \|\| unitMatchesTimelineMode\(stay\)\)/);
  assert.match(visibleClients, /matchesSearch\(stay\)/);
});

test("new reservations return to the clients page instead of the removed timeline", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const submitTail = app.match(/if \(!existingStay\) \{[\s\S]*?window\.requestAnimationFrame\(\(\) => \{[\s\S]*?\}\);[\s\S]*?\}/)?.[0];

  assert.ok(submitTail, "new-reservation navigation should exist");
  assert.match(submitTail, /jumpToClientCard\(nextStay\.key\)/);
  assert.doesNotMatch(submitTail, /jumpToTimelineStay/);
});
