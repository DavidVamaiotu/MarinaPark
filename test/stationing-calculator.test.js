const assert = require("node:assert/strict");
const test = require("node:test");
const calculator = require("../stationing-calculator");

function record(overrides = {}) {
  return {
    key: "station-1",
    schemaVersion: 2,
    owner: "Ana",
    startDate: "2026-07-01",
    endDate: "",
    openEnded: true,
    pricePerDayCents: 2000,
    paymentTransactions: [],
    stayLinks: [],
    ...overrides
  };
}

function payment(id, amountCents, overrides = {}) {
  return {
    id,
    amountCents,
    paymentDate: "2026-07-01",
    createdAt: `2026-07-01T00:00:0${id.length}.000Z`,
    ...overrides
  };
}

function statuses(result) {
  return Object.fromEntries(result.days.map((day) => [day.date, day.status]));
}

test("open records derive completed dates from the current local day", () => {
  const july11 = calculator.calculate(record(), [], { todayISO: "2026-07-11" });
  assert.equal(july11.effectiveEndDate, "2026-07-10");
  assert.equal(july11.days.length, 10);
  assert.equal(july11.days.at(-1).date, "2026-07-10");
  assert.equal(july11.days.at(-1).status, calculator.DAY_STATUS.UNPAID);

  const july12 = calculator.calculate(record(), [], { todayISO: "2026-07-12" });
  assert.equal(july12.days.length, 11);
  assert.equal(july12.days.at(-1).date, "2026-07-11");
  assert.equal(july12.generatedTotalCents, july11.generatedTotalCents + 2000);
  assert.ok(!july12.days.some((day) => day.date === "2026-07-12"));
});

test("an open record starting today or in the future has no charged days", () => {
  assert.equal(calculator.calculate(record({ startDate: "2026-07-11" }), [], { todayISO: "2026-07-11" }).days.length, 0);
  assert.equal(calculator.calculate(record({ startDate: "2026-07-12" }), [], { todayISO: "2026-07-11" }).days.length, 0);
});

test("closed stationing dates are inclusive and an invalid period is rejected", () => {
  const result = calculator.calculate(record({ openEnded: false, endDate: "2026-07-03" }), [], { todayISO: "2026-07-20" });
  assert.deepEqual(result.days.map((day) => day.date), ["2026-07-01", "2026-07-02", "2026-07-03"]);
  assert.throws(
    () => calculator.calculate(record({ startDate: "2026-07-03", openEnded: false, endDate: "2026-07-02" })),
    /înainte/
  );
});

test("payments combine chronologically, skip excluded stays, and never pay a date twice", () => {
  const source = record({
    openEnded: false,
    endDate: "2026-07-04",
    paymentTransactions: [payment("one", 2000), payment("two", 2000)],
    stayLinks: [{ stayKey: "stay-blue", subtractDays: true }]
  });
  const stays = [{ key: "stay-blue", guest: "Ana", start: "2026-07-02", end: "2026-07-03" }];
  const result = calculator.calculate(source, stays);
  assert.deepEqual(statuses(result), {
    "2026-07-01": calculator.DAY_STATUS.PAID,
    "2026-07-02": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-03": calculator.DAY_STATUS.PAID,
    "2026-07-04": calculator.DAY_STATUS.UNPAID
  });
  assert.equal(result.paidDays, 2);
  assert.equal(result.generatedTotalCents, 6000);
  assert.equal(result.remainingBalanceCents, 2000);
});

test("manual prepaid nights start from the beginning and skip already paid days", () => {
  const result = calculator.calculate(record({
    openEnded: false,
    endDate: "2026-07-06",
    paymentTransactions: [payment("cash", 4000)],
    manualPrepaidNights: 3
  }));
  assert.deepEqual(statuses(result), {
    "2026-07-01": calculator.DAY_STATUS.PAID,
    "2026-07-02": calculator.DAY_STATUS.PAID,
    "2026-07-03": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-04": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-05": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-06": calculator.DAY_STATUS.UNPAID
  });
  assert.equal(result.linkedExcludedDays, 0);
  assert.equal(result.manualExcludedDays, 3);
  assert.equal(result.excludedDays, 3);
  assert.equal(result.remainingBalanceCents, 2000);
});

test("manual prepaid nights are additional to linked blue ranges", () => {
  const source = record({
    openEnded: false,
    endDate: "2026-07-06",
    paymentTransactions: [payment("cash", 2000)],
    stayLinks: [{ stayKey: "stay-blue", subtractDays: true }],
    manualPrepaidNights: 2
  });
  const result = calculator.calculate(source, [{ key: "stay-blue", start: "2026-07-02", end: "2026-07-04" }]);
  assert.deepEqual(statuses(result), {
    "2026-07-01": calculator.DAY_STATUS.PAID,
    "2026-07-02": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-03": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-04": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-05": calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED,
    "2026-07-06": calculator.DAY_STATUS.UNPAID
  });
  assert.equal(result.linkedExcludedDays, 2);
  assert.equal(result.manualExcludedDays, 2);
  assert.equal(result.excludedDays, 4);
});

