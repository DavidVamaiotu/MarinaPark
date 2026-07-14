(function exposeStationingCalculator(root, factory) {
  const calculator = factory();
  if (typeof module === "object" && module.exports) module.exports = calculator;
  if (root) root.StationingCalculator = calculator;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStationingCalculator() {
  "use strict";

  const DAY_STATUS = Object.freeze({
    OUTSIDE_PERIOD: "OutsidePeriod",
    UNPAID: "Unpaid",
    PAID: "Paid",
    CLIENT_STAY_EXCLUDED: "ClientStayExcluded"
  });

  function validISODate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  function localDateISO(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function dateFromISO(value) {
    if (!validISODate(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }

  function addCalendarDays(value, amount) {
    const date = dateFromISO(value);
    if (!date) return "";
    date.setDate(date.getDate() + Number(amount || 0));
    return localDateISO(date);
  }

  function datesBetweenInclusive(startDate, endDate) {
    if (!validISODate(startDate) || !validISODate(endDate) || endDate < startDate) return [];
    const dates = [];
    for (let date = startDate; date <= endDate; date = addCalendarDays(date, 1)) dates.push(date);
    return dates;
  }

  function toCents(value) {
    const normalized = typeof value === "string" ? value.replace(/\s+/g, "").replace(",", ".") : value;
    const number = Number(normalized || 0);
    return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
  }

  function centsFrom(record, centsKey, legacyKey) {
    const explicit = Number(record?.[centsKey]);
    if (Number.isInteger(explicit) && explicit >= 0) return explicit;
    return toCents(record?.[legacyKey]);
  }

  function normalizePayment(payment = {}, index = 0) {
    const explicitCents = Number(payment.amountCents);
    const amountCents = payment.kind === "adjustment" && Number.isInteger(explicitCents)
      ? explicitCents
      : centsFrom(payment, "amountCents", "amount");
    return {
      id: String(payment.id || payment.key || `stationing-payment-${index}`),
      paymentDate: validISODate(payment.paymentDate) ? payment.paymentDate : localDateISO(new Date(payment.createdAt || Date.now())),
      amountCents,
      method: String(payment.method || "manual"),
      kind: payment.kind === "adjustment" ? "adjustment" : "payment",
      note: String(payment.note || ""),
      createdAt: String(payment.createdAt || new Date().toISOString()),
      voidedAt: String(payment.voidedAt || "")
    };
  }

  function normalizePayments(record = {}) {
    const source = Array.isArray(record.paymentTransactions) ? record.paymentTransactions : [];
    const normalized = source.map(normalizePayment).filter((payment) => payment.amountCents !== 0);
    if (normalized.length || centsFrom(record, "paidAmountCents", "paidAmount") <= 0) return normalized;
    return [normalizePayment({
      id: `legacy-${record.key || "stationing"}`,
      amountCents: centsFrom(record, "paidAmountCents", "paidAmount"),
      paymentDate: validISODate(record.startDate) ? record.startDate : localDateISO(),
      method: "legacy",
      note: "Plată migrată din câmpul vechi Plătit"
    })];
  }

  function normalizeStayLinks(record = {}) {
    const links = new Map();
    const sources = [
      ...(Array.isArray(record.deductions) ? record.deductions.map((item) => ({ ...item, subtractDays: true })) : []),
      ...(Array.isArray(record.stayLinks) ? record.stayLinks : [])
    ];
    sources.forEach((link) => {
      const stayKey = String(link.stayKey || "").trim();
      if (!stayKey) return;
      links.set(stayKey, {
        stayKey,
        subtractDays: link.subtractDays !== false,
        linkedAt: String(link.linkedAt || link.appliedAt || new Date().toISOString())
      });
    });
    return [...links.values()];
  }

  function legacyEndDate(record = {}) {
    if (validISODate(record.endDate)) return record.endDate;
    const nights = Math.max(0, Math.round(Number(record.prepaidNights || 0)));
    return nights > 0 && validISODate(record.startDate) ? addCalendarDays(record.startDate, nights - 1) : "";
  }

  function normalizeRecord(record = {}) {
    const startDate = validISODate(record.startDate) ? record.startDate : localDateISO();
    const hasExplicitPeriodModel = record.schemaVersion >= 2 || Object.prototype.hasOwnProperty.call(record, "openEnded");
    const endDate = validISODate(record.endDate) ? record.endDate : hasExplicitPeriodModel ? "" : legacyEndDate({ ...record, startDate });
    const openEnded = hasExplicitPeriodModel ? record.openEnded !== false && !endDate : !endDate;
    const pricePerDayCents = centsFrom(record, "pricePerDayCents", "nightlyPrice");
    const manualPrepaidNights = Math.max(0, Math.round(Number(record.manualPrepaidNights || 0)));
    return {
      ...record,
      schemaVersion: 2,
      startDate,
      endDate: openEnded ? "" : endDate,
      openEnded,
      pricePerDayCents,
      nightlyPrice: pricePerDayCents / 100,
      manualPrepaidNights,
      paymentTransactions: normalizePayments(record),
      stayLinks: normalizeStayLinks(record)
    };
  }

  function effectiveEndDate(record, todayISO = localDateISO()) {
    const normalized = normalizeRecord(record);
    return normalized.openEnded ? addCalendarDays(todayISO, -1) : normalized.endDate;
  }

  function linkedStayMap(record, stays = []) {
    const normalized = normalizeRecord(record);
    const allowed = new Map(normalized.stayLinks.map((link) => [link.stayKey, link]));
    stays.forEach((stay) => {
      const deduction = stay?.stationingDeduction;
      if (deduction?.recordKey !== normalized.key || deduction.subtractDays === false) return;
      allowed.set(String(stay.key), { stayKey: String(stay.key), subtractDays: true, linkedAt: deduction.selectedAt || "" });
    });
    return allowed;
  }

  function exclusionDetails(record, stays = []) {
    const links = linkedStayMap(record, stays);
    const exclusions = new Map();
    const staysByKey = new Map(stays.map((stay) => [String(stay.key), stay]));
    links.forEach((link, stayKey) => {
      if (!link.subtractDays) return;
      const stay = staysByKey.get(stayKey);
      if (!stay || !validISODate(stay.start) || !validISODate(stay.end) || stay.end <= stay.start) return;
      // Reservation end is checkout: exclude arrival through the day before departure.
      datesBetweenInclusive(stay.start, addCalendarDays(stay.end, -1)).forEach((date) => {
        const sources = exclusions.get(date) || [];
        sources.push({ stayKey, guest: String(stay.guest || ""), start: stay.start, end: stay.end });
        exclusions.set(date, sources);
      });
    });
    return exclusions;
  }

  function calculate(record = {}, stays = [], options = {}) {
    const normalized = normalizeRecord(record);
    const todayISO = validISODate(options.todayISO) ? options.todayISO : localDateISO(options.now || new Date());
    const endDate = effectiveEndDate(normalized, todayISO);
    if (normalized.endDate && normalized.endDate < normalized.startDate) {
      throw new RangeError("Data de sfârșit nu poate fi înaintea datei de început.");
    }
    if (normalized.pricePerDayCents <= 0 && options.allowZeroPrice !== true) {
      throw new RangeError("Prețul pe zi trebuie să fie mai mare decât zero.");
    }
    const periodDates = endDate && endDate >= normalized.startDate
      ? datesBetweenInclusive(normalized.startDate, endDate)
      : [];
    const exclusions = exclusionDetails(normalized, stays);
    const activePayments = normalized.paymentTransactions
      .filter((payment) => !payment.voidedAt)
      .sort((first, second) =>
        first.paymentDate.localeCompare(second.paymentDate) ||
        first.createdAt.localeCompare(second.createdAt) ||
        first.id.localeCompare(second.id)
      );
    const amountPaidCents = Math.max(0, activePayments.reduce((sum, payment) => sum + payment.amountCents, 0));
    let availableCreditCents = amountPaidCents;
    let appliedPaymentCents = 0;
    const paymentBuckets = activePayments
      .filter((payment) => payment.amountCents > 0)
      .map((payment) => ({ id: payment.id, remainingCents: payment.amountCents }));
    let paymentBucketIndex = 0;
    function allocatePaymentIds(amountCents) {
      const ids = [];
      let remaining = amountCents;
      while (remaining > 0 && paymentBucketIndex < paymentBuckets.length) {
        const bucket = paymentBuckets[paymentBucketIndex];
        const used = Math.min(remaining, bucket.remainingCents);
        if (used > 0 && !ids.includes(bucket.id)) ids.push(bucket.id);
        bucket.remainingCents -= used;
        remaining -= used;
        if (bucket.remainingCents <= 0) paymentBucketIndex += 1;
      }
      return ids;
    }
    const days = periodDates.map((date) => {
      const exclusionSources = exclusions.get(date) || [];
      if (exclusionSources.length) {
        return { date, status: DAY_STATUS.CLIENT_STAY_EXCLUDED, chargeCents: 0, exclusionSources, paymentIds: [], dynamicallyGenerated: normalized.openEnded };
      }
      if (availableCreditCents >= normalized.pricePerDayCents) {
        availableCreditCents -= normalized.pricePerDayCents;
        appliedPaymentCents += normalized.pricePerDayCents;
        return { date, status: DAY_STATUS.PAID, chargeCents: normalized.pricePerDayCents, exclusionSources: [], paymentIds: allocatePaymentIds(normalized.pricePerDayCents), dynamicallyGenerated: normalized.openEnded };
      }
      return { date, status: DAY_STATUS.UNPAID, chargeCents: normalized.pricePerDayCents, exclusionSources: [], paymentIds: [], dynamicallyGenerated: normalized.openEnded };
    });
    let manualExcludedDays = 0;
    for (const day of days) {
      if (manualExcludedDays >= normalized.manualPrepaidNights) break;
      if (day.status !== DAY_STATUS.UNPAID) continue;
      day.status = DAY_STATUS.CLIENT_STAY_EXCLUDED;
      day.chargeCents = 0;
      day.exclusionSources = [{ type: "manual-prepaid" }];
      manualExcludedDays += 1;
    }
    const chargeableDays = days.filter((day) => day.status !== DAY_STATUS.CLIENT_STAY_EXCLUDED).length;
    const linkedExcludedDays = days.filter((day) =>
      day.status === DAY_STATUS.CLIENT_STAY_EXCLUDED && day.exclusionSources.some((source) => source.type !== "manual-prepaid")
    ).length;
    const generatedTotalCents = chargeableDays * normalized.pricePerDayCents;
    const remainingBalanceCents = Math.max(0, generatedTotalCents - appliedPaymentCents);
    return {
      record: normalized,
      todayISO,
      effectiveEndDate: endDate,
      days,
      chargeableDays,
      excludedDays: days.length - chargeableDays,
      linkedExcludedDays,
      manualExcludedDays,
      generatedTotalCents,
      amountPaidCents,
      appliedPaymentCents,
      remainingBalanceCents,
      creditCents: Math.max(0, amountPaidCents - appliedPaymentCents),
      paidDays: days.filter((day) => day.status === DAY_STATUS.PAID).length,
      unpaidDays: days.filter((day) => day.status === DAY_STATUS.UNPAID).length
    };
  }

  return {
    DAY_STATUS,
    addCalendarDays,
    calculate,
    effectiveEndDate,
    exclusionDetails,
    localDateISO,
    normalizePayment,
    normalizePayments,
    normalizeRecord,
    normalizeStayLinks,
    toCents,
    validISODate
  };
});
