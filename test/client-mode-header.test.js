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

test("today's free rooms use only reservations saved in the app", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(
    app,
    /function occupiedUnitKeysFromSavedStays\(\)[\s\S]*stays\.forEach\(\(stay\) => \{[\s\S]*occupied\.add\(unitOccupancyKey\(stay\.group, stay\.id\)\)/
  );
  assert.match(app, /function availableUnitsFromSavedStays\(\)[\s\S]*occupiedUnitKeysFromSavedStays\(\)/);
  assert.doesNotMatch(app, /if \(stayOccupiesDate\(stay, date\)\) occupied\.add/);
  assert.match(app, /Calculat din rezervările salvate în aplicație\./);
  assert.doesNotMatch(app, /fetch\(`\/api\/availability/);
});

test("compound occupancy counts guests until their reservation is deleted", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const occupancyFunction = app.match(/function renderSidebarOccupancy\(\) \{[\s\S]*?\n\}\n\nfunction /)?.[0];

  assert.ok(occupancyFunction, "renderSidebarOccupancy should exist");
  assert.match(occupancyFunction, /stays\.forEach\(\(stay\) => \{/);
  assert.match(occupancyFunction, /Number\(stay\.party \|\| 0\)/);
  assert.doesNotMatch(occupancyFunction, /stayStartDate|stayEndDate|\btoday\b/);
});

test("only SQL source records are grouped as arrivals today", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(app, /function isSqlSourceArrivalToday[\s\S]*directorySource === "sql"/);
  assert.match(app, /todayBookings = orderedBookings\.filter\(\(booking\) => isSqlSourceArrivalToday\(booking, todayText\)\)/);
  assert.match(app, /sourceBookings\.filter\(\(booking\) => isSqlSourceArrivalToday\(booking, todayText\)\)/);
});
