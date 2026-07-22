const activityLogStorageKey = "marinaParkActivityLog";
const logFeed = document.querySelector("#logFeed");
const summaryGrid = document.querySelector("#summaryGrid");
const searchInput = document.querySelector("#logSearch");
const dailyTotalsFilterButton = document.querySelector("#dailyTotalsFilter");
const eventFilterButtons = [...document.querySelectorAll("[data-event-filter]")];
const refreshButton = document.querySelector("#refreshLog");
const exportDatabaseButton = document.querySelector("#exportDatabase");
const clearActivityLogButton = document.querySelector("#clearActivityLog");
const localActivityAccess = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);

if (!localActivityAccess) {
  exportDatabaseButton.hidden = true;
  clearActivityLogButton.hidden = true;
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
    year: "numeric"
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
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return text;
  return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
}

function displayDatesInText(value) {
  return String(value ?? "").replace(
    /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{4})\b/g,
    (date) => displayDateValue(date)
  );
}

function timeLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "--:--";
  return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function exactTimeLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "--";
  return `${displayDateValue(localDateKey(timestamp))}, ${date.toLocaleTimeString("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })}`;
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
    JSON.stringify(entry.data || {})
  ]
    .join(" ")
    .toLowerCase();
}

function filteredEntries() {
  const query = searchInput.value.trim().toLowerCase();
  return entries.filter((entry) => {
    const matchesEvent =
      eventFilter === "all" ||
      (eventFilter === "suspicious" ? suspiciousReasons(entry).length > 0 : entry.eventType === eventFilter);
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
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
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
    entry.data?.totalPrice
  );
  if (structuredPrice !== null) return structuredPrice;

  const messageMatch = String(entry.message || "").match(
    /Pre(?:ț|t) ini(?:ț|t)ial(?: client| sta(?:ț|t)ionare)?:\s*([\d\s.,]+)/i
  );
  return messageMatch ? loggedMoney(messageMatch[1]) : null;
}

function paymentComparison(entry) {
  if (entry.eventType !== "payment" || entry.entityType === "bar") return null;
  const initialPrice = paymentInitialPrice(entry);
  const paidAmount = finiteMoney(entry.data?.actualPaidAmount, entry.data?.amount, entry.amount);
  if (initialPrice === null || paidAmount === null || initialPrice < 0) return null;
  return {
    initialPrice,
    paidAmount,
    difference: Math.round((initialPrice - paidAmount) * 100) / 100,
    isUnderpaid: paidAmount + 0.001 < initialPrice
  };
}

function priceReduction(entry) {
  if (entry.eventType !== "update") return null;
  const previousPrice = finiteMoney(entry.data?.previousPrice, entry.data?.previous?.price, entry.data?.previous?.totalPrice);
  const newPrice = finiteMoney(entry.data?.newPrice, entry.data?.current?.price, entry.data?.current?.totalPrice);
  if (previousPrice === null || newPrice === null || newPrice + 0.001 >= previousPrice) return null;
  return { previousPrice, newPrice, difference: Math.round((previousPrice - newPrice) * 100) / 100 };
}

function suspiciousReasons(entry) {
  const reasons = [];
  const comparison = paymentComparison(entry);
  const reduction = priceReduction(entry);
  if (comparison?.isUnderpaid) reasons.push(`Plătit cu ${formatCurrency(comparison.difference)} mai puțin decât prețul inițial.`);
  if (reduction) reasons.push(`Preț redus cu ${formatCurrency(reduction.difference)}.`);
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
  if (explicitChanges.length) return explicitChanges.map(String).filter((change) => change && !/^rest\s*:/i.test(change));

  const changes = [];
  const pairs = [
    ["Început", entry.data?.previousStart, entry.data?.newStart],
    ["Final", entry.data?.previousEnd, entry.data?.newEnd],
    ["Preț", entry.data?.previousPrice, entry.data?.newPrice]
  ];
  pairs.forEach(([label, previous, current]) => {
    if (previous === undefined || current === undefined || String(previous) === String(current)) return;
    const moneyValue = ["Preț", "Rest"].includes(label);
    changes.push(`${label}: ${moneyValue ? formatCurrency(previous) : previous} -> ${moneyValue ? formatCurrency(current) : current}`);
  });
  return changes;
}

function changeDetails(entry) {
  if (!["update", "payment"].includes(entry.eventType)) return "";
  const changes = readableChanges(entry);
  if (!changes.length) return "";
  const rows = changes.map((change) => {
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
  }).join("");
  return `<div class="change-details"><strong>Ce s-a schimbat</strong>${rows}</div>`;
}

function eventLabel(entry) {
  const labels = {
    payment: "Plată înregistrată",
    update: "Modificat",
    create: "Adăugat",
    delete: "Șters",
    open: "Deschis",
    settings: "Setări schimbate"
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
    settings: "⚙"
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
    facility: "Facilitate"
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
  const content = [changeDetails(entry), paymentComparisonView(entry), priceChangeAlert(entry)].filter(Boolean).join("");
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
    entry.data?.prepaidNights
  );
}

function entryActionSummary(entry) {
  const amount = Number(entry.amount || 0);
  if (entry.eventType === "payment" && amount > 0) {
    const person = entry.data?.client || entry.data?.owner || entry.entityLabel || entityLabel(entry);
    const method = entry.method ? ` prin ${entry.method}` : "";
    return `<p class="action-summary"><span class="person-name">${escapeHtml(person)}</span> a plătit <strong>${formatCurrency(amount)}</strong>${escapeHtml(method)}.</p>`;
  }

  const deductedNights = stationingDeductedNights(entry);
  if (deductedNights !== null) {
    const count = Math.max(0, Math.round(deductedNights));
    return `<p class="action-summary"><strong>${count}</strong> ${count === 1 ? "noapte dedusă" : "nopți deduse"}.</p>`;
  }

  return "";
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
    { card: 0, numerar: 0, voucher: 0 }
  );
}

