const activityLogStorageKey = "marinaParkActivityLog";
const logFeed = document.querySelector("#logFeed");
const summaryGrid = document.querySelector("#summaryGrid");
const searchInput = document.querySelector("#logSearch");
const dailyTotalsFilterButton = document.querySelector("#dailyTotalsFilter");
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
  return date.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
  if (!query) return entries;
  return entries.filter((entry) => entrySearchText(entry).includes(query));
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
    settings: "Setări"
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
            <span>${escapeHtml(exactTimeLabel(entry.timestamp))}</span>
            <span class="chip">${escapeHtml(eventLabel(entry))}</span>
            <span class="chip">${escapeHtml(entityLabel(entry))}</span>
            ${method}
            ${amountChip}
          </div>
        </div>
      </header>
      <p>${escapeHtml(entry.message)}</p>
      ${priceChangeAlert(entry)}
    </article>
  `;
}

function dailyPaymentSummary(dayEntries) {
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
      <ul class="daily-payments">
        ${payments
          .map((entry) => {
            const name = entry.data?.client || entry.data?.owner || entry.entityLabel || "Client";
            const method = entry.method ? `, ${entry.method}` : "";
            return `<li>${escapeHtml(timeLabel(entry.timestamp))} · <span class="person-name">${escapeHtml(name)}</span> - ${formatCurrency(entry.amount)}${escapeHtml(method)}</li>`;
          })
          .join("")}
      </ul>
    </section>
  `;
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
            <span>${dayEntries.length} ${dailyTotalsOnly ? (dayEntries.length === 1 ? "plată" : "plăți") : "evenimente"}</span>
          </div>
          ${dailyTotalsOnly ? "" : `<div class="log-list">${dayEntries.map(logCard).join("")}</div>`}
          ${dailyPaymentSummary(dayEntries)}
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
  const confirmation = window.prompt(
    "Această acțiune șterge doar jurnalul de activitate. Clienții și articolele de bar rămân în baza de date. Scrie exact STERGE LOG pentru confirmare."
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
    window.alert("Jurnalul de activitate a fost șters. Clienții și articolele de bar au rămas neschimbate.");
  } catch (error) {
    window.alert(error.message || "Nu am putut șterge jurnalul de activitate");
  } finally {
    clearActivityLogButton.disabled = false;
  }
}

searchInput.addEventListener("input", renderLog);
dailyTotalsFilterButton.addEventListener("click", () => {
  dailyTotalsOnly = !dailyTotalsOnly;
  dailyTotalsFilterButton.setAttribute("aria-pressed", String(dailyTotalsOnly));
  renderLog();
});
refreshButton.addEventListener("click", loadLog);
exportDatabaseButton.addEventListener("click", exportDatabase);
clearActivityLogButton.addEventListener("click", clearActivityLog);
loadLog();
