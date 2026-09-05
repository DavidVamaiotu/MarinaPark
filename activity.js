const activityLogStorageKey = "marinaParkActivityLog";
const logFeed = document.querySelector("#logFeed");
const summaryGrid = document.querySelector("#summaryGrid");
const searchInput = document.querySelector("#logSearch");
const dailyTotalsFilterButton = document.querySelector("#dailyTotalsFilter");
const eventFilterButtons = [
  ...document.querySelectorAll("[data-event-filter]"),
];
const refreshButton = document.querySelector("#refreshLog");
const exportDatabaseButton = document.querySelector("#exportDatabase");
const clearActivityLogButton = document.querySelector("#clearActivityLog");
const clearActivityLogRangeButton = document.querySelector(
  "#clearActivityLogRange",
);
const clearLogFromDateInput = document.querySelector("#clearLogFromDate");
const clearLogToDateInput = document.querySelector("#clearLogToDate");
const loadMoreLogButton = document.querySelector("#loadMoreLog");
const localActivityAccess = ["127.0.0.1", "localhost", "::1"].includes(
  window.location.hostname,
);
const logPageSize = 250;
let logOffset = 0;
let logHasMore = false;

if (!localActivityAccess) {
  exportDatabaseButton.hidden = true;
}

let entries = [];
let dailyTotalsOnly = false;
let eventFilter = "all";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Single audited HTML sink for this page. Every interpolated value must
// already be escaped (escapeHtml) before reaching this function. Markup is
// parsed through a detached <template>, so it lands as inert nodes (no
// inline scripts execute) — same pattern as app.js setElementHtml.
function setElementHtml(element, html) {
  if (!element) return;
  const fragment = Object.assign(document.createElement("template"), {
    innerHTML: String(html ?? ""),
  }).content;
  element.replaceChildren(fragment);
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "Fără dată";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(dateKey) {
  if (dateKey === "Fără dată") return dateKey;
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayDateValue(value) {
  const text = String(value ?? "").trim();
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:T.*)?$/);
  const localMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  const parts = isoMatch
    ? [Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3])]
    : localMatch
      ? [Number(localMatch[3]), Number(localMatch[2]), Number(localMatch[1])]
      : null;
  if (!parts) return text;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return text;
  return date.toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function displayDatesInText(value) {
  return String(value ?? "").replace(
    /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/g,
    (date) => displayDateValue(date),
  );
}

function timeLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "--:--";
  return date.toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} lei`;
}

function entrySearchText(entry) {
  return [
    entry.eventType,
    entry.entityType,
    entry.entityLabel,
    entry.message,
    entry.method,
    entry.amount,
    JSON.stringify(entry.data || {}),
  ]
    .join(" ")
    .toLowerCase();
}

function filteredEntries() {
  const query = searchInput.value.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesEvent =
      eventFilter === "all" ||
      (eventFilter === "suspicious"
        ? suspiciousReasons(entry).length > 0
        : entry.eventType === eventFilter);
    const matchesSearch = !query || entrySearchText(entry).includes(query);
    return matchesEvent && matchesSearch;
  });
}

function finiteMoney(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function loggedMoney(value) {
  let text = String(value ?? "").replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) {
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replaceAll(".", "").replace(",", ".")
        : text.replaceAll(",", "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function paymentInitialPrice(entry) {
  const structuredPrice = finiteMoney(
    entry.data?.initialEditPrice,
    entry.data?.originalCustomerPrice,
    entry.data?.originalTotalPrice,
    entry.data?.previousPrice,
    entry.data?.totalPrice,
  );
  if (structuredPrice !== null) return structuredPrice;

  const messageMatch = String(entry.message || "").match(
    /Pre(?:ț|t) ini(?:ț|t)ial(?: client| sta(?:ț|t)ionare)?:\s*([\d\s.,]+)/i,
  );
  return messageMatch ? loggedMoney(messageMatch[1]) : null;
}

function paymentComparison(entry) {
  if (entry.eventType !== "payment" || entry.entityType === "bar") return null;
  const initialPrice = paymentInitialPrice(entry);
  const paidAmount = finiteMoney(
    entry.data?.actualPaidAmount,
    entry.data?.amount,
    entry.amount,
  );
  if (initialPrice === null || paidAmount === null || initialPrice < 0)
    return null;
  return {
    initialPrice,
    paidAmount,
    difference: Math.round((initialPrice - paidAmount) * 100) / 100,
    isUnderpaid: paidAmount + 0.001 < initialPrice,
  };
}

function priceReduction(entry) {
  if (entry.eventType !== "update") return null;
  const previousPrice = finiteMoney(
    entry.data?.previousPrice,
    entry.data?.previous?.price,
    entry.data?.previous?.totalPrice,
  );
  const newPrice = finiteMoney(
    entry.data?.newPrice,
    entry.data?.current?.price,
    entry.data?.current?.totalPrice,
  );
  if (
    previousPrice === null ||
    newPrice === null ||
    newPrice + 0.001 >= previousPrice
  )
    return null;
  return {
    previousPrice,
    newPrice,
    difference: Math.round((previousPrice - newPrice) * 100) / 100,
  };
}

function suspiciousReasons(entry) {
  const reasons = [];
  const comparison = paymentComparison(entry);
  const reduction = priceReduction(entry);
  if (comparison?.isUnderpaid)
    reasons.push(
      `Plătit cu ${formatCurrency(comparison.difference)} mai puțin decât prețul inițial.`,
    );
  if (reduction)
    reasons.push(`Preț redus cu ${formatCurrency(reduction.difference)}.`);
  return reasons;
}

function suspiciousAlert(entry) {
  const reasons = suspiciousReasons(entry);
  if (!reasons.length) return "";
  return `
    <div class="suspicious-alert" role="note">
      <strong>De verificat</strong>
      <span>${escapeHtml(reasons.join(" "))}</span>
    </div>
  `;
}

function paymentComparisonView(entry) {
  const comparison = paymentComparison(entry);
  if (!comparison) return "";
  const differenceText = comparison.isUnderpaid
    ? `-${formatCurrency(comparison.difference)}`
    : formatCurrency(comparison.paidAmount - comparison.initialPrice);
  return `
    <dl class="payment-comparison${comparison.isUnderpaid ? " is-suspicious" : ""}">
      <div><dt>Preț inițial</dt><dd>${formatCurrency(comparison.initialPrice)}</dd></div>
      <div><dt>Plătit efectiv</dt><dd>${formatCurrency(comparison.paidAmount)}</dd></div>
      <div><dt>Diferență</dt><dd>${differenceText}</dd></div>
    </dl>
  `;
}

function readableChanges(entry) {
  const explicitChanges = Array.isArray(entry.data?.changes)
    ? entry.data.changes
    : Array.isArray(entry.data?.savedEdits)
      ? entry.data.savedEdits
      : [];
  if (explicitChanges.length)
    return explicitChanges
      .map(String)
      .filter((change) => change && !/^rest\s*:/i.test(change));

  const changes = [];
  const pairs = [
    ["Început", entry.data?.previousStart, entry.data?.newStart],
    ["Final", entry.data?.previousEnd, entry.data?.newEnd],
    ["Preț", entry.data?.previousPrice, entry.data?.newPrice],
  ];
  pairs.forEach(([label, previous, current]) => {
    if (
      previous === undefined ||
      current === undefined ||
      String(previous) === String(current)
    )
      return;
    const moneyValue = ["Preț", "Rest"].includes(label);
    changes.push(
      `${label}: ${moneyValue ? formatCurrency(previous) : previous} -> ${moneyValue ? formatCurrency(current) : current}`,
    );
  });
  return changes;
}

function changeDetails(entry) {
  if (!["update", "payment"].includes(entry.eventType)) return "";
  const changes = readableChanges(entry);
  if (!changes.length) return "";
  const rows = changes
    .map((change) => {
      const [labelPart, valuePart = ""] = String(change).split(/:\s(.+)/);
      const [previous = "—", current = "—"] = valuePart.split(/\s(?:->|→)\s/);
      return `
      <div class="change-row">
        <span>${escapeHtml(labelPart)}</span>
        <del>${escapeHtml(displayDateValue(previous))}</del>
        <b aria-hidden="true">→</b>
        <ins>${escapeHtml(displayDateValue(current))}</ins>
      </div>
    `;
    })
    .join("");
  return `<div class="change-details"><strong>Ce s-a schimbat</strong>${rows}</div>`;
}

function eventLabel(entry) {
  const labels = {
    payment: "Plată înregistrată",
    update: "Modificat",
    create: "Adăugat",
    delete: "Șters",
    open: "Deschis",
    settings: "Setări schimbate",
  };
  return labels[entry.eventType] || "Eveniment";
}

function eventIcon(entry) {
  const icons = {
    payment: "₤",
    update: "↻",
    create: "+",
    delete: "×",
    open: "↗",
    settings: "⚙",
  };
  return icons[entry.eventType] || "•";
}

function entityLabel(entry) {
  const labels = {
    client: "Client",
    stationing: "Staționare",
    unit: "Unitate",
    settings: "Setări",
    bar: "Bar",
    bar_article: "Articol bar",
    facility: "Facilitate",
  };
  return labels[entry.entityType] || entry.entityType || "Aplicație";
}

function priceChangeAlert(entry) {
  if (!entry.data?.priceChangedDuringEdit) return "";
  const nextPrice = entry.data.customerPriceAtPayment ?? entry.data.paidPrice;
  return `
    <div class="price-alert">
      Fișa clientului era deschisă, iar prețul a fost schimbat pe loc de la
      ${formatCurrency(entry.data.initialEditPrice)} la ${formatCurrency(nextPrice)} înainte de plată.
    </div>
  `;
}

function entryVisualDetails(entry) {
  const content = [
    changeDetails(entry),
    paymentComparisonView(entry),
    priceChangeAlert(entry),
  ]
    .filter(Boolean)
    .join("");
  if (!content) return "";
  return `<div class="entry-visual-details">${content}</div>`;
}

function stationingDeductedNights(entry) {
  if (entry.entityType !== "stationing") return null;
  return finiteMoney(
    entry.data?.deduction?.nights,
    entry.data?.deduction?.appliedNights,
    entry.data?.current?.prepaidNights,
    entry.data?.record?.prepaidNights,
    entry.data?.prepaidNights,
  );
}

function paymentMethodTotals(payments) {
  return payments.reduce(
    (totals, entry) => {
      const method = String(entry.method || "").toLowerCase();
      const amount = Number(entry.amount || 0);
      if (method === "card") totals.card += amount;
      if (method === "numerar") totals.numerar += amount;
      if (method === "voucher") totals.voucher += amount;
      return totals;
    },
    { card: 0, numerar: 0, voucher: 0 },
  );
}

function paymentMethodTotalText(payments) {
  const totals = paymentMethodTotals(payments);
  return `Card: ${formatCurrency(totals.card)} · Numerar: ${formatCurrency(totals.numerar)} · Voucher: ${formatCurrency(totals.voucher)}`;
}

function activityTimestamp(entry) {
  const date = new Date(entry.timestamp);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function sessionKey(entry) {
  const entityType = String(entry.entityType || "");
  const entityKey = String(entry.entityKey || "");
  return entityType && entityKey ? `${entityType}:${entityKey}` : "";
}

function dailyClientKey(entry, knownPersonIds = null) {
  const personId =
    entry.data?.personId ||
    entry.data?.editSession?.personId ||
    entry.data?.current?.personId ||
    entry.data?.previous?.personId ||
    entry.data?.stay?.personId ||
    knownPersonIds?.get(sessionKey(entry));
  if (personId) return `person:${personId}`;
  if (entry.entityKey)
    return `${entry.entityType || "entry"}:${entry.entityKey}`;
  return `${entry.entityType || "entry"}:${entry.entityLabel || entityLabel(entry)}`;
}

function dailyClientName(entry) {
  return (
    entry.data?.client ||
    entry.data?.owner ||
    entry.entityLabel ||
    entityLabel(entry)
  );
}

function readableActionText(entry) {
  if (entry.eventType === "payment") {
    const comparison = paymentComparison(entry);
    const paidAmount =
      comparison?.paidAmount ??
      finiteMoney(
        entry.data?.actualPaidAmount,
        entry.data?.amount,
        entry.amount,
      ) ??
      0;
    const method = entry.method ? ` prin ${entry.method}` : "";
    const initialPriceText = comparison
      ? ` Preț inițial: ${formatCurrency(comparison.initialPrice)}.`
      : "";
    return `A plătit ${formatCurrency(paidAmount)}${method}.${initialPriceText}`;
  }

  if (entry.eventType === "delete") {
    const deletedPrice =
      entry.entityType === "client"
        ? finiteMoney(
            entry.data?.stay?.price,
            entry.data?.record?.price,
            entry.data?.price,
          )
        : null;
    return deletedPrice === null
      ? "Fișa a fost ștearsă."
      : `Fișa a fost ștearsă (${formatCurrency(deletedPrice)}).`;
  }
  if (entry.eventType === "create") return "Fișa a fost adăugată.";
  if (entry.eventType === "settings") return "Setările au fost modificate.";

  const deductedNights = stationingDeductedNights(entry);
  if (deductedNights !== null) {
    const count = Math.max(0, Math.round(deductedNights));
    return `${count} ${count === 1 ? "noapte a fost dedusă" : "nopți au fost deduse"}.`;
  }

  return "Fișa a fost modificată.";
}

function actionFacts(entry) {
  const data = entry.data || {};
  const record = data.stay || data.record || data.current || {};
  const facts = [];
  const addFact = (label, value) => {
    const text = displayDatesInText(value).trim();
    if (
      !text ||
      facts.some((fact) => fact.label === label && fact.value === text)
    )
      return;
    facts.push({ label, value: text });
  };

  if (entry.entityType === "client") {
    addFact("Unitate", data.unit || record.id);
    addFact("Perioadă", record.dates);
  }
  if (entry.entityType === "stationing")
    addFact("Rulotă", data.caravan || record.caravan);

  const linkedCount = Array.isArray(data.linkedReservations)
    ? data.linkedReservations.length
    : 0;
  if (linkedCount) addFact("Rezervări", `${linkedCount} legate`);
  if (data.repeatPayment) addFact("Tip plată", "Plată suplimentară");
  if (data.zeroPriceMarkPaid) addFact("Stare", "Marcat achitat cu voucher");
  if (data.receiptBarMode === "separate")
    addFact("Bon bar", "Separat de cazare");
  if (data.receiptBarMode === "combined")
    addFact("Bon bar", "Împreună cu cazarea");
  if (data.savedFromPaymentPopup) addFact("Salvare", "Din fereastra de plată");

  if (!facts.length) return "";
  return `
    <dl class="action-facts">
      ${facts.map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join("")}
    </dl>
  `;
}

function createdClientDetails(entry) {
  if (entry.eventType !== "create" || entry.entityType !== "client") return "";
  const client =
    entry.data?.current || entry.data?.stay || entry.data?.record || {};
  const phone = String(client.phone || "").trim() || "Nespecificat";
  const car = String(client.car || "").trim() || "Nespecificat";
  const peopleCount = (value) => {
    if (value === undefined || value === null || String(value).trim() === "")
      return "Nespecificat";
    const count = Number(value);
    return Number.isFinite(count)
      ? String(Math.max(0, Math.round(count)))
      : "Nespecificat";
  };
  const adults = peopleCount(client.adults);
  const children = peopleCount(client.children);
  const facilities = Array.isArray(client.facilities) ? client.facilities : [];
  const facilityAnswer = (key, name) => {
    const facility = facilities.find(
      (item) =>
        item?.key === key || String(item?.name || "").toLowerCase() === name,
    );
    if (!facility) return "Nu";
    const nights = Number(facility.nights);
    if (!Number.isFinite(nights) || nights <= 0) return "Da";
    const roundedNights = Math.round(nights);
    return `Da (${roundedNights} ${roundedNights === 1 ? "noapte" : "nopți"})`;
  };
  const electricity = facilityAnswer("electricitate", "electricitate");
  const extraBed = facilityAnswer("pat-suplimentar", "pat suplimentar");
  const hasPrice =
    client.price !== undefined &&
    client.price !== null &&
    String(client.price).trim() !== "";
  const price = hasPrice ? formatCurrency(client.price) : "Nespecificat";

  return `
    <div class="client-created-details-control">
      <button class="client-details-toggle" type="button" aria-expanded="false">Vezi date client</button>
      <dl class="client-created-details" hidden>
        <div><dt>Telefon</dt><dd>${escapeHtml(phone)}</dd></div>
        <div><dt>Nr. mașină</dt><dd>${escapeHtml(car)}</dd></div>
        <div><dt>Adulți</dt><dd>${escapeHtml(adults)}</dd></div>
        <div><dt>Copii</dt><dd>${escapeHtml(children)}</dd></div>
        <div><dt>Electricitate</dt><dd>${escapeHtml(electricity)}</dd></div>
        <div><dt>Pat suplimentar</dt><dd>${escapeHtml(extraBed)}</dd></div>
        <div><dt>Preț</dt><dd>${escapeHtml(price)}</dd></div>
      </dl>
    </div>
  `;
}

function renderClientDayAction(entry) {
  return `
    <div class="client-day-action is-${escapeHtml(entry.eventType)}${suspiciousReasons(entry).length ? " is-suspicious" : ""}">
      <div class="client-action-heading">
        <time>${escapeHtml(timeLabel(entry.timestamp))}</time>
        <span class="event-marker" aria-hidden="true">${eventIcon(entry)}</span>
        <span class="event-name">${escapeHtml(eventLabel(entry))}</span>
      </div>
      <p class="client-action-text">${escapeHtml(readableActionText(entry))}</p>
      ${createdClientDetails(entry)}
      ${actionFacts(entry)}
      ${entryVisualDetails(entry)}
      ${suspiciousAlert(entry)}
    </div>
  `;
}

function renderDayLog(dayEntries) {
  const clients = new Map();
  const knownPersonIds = new Map();
  dayEntries.forEach((entry) => {
    const personKey = dailyClientKey(entry);
    if (personKey.startsWith("person:") && sessionKey(entry)) {
      knownPersonIds.set(sessionKey(entry), personKey.slice("person:".length));
    }
  });
  dayEntries.forEach((entry) => {
    const key = dailyClientKey(entry, knownPersonIds);
    if (!clients.has(key))
      clients.set(key, {
        name: dailyClientName(entry),
        entityType: entry.entityType,
        entries: [],
      });
    clients.get(key).entries.push(entry);
  });

  const groups = [...clients.values()]
    .map((client) => ({
      ...client,
      entries: client.entries.sort(
        (first, second) => activityTimestamp(first) - activityTimestamp(second),
      ),
    }))
    .sort(
      (first, second) =>
        activityTimestamp(second.entries[second.entries.length - 1]) -
        activityTimestamp(first.entries[first.entries.length - 1]),
    );

  return `
    <div class="client-day-list">
      ${groups
        .map(
          (client) => `
        <article class="client-day-card">
          <header class="client-day-heading">
            <h3 class="person-name">${escapeHtml(client.name)}</h3>
            <span>${escapeHtml(entityLabel({ entityType: client.entityType }))} · ${client.entries.length} ${client.entries.length === 1 ? "acțiune" : "acțiuni"}</span>
          </header>
          <div class="client-day-actions">${client.entries.map(renderClientDayAction).join("")}</div>
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function dayCountLabel(count) {
  if (dailyTotalsOnly || eventFilter === "payment")
    return count === 1 ? "plată" : "plăți";
  if (eventFilter === "update") return count === 1 ? "editare" : "editări";
  if (eventFilter === "delete") return count === 1 ? "ștergere" : "ștergeri";
  if (eventFilter === "suspicious")
    return count === 1 ? "de verificat" : "de verificat";
  return "evenimente";
}

function dailyPaymentSummary(dayEntries, showDetails = false) {
  const payments = dayEntries.filter(
    (entry) => entry.eventType === "payment" && Number(entry.amount || 0) > 0,
  );
  const methodText = paymentMethodTotalText(payments);
  if (!payments.length) {
    return `
      <section class="daily-total">
        <div class="daily-total-row">
          <span>Total plăți zi</span>
          <strong>${formatCurrency(0)}</strong>
        </div>
        <p class="log-meta">Nicio plată înregistrată în această zi. ${escapeHtml(methodText)}.</p>
      </section>
    `;
  }

  const total = payments.reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0,
  );
  return `
    <section class="daily-total">
      <div class="daily-total-row">
        <span>Total plăți zi</span>
        <strong>${formatCurrency(total)}</strong>
      </div>
      <p class="log-meta">${escapeHtml(methodText)}</p>
      ${
        showDetails
          ? `<ul class="daily-payments">
              ${payments
                .map((entry) => {
                  const name =
                    entry.data?.client ||
                    entry.data?.owner ||
                    entry.entityLabel ||
                    "Client";
                  const method = entry.method ? `, ${entry.method}` : "";
                  return `<li>${escapeHtml(timeLabel(entry.timestamp))} · <span class="person-name">${escapeHtml(name)}</span> - ${formatCurrency(entry.amount)}${escapeHtml(method)}</li>`;
                })
                .join("")}
            </ul>`
          : ""
      }
    </section>
  `;
}

function setEventFilter(nextFilter) {
  eventFilter = nextFilter || "all";
  eventFilterButtons.forEach((filterButton) => {
    const isActive = filterButton.dataset.eventFilter === eventFilter;
    filterButton.classList.toggle("is-active", isActive);
    filterButton.setAttribute("aria-pressed", String(isActive));
  });
}

function renderSummary(currentEntries) {
  const summaryEntries = currentEntries.filter(
    (entry) => entry.eventType !== "open",
  );
  const todayKey = localDateKey(new Date().toISOString());
  const todayPayments = summaryEntries.filter(
    (entry) =>
      localDateKey(entry.timestamp) === todayKey &&
      entry.eventType === "payment",
  );
  const totalToday = todayPayments.reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0,
  );
  const todayMethodText = paymentMethodTotalText(todayPayments);
  const updates = summaryEntries.filter(
    (entry) => entry.eventType === "update",
  ).length;
  const suspicious = summaryEntries.filter(
    (entry) => suspiciousReasons(entry).length > 0,
  ).length;

  setElementHtml(
    summaryGrid,
    `
    <p class="summary-line">
      <span><strong>${summaryEntries.length}</strong> înregistrări</span>
      <span><strong>${todayPayments.length}</strong> plăți azi</span>
      <span><strong>${formatCurrency(totalToday)}</strong> încasat azi</span>
      <span>${escapeHtml(todayMethodText)}</span>
      <span><strong>${updates}</strong> modificări</span>
      ${suspicious ? `<span class="summary-warning"><strong>${suspicious}</strong> de verificat</span>` : ""}
    </p>
  `,
  );
}

function renderLog() {
  const currentEntries = filteredEntries();
  renderSummary(currentEntries);
  loadMoreLogButton.hidden = !logHasMore;
  const visibleEntries = dailyTotalsOnly
    ? currentEntries.filter(
        (entry) =>
          entry.eventType === "payment" && Number(entry.amount || 0) > 0,
      )
    : currentEntries.filter((entry) => entry.eventType !== "open");

  if (!visibleEntries.length) {
    setElementHtml(
      logFeed,
      `<p class="empty-state">${dailyTotalsOnly ? "Nu există plăți pentru filtrul curent." : "Nu există activitate pentru filtrul curent."}</p>`,
    );
    return;
  }

  const groups = visibleEntries.reduce((map, entry) => {
    const key = localDateKey(entry.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
    return map;
  }, new Map());

  setElementHtml(
    logFeed,
    [...groups.entries()]
      .map(
        ([day, dayEntries]) => `
        <section class="day-group">
          <div class="day-heading">
            <h2>${escapeHtml(dateLabel(day))}</h2>
            <span>${dayEntries.length} ${escapeHtml(dayCountLabel(dayEntries.length))}</span>
          </div>
          ${dailyPaymentSummary(dayEntries, dailyTotalsOnly)}
          ${dailyTotalsOnly ? "" : `<div class="log-list">${renderDayLog(dayEntries)}</div>`}
        </section>
      `,
      )
      .join(""),
  );
}

function mergedLogEntries(serverEntries, localEntries, append) {
  const byId = new Map();
  [...(append ? entries : []), ...serverEntries, ...localEntries].forEach(
    (entry) => {
      if (entry?.id) byId.set(entry.id, entry);
    },
  );
  return [...byId.values()].sort((first, second) =>
    String(second.timestamp || "").localeCompare(String(first.timestamp || "")),
  );
}

async function loadLogPage({ append = false } = {}) {
  const offset = append ? logOffset : 0;
  const activeButton = append ? loadMoreLogButton : refreshButton;
  activeButton.disabled = true;
  try {
    const response = await fetch(
      `/api/log?limit=${logPageSize}&offset=${offset}`,
      { cache: "no-store" },
    );
    const result = await response.json();
    const serverEntries =
      response.ok && result.ok && Array.isArray(result.entries)
        ? result.entries
        : [];
    const storedLocalEntries = JSON.parse(
      localStorage.getItem(activityLogStorageKey) || "[]",
    );
    const purgeRanges = Array.isArray(result.purges) ? result.purges : [];
    const localEntries = storedLocalEntries.filter(
      (entry) =>
        !purgeRanges.some((range) => matchesServerLogPurge(entry, range)),
    );
    if (localEntries.length !== storedLocalEntries.length)
      persistLocalActivityEntries(localEntries);
    entries = mergedLogEntries(serverEntries, localEntries, append);
    logOffset =
      response.ok && result.ok
        ? Number(result.nextOffset || offset + serverEntries.length)
        : offset;
    logHasMore = Boolean(response.ok && result.ok && result.hasMore);
  } catch {
    if (!append) {
      entries = JSON.parse(localStorage.getItem(activityLogStorageKey) || "[]");
      logOffset = 0;
      logHasMore = false;
    }
  } finally {
    activeButton.disabled = false;
    renderLog();
  }
}

function loadLog() {
  return loadLogPage();
}

function loadMoreLog() {
  return loadLogPage({ append: true });
}

function exportDatabase() {
  const link = document.createElement("a");
  link.href = `/api/export-database?t=${Date.now()}`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function isPurgeableActivityLogEntry(entry) {
  return (
    entry?.entityType === "client" ||
    (entry?.entityType === "bar" &&
      entry?.eventType === "payment" &&
      String(entry?.method || "").toLowerCase() === "voucher")
  );
}

function persistLocalActivityEntries(localEntries) {
  if (localEntries.length) {
    localStorage.setItem(activityLogStorageKey, JSON.stringify(localEntries));
  } else {
    localStorage.removeItem(activityLogStorageKey);
  }
}

function localDateBoundary(dateValue, dayOffset = 0) {
  const match = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day + dayOffset);
  if (
    !Number.isFinite(date.getTime()) ||
    (dayOffset === 0 &&
      (date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day))
  ) {
    return null;
  }
  return date;
}

function matchesLogClearRange(entry, startInclusive, endExclusive) {
  const timestamp = new Date(entry?.timestamp).getTime();
  return (
    isPurgeableActivityLogEntry(entry) &&
    Number.isFinite(timestamp) &&
    timestamp >= startInclusive.getTime() &&
    timestamp < endExclusive.getTime()
  );
}

function matchesServerLogPurge(entry, range) {
  if (!isPurgeableActivityLogEntry(entry)) return false;
  const timestamp = new Date(entry?.timestamp).getTime();
  const start = range?.startInclusive
    ? new Date(range.startInclusive).getTime()
    : Number.NEGATIVE_INFINITY;
  const end = new Date(range?.endExclusive || "").getTime();
  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(end) &&
    timestamp >= start &&
    timestamp < end
  );
}

async function clearActivityLogScope(options) {
  const { scope, confirmationText, title, message, successMessage, button } =
    options;
  const confirmation = await window.appDialog.prompt(message, {
    title,
    confirmLabel: "Continuă",
    inputLabel: `Scrie ${confirmationText}`,
    danger: true,
  });
  if (confirmation !== confirmationText) return;

  button.disabled = true;
  try {
    const response = await fetch("/api/clear-activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmation, scope }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || "Nu am putut șterge jurnalul de activitate",
      );
    }
    const localEntries = JSON.parse(
      localStorage.getItem(activityLogStorageKey) || "[]",
    );
    const remainingLocalEntries = localEntries.filter(
      (entry) => !isPurgeableActivityLogEntry(entry),
    );
    persistLocalActivityEntries(remainingLocalEntries);
    await loadLog();
    await window.appDialog.alert(successMessage);
  } catch (error) {
    await window.appDialog.alert(
      error.message || "Nu am putut șterge jurnalul de activitate",
      {
        title: "Eroare",
        danger: true,
      },
    );
  } finally {
    button.disabled = false;
  }
}

function clearActivityLog() {
  return clearActivityLogScope({
    scope: "all",
    confirmationText: "STERGE LOG",
    title: "Ștergere jurnal",
    message:
      "Se șterg definitiv din jurnal și din backupurile aplicației toate intrările despre rezervări/clienți și vânzările de bar plătite cu voucher. Vânzările de bar cu numerar sau card rămân. Scrie exact STERGE LOG pentru confirmare.",
    successMessage:
      "Jurnalul rezervărilor și vânzările cu voucher au fost șterse din aplicație și din backupurile administrate. Vânzările de bar cu numerar sau card au rămas.",
    button: clearActivityLogButton,
  });
}

async function clearActivityLogRange() {
  const fromDate = clearLogFromDateInput.value;
  const toDate = clearLogToDateInput.value;
  const startInclusive = localDateBoundary(fromDate);
  const endInclusive = localDateBoundary(toDate);
  const endExclusive = localDateBoundary(toDate, 1);

  if (!startInclusive || !endInclusive || !endExclusive) {
    await window.appDialog.alert("Alege data de început și data de sfârșit.", {
      title: "Interval incomplet",
    });
    return;
  }
  if (startInclusive.getTime() > endInclusive.getTime()) {
    await window.appDialog.alert(
      "Data de început trebuie să fie înaintea datei de sfârșit.",
      { title: "Interval invalid" },
    );
    return;
  }

  const confirmed = await window.appDialog.confirm(
    `Se vor șterge definitiv, inclusiv din backupurile aplicației, intrările despre rezervări/clienți și vânzările de bar cu voucher dintre ${dateLabel(fromDate)} și ${dateLabel(toDate)}, inclusiv. Vânzările de bar cu numerar sau card rămân.`,
    {
      title: "Ștergere interval jurnal",
      confirmLabel: "Șterge intervalul",
      danger: true,
    },
  );
  if (!confirmed) return;

  clearActivityLogRangeButton.disabled = true;
  try {
    const response = await fetch("/api/clear-activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: "STERGE INTERVAL",
        scope: "range",
        startInclusive: startInclusive.toISOString(),
        endExclusive: endExclusive.toISOString(),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(
        result.error || "Nu am putut șterge intervalul din jurnal",
      );
    }

    const localEntries = JSON.parse(
      localStorage.getItem(activityLogStorageKey) || "[]",
    );
    const remainingLocalEntries = localEntries.filter(
      (entry) => !matchesLogClearRange(entry, startInclusive, endExclusive),
    );
    persistLocalActivityEntries(remainingLocalEntries);
    await loadLog();
    await window.appDialog.alert(
      `${result.deleted || 0} intrări despre rezervări sau plăți de bar cu voucher au fost șterse din interval și din backupurile aplicației. Vânzările cu numerar sau card au rămas.`,
    );
  } catch (error) {
    await window.appDialog.alert(
      error.message || "Nu am putut șterge intervalul din jurnal",
      {
        title: "Eroare",
        danger: true,
      },
    );
  } finally {
    clearActivityLogRangeButton.disabled = false;
  }
}

searchInput.addEventListener("input", renderLog);
eventFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (dailyTotalsOnly && button.dataset.eventFilter !== "payment") {
      dailyTotalsOnly = false;
      dailyTotalsFilterButton.setAttribute("aria-pressed", "false");
    }
    setEventFilter(button.dataset.eventFilter);
    renderLog();
  });
});
dailyTotalsFilterButton.addEventListener("click", () => {
  dailyTotalsOnly = !dailyTotalsOnly;
  if (dailyTotalsOnly) setEventFilter("payment");
  dailyTotalsFilterButton.setAttribute("aria-pressed", String(dailyTotalsOnly));
  renderLog();
});
refreshButton.addEventListener("click", loadLog);
loadMoreLogButton.addEventListener("click", loadMoreLog);
exportDatabaseButton.addEventListener("click", exportDatabase);
clearActivityLogButton.addEventListener("click", clearActivityLog);
clearActivityLogRangeButton.addEventListener("click", clearActivityLogRange);
logFeed.addEventListener("click", (event) => {
  const button = event.target.closest(".client-details-toggle");
  if (!button) return;
  const details = button
    .closest(".client-created-details-control")
    ?.querySelector(".client-created-details");
  if (!details) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  button.textContent = expanded ? "Vezi date client" : "Ascunde date client";
  details.hidden = expanded;
});
loadLog();