function paymentMethodTotalText(payments) {
  const totals = paymentMethodTotals(payments);
  return `Card: ${formatCurrency(totals.card)} · Numerar: ${formatCurrency(totals.numerar)} · Voucher: ${formatCurrency(totals.voucher)}`;
}

function logCard(entry) {
  const amount = Number(entry.amount || 0);
  const subject = entry.entityLabel || entityLabel(entry);
  return `
    <article class="log-card is-${escapeHtml(entry.eventType)}${suspiciousReasons(entry).length ? " is-suspicious" : ""}">
      <header class="log-row-heading">
        <time>${escapeHtml(timeLabel(entry.timestamp))}</time>
        <span class="event-marker" aria-hidden="true">${eventIcon(entry)}</span>
        <div class="log-row-main">
          <span class="event-name">${escapeHtml(eventLabel(entry))}</span>
          <h3 class="person-name">${escapeHtml(subject)}</h3>
          <span class="entity-name">${escapeHtml(entityLabel(entry))}</span>
        </div>
        ${
          amount > 0 || entry.method
            ? `<div class="log-row-value">${amount > 0 ? `<strong>${formatCurrency(amount)}</strong>` : ""}${entry.method ? `<span>${escapeHtml(entry.method)}</span>` : ""}</div>`
            : ""
        }
      </header>
      ${entryActionSummary(entry)}
      ${entryVisualDetails(entry)}
      ${suspiciousAlert(entry)}
    </article>
  `;
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

function isClientSessionStart(entry) {
  return entry.eventType === "open" && ["client", "stationing"].includes(entry.entityType) && sessionKey(entry);
}

function isClientSessionAction(entry) {
  return ["client", "stationing"].includes(entry.entityType) && entry.eventType !== "open" && sessionKey(entry);
}

function organizeDayEntries(dayEntries) {
  const chronologicalEntries = [...dayEntries].sort((first, second) => activityTimestamp(first) - activityTimestamp(second));
  const openSessions = new Map();
  const sections = [];

  chronologicalEntries.forEach((entry) => {
    const key = sessionKey(entry);
    if (isClientSessionStart(entry)) {
      const section = {
        type: "session",
        key: entry.id,
        openEntry: entry,
        actions: []
      };
      openSessions.set(key, section);
      sections.push(section);
      return;
    }

    const openSection = isClientSessionAction(entry) ? openSessions.get(key) : null;
    if (openSection) {
      openSection.actions.push(entry);
      if (entry.eventType === "delete") openSessions.delete(key);
    }
  });

  const groupedSessions = sections.filter((section) => section.actions.length > 0);
  const groupedIds = new Set();
  groupedSessions.forEach((section) => {
    groupedIds.add(section.openEntry.id);
    section.actions.forEach((entry) => groupedIds.add(entry.id));
  });

  dayEntries.forEach((entry) => {
    if (!groupedIds.has(entry.id)) groupedSessions.push({ type: "entry", key: entry.id, entry });
  });

  return groupedSessions.sort((first, second) => sectionTimestamp(second) - sectionTimestamp(first));
}

function sectionTimestamp(section) {
  if (section.type === "entry") return activityTimestamp(section.entry);
  const lastAction = section.actions[section.actions.length - 1];
  return activityTimestamp(lastAction || section.openEntry);
}

function sessionActionRow(entry) {
  const amount = Number(entry.amount || 0);

  return `
    <div class="session-action is-${escapeHtml(entry.eventType)}${suspiciousReasons(entry).length ? " is-suspicious" : ""}">
      <div class="session-action-row">
        <time>${escapeHtml(timeLabel(entry.timestamp))}</time>
        <span class="event-marker" aria-hidden="true">${eventIcon(entry)}</span>
        <span class="event-name">${escapeHtml(eventLabel(entry))}</span>
        ${amount > 0 || entry.method ? `<div class="session-action-value">${amount > 0 ? `<strong>${formatCurrency(amount)}</strong>` : ""}${entry.method ? `<span>${escapeHtml(entry.method)}</span>` : ""}</div>` : ""}
      </div>
      ${entryVisualDetails(entry)}
      ${suspiciousAlert(entry)}
    </div>
  `;
}

function clientSessionSection(section) {
  const actionCount = section.actions.length;
  const actionText = actionCount === 1 ? "1 acțiune în fișă" : `${actionCount} acțiuni în fișă`;
  const actionList = actionCount
    ? section.actions.map(sessionActionRow).join("")
    : `<p class="session-empty">Fișa a fost deschisă, fără alte modificări înregistrate după deschidere.</p>`;

  return `
    <article class="log-session">
      <header class="session-heading">
        <h3 class="person-name">${escapeHtml(section.openEntry.entityLabel || entityLabel(section.openEntry))}</h3>
        <p>Fișă deschisă la ${escapeHtml(timeLabel(section.openEntry.timestamp))} · ${escapeHtml(actionText)}</p>
      </header>
      <div class="session-actions">
        ${actionList}
      </div>
    </article>
  `;
}

function dailyClientKey(entry) {
  const personId = entry.data?.personId || entry.data?.editSession?.personId;
  if (personId) return `person:${personId}`;
  if (entry.entityKey) return `${entry.entityType || "entry"}:${entry.entityKey}`;
  return `${entry.entityType || "entry"}:${entry.entityLabel || entityLabel(entry)}`;
}

function dailyClientName(entry) {
  return entry.data?.client || entry.data?.owner || entry.entityLabel || entityLabel(entry);
}

function readableActionText(entry) {
  if (entry.eventType === "payment") {
    const comparison = paymentComparison(entry);
    const paidAmount = comparison?.paidAmount ?? finiteMoney(entry.data?.actualPaidAmount, entry.data?.amount, entry.amount) ?? 0;
    const method = entry.method ? ` prin ${entry.method}` : "";
    const initialPriceText = comparison ? ` Preț inițial: ${formatCurrency(comparison.initialPrice)}.` : "";
    return `A plătit ${formatCurrency(paidAmount)}${method}.${initialPriceText}`;
  }

  if (entry.eventType === "delete") {
    const deletedPrice = entry.entityType === "client"
      ? finiteMoney(entry.data?.stay?.price, entry.data?.record?.price, entry.data?.price)
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
    if (!text || facts.some((fact) => fact.label === label && fact.value === text)) return;
    facts.push({ label, value: text });
  };

  if (entry.entityType === "client") {
    addFact("Unitate", data.unit || record.id);
    addFact("Perioadă", record.dates);
  }
  if (entry.entityType === "stationing") addFact("Rulotă", data.caravan || record.caravan);

  const linkedCount = Array.isArray(data.linkedReservations) ? data.linkedReservations.length : 0;
  if (linkedCount) addFact("Rezervări", `${linkedCount} legate`);
  if (data.repeatPayment) addFact("Tip plată", "Plată suplimentară");
  if (data.zeroPriceMarkPaid) addFact("Stare", "Marcat achitat cu voucher");
  if (data.receiptBarMode === "separate") addFact("Bon bar", "Separat de cazare");
  if (data.receiptBarMode === "combined") addFact("Bon bar", "Împreună cu cazarea");
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
  const client = entry.data?.current || entry.data?.stay || entry.data?.record || {};
  const phone = String(client.phone || "").trim() || "Nespecificat";
  const car = String(client.car || "").trim() || "Nespecificat";
  const peopleCount = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return "Nespecificat";
    const count = Number(value);
    return Number.isFinite(count) ? String(Math.max(0, Math.round(count))) : "Nespecificat";
  };
  const adults = peopleCount(client.adults);
  const children = peopleCount(client.children);
  const facilities = Array.isArray(client.facilities) ? client.facilities : [];
  const facilityAnswer = (key, name) => {
    const facility = facilities.find((item) => item?.key === key || String(item?.name || "").toLowerCase() === name);
    if (!facility) return "Nu";
    const nights = Number(facility.nights);
    if (!Number.isFinite(nights) || nights <= 0) return "Da";
    const roundedNights = Math.round(nights);
    return `Da (${roundedNights} ${roundedNights === 1 ? "noapte" : "nopți"})`;
  };
  const electricity = facilityAnswer("electricitate", "electricitate");
  const extraBed = facilityAnswer("pat-suplimentar", "pat suplimentar");
  const hasPrice = client.price !== undefined && client.price !== null && String(client.price).trim() !== "";
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
  dayEntries.forEach((entry) => {
    const key = dailyClientKey(entry);
    if (!clients.has(key)) clients.set(key, { name: dailyClientName(entry), entityType: entry.entityType, entries: [] });
    clients.get(key).entries.push(entry);
  });

  const groups = [...clients.values()]
    .map((client) => ({
      ...client,
      entries: client.entries.sort((first, second) => activityTimestamp(first) - activityTimestamp(second))
    }))
    .sort((first, second) => activityTimestamp(second.entries[second.entries.length - 1]) - activityTimestamp(first.entries[first.entries.length - 1]));

  return `
    <div class="client-day-list">
      ${groups.map((client) => `
        <article class="client-day-card">
          <header class="client-day-heading">
            <h3 class="person-name">${escapeHtml(client.name)}</h3>
            <span>${escapeHtml(entityLabel({ entityType: client.entityType }))} · ${client.entries.length} ${client.entries.length === 1 ? "acțiune" : "acțiuni"}</span>
          </header>
          <div class="client-day-actions">${client.entries.map(renderClientDayAction).join("")}</div>
        </article>
      `).join("")}
    </div>
  `;
}