test("partial money and overpayment remain explicit credit without falsely paying a day", () => {
  const partial = calculator.calculate(record({
    openEnded: false,
    endDate: "2026-07-03",
    paymentTransactions: [payment("cash", 5000)]
  }));
  assert.equal(partial.paidDays, 2);
  assert.equal(partial.unpaidDays, 1);
  assert.equal(partial.creditCents, 1000);
  assert.equal(partial.remainingBalanceCents, 2000);

  const overpaid = calculator.calculate(record({
    openEnded: false,
    endDate: "2026-07-01",
    paymentTransactions: [payment("cash", 5000)]
  }));
  assert.equal(overpaid.paidDays, 1);
  assert.equal(overpaid.creditCents, 3000);
});

test("voiding or correcting a payment deterministically recalculates red and green days", () => {
  const base = record({ openEnded: false, endDate: "2026-07-03", paymentTransactions: [payment("cash", 4000)] });
  assert.equal(calculator.calculate(base).paidDays, 2);
  assert.equal(calculator.calculate({ ...base, paymentTransactions: [payment("cash", 4000, { voidedAt: "2026-07-02T10:00:00Z" })] }).paidDays, 0);
  assert.equal(calculator.calculate({ ...base, paymentTransactions: [...base.paymentTransactions, payment("correction", -2000, { kind: "adjustment" })] }).paidDays, 1);
});

test("stay subtraction is optional, idempotent, checkout-exclusive, and overlap-safe", () => {
  const stays = [
    { key: "stay-a", guest: "Ana", start: "2026-07-02", end: "2026-07-05" },
    { key: "stay-b", guest: "Ana", start: "2026-07-04", end: "2026-07-06" }
  ];
  const accepted = record({
    openEnded: false,
    endDate: "2026-07-06",
    stayLinks: [
      { stayKey: "stay-a", subtractDays: true },
      { stayKey: "stay-a", subtractDays: true },
      { stayKey: "stay-b", subtractDays: true }
    ]
  });
  const result = calculator.calculate(accepted, stays);
  assert.equal(result.excludedDays, 4);
  assert.equal(statuses(result)["2026-07-05"], calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED);
  assert.equal(statuses(result)["2026-07-06"], calculator.DAY_STATUS.UNPAID);

  const declined = calculator.calculate({ ...accepted, stayLinks: [{ stayKey: "stay-a", subtractDays: false }] }, stays);
  assert.equal(declined.excludedDays, 0);
});

test("edited and deleted stays restore charges and reallocate existing payment value", () => {
  const source = record({
    openEnded: false,
    endDate: "2026-07-04",
    paymentTransactions: [payment("cash", 4000)],
    stayLinks: [{ stayKey: "stay", subtractDays: true }]
  });
  const original = calculator.calculate(source, [{ key: "stay", start: "2026-07-02", end: "2026-07-03" }]);
  assert.equal(statuses(original)["2026-07-03"], calculator.DAY_STATUS.PAID);

  const moved = calculator.calculate(source, [{ key: "stay", start: "2026-07-03", end: "2026-07-04" }]);
  assert.equal(statuses(moved)["2026-07-02"], calculator.DAY_STATUS.PAID);
  assert.equal(statuses(moved)["2026-07-03"], calculator.DAY_STATUS.CLIENT_STAY_EXCLUDED);

  const deleted = calculator.calculate(source, []);
  assert.equal(deleted.excludedDays, 0);
  assert.equal(deleted.paidDays, 2);
  assert.equal(statuses(deleted)["2026-07-03"], calculator.DAY_STATUS.UNPAID);
});

test("price and period edits preserve payment value and recalculate allocation", () => {
  const source = record({ openEnded: false, endDate: "2026-07-03", paymentTransactions: [payment("cash", 4000)] });
  assert.equal(calculator.calculate(source).paidDays, 2);
  assert.equal(calculator.calculate({ ...source, pricePerDayCents: 3000 }).paidDays, 1);
  assert.equal(calculator.calculate({ ...source, startDate: "2026-07-02" }).days.length, 2);
  assert.equal(calculator.calculate({ ...source, endDate: "2026-07-02" }).creditCents, 0);
  assert.equal(calculator.calculate({ ...source, endDate: "2026-07-01" }).creditCents, 2000);
  assert.equal(calculator.calculate({ ...source, openEnded: true, endDate: "" }, [], { todayISO: "2026-07-05" }).days.length, 4);
});

test("legacy prepaid records migrate to an inclusive closed period and payment ledger", () => {
  const normalized = calculator.normalizeRecord({
    key: "legacy",
    startDate: "2026-07-01",
    prepaidNights: 3,
    nightlyPrice: 20,
    paidAmount: 40
  });
  assert.equal(normalized.openEnded, false);
  assert.equal(normalized.endDate, "2026-07-03");
  assert.equal(normalized.pricePerDayCents, 2000);
  assert.equal(normalized.paymentTransactions.length, 1);
  assert.equal(calculator.calculate(normalized).paidDays, 2);
});
