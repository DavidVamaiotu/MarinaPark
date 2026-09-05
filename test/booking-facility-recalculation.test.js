const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

test("RV electricity follows the stay length whenever booking nights change", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const syncElectricity = app.match(
    /function syncRvElectricityDaysToStay\(\) \{[\s\S]*?\n\}\n\nfunction /
  )?.[0];
  const calendarRange = app.match(
    /function setBookingRangeFromCalendar\(startText, endText = startText\) \{[\s\S]*?\n\}\n\nfunction /
  )?.[0];
  const dateHandlers = app.match(
    /const syncDepartureAndPricing = \(\) => \{[\s\S]*?const syncNightsAndPricing = \(\) => \{[\s\S]*?\n\};/
  )?.[0];

  assert.ok(syncElectricity, "RV electricity stay-length sync should exist");
  assert.match(syncElectricity, /if \(!currentBookingIsRv\(\)\) return;/);
  assert.match(syncElectricity, /const nights = stayNightCount\(/);
  assert.match(syncElectricity, /facility\.key === "electricitate"/);
  assert.match(syncElectricity, /\{ \.\.\.facility, nights, customNights: false \}/);

  assert.ok(calendarRange, "calendar booking range handler should exist");
  assert.match(
    calendarRange,
    /syncNightsFromDates\(\);\s*syncRvElectricityDaysToStay\(\);\s*syncBookingCalendarMonthToArrival\(\);/
  );

  assert.ok(dateHandlers, "booking date and night handlers should exist");
  assert.equal(
    dateHandlers.match(/syncRvElectricityDaysToStay\(\);/g)?.length,
    3,
    "arrival, nights, and departure changes should all resync RV electricity days"
  );
});
