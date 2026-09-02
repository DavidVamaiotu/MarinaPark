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
    /function stayCountsAsPresent\(stay\)[\s\S]*stay\.guest === "Disponibil"[\s\S]*const start = stayStartDate\(stay\);[\s\S]*return !start \|\| start <= today;/
  );
  assert.match(
    app,
    /function occupiedUnitKeysFromSavedStays\(\)[\s\S]*stays\.forEach\(\(stay\) => \{[\s\S]*if \(!stayCountsAsPresent\(stay\)\) return;[\s\S]*occupied\.add\(unitOccupancyKey\(stay\.group, stay\.id\)\)/
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
  assert.match(occupancyFunction, /if \(!stayCountsAsPresent\(stay\)\) return;/);
  assert.match(occupancyFunction, /Number\(stay\.party \|\| 0\)/);
  assert.doesNotMatch(occupancyFunction, /stayEndDate/);
});

test("local-history selection applies every retained client field", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const applySource = app.match(/function applySourceBooking\(booking\) \{[\s\S]*?\n\}\n\nfunction /)?.[0];

  assert.ok(applySource, "applySourceBooking should exist");
  assert.match(applySource, /booking\.previousRoom \|\| booking\.room/);
  assert.match(applySource, /booking\.previousCategory \|\| booking\.category/);
  assert.match(applySource, /bookingForm\.elements\.guest\.value = booking\.guest \|\| "";/);
  assert.match(applySource, /bookingForm\.elements\.phone\.value = booking\.phone \|\| "";/);
  assert.match(applySource, /bookingForm\.elements\.adults\.value = Math\.max\(0, Number\(booking\.adults \|\| 0\)\);/);
  assert.match(applySource, /bookingForm\.elements\.children\.value = Math\.max\(0, Number\(booking\.children \|\| 0\)\);/);
  assert.match(applySource, /bookingForm\.elements\.car\.value = booking\.car \|\| "";/);
});

test("local-history Rulote selection uses the same exact-name Stationare auto-link as Marina", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const applySource = app.match(/function applySourceBooking\(booking\) \{[\s\S]*?\n\}\n\nfunction /)?.[0];
  const autoLink = app.match(/function autoLinkStationingForFutureBooking\(booking = \{\}\) \{[\s\S]*?\n\}\n\nfunction /)?.[0];

  assert.ok(applySource, "applySourceBooking should exist");
  assert.ok(autoLink, "autoLinkStationingForFutureBooking should exist");
  assert.match(
    applySource,
    /if \(detailsOnly\) \{\s*if \(currentBookingIsRv\(\)\) \{\s*autoLinkStationingForFutureBooking\(\{\s*\.\.\.booking,\s*group: currentBookingGroup\(\),\s*start: bookingForm\.elements\.arrival\.value,\s*end: bookingForm\.elements\.departure\.value/
  );
  assert.equal(applySource.match(/autoLinkStationingForFutureBooking/g)?.length, 2);
  assert.match(autoLink, /const matches = exactAvailableStationingMatches\(booking\.guest \|\| bookingForm\.elements\.guest\.value\);/);
  assert.match(autoLink, /if \(matches\.length !== 1\) return false;/);
  assert.match(autoLink, /autoLinked: true,\s*subtractDays: false/);
});

test("expired Marina source reservations start today while preserving their duration", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const applySource = app.match(/function applySourceBooking\(booking\) \{[\s\S]*?\n\}\n\nfunction /)?.[0];

  assert.ok(applySource, "applySourceBooking should exist");
  assert.match(applySource, /const sourceCheckoutDate = validDateFromISO\(booking\.end\);/);
  assert.match(applySource, /sourceCheckoutDate && sourceCheckoutDate < today/);
  assert.match(applySource, /bookingForm\.elements\.arrival\.value = toISODate\(today\);\s*syncDepartureFromNights\(\);/);
  assert.match(applySource, /showOldSourceBookingWarning\(booking\);/);
});

test("only Marina source records are grouped as arrivals today", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert.match(app, /function isMarinaSourceArrivalToday[\s\S]*directorySource === "marina"/);
  assert.match(app, /todayBookings = orderedBookings\.filter\(\(booking\) => isMarinaSourceArrivalToday\(booking, todayText\)\)/);
  assert.match(app, /sourceBookings\.filter\(\(booking\) => isMarinaSourceArrivalToday\(booking, todayText\)\)/);
});