function dayCountLabel(count) {
  if (dailyTotalsOnly || eventFilter === "payment") return count === 1 ? "plată" : "plăți";
  if (eventFilter === "update") return count === 1 ? "editare" : "editări";
  if (eventFilter === "delete") return count === 1 ? "ștergere" : "ștergeri";
  if (eventFilter === "suspicious") return count === 1 ? "de verificat" : "de verificat";
  return "evenimente";
}

function dailyPaymentSummary(dayEntries, showDetails = false) {
  const payments = dayEntries.filter((entry) => entry.eventType === "payment" && Number(entry.amount || 0) > 0);
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

  const total = payments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
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
                  const name = entry.data?.client || entry.data?.owner || entry.entityLabel || "Client";
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
  const summaryEntries = currentEntries.filter((entry) => entry.eventType !== "open");
  const todayKey = localDateKey(new Date().toISOString());
  const todayPayments = summaryEntries.filter((entry) => localDateKey(entry.timestamp) === todayKey && entry.eventType === "payment");
  const totalToday = todayPayments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayMethodText = paymentMethodTotalText(todayPayments);
  const updates = summaryEntries.filter((entry) => entry.eventType === "update").length;
  const suspicious = summaryEntries.filter((entry) => suspiciousReasons(entry).length > 0).length;

  summaryGrid.innerHTML = `
    <p class="summary-line">
      <span><strong>${summaryEntries.length}</strong> înregistrări</span>
      <span><strong>${todayPayments.length}</strong> plăți azi</span>
      <span><strong>${formatCurrency(totalToday)}</strong> încasat azi</span>
      <span>${escapeHtml(todayMethodText)}</span>
      <span><strong>${updates}</strong> modificări</span>
      ${suspicious ? `<span class="summary-warning"><strong>${suspicious}</strong> de verificat</span>` : ""}
    </p>
  `;
}

