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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function timeLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "--:--";
  return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

function exactTimeLabel(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return "--";
  return date.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
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
    const matchesEvent = eventFilter === "all" || entry.eventType === eventFilter;
    const matchesSearch = !query || entrySearchText(entry).includes(query);
    return matchesEvent && matchesSearch;
  });
}

function eventLabel(entry) {
  const labels = {
    payment: "Plată",
    update: "Modificare",
    create: "Adăugare",
    delete: "Ștergere",
    open: "Deschis",
    settings: "Setări"
  };
  return labels[entry.eventType] || "Eveniment";
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
  const method = entry.method ? `<span class="chip">${escapeHtml(entry.method)}</span>` : "";
  const amountChip = amount > 0 ? `<span class="chip">${formatCurrency(amount)}</span>` : "";
  const entityNameClass = entry.entityType === "client" || entry.entityType === "stationing" ? " class=\"person-name\"" : "";
  return `
    <article class="log-card is-${escapeHtml(entry.eventType)}">
      <header>
        <div>
          <h3${entityNameClass}>${escapeHtml(entry.entityLabel || entityLabel(entry))}</h3>
          <div class="log-meta">
            <span class="chip">${escapeHtml(eventLabel(entry))}</span>
            <span class="chip">${escapeHtml(entityLabel(entry))}</span>
            ${method}
            ${amountChip}
            <time>${escapeHtml(timeLabel(entry.timestamp))}</time>
          </div>
        </div>
      </header>
      <p>${escapeHtml(entry.message)}</p>
      ${priceChangeAlert(entry)}
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
  const amountText = amount > 0 ? `<span>${formatCurrency(amount)}</span>` : "";
  const methodText = entry.method ? `<span>${escapeHtml(entry.method)}</span>` : "";

  return `
    <div class="session-action-row is-${escapeHtml(entry.eventType)}">
      <time>${escapeHtml(timeLabel(entry.timestamp))}</time>
      <span>${escapeHtml(eventLabel(entry))}</span>
      <p>${escapeHtml(entry.message)}</p>
      ${methodText}
      ${amountText}
    </div>
    ${priceChangeAlert(entry)}
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
        <div>
          <h3 class="person-name">${escapeHtml(section.openEntry.entityLabel || entityLabel(section.openEntry))}</h3>
          <div class="log-meta">
            <time>${escapeHtml(timeLabel(section.openEntry.timestamp))}</time>
            <span class="chip">Fișă deschisă</span>
            <span class="chip">${escapeHtml(entityLabel(section.openEntry))}</span>
            <span class="chip">${escapeHtml(actionText)}</span>
          </div>
        </div>
      </header>
      <div class="session-actions">
        ${actionList}
      </div>
    </article>
  `;
}

function renderDayLog(dayEntries) {
  return organizeDayEntries(dayEntries)
    .map((section) => (section.type === "session" ? clientSessionSection(section) : logCard(section.entry)))
    .join("");
}

function dayCountLabel(count) {
  if (dailyTotalsOnly || eventFilter === "payment") return count === 1 ? "plată" : "plăți";
  if (eventFilter === "update") return count === 1 ? "editare" : "editări";
  if (eventFilter === "delete") return count === 1 ? "ștergere" : "ștergeri";
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
  const todayKey = localDateKey(new Date().toISOString());
  const todayPayments = currentEntries.filter((entry) => localDateKey(entry.timestamp) === todayKey && entry.eventType === "payment");
  const totalToday = todayPayments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const todayMethodText = paymentMethodTotalText(todayPayments);
  const updates = currentEntries.filter((entry) => entry.eventType === "update").length;
  const deletes = currentEntries.filter((entry) => entry.eventType === "delete").length;

  summaryGrid.innerHTML = [
    ["Evenimente", currentEntries.length, "în filtrul curent"],
    ["Plăți azi", formatCurrency(totalToday), `${todayPayments.length} încasări · ${todayMethodText}`],
    ["Modificări", updates, "editări și mutări"],
    ["Ștergeri", deletes, "client/unitate/staționare"]
  ]
    .map(
      ([label, value, detail]) => `
        <article class="summary-card">
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(detail)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderLog() {
  const currentEntries = filteredEntries();
  renderSummary(currentEntries);
  const visibleEntries = dailyTotalsOnly
    ? currentEntries.filter((entry) => entry.eventType === "payment" && Number(entry.amount || 0) > 0)
    : currentEntries;

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
loadLog();