function renderLog() {
  const currentEntries = filteredEntries();
  renderSummary(currentEntries);
  const visibleEntries = dailyTotalsOnly
    ? currentEntries.filter((entry) => entry.eventType === "payment" && Number(entry.amount || 0) > 0)
    : currentEntries.filter((entry) => entry.eventType !== "open");

  if (!visibleEntries.length) {
    logFeed.innerHTML = `<p class="empty-state">${dailyTotalsOnly ? "Nu există plăți pentru filtrul curent." : "Nu există activitate pentru filtrul curent."}</p>`;
    return;
  }

  const groups = visibleEntries.reduce((map, entry) => {
    const key = localDateKey(entry.timestamp);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
    return map;
  }, new Map());

  logFeed.innerHTML = [...groups.entries()]
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
      `
    )
    .join("");
}

async function loadLog() {
  refreshButton.disabled = true;
  try {
    const response = await fetch("/api/log?limit=1500", { cache: "no-store" });
    const result = await response.json();
    const serverEntries = response.ok && result.ok && Array.isArray(result.entries) ? result.entries : [];
    const localEntries = JSON.parse(localStorage.getItem(activityLogStorageKey) || "[]");
    const byId = new Map();
    [...serverEntries, ...localEntries].forEach((entry) => {
      if (entry?.id) byId.set(entry.id, entry);
    });
    entries = [...byId.values()].sort((first, second) => String(second.timestamp || "").localeCompare(String(first.timestamp || "")));
  } catch {
    entries = JSON.parse(localStorage.getItem(activityLogStorageKey) || "[]");
  } finally {
    refreshButton.disabled = false;
    renderLog();
  }
}

function exportDatabase() {
  const link = document.createElement("a");
  link.href = `/api/export-database?t=${Date.now()}`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function clearActivityLog() {
  const confirmation = await window.appDialog.prompt(
    "Această acțiune șterge doar jurnalul de activitate. Clienții și articolele de bar rămân în baza de date. Scrie exact STERGE LOG pentru confirmare.",
    {
      title: "Ștergere jurnal",
      confirmLabel: "Continuă",
      inputLabel: "Scrie STERGE LOG",
      danger: true
    }
  );
  if (confirmation !== "STERGE LOG") return;

  clearActivityLogButton.disabled = true;
  try {
    const response = await fetch("/api/clear-activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: confirmation })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Nu am putut șterge jurnalul de activitate");
    }
    localStorage.removeItem(activityLogStorageKey);
    entries = [];
    renderLog();
    await window.appDialog.alert("Jurnalul de activitate a fost șters. Clienții și articolele de bar au rămas neschimbate.");
  } catch (error) {
    await window.appDialog.alert(error.message || "Nu am putut șterge jurnalul de activitate", {
      title: "Eroare",
      danger: true
    });
  } finally {
    clearActivityLogButton.disabled = false;
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
exportDatabaseButton.addEventListener("click", exportDatabase);
clearActivityLogButton.addEventListener("click", clearActivityLog);
logFeed.addEventListener("click", (event) => {
  const button = event.target.closest(".client-details-toggle");
  if (!button) return;
  const details = button.closest(".client-created-details-control")?.querySelector(".client-created-details");
  if (!details) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  button.textContent = expanded ? "Vezi date client" : "Ascunde date client";
  details.hidden = expanded;
});
loadLog();
