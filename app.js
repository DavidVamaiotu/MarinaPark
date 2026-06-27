const stays = [
  {
    id: "D-01",
    group: "room",
    kind: "Cameră dublă",
    guest: "Mara Ionescu",
    phone: "+40 722 118 240",
    party: 2,
    status: "occupied",
    start: "2026-05-03",
    end: "2026-05-07",
    dates: "3-7 mai",
    price: 720,
    balance: 0,
    note: "Vedere spre parc, achitat"
  },
  {
    id: "D-02",
    group: "room",
    kind: "Cameră dublă",
    guest: "Alex Morgan",
    phone: "+44 7700 900 412",
    party: 2,
    status: "arriving",
    start: "2026-05-04",
    end: "2026-05-05",
    dates: "4-5 mai",
    price: 650,
    balance: 450,
    note: "Apel în engleză, check-in târziu"
  },
  {
    id: "Q-01",
    group: "room",
    kind: "Cameră cvadruplă",
    guest: "Familia Nițu",
    phone: "+40 744 590 311",
    party: 4,
    status: "occupied",
    start: "2026-05-04",
    end: "2026-05-08",
    dates: "4-8 mai",
    price: 960,
    balance: 0,
    note: "Lenjerie curată"
  },
  {
    id: "B-03",
    group: "room",
    kind: "Bungalou",
    guest: "Giulia Conti",
    phone: "+39 333 201 781",
    party: 2,
    status: "maintenance",
    start: "2026-05-05",
    end: "2026-05-09",
    dates: "5-9 mai",
    price: 850,
    balance: 300,
    note: "Solicitare ventilator"
  },
  {
    id: "T-08",
    group: "camping",
    kind: "Campare cort",
    guest: "Disponibil",
    phone: "",
    party: 0,
    status: "available",
    start: null,
    end: null,
    dates: "Liber",
    price: 0,
    balance: 0,
    note: "Lângă terasa umbrită"
  },
  {
    id: "T-14",
    group: "camping",
    kind: "Campare cort",
    guest: "Steffen Major",
    phone: "+49 171 884 530",
    party: 2,
    status: "occupied",
    start: "2026-05-02",
    end: "2026-05-04",
    dates: "2-4 mai",
    price: 160,
    balance: 0,
    note: "Cutie de valori"
  },
  {
    id: "RV-04",
    group: "camping",
    kind: "Campare rulotă",
    guest: "Popa Ioan",
    phone: "+40 730 220 810",
    party: 3,
    status: "occupied",
    start: "2026-05-01",
    end: "2026-05-10",
    dates: "1-10 mai",
    price: 900,
    balance: 150,
    note: "Racord electric"
  },
  {
    id: "RV-07",
    group: "camping",
    kind: "Rulotă pentru toate sezoanele",
    guest: "Henrietta Fleckhammer",
    phone: "+49 152 840 611",
    party: 2,
    status: "arriving",
    start: "2026-05-04",
    end: "2026-05-11",
    dates: "4-11 mai",
    price: 700,
    balance: 0,
    note: "Loc liniștit"
  },
  {
    id: "D-04",
    group: "room",
    kind: "Camera dubla",
    guest: "Radu Matei",
    phone: "+40 731 420 118",
    party: 2,
    status: "arriving",
    start: "2026-06-12",
    end: "2026-06-16",
    dates: "12-16 iun.",
    price: 780,
    balance: 180,
    note: "Rezervare iunie"
  },
  {
    id: "T-21",
    group: "camping",
    kind: "Campare cort",
    guest: "Familia Rusu",
    phone: "+40 755 610 044",
    party: 3,
    status: "arriving",
    start: "2026-06-18",
    end: "2026-06-22",
    dates: "18-22 iun.",
    price: 360,
    balance: 0,
    note: "Aproape de dusuri"
  }
];

const staysStorageKey = "marinaParkClientStays";
const stationingStorageKey = "marinaParkStationing";
const activityLogStorageKey = "marinaParkActivityLog";
const barArticlesStorageKey = "marinaParkBarArticles";
const defaultStays = stays.map((stay) => ({ ...stay }));
const defaultStationing = [];
const defaultBarArticles = [
  { key: "bar-apa-05", name: "APA 0.5", price: 5.5, stock: 169, vatRate: 11, hasSgr: true },
  { key: "bar-pepsi", name: "PEPSI", price: 9.5, stock: 159, vatRate: 21, hasSgr: true },
  { key: "bar-bergenbier", name: "BERGENBIER", price: 7.5, stock: 72, vatRate: 21, hasSgr: true },
  { key: "bar-staropramen", name: "STAROPRAMEN", price: 8.5, stock: 24, vatRate: 21, hasSgr: true },
  { key: "bar-becks", name: "BECKS", price: 9.5, stock: 17, vatRate: 21, hasSgr: true },
  { key: "bar-stella-artois", name: "STELLA ARTOIS", price: 11.5, stock: 23, vatRate: 21, hasSgr: true },
  { key: "bar-corona", name: "CORONA", price: 14.5, stock: 22, vatRate: 21, hasSgr: true },
  { key: "bar-madri", name: "MADRI", price: 9.5, stock: 24, vatRate: 21, hasSgr: true },
  { key: "bar-cafea-espresso", name: "CAFEA ESPRESSO", price: 10, stock: 157, vatRate: 11, hasSgr: false },
  { key: "bar-vin", name: "VIN", price: 39.5, stock: 6, vatRate: 21, hasSgr: false }
];

const defaultFacilityCatalog = [
  { key: "electricitate", name: "Electricitate", group: "camping", pricePerNight: 20, active: true },
  { key: "pat-suplimentar", name: "Pat suplimentar", group: "room", pricePerNight: 15, active: true }
];

const defaultRoomUnitSeeds = [
  { id: "cvdr 1", kind: "Cameră cvadruplă" },
  { id: "cvdr 4", kind: "Cameră cvadruplă" },
  { id: "dubla 2", kind: "Cameră dublă" },
  { id: "dubla 3", kind: "Cameră dublă" },
  { id: "dubla 5", kind: "Cameră dublă" },
  { id: "dubla 6", kind: "Cameră dublă" },
  { id: "dubla 7", kind: "Cameră dublă" },
  { id: "dubla 8", kind: "Cameră dublă" },
  { id: "bungalow 9", kind: "Bungalou" },
  { id: "bungalow 10", kind: "Bungalou" },
  { id: "bungalow 11", kind: "Bungalou" },
  { id: "bungalow 12", kind: "Bungalou" },
  { id: "bungalow 14", kind: "Bungalou" },
  { id: "bungalow 15", kind: "Bungalou" },
  { id: "bungalow 16", kind: "Bungalou" },
  { id: "bungalow 17", kind: "Bungalou" },
  { id: "bungalow 18", kind: "Bungalou" },
  { id: "bungalow 19", kind: "Bungalou" },
  { id: "bungalow 20", kind: "Bungalou" },
  { id: "bungalow 21", kind: "Bungalou" }
];

let googleReviewData = {
  rating: 4.7,
  total: 801,
  checkedAt: "4 mai 2026",
  sourceUrl: "https://www.marinapark.ro/",
  latest: [
    {
      author: "Harald Schmidt",
      text: "Super freizugiger Platz mit allem was man braucht. Einrichtungen sauber, Betreiber freundlich, was will man mehr"
    },
    {
      author: "Steffen Major",
      text: "Kann man empfehlen. Schoner Campingplatz der auch in der Hauptsaison Stellplatze frei hat. Sanitaranlagen waren sauber und in Ordnung."
    },
    {
      author: "Henrietta Fleckhammer",
      text: "Marina Park este un loc excelent. Ai tot ce trebuie pentru o vacanta linistita. Foarte curat si placut pentru orice persoana la orice varsta."
    }
  ]
};

let activeMode = "room";
let activePage = "calendar";
let searchTerm = "";
let sidebarCollapsed = localStorage.getItem("marinaParkSidebarCollapsed") === "true";
let stationing = [];
let barArticles = [];
let barCart = [];
let searchDebounceTimer = null;
const RESERVATION_PAGE_SIZE = 50;
const TIMELINE_VIRTUAL_ROW_THRESHOLD = 70;
const TIMELINE_ROW_BASE_HEIGHT = 82;
const TIMELINE_LANE_HEIGHT = 58;
const TIMELINE_ROW_GAP = 8;
const TIMELINE_ROW_OVERSCAN = 8;
const TIMELINE_BAR_OVERSCAN_DAYS = 21;
let reservationPage = 1;
let staysByUnitIndex = new Map();
let timelineLayoutCache = new Map();
let reservationAutoLoadObserver = null;
let reservationAutoLoadQueued = false;
let timelineRenderState = {
  rows: [],
  rowTops: [],
  totalHeight: 0,
  startIndex: 0,
  endIndex: 0,
  startDay: 0,
  endDay: 0,
  virtualized: false
};
let timelineRenderFrame = null;
let pageSwitchRenderFrame = null;
let timelineProgrammaticScrollFrame = null;
let suppressTimelineScrollMonthUpdate = false;
let timelineMonthNavigationLockedUntil = 0;
let timelineLastScrollLeft = 0;
const pageNames = ["calendar", "clients", "stationing", "bar", "settings", "statistics"];
const dirtyPages = new Set(pageNames);

function markPagesDirty(...pages) {
  const targets = pages.length ? pages : pageNames;
  targets.forEach((page) => dirtyPages.add(page));
}

const metricGrid = document.querySelector("#metricGrid");
const pageSections = document.querySelectorAll("[data-page-section]");
const reviewStatus = document.querySelector("#reviewStatus");
const reviewList = document.querySelector("#reviewList");
const checkGoogleReviewsButton = document.querySelector("#checkGoogleReviews");
const timelineShell = document.querySelector(".timeline-shell");
const guestTimeline = document.querySelector("#guestTimeline");
const timelineScale = document.querySelector("#timelineScale");
const guestTimelineMode = document.querySelector("#guestTimelineMode");
const modeSwitch = document.querySelector("#modeSwitch");
const monthLabel = document.querySelector("#monthLabel");
const prevMonthButton = document.querySelector("#prevMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const currentMonthButton = document.querySelector("#currentMonth");
const reservationCards = document.querySelector("#reservationCards");
const searchInput = document.querySelector("#globalSearch");
const bookingForm = document.querySelector("#bookingForm");
const bookingModal = document.querySelector("#guest-form-section");
const guestFormTitle = document.querySelector("#guestFormTitle");
const bookingSubmitLabel = document.querySelector("#bookingSubmitLabel");
const deleteBookingButton = document.querySelector("#deleteBooking");
const receiptFromBookingButton = document.querySelector("#receiptFromBooking");
const linkedReservationsSection = document.querySelector("#linkedReservationsSection");
const linkedReservationsTrack = document.querySelector("#linkedReservationsTrack");
const linkedReservationsCount = document.querySelector("#linkedReservationsCount");
const addLinkedReservationButton = document.querySelector("#addLinkedReservation");
const jumpToFormButton = document.querySelector("#jumpToForm");
const openUnitModalButton = document.querySelector("#openUnitModal");
const unitModal = document.querySelector("#unit-modal");
const unitForm = document.querySelector("#unitForm");
const closeUnitModalButton = document.querySelector("#closeUnitModal");
const settingsAddUnitButton = document.querySelector("#settingsAddUnit");
const settingsCloneUnitButton = document.querySelector("#settingsCloneUnit");
const cloneUnitModal = document.querySelector("#clone-unit-modal");
const cloneUnitForm = document.querySelector("#cloneUnitForm");
const closeCloneUnitModalButton = document.querySelector("#closeCloneUnitModal");
const cloneUnitSourceSelect = document.querySelector("#cloneUnitSource");
const cloneUnitPreview = document.querySelector("#cloneUnitPreview");
const unitList = document.querySelector("#unitList");
const settingsNewFacilityButton = document.querySelector("#settingsNewFacility");
const facilityCatalogForm = document.querySelector("#facilityCatalogForm");
const facilitySubmitLabel = document.querySelector("#facilitySubmitLabel");
const cancelFacilityEditButton = document.querySelector("#cancelFacilityEdit");
const facilityList = document.querySelector("#facilityList");
const loadSourceBookingsButton = document.querySelector("#loadSourceBookings");
const sourceModeSwitch = document.querySelector("#sourceModeSwitch");
const sourceRecordStatus = document.querySelector("#sourceRecordStatus");
const sourceRecordRows = document.querySelector("#sourceRecordRows");
const closeBooking = document.querySelector("#closeBooking");
const appShell = document.querySelector("#appShell");
const sidebarToggle = document.querySelector("#sidebarToggle");
const timelineContextMenu = document.querySelector("#timelineContextMenu");
const toast = document.querySelector("#toast");
const settingsForm = document.querySelector("#settingsForm");
const receiptDirectoryInput = document.querySelector("#receiptDirectory");
const pickReceiptDirectoryButton = document.querySelector("#pickReceiptDirectory");
const receiptVatInput = document.querySelector("#receiptVat");
const cardPaymentCodeInput = document.querySelector("#cardPaymentCode");
const cashPaymentCodeInput = document.querySelector("#cashPaymentCode");
const receiptModal = document.querySelector("#receipt-modal");
const receiptForm = document.querySelector("#receiptForm");
const receiptSummary = document.querySelector("#receiptSummary");
const receiptAmountInput = document.querySelector("#receiptAmount");
const closeReceiptModalButton = document.querySelector("#closeReceiptModal");
const unitPricingCalendar = document.querySelector("#unitPricingCalendar");
const unitPricingMonthLabel = document.querySelector("#unitPricingMonthLabel");
const unitPricingPrevButton = document.querySelector("#unitPricingPrev");
const unitPricingNextButton = document.querySelector("#unitPricingNext");
const unitDayPriceInput = document.querySelector("#unitDayPrice");
const applyUnitDayPriceButton = document.querySelector("#applyUnitDayPrice");
const clearUnitDayPriceButton = document.querySelector("#clearUnitDayPrice");
const unitPricingSummary = document.querySelector("#unitPricingSummary");
const bookingRangeCalendar = document.querySelector("#bookingRangeCalendar");
const bookingCalendarMonthLabel = document.querySelector("#bookingCalendarMonthLabel");
const bookingCalendarPrevButton = document.querySelector("#bookingCalendarPrev");
const bookingCalendarNextButton = document.querySelector("#bookingCalendarNext");
const bookingRangeSummary = document.querySelector("#bookingRangeSummary");
const bookingFacilities = document.querySelector("#bookingFacilities");
const stationingMetricGrid = document.querySelector("#stationingMetricGrid");
const stationingCards = document.querySelector("#stationingCards");
const openStationingModalButton = document.querySelector("#openStationingModal");
const stationingModal = document.querySelector("#stationing-modal");
const stationingForm = document.querySelector("#stationingForm");
const stationingModalTitle = document.querySelector("#stationingModalTitle");
const stationingSubmitLabel = document.querySelector("#stationingSubmitLabel");
const closeStationingModalButton = document.querySelector("#closeStationingModal");
const deleteStationingButton = document.querySelector("#deleteStationing");
const receiptFromStationingButton = document.querySelector("#receiptFromStationing");
const stationingRangeSummary = document.querySelector("#stationingRangeSummary");
const barArticleGrid = document.querySelector("#barArticleGrid");
const openBarArticleModalButton = document.querySelector("#openBarArticleModal");
const clearBarCheckoutButton = document.querySelector("#clearBarCheckout");
const barCheckoutList = document.querySelector("#barCheckoutList");
const barCheckoutSummary = document.querySelector("#barCheckoutSummary");
const barCheckoutPayButton = document.querySelector("#barCheckoutPay");
const barAttachReservationButton = document.querySelector("#barAttachReservation");
const bookingBarSection = document.querySelector("#bookingBarSection");
const bookingBarItems = document.querySelector("#bookingBarItems");
const barArticleModal = document.querySelector("#bar-article-modal");
const barArticleForm = document.querySelector("#barArticleForm");
const barArticleModalTitle = document.querySelector("#barArticleModalTitle");
const barArticleSubmitLabel = document.querySelector("#barArticleSubmitLabel");
const closeBarArticleModalButton = document.querySelector("#closeBarArticleModal");
const deleteBarArticleButton = document.querySelector("#deleteBarArticle");
const barAttachModal = document.querySelector("#bar-attach-modal");
const barAttachSummary = document.querySelector("#barAttachSummary");
const barAttachSearch = document.querySelector("#barAttachSearch");
const barReservationChoices = document.querySelector("#barReservationChoices");
const closeBarAttachModalButton = document.querySelector("#closeBarAttachModal");
const barPaymentModal = document.querySelector("#bar-payment-modal");
const barPaymentForm = document.querySelector("#barPaymentForm");
const barPaymentSummary = document.querySelector("#barPaymentSummary");
const closeBarPaymentModalButton = document.querySelector("#closeBarPaymentModal");
const sagaExportModal = document.querySelector("#saga-export-modal");
const sagaExportForm = document.querySelector("#sagaExportForm");
const openSagaExportModalButton = document.querySelector("#openSagaExportModal");
const closeSagaExportModalButton = document.querySelector("#closeSagaExportModal");
let today = new Date();
today.setHours(0, 0, 0, 0);
let visibleMonth = monthStart(today);
let timelineWindowStart = addMonths(monthStart(today), -1);
const timelineWindowMonths = 6;
let dragState = null;
let editingStayKey = null;
let bookingPersonId = null;
let bookingUnitId = null;
let contextStayKey = null;
let receiptStayKey = null;
let receiptDraft = null;
let receiptTargetType = "stay";
let receiptPaymentInProgress = false;
let sourceBookings = [];
let sourceRecordsMode = activeMode;
let units = [];
let facilityCatalog = defaultFacilityCatalog.map((facility) => ({ ...facility }));
let bookingFacilityDraft = [];
let editingUnitId = null;
let editingFacilityKey = null;
let saveToFilesTimer = null;
let lastDatabaseSavedAt = null;
let saveToFilesPromise = Promise.resolve();
let timelineLastVirtualShiftAt = 0;
let unitPricingMonth = monthStart(today);
let unitPricingDraft = {};
let unitPricingSelectedDates = new Set([toISODate(today)]);
let unitPricingDrag = null;
let unitPricingAnchorDate = null;
let suppressUnitCalendarClick = false;
let bookingCalendarMonth = monthStart(today);
let bookingCalendarDrag = null;
let bookingRangeAnchorDate = null;
let suppressBookingCalendarClick = false;
let editingStationingKey = null;
let bookingEditSession = null;
let stationingEditSession = null;
let editingBarArticleKey = null;
let barPaymentInProgress = false;
let barAttachInProgress = false;
let receiptConfig = {
  receiptDirectory: localStorage.getItem("marinaParkReceiptDirectory") || "",
  receiptVat: localStorage.getItem("marinaParkReceiptVat") || "19",
  cardPaymentCode: localStorage.getItem("marinaParkCardPaymentCode") || "1",
  cashPaymentCode: localStorage.getItem("marinaParkCashPaymentCode") || "0"
};
let sagaExportConfig = {
  companyCif: localStorage.getItem("marinaParkSagaCompanyCif") || "",
  companyName: localStorage.getItem("marinaParkSagaCompanyName") || "Marina Park",
  clientName: localStorage.getItem("marinaParkSagaClientName") || "Client generic bar",
  productName: localStorage.getItem("marinaParkSagaProductName") || "",
  vatRate: localStorage.getItem("marinaParkSagaVatRate") || ""
};
const timelineUnitColumnWidth = 180;
let timelineDayWidth = 54;
const timelineVirtualShiftMonths = 1;
const timelineWheelMaxDays = 1;
const timelineTargetVisibleDays = 31;
const timelineMinDayWidth = 24;
const timelineMaxDayWidth = 54;

loadSavedStays();
loadSavedStationing();
loadSavedBarArticles();
ensureStayKeys();
units = buildUnitCatalogFromStays();
applySidebarState();
applyReceiptSettings();
applySagaExportSettings();
loadFileBackedData();


function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}


function timelineWindowEnd() {
  return addMonths(timelineWindowStart, timelineWindowMonths);
}

function daysInTimelineWindow() {
  return daysBetween(timelineWindowStart, timelineWindowEnd());
}

function timelineMonthInWindow(month) {
  return month >= timelineWindowStart && monthEnd(month) <= timelineWindowEnd();
}

function ensureTimelineWindowContains(month) {
  const targetMonth = monthStart(month);
  if (timelineMonthInWindow(targetMonth)) return false;

  timelineWindowStart = addMonths(targetMonth, -1);
  return true;
}

function scrollLeftForDate(date) {
  return Math.max(0, daysBetween(timelineWindowStart, date) * timelineDayWidth);
}

function updateTimelineDayWidth() {
  const availableWidth = Math.max(0, timelineShell.clientWidth - timelineUnitColumnWidth - 12);
  const nextWidth = Math.floor(
    Math.min(timelineMaxDayWidth, Math.max(timelineMinDayWidth, availableWidth / timelineTargetVisibleDays))
  );
  if (!Number.isFinite(nextWidth) || nextWidth === timelineDayWidth) return false;

  timelineDayWidth = nextWidth;
  timelineShell.style.setProperty("--timeline-day-width", `${timelineDayWidth}px`);
  return true;
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromISO(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function syncStayDateCache(stay) {
  if (!stay) return null;
  const start = stay?.start ? dateFromISO(stay.start) : null;
  const end = stay?.end ? dateFromISO(stay.end) : null;
  const startDate = start && Number.isFinite(start.getTime()) ? start : null;
  const endDate = end && Number.isFinite(end.getTime()) ? end : null;
  Object.defineProperties(stay, {
    _startDate: { value: startDate, writable: true, configurable: true, enumerable: false },
    _endDate: { value: endDate, writable: true, configurable: true, enumerable: false },
    _startTime: { value: startDate ? startDate.getTime() : NaN, writable: true, configurable: true, enumerable: false },
    _endTime: { value: endDate ? endDate.getTime() : NaN, writable: true, configurable: true, enumerable: false },
    _startDateText: { value: stay.start, writable: true, configurable: true, enumerable: false },
    _endDateText: { value: stay.end, writable: true, configurable: true, enumerable: false }
  });
  return stay;
}

function stayStartDate(stay) {
  if (!stay) return null;
  if (stay?._startDateText !== stay.start || stay?._endDateText !== stay.end) {
    syncStayDateCache(stay);
  }
  return stay._startDate;
}

function stayEndDate(stay) {
  if (!stay) return null;
  if (stay?._startDateText !== stay.start || stay?._endDateText !== stay.end) {
    syncStayDateCache(stay);
  }
  return stay._endDate;
}

function localToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function refreshTodayIfNeeded() {
  const nextToday = localToday();
  if (nextToday.getTime() === today.getTime()) return false;

  today = nextToday;
  renderAll();
  return true;
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} lei`;
}

function formatCompactMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0";
  return amount.toLocaleString("ro-RO", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  });
}

function isISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function validDateFromISO(value) {
  if (!isISODate(value)) return null;
  const date = dateFromISO(value);
  return Number.isFinite(date.getTime()) && toISODate(date) === value ? date : null;
}

function normalizeMoneyValue(value) {
  const normalizedValue = typeof value === "string" ? value.replace(/\s+/g, "").replace(",", ".") : value;
  const amount = Math.max(0, Number(normalizedValue || 0));
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function safeIdSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function createPersonId(seed = "") {
  const base = safeIdSegment(seed);
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `person-${base ? `${base}-` : ""}${suffix}`;
}

function normalizePersonId(value, fallbackKey = "") {
  const cleaned = String(value || "").trim();
  if (cleaned) return cleaned;
  return `person-${safeIdSegment(fallbackKey) || "reservation"}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDailyPrices(dailyPrices = {}) {
  const normalized = {};
  if (!dailyPrices || typeof dailyPrices !== "object") return normalized;

  Object.entries(dailyPrices).forEach(([date, rawPrice]) => {
    if (!validDateFromISO(date)) return;
    const priceValue = typeof rawPrice === "object" && rawPrice !== null ? rawPrice.price ?? rawPrice.adultPrice : rawPrice;
    const price = normalizeMoneyValue(priceValue);
    if (price > 0) {
      normalized[date] = price;
    }
  });
  return normalized;
}

function formatStayDates(startText, endText) {
  const start = dateFromISO(startText);
  const end = dateFromISO(endText);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("ro-RO", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
  return `${startLabel}-${endLabel}`;
}

function stayOverlapsVisibleMonth(stay) {
  if (!stay.start || !stay.end) return true;
  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  if (!start || !end) return true;
  return start < monthEnd(visibleMonth) && end > visibleMonth;
}

function stayOverlapsTimelineWindow(stay) {
  if (!stay.start || !stay.end) return true;
  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  if (!start || !end) return true;
  return start < timelineWindowEnd() && end > timelineWindowStart;
}

function defaultArrivalDate() {
  return monthStart(today).getTime() === visibleMonth.getTime() ? today : visibleMonth;
}

function storedGoogleReviewTotal() {
  return Number(localStorage.getItem("marinaParkGoogleReviewTotal") || googleReviewData.total);
}

function googleReviewDelta() {
  return Math.max(0, googleReviewData.total - storedGoogleReviewTotal());
}

function unitOptions() {
  const catalog = new Map();
  units.forEach((unit) => {
    catalog.set(unit.id, unit);
  });
  stays.forEach((stay) => {
    if (stay.guest === "Disponibil") return;
    if (!catalog.has(stay.id)) {
      catalog.set(stay.id, normalizeUnit({ id: stay.id, kind: stay.kind, group: stay.group }));
    }
  });
  return [...catalog.values()];
}

function normalizeUnit(unit) {
  const id = String(unit.id || "").trim();
  const kind = String(unit.kind || "Cameră dublă").trim();
  const group = unit.group || groupFromKind(kind);
  const dailyPrices = normalizeDailyPrices(unit.dailyPrices);
  const firstDailyPrice = Object.values(dailyPrices).find((price) => Number(price || 0) > 0) || 0;
  const adultPrice = Math.max(0, Number(unit.adultPrice || firstDailyPrice || 0));
  const childPrice = Math.max(0, Number(unit.childPrice ?? adultPrice / 2));

  return {
    id,
    kind,
    group,
    pricingMode: unit.pricingMode === "per-person-night" ? "per-person-night" : "per-night",
    adultPrice,
    childPrice,
    dailyPrices
  };
}

function defaultRoomUnits() {
  return defaultRoomUnitSeeds.map((unit) =>
    normalizeUnit({
      ...unit,
      group: "room",
      pricingMode: "per-night",
      adultPrice: 0,
      childPrice: 0
    })
  );
}

function mergeUnitCatalog(...catalogs) {
  const merged = new Map();
  catalogs.flat().forEach((unit) => {
    const normalized = normalizeUnit(unit);
    if (normalized.id) {
      merged.set(normalized.id, normalized);
    }
  });
  return [...merged.values()].sort((first, second) => first.id.localeCompare(second.id, "ro-RO", { numeric: true }));
}

function buildUnitCatalogFromStays() {
  const catalog = new Map();
  stays.forEach((stay) => {
    if (stay.guest === "Disponibil") return;
    if (!catalog.has(stay.id)) {
      catalog.set(stay.id, normalizeUnit({ id: stay.id, kind: stay.kind, group: stay.group }));
    }
  });
  return [...catalog.values()].sort((first, second) => first.id.localeCompare(second.id, "ro-RO", { numeric: true }));
}

function activeUnitOptions(group = activeMode) {
  return unitOptions()
    .filter((unit) => unit.group === group)
    .sort((first, second) => first.id.localeCompare(second.id, "ro-RO", { numeric: true }));
}

function unitById(unitId) {
  return unitOptions().find((unit) => unit.id === unitId) || null;
}

function calendarMonthLabel(date) {
  return date.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function calendarGridDates(month) {
  const firstDay = monthStart(month);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -leadingDays);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function dateRangeBounds(firstDateText, secondDateText) {
  const first = validDateFromISO(firstDateText);
  const second = validDateFromISO(secondDateText);
  if (!first || !second) return null;
  return first <= second
    ? { start: first, end: second, startText: firstDateText, endText: secondDateText }
    : { start: second, end: first, startText: secondDateText, endText: firstDateText };
}

function inclusiveDateTexts(startDate, endDate) {
  const dates = [];
  const limit = 730;
  for (let cursor = new Date(startDate), index = 0; cursor <= endDate && index < limit; cursor = addDays(cursor, 1), index += 1) {
    dates.push(toISODate(cursor));
  }
  return dates;
}

function unitDailyPrimaryPrice(unit, dateText) {
  const dailyPrices = normalizeDailyPrices(unit?.dailyPrices);
  const hasCustomPrice = Object.prototype.hasOwnProperty.call(dailyPrices, dateText);
  const primaryPrice = hasCustomPrice ? dailyPrices[dateText] : 0;
  return {
    primaryPrice: normalizeMoneyValue(primaryPrice),
    hasCustomPrice
  };
}

function unitChildPriceForDate(unit, dateText, primaryPrice) {
  if (unit?.pricingMode !== "per-person-night") return 0;
  return normalizeMoneyValue(primaryPrice / 2);
}

function unitRatesForDate(unit, dateText) {
  const { primaryPrice, hasCustomPrice } = unitDailyPrimaryPrice(unit, dateText);
  return {
    primaryPrice,
    childPrice: unitChildPriceForDate(unit, dateText, primaryPrice),
    hasCustomPrice
  };
}

function priceForUnitRange(unit, arrivalText, departureText, adults = 0, children = 0) {
  const arrival = validDateFromISO(arrivalText);
  const departure = validDateFromISO(departureText);
  if (!unit || !arrival || !departure || departure <= arrival) return null;

  let total = 0;
  let hasAnyRate = false;
  const nights = Math.min(daysBetween(arrival, departure), 365);
  for (let index = 0; index < nights; index += 1) {
    const dateText = toISODate(addDays(arrival, index));
    const rates = unitRatesForDate(unit, dateText);
    if (!rates.hasCustomPrice || rates.primaryPrice <= 0) {
      return null;
    }
    hasAnyRate = hasAnyRate || rates.primaryPrice > 0 || rates.childPrice > 0 || rates.hasCustomPrice;
    if (unit.pricingMode === "per-person-night") {
      total += adults * rates.primaryPrice + children * rates.childPrice;
    } else {
      total += rates.primaryPrice;
    }
  }

  return hasAnyRate ? normalizeMoneyValue(total) : null;
}

function normalizeFacilityCatalog(catalog = []) {
  const merged = new Map();
  [...defaultFacilityCatalog, ...(Array.isArray(catalog) ? catalog : [])].forEach((facility) => {
    const key = String(facility.key || "").trim();
    if (!key) return;
    merged.set(key, {
      key,
      name: String(facility.name || key).trim(),
      group: ["room", "camping", "all"].includes(facility.group) ? facility.group : "all",
      pricePerNight: normalizeMoneyValue(facility.pricePerNight ?? facility.price ?? 0),
      active: facility.active !== false
    });
  });
  return [...merged.values()];
}

function facilityByKey(key) {
  return facilityCatalog.find((facility) => facility.key === key) || null;
}

function activeFacilitiesForGroup(group) {
  return facilityCatalog.filter((facility) => facility.active && (facility.group === "all" || facility.group === group));
}

function facilityGroupLabel(group) {
  if (group === "room") return "Camere";
  if (group === "camping") return "Camping";
  return "Ambele";
}

function facilityKeyFromName(name) {
  const base = normalizeSearchText(name).replace(/\s+/g, "-") || "facilitate";
  let key = base;
  let suffix = 2;
  while (facilityCatalog.some((facility) => facility.key === key)) {
    key = `${base}-${suffix}`;
    suffix += 1;
  }
  return key;
}

function facilityUsageCount(key) {
  return stays.filter((stay) => normalizeStayFacilities(stay.facilities, stay).some((facility) => facility.key === key)).length;
}

function resetFacilityForm() {
  if (!facilityCatalogForm) return;
  editingFacilityKey = null;
  facilityCatalogForm.reset();
  facilityCatalogForm.elements.key.value = "";
  facilityCatalogForm.elements.group.value = "all";
  facilityCatalogForm.elements.pricePerNight.value = "0.00";
  if (facilitySubmitLabel) facilitySubmitLabel.textContent = "Adaugă facilitatea";
}

function editFacility(key) {
  if (!facilityCatalogForm) return;
  const facility = facilityByKey(key);
  if (!facility) return;
  editingFacilityKey = facility.key;
  facilityCatalogForm.elements.key.value = facility.key;
  facilityCatalogForm.elements.name.value = facility.name;
  facilityCatalogForm.elements.group.value = facility.group;
  facilityCatalogForm.elements.pricePerNight.value = Number(facility.pricePerNight || 0).toFixed(2);
  if (facilitySubmitLabel) facilitySubmitLabel.textContent = "Salvează facilitatea";
  facilityCatalogForm.elements.name.focus();
}

function saveFacilityFromForm() {
  if (!facilityCatalogForm) return false;
  const data = new FormData(facilityCatalogForm);
  const name = String(data.get("name") || "").trim();
  if (!name) {
    showToast("Numele facilității este obligatoriu");
    return false;
  }

  const key = editingFacilityKey || String(data.get("key") || "").trim() || facilityKeyFromName(name);
  const group = ["room", "camping", "all"].includes(data.get("group")) ? data.get("group") : "all";
  const nextFacility = {
    key,
    name,
    group,
    pricePerNight: normalizeMoneyValue(data.get("pricePerNight")),
    active: true
  };
  const previousFacility = facilityByKey(key);
  const existingIndex = facilityCatalog.findIndex((facility) => facility.key === key);
  if (existingIndex >= 0) {
    facilityCatalog[existingIndex] = nextFacility;
  } else {
    facilityCatalog.push(nextFacility);
  }
  markPagesDirty("clients", "settings");
  facilityCatalog = normalizeFacilityCatalog(facilityCatalog).sort((first, second) =>
    first.name.localeCompare(second.name, "ro-RO", { numeric: true })
  );
  queueFileSave();
  renderFacilityList();
  renderBookingFacilities();
  resetFacilityForm();
  logActivity({
    eventType: previousFacility ? "update" : "create",
    entityType: "facility",
    entityKey: key,
    entityLabel: name,
    message: previousFacility ? `Facilitatea ${name} a fost actualizată.` : `Facilitatea ${name} a fost adăugată.`,
    data: { previous: previousFacility, current: nextFacility }
  });
  showToast(previousFacility ? `Facilitate actualizată: ${name}` : `Facilitate adăugată: ${name}`);
  return true;
}

function setFacilityActive(key, active) {
  const facility = facilityByKey(key);
  if (!facility) return;
  const previousFacility = { ...facility };
  facilityCatalog = facilityCatalog.map((item) => (item.key === key ? { ...item, active } : item));
  markPagesDirty("clients", "settings");
  queueFileSave();
  renderFacilityList();
  renderBookingFacilities();
  if (editingFacilityKey === key && !active) resetFacilityForm();
  logActivity({
    eventType: "update",
    entityType: "facility",
    entityKey: key,
    entityLabel: facility.name,
    message: active ? `Facilitatea ${facility.name} a fost activată.` : `Facilitatea ${facility.name} a fost dezactivată.`,
    data: { previous: previousFacility, current: { ...facility, active } }
  });
  showToast(active ? `Facilitate activată: ${facility.name}` : `Facilitate dezactivată: ${facility.name}`);
}

function renderFacilityList() {
  if (!facilityList) return;
  if (!facilityCatalog.length) {
    facilityList.innerHTML = `<p class="empty-state">Nu există facilități configurate.</p>`;
    return;
  }

  const sortedFacilities = [...facilityCatalog].sort((first, second) => {
    if (first.active !== second.active) return first.active ? -1 : 1;
    const groupSort = facilityGroupLabel(first.group).localeCompare(facilityGroupLabel(second.group), "ro-RO");
    if (groupSort) return groupSort;
    return first.name.localeCompare(second.name, "ro-RO", { numeric: true });
  });

  facilityList.innerHTML = sortedFacilities
    .map((facility) => {
      const usage = facilityUsageCount(facility.key);
      const escapedKey = escapeHtml(facility.key);
      const escapedName = escapeHtml(facility.name);
      const isActive = facility.active !== false;
      return `
        <article class="facility-list-card ${isActive ? "" : "is-inactive"}">
          <div>
            <strong>${escapedName}</strong>
            <span>${facilityGroupLabel(facility.group)} · ${formatCurrency(facility.pricePerNight)} / noapte</span>
            <small>${usage} rezervări · ${isActive ? "activă" : "inactivă"}</small>
          </div>
          <div class="facility-list-actions">
            <button class="icon-button compact" type="button" data-edit-facility="${escapedKey}" title="Editează facilitatea" aria-label="Editează facilitatea ${escapedName}">
              <i data-lucide="pencil" aria-hidden="true"></i>
            </button>
            <button class="icon-button compact ${isActive ? "danger-button" : ""}" type="button" data-toggle-facility="${escapedKey}" data-active="${isActive ? "false" : "true"}" title="${isActive ? "Dezactivează" : "Activează"} facilitatea" aria-label="${isActive ? "Dezactivează" : "Activează"} facilitatea ${escapedName}">
              <i data-lucide="${isActive ? "trash-2" : "rotate-ccw"}" aria-hidden="true"></i>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
  refreshIcons(facilityList);
}

function stayNightCount(startText, endText) {
  const start = validDateFromISO(startText);
  const end = validDateFromISO(endText);
  if (!start || !end || end <= start) return 1;
  return Math.max(1, daysBetween(start, end));
}

function normalizeStayFacilities(facilities = [], stay = {}) {
  if (!Array.isArray(facilities)) return [];
  const stayStart = validDateFromISO(stay.start);
  const stayEnd = validDateFromISO(stay.end);
  const hasStayRange = Boolean(stayStart && stayEnd && stayEnd > stayStart);
  const nights = hasStayRange ? Math.max(1, daysBetween(stayStart, stayEnd)) : 1;
  return facilities
    .map((item) => {
      const catalogItem = facilityByKey(item.key) || defaultFacilityCatalog.find((facility) => facility.key === item.key);
      const key = String(item.key || catalogItem?.key || "").trim();
      if (!key) return null;
      const pricePerNight = normalizeMoneyValue(item.pricePerNight ?? catalogItem?.pricePerNight ?? 0);
      const rawNights = Number(item.nights);
      const hasValidNights = Number.isFinite(rawNights) && rawNights > 0;
      const fallbackNights = hasValidNights ? rawNights : nights;
      const itemNights = hasStayRange ? Math.min(nights, Math.max(1, fallbackNights)) : Math.max(1, fallbackNights);
      const customNights = item.customNights === true || (hasStayRange && hasValidNights && rawNights !== nights);
      const includedInBasePrice = item.includedInBasePrice === true;
      return {
        key,
        name: String(item.name || catalogItem?.name || key).trim(),
        pricePerNight,
        nights: itemNights,
        customNights,
        total: includedInBasePrice ? 0 : normalizeMoneyValue(pricePerNight * itemNights),
        includedInBasePrice,
        source: item.source === "mysql" ? "mysql" : "manual"
      };
    })
    .filter(Boolean);
}

function manualFacilityTotal(facilities = []) {
  return normalizeMoneyValue(
    normalizeStayFacilities(facilities).reduce((sum, facility) => sum + (facility.includedInBasePrice ? 0 : Number(facility.total || 0)), 0)
  );
}

function priceWithFacilities(basePrice, facilities = []) {
  return normalizeMoneyValue(Number(basePrice || 0) + manualFacilityTotal(facilities));
}

function refreshFacilityNights(facilities = [], startText, endText) {
  const nights = stayNightCount(startText, endText);
  return normalizeStayFacilities(facilities, { start: startText, end: endText }).map((facility) => ({
    ...facility,
    nights: facility.customNights ? Math.min(nights, Math.max(1, Number(facility.nights || nights))) : nights,
    total: facility.includedInBasePrice
      ? 0
      : normalizeMoneyValue(facility.pricePerNight * (facility.customNights ? Math.min(nights, Math.max(1, Number(facility.nights || nights))) : nights))
  }));
}

function recalculateStayPricingFromUnit(stay, options = {}) {
  const unit = unitById(stay.id);
  const nextPrice = priceForUnitRange(unit, stay.start, stay.end, Number(stay.adults || 0), Number(stay.children || 0));
  if (nextPrice === null) return false;

  stay.basePrice = nextPrice;
  stay.facilities = refreshFacilityNights(stay.facilities, stay.start, stay.end);
  stay.barItems = normalizeStayBarItems(stay.barItems);
  stay.price = normalizeMoneyValue(priceWithFacilities(stay.basePrice, stay.facilities) + reservationBarTotal(stay.barItems));
  stay.deposit = 0;
  stay.balance = stay.price;
  return true;
}

function restoreTimelineDragPrice() {
  if (!dragState?.stay) return;
  dragState.stay.price = dragState.originalPrice;
  dragState.stay.deposit = dragState.originalDeposit;
  dragState.stay.balance = dragState.originalBalance;
}

function calendarWeekdayHeader() {
  return ["Lun.", "Mar.", "Mie.", "Joi.", "Vin.", "Sâm.", "Dum."]
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join("");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, " ")
    .trim();
}

function searchTokens(value) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, value));
}

function fuzzyDistance(first, second) {
  const rows = first.length + 1;
  const columns = second.length + 1;
  const distances = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) distances[row][0] = row;
  for (let column = 0; column < columns; column += 1) distances[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost
      );

      if (row > 1 && column > 1 && first[row - 1] === second[column - 2] && first[row - 2] === second[column - 1]) {
        distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1);
      }
    }
  }

  return distances[first.length][second.length];
}

function fuzzyTokenScore(queryToken, targetToken) {
  if (!queryToken || !targetToken) return Infinity;
  if (queryToken === targetToken) return 0;
  if (targetToken.startsWith(queryToken)) return clampScore(4 + Math.max(0, targetToken.length - queryToken.length));
  if (targetToken.includes(queryToken)) return clampScore(12 + Math.max(0, targetToken.length - queryToken.length));
  if (queryToken.includes(targetToken) && targetToken.length >= Math.min(4, queryToken.length)) return 18;
  if (queryToken.length <= 2) return Infinity;

  const allowedDistance = queryToken.length <= 4 ? 2 : Math.min(3, Math.ceil(queryToken.length * 0.35));

  if (targetToken.startsWith(queryToken[0])) {
    const prefix = targetToken.slice(0, Math.min(targetToken.length, Math.max(queryToken.length + 1, 4)));
    const prefixDistance = fuzzyDistance(queryToken, prefix);
    if (prefixDistance <= allowedDistance) {
      return clampScore(24 + (prefixDistance / Math.max(queryToken.length, 1)) * 45);
    }
  }

  const distance = fuzzyDistance(queryToken, targetToken);
  if (distance > allowedDistance) return Infinity;

  return clampScore(34 + (distance / Math.max(queryToken.length, targetToken.length, 1)) * 55);
}


function fuzzyMatchScore(query, text) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);
  if (!normalizedQuery) return 0;
  if (!normalizedText) return Infinity;
  if (normalizedText === normalizedQuery) return 0;
  if (normalizedText.startsWith(normalizedQuery)) return 2;
  if (normalizedText.includes(normalizedQuery)) return 8;

  const compactQuery = normalizedQuery.replaceAll(" ", "");
  const compactText = normalizedText.replaceAll(" ", "");
  if (compactText === compactQuery) return 0;
  if (compactText.startsWith(compactQuery)) return 5;
  if (compactQuery.length >= 3 && compactText.includes(compactQuery)) return 12;

  const queryTokens = searchTokens(normalizedQuery);
  const targetTokens = searchTokens(normalizedText);
  if (!queryTokens.length || !targetTokens.length) return Infinity;

  const tokenScores = queryTokens.map((queryToken) =>
    Math.min(...targetTokens.map((targetToken) => fuzzyTokenScore(queryToken, targetToken)))
  );
  if (tokenScores.some((score) => !Number.isFinite(score))) return Infinity;

  const averageScore = tokenScores.reduce((sum, score) => sum + score, 0) / tokenScores.length;
  const compactWindow = compactText.slice(0, Math.max(compactQuery.length + 3, 6));
  const compactDistance = compactQuery.length >= 4 ? fuzzyDistance(compactQuery, compactWindow) : Infinity;
  const compactScore =
    compactDistance <= Math.ceil(compactQuery.length * 0.34)
      ? 22 + (compactDistance / Math.max(compactQuery.length, 1)) * 48
      : Infinity;

  return Math.min(averageScore, compactScore);
}


function staySearchScore(stay) {
  if (!searchTerm) return 0;
  const fieldScores = [
    fuzzyMatchScore(searchTerm, stay.guest),
    fuzzyMatchScore(searchTerm, stay.phone),
    fuzzyMatchScore(searchTerm, stay.car || ""),
    fuzzyMatchScore(searchTerm, stay.id),
    fuzzyMatchScore(searchTerm, stay.kind),
    fuzzyMatchScore(searchTerm, stay.dates),
    fuzzyMatchScore(searchTerm, stay.paymentMethod || ""),
    fuzzyMatchScore(searchTerm, stay.note)
  ];

  return Math.min(...fieldScores);
}

function matchesSearch(stay) {
  return !searchTerm || Number.isFinite(staySearchScore(stay));
}

function matchesUnitSearch(unit, unitStays) {
  if (!searchTerm) return true;
  const unitScore = Math.min(fuzzyMatchScore(searchTerm, unit.id), fuzzyMatchScore(searchTerm, unit.kind));
  return Number.isFinite(unitScore) || unitStays.some(matchesSearch);
}

function unitSearchScore(unit) {
  if (!searchTerm) return 0;
  const unitScore = Math.min(fuzzyMatchScore(searchTerm, unit.id), fuzzyMatchScore(searchTerm, unit.kind));
  const stayScore = unit.allStays?.length ? Math.min(...unit.allStays.map(staySearchScore)) : Infinity;
  return Math.min(unitScore, stayScore);
}

function rebuildStaysByUnitIndex() {
  staysByUnitIndex = new Map();
  timelineLayoutCache.clear();
  for (const stay of stays) {
    if (stay.guest === "Disponibil") continue;
    syncStayDateCache(stay);
    const key = `${stay.group}:${stay.id}`;
    let list = staysByUnitIndex.get(key);
    if (!list) {
      list = [];
      staysByUnitIndex.set(key, list);
    }
    list.push(stay);
  }
}

function timelineUnitRows() {
  return unitOptions()
    .filter((unit) => unit.group === activeMode)
    .map((unit) => {
      const unitStays = staysByUnitIndex.get(`${activeMode}:${unit.id}`) || [];
      return {
        ...unit,
        stays: unitStays.filter((stay) => stayOverlapsTimelineWindow(stay) && matchesSearch(stay)),
        allStays: unitStays
      };
    })
    .filter((unit) => matchesUnitSearch(unit, unit.allStays))
    .sort((first, second) => {
      if (searchTerm) {
        const scoreCompare = unitSearchScore(first) - unitSearchScore(second);
        if (scoreCompare !== 0) return scoreCompare;
      }

      return first.id.localeCompare(second.id, "ro-RO", { numeric: true });
    });
}

function daysBetween(start, end) {
  return Math.round((end - start) / 86400000);
}

function formatDateLabel(dateText) {
  const date = validDateFromISO(dateText);
  return date ? date.toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "-";
}

function stationingEndDate(record) {
  const start = validDateFromISO(record.startDate) || today;
  const prepaidNights = Math.max(1, Number(record.prepaidNights || 1));
  return toISODate(addDays(start, prepaidNights));
}

function normalizeStationingRecord(record = {}, index = 0) {
  const startDate = validDateFromISO(record.startDate) ? record.startDate : toISODate(today);
  const prepaidNights = Math.max(1, Math.min(1095, Math.round(Number(record.prepaidNights || 30))));
  const nightlyPrice = normalizeMoneyValue(record.nightlyPrice);
  const totalPrice = normalizeMoneyValue(record.totalPrice || nightlyPrice * prepaidNights);
  const paidAmount = Math.min(totalPrice, normalizeMoneyValue(record.paidAmount));
  const balance = Math.max(0, normalizeMoneyValue(totalPrice - paidAmount));

  return {
    key: String(record.key || `stationing-${Date.now()}-${index}`),
    owner: String(record.owner || "").trim(),
    phone: String(record.phone || "").trim(),
    caravan: String(record.caravan || "").trim(),
    startDate,
    prepaidNights,
    nightlyPrice,
    totalPrice,
    paidAmount,
    balance,
    note: String(record.note || "").trim()
  };
}

function stationingDetails(record) {
  const start = validDateFromISO(record.startDate) || today;
  const prepaidNights = Math.max(1, Number(record.prepaidNights || 1));
  const nightlyPrice = normalizeMoneyValue(record.nightlyPrice);
  const totalPrice = normalizeMoneyValue(record.totalPrice || prepaidNights * nightlyPrice);
  const paidAmount = Math.min(totalPrice, normalizeMoneyValue(record.paidAmount));
  const paidNights =
    nightlyPrice > 0
      ? Math.min(prepaidNights, Math.floor(paidAmount / nightlyPrice))
      : paidAmount >= totalPrice && totalPrice > 0
        ? prepaidNights
        : 0;
  const usedNights = Math.min(prepaidNights, Math.max(0, daysBetween(start, today)));
  const remainingNights = Math.max(0, prepaidNights - usedNights);
  const progress = Math.round((usedNights / prepaidNights) * 100);
  const paidProgress = Math.round((paidNights / prepaidNights) * 100);
  const unpaidProgress = Math.max(0, 100 - paidProgress);
  const endDate = stationingEndDate(record);
  const status =
    remainingNights === 0
      ? { label: "Expirat", className: "is-expired", priority: 0 }
      : remainingNights <= 7
        ? { label: "Expiră curând", className: "is-expiring", priority: 1 }
        : { label: "Activ", className: "is-active", priority: 2 };

  return {
    usedNights,
    remainingNights,
    paidNights,
    prepaidNights,
    progress,
    paidProgress,
    unpaidProgress,
    endDate,
    status
  };
}

function stationingSearchScore(record) {
  if (!searchTerm) return 0;
  return Math.min(
    fuzzyMatchScore(searchTerm, record.owner),
    fuzzyMatchScore(searchTerm, record.phone),
    fuzzyMatchScore(searchTerm, record.caravan),
    fuzzyMatchScore(searchTerm, record.startDate),
    fuzzyMatchScore(searchTerm, record.note)
  );
}

function matchesStationingSearch(record) {
  return !searchTerm || Number.isFinite(stationingSearchScore(record));
}

function normalizeBarArticle(article = {}, index = 0) {
  const name = String(article.name || "Articol").trim() || "Articol";
  const price = normalizeMoneyValue(article.price);
  const stock = Math.max(0, Math.floor(Number(article.stock || 0)));
  const vatRate = Number(article.vatRate || article.vat_rate) === 11 ? 11 : 21;
  const now = new Date().toISOString();

  return {
    key: String(article.key || `bar-${Date.now()}-${index}`),
    name,
    price,
    stock,
    vatRate,
    hasSgr: article.hasSgr === true || article.hasSgr === "true" || article.hasSgr === 1,
    createdAt: article.createdAt || now,
    updatedAt: article.updatedAt || now
  };
}

function normalizeReservationBarItem(item = {}, index = 0) {
  const articleKey = String(item.articleKey || item.key || "").trim();
  const name = String(item.name || "Articol bar").trim() || "Articol bar";
  const price = normalizeMoneyValue(item.price);
  const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
  const vatRate = Number(item.vatRate || item.vat_rate) === 11 ? 11 : 21;
  const hasSgr = item.hasSgr === true || item.hasSgr === "true" || item.hasSgr === 1;
  const subtotal = normalizeMoneyValue(price * quantity);
  const sgrTotal = hasSgr ? normalizeMoneyValue(0.5 * quantity) : 0;
  const lineTotal = normalizeMoneyValue(subtotal + sgrTotal);
  const now = new Date().toISOString();

  return {
    id: String(item.id || `${articleKey || "bar"}-${Date.now()}-${index}`),
    articleKey,
    name,
    price,
    quantity,
    vatRate,
    hasSgr,
    subtotal,
    sgrTotal,
    lineTotal,
    attachedAt: item.attachedAt || now,
    updatedAt: item.updatedAt || item.attachedAt || now
  };
}

function normalizeStayBarItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeReservationBarItem).filter((item) => item.price > 0 && item.quantity > 0);
}

function reservationBarTotal(items = []) {
  return normalizeMoneyValue(normalizeStayBarItems(items).reduce((sum, item) => sum + Number(item.lineTotal || 0), 0));
}

function currentBookingBarTotal() {
  if (!editingStayKey) return 0;
  const stay = stays.find((item) => item.key === editingStayKey);
  return reservationBarTotal(stay?.barItems);
}

function reservationBarItemsFromCartLines(lines = []) {
  const now = new Date().toISOString();
  return lines.map((line, index) =>
    normalizeReservationBarItem(
      {
        id: `${line.key}-${Date.now()}-${index}`,
        articleKey: line.key,
        name: line.name,
        price: line.price,
        quantity: line.quantity,
        vatRate: line.vatRate,
        hasSgr: line.hasSgr,
        attachedAt: now,
        updatedAt: now
      },
      index
    )
  );
}

function mergeReservationBarItems(existingItems = [], addedItems = []) {
  const merged = normalizeStayBarItems(existingItems);
  normalizeStayBarItems(addedItems).forEach((item) => {
    const match = merged.find(
      (existing) =>
        existing.articleKey === item.articleKey &&
        existing.price === item.price &&
        existing.vatRate === item.vatRate &&
        existing.hasSgr === item.hasSgr
    );
    if (match) {
      match.quantity += item.quantity;
      match.updatedAt = item.updatedAt;
      Object.assign(match, normalizeReservationBarItem(match));
    } else {
      merged.push(item);
    }
  });
  return merged;
}

function settledPriceForStay(stay) {
  return normalizeMoneyValue(stay?.settledPrice ?? stay?.paidThroughPrice ?? 0);
}

function actualPaidAmountForStay(stay) {
  return normalizeMoneyValue(stay?.actualPaidAmount ?? 0);
}

function hasStayPaymentEvidence(stay) {
  if (!stay) return false;
  return (
    String(stay.paymentMethod || "").trim() !== "" ||
    actualPaidAmountForStay(stay) > 0 ||
    String(stay.paidAt || "").trim() !== "" ||
    String(stay.receiptId || "").trim() !== ""
  );
}

function paymentCoveredPriceForStay(stay) {
  return hasStayPaymentEvidence(stay) ? settledPriceForStay(stay) : 0;
}

function isStayFullyPaid(stay) {
  if (!stay || stay.guest === "Disponibil") return false;
  const price = normalizeMoneyValue(stay.price);
  if (price <= 0 || !hasStayPaymentEvidence(stay)) return false;
  return stay.paid === true || paymentCoveredPriceForStay(stay) >= price;
}

function barArticleSearchScore(article) {
  if (!searchTerm) return 0;
  return Math.min(
    fuzzyMatchScore(searchTerm, article.name),
    fuzzyMatchScore(searchTerm, `${article.vatRate}%`),
    fuzzyMatchScore(searchTerm, article.hasSgr ? "sgr ambalaj" : "fara sgr")
  );
}

function matchesBarArticleSearch(article) {
  return !searchTerm || Number.isFinite(barArticleSearchScore(article));
}

function barArticleByKey(key) {
  return barArticles.find((article) => article.key === key) || null;
}

function barCartQuantity(key) {
  return barCart.find((item) => item.key === key)?.quantity || 0;
}

function activityLogFallback(entry) {
  try {
    const current = JSON.parse(localStorage.getItem(activityLogStorageKey) || "[]");
    localStorage.setItem(activityLogStorageKey, JSON.stringify([entry, ...current].slice(0, 1000)));
  } catch {
    // Logging must never block the operational workflow.
  }
}

function removeActivityLogFallback(ids = []) {
  const idSet = new Set(ids.filter(Boolean));
  if (!idSet.size) return;

  try {
    const current = JSON.parse(localStorage.getItem(activityLogStorageKey) || "[]");
    if (!Array.isArray(current)) return;
    localStorage.setItem(
      activityLogStorageKey,
      JSON.stringify(current.filter((entry) => !idSet.has(entry?.id)))
    );
  } catch {
    // Keep the browser copy if localStorage is unavailable or corrupted.
  }
}

async function postActivityLogEntries(entries = [], options = {}) {
  const validEntries = entries.filter((entry) => entry?.id);
  if (!validEntries.length) return false;

  const response = await fetch("/api/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validEntries.length === 1 ? validEntries[0] : { entries: validEntries }),
    keepalive: true
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Nu am putut salva jurnalul local");
  }
  if (options.removeFallback) {
    removeActivityLogFallback(validEntries.map((entry) => entry.id));
  }
  return true;
}

function logActivity(entry = {}) {
  const normalized = {
    id: entry.id || `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    eventType: entry.eventType || "event",
    entityType: entry.entityType || "app",
    entityKey: entry.entityKey || "",
    entityLabel: entry.entityLabel || "",
    message: entry.message || "Activitate înregistrată",
    amount: normalizeMoneyValue(entry.amount || 0),
    method: entry.method || "",
    data: entry.data || {}
  };

  activityLogFallback(normalized);
  return postActivityLogEntries([normalized], { removeFallback: true }).catch(() => {
    // The local fallback already has the entry.
    return false;
  });
}

async function syncLocalActivityLog() {
  let entries = [];
  try {
    entries = JSON.parse(localStorage.getItem(activityLogStorageKey) || "[]");
  } catch {
    entries = [];
  }
  if (!Array.isArray(entries) || !entries.length) return;

  try {
    const validEntries = entries.filter((entry) => entry?.id);
    for (let index = 0; index < validEntries.length; index += 50) {
      await postActivityLogEntries(validEntries.slice(index, index + 50), { removeFallback: true });
    }
  } catch {
    // Keep the browser copy; it will sync on a later app load.
  }
}

function formatActivityMoney(value) {
  return formatCurrency(normalizeMoneyValue(value));
}

function activityStayLabel(stay) {
  return `${stay.guest || "Client"} (${stay.id || "-"}, ${stay.kind || "-"})`;
}

function activityStationingLabel(record) {
  return `${record.owner || "Proprietar"} (${record.caravan || "rulotă"})`;
}

function activityBarArticleLabel(article) {
  return `${article.name || "Articol"} (${formatActivityMoney(article.price || 0)}, stoc ${Number(article.stock || 0)})`;
}

function changedValueLabel(value) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function changedMoneyLabel(value) {
  return formatActivityMoney(Number(value || 0));
}

function stayChangeList(previous, next) {
  const changes = [];
  const fields = [
    ["guest", "client"],
    ["phone", "telefon"],
    ["id", "unitate"],
    ["kind", "tip"],
    ["start", "început"],
    ["end", "final"],
    ["adults", "adulți"],
    ["children", "copii"],
    ["party", "persoane"],
    ["car", "mașină"],
    ["personId", "client comun"],
    ["paid", "achitat", (value) => (value ? "da" : "nu")],
    ["settledPrice", "total acoperit", changedMoneyLabel],
    ["actualPaidAmount", "plătit efectiv", changedMoneyLabel],
    ["balance", "rest", changedMoneyLabel],
    ["deposit", "avans", changedMoneyLabel],
    ["paymentMethod", "metodă plată"],
    ["note", "observații"]
  ];

  fields.forEach(([field, label, formatter = changedValueLabel]) => {
    if (String(previous?.[field] ?? "") !== String(next?.[field] ?? "")) {
      changes.push(`${label}: ${formatter(previous?.[field])} -> ${formatter(next?.[field])}`);
    }
  });

  if (Number(previous?.price || 0) !== Number(next?.price || 0)) {
    changes.unshift(`preț: ${changedMoneyLabel(previous?.price)} -> ${changedMoneyLabel(next?.price)}`);
  }

  const previousFacilities = normalizeStayFacilities(previous?.facilities, previous)
    .map((facility) => `${facility.name}${facility.includedInBasePrice ? " inclus" : ""}`)
    .join(", ");
  const nextFacilities = normalizeStayFacilities(next?.facilities, next)
    .map((facility) => `${facility.name}${facility.includedInBasePrice ? " inclus" : ""}`)
    .join(", ");
  if (previousFacilities !== nextFacilities) {
    changes.push(`facilități: ${previousFacilities || "fără"} -> ${nextFacilities || "fără"}`);
  }

  return changes;
}

function stationingChangeList(previous, next) {
  const changes = [];
  const fields = [
    ["owner", "proprietar"],
    ["phone", "telefon"],
    ["caravan", "rulotă"],
    ["startDate", "început"],
    ["prepaidNights", "nopți"],
    ["nightlyPrice", "preț/noapte", changedMoneyLabel],
    ["totalPrice", "total", changedMoneyLabel],
    ["paidAmount", "plătit", changedMoneyLabel],
    ["balance", "rest", changedMoneyLabel],
    ["note", "observații"]
  ];

  fields.forEach(([field, label, formatter = changedValueLabel]) => {
    if (String(previous?.[field] ?? "") !== String(next?.[field] ?? "")) {
      changes.push(`${label}: ${formatter(previous?.[field])} -> ${formatter(next?.[field])}`);
    }
  });

  return changes;
}

function barArticleChangeList(previous, next) {
  const changes = [];
  const fields = [
    ["name", "nume"],
    ["price", "preț", changedMoneyLabel],
    ["stock", "stoc"],
    ["vatRate", "TVA", (value) => `${value || 21}%`],
    ["hasSgr", "SGR", (value) => (value ? "da" : "nu")]
  ];

  fields.forEach(([field, label, formatter = changedValueLabel]) => {
    if (String(previous?.[field] ?? "") !== String(next?.[field] ?? "")) {
      changes.push(`${label}: ${formatter(previous?.[field])} -> ${formatter(next?.[field])}`);
    }
  });

  return changes;
}

function normalizeStay(stay, index) {
  const id = String(stay.id || `U-${index + 1}`).trim();
  const key = String(stay.key || `${id}-${index}`);
  const kind = String(stay.kind || "Cameră dublă").trim();
  const guest = String(stay.guest || "Disponibil").trim();
  const start = stay.start || null;
  const end = stay.end || null;
  const group = stay.group || (kind.toLowerCase().includes("campare") || kind.toLowerCase().includes("rulot") ? "camping" : "room");
  const dates = start && end ? formatStayDates(start, end) : stay.dates || "Liber";
  const facilities = normalizeStayFacilities(stay.facilities, { start, end });
  const barItems = normalizeStayBarItems(stay.barItems);
  const barTotal = reservationBarTotal(barItems);
  const price = Number(stay.price || 0);
  const basePrice = normalizeMoneyValue(stay.basePrice ?? Math.max(0, price - manualFacilityTotal(facilities) - barTotal));
  const settledPrice = normalizeMoneyValue(stay.settledPrice ?? stay.paidThroughPrice ?? 0);
  const hasPaymentEvidence = hasStayPaymentEvidence(stay);
  const paid = guest !== "Disponibil" && (
    hasPaymentEvidence &&
    price > 0 &&
    (stay.paid === true || stay.isPaid === true || stay.paymentStatus === "paid" || settledPrice >= price)
  );

  return {
    id,
    key,
    personId: guest === "Disponibil" ? "" : normalizePersonId(stay.personId, key),
    group,
    kind,
    guest,
    phone: String(stay.phone || ""),
    adults: Math.max(0, Number(stay.adults ?? stay.party ?? 0)),
    children: Math.max(0, Number(stay.children || 0)),
    car: String(stay.car || ""),
    party: Number(stay.party || 0),
    status: stay.status || (guest === "Disponibil" ? "available" : "arriving"),
    start,
    end,
    dates,
    basePrice,
    facilities,
    barItems,
    price,
    balance: Math.max(0, Number(stay.balance || 0)),
    deposit: Math.max(0, Number(stay.deposit ?? Math.max(0, Number(stay.price || 0) - Number(stay.balance || 0)))),
    paid,
    settledPrice: hasPaymentEvidence ? (paid && settledPrice <= 0 ? normalizeMoneyValue(price) : settledPrice) : 0,
    actualPaidAmount: hasPaymentEvidence ? actualPaidAmountForStay(stay) : 0,
    paymentMethod: String(stay.paymentMethod || ""),
    note: String(stay.note || "")
  };
}

function loadSavedStays() {
  try {
    const raw = localStorage.getItem(staysStorageKey);
    const loaded = raw ? JSON.parse(raw) : defaultStays;
    if (!Array.isArray(loaded)) throw new Error("Date locale invalide");
    stays.splice(0, stays.length, ...loaded.map(normalizeStay));
  } catch {
    stays.splice(0, stays.length, ...defaultStays.map(normalizeStay));
  }
}

function loadSavedStationing() {
  try {
    const raw = localStorage.getItem(stationingStorageKey);
    const loaded = raw ? JSON.parse(raw) : defaultStationing;
    if (!Array.isArray(loaded)) throw new Error("Date staționare invalide");
    stationing = loaded.map(normalizeStationingRecord);
  } catch {
    stationing = defaultStationing.map(normalizeStationingRecord);
  }
}

function loadSavedBarArticles() {
  try {
    const raw = localStorage.getItem(barArticlesStorageKey);
    const loaded = raw ? JSON.parse(raw) : defaultBarArticles;
    if (!Array.isArray(loaded)) throw new Error("Date bar invalide");
    barArticles = loaded.map(normalizeBarArticle);
  } catch {
    barArticles = defaultBarArticles.map(normalizeBarArticle);
  }
}

async function loadFileBackedData() {
  try {
    const response = await fetch("/api/data", { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    lastDatabaseSavedAt = data.config?.savedAt || null;
    if (Array.isArray(data.stays)) {
      stays.splice(0, stays.length, ...data.stays.map(normalizeStay));
      ensureStayKeys();
      localStorage.setItem(staysStorageKey, JSON.stringify(stays));
    } else {
      queueFileSave();
    }

    if (Array.isArray(data.stationing)) {
      stationing = data.stationing.map(normalizeStationingRecord);
      localStorage.setItem(stationingStorageKey, JSON.stringify(stationing));
    }

    if (Array.isArray(data.barArticles) && (data.barArticles.length || localStorage.getItem(barArticlesStorageKey))) {
      barArticles = data.barArticles.map(normalizeBarArticle);
      localStorage.setItem(barArticlesStorageKey, JSON.stringify(barArticles));
    } else if (Array.isArray(data.barArticles)) {
      queueFileSave();
    }

    if (data.config?.googleReviewData) {
      googleReviewData = {
        ...googleReviewData,
        ...data.config.googleReviewData
      };
    }

    if (typeof data.config?.sidebarCollapsed === "boolean") {
      sidebarCollapsed = data.config.sidebarCollapsed;
      localStorage.setItem("marinaParkSidebarCollapsed", String(sidebarCollapsed));
      applySidebarState();
    }

    receiptConfig = {
      ...receiptConfig,
      ...(data.config?.receiptConfig || {})
    };
    applyReceiptSettings();

    sagaExportConfig = {
      ...sagaExportConfig,
      ...(data.config?.sagaExportConfig || {})
    };
    applySagaExportSettings();

    facilityCatalog = normalizeFacilityCatalog(data.config?.facilityCatalog);
    if (!Array.isArray(data.config?.facilityCatalog)) {
      queueFileSave();
    }

    const databaseUnits = Array.isArray(data.units) ? data.units : null;
    const configUnits = Array.isArray(data.config?.units) ? data.config.units : [];
    let shouldSaveUnits = false;

    if (databaseUnits) {
      units = mergeUnitCatalog(databaseUnits);
    } else if (configUnits.length) {
      units = mergeUnitCatalog(configUnits);
      shouldSaveUnits = true;
    } else {
      units = buildUnitCatalogFromStays();
      shouldSaveUnits = true;
    }

    if (data.config?.roomUnitCatalogSeeded !== true) {
      units = mergeUnitCatalog(defaultRoomUnits(), units);
      shouldSaveUnits = true;
    }

    if (shouldSaveUnits) {
      queueFileSave();
    }
    rebuildStaysByUnitIndex();
    renderAll();
  } catch {
    // Static file mode keeps using localStorage.
  }
}

function ensureStayKeys() {
  stays.forEach((stay, index) => {
    if (!stay.key) {
      stay.key = `${stay.id}-${index}`;
    }
    if (stay.guest === "Disponibil") {
      stay.personId = "";
    } else if (!stay.personId) {
      stay.personId = normalizePersonId("", stay.key);
    }
  });
}

function saveStays() {
  markPagesDirty();
  ensureStayKeys();
  try {
    localStorage.setItem(staysStorageKey, JSON.stringify(stays));
    localStorage.setItem(stationingStorageKey, JSON.stringify(stationing));
    localStorage.setItem(barArticlesStorageKey, JSON.stringify(barArticles));
  } catch {
    // Local storage can fail in private browsing or restricted file contexts.
  }
  rebuildStaysByUnitIndex();
  queueFileSave();
}

function configSnapshot() {
  return {
    savedAt: new Date().toISOString(),
    activeMode,
    activePage,
    sidebarCollapsed,
    visibleMonth: toISODate(visibleMonth),
    timelineWindowStart: toISODate(timelineWindowStart),
    googleReviewData,
    googleReviewTotal: storedGoogleReviewTotal(),
    reviewsEndpoint: localStorage.getItem("marinaParkReviewsEndpoint") || "",
    receiptConfig,
    sagaExportConfig,
    facilityCatalog,
    roomUnitCatalogSeeded: true
  };
}

async function saveStaysToFiles(options = {}) {
  const runSave = async () => {
    try {
      const config = configSnapshot();
      const response = await fetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stays, units, stationing, barArticles, config, baseSavedAt: lastDatabaseSavedAt })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status}`);
      lastDatabaseSavedAt = result.savedAt || config.savedAt;
      if (options.showMessage) {
        showToast("Baza de date locală a fost actualizată");
      }
      return true;
    } catch (error) {
      const message = String(error.message || "");
      if (message.includes("altă fereastră") || options.showMessage) {
        showToast(message || "Nu am putut salva baza de date locală");
      }
      return false;
    }
  };
  const savePromise = saveToFilesPromise.then(runSave, runSave);
  saveToFilesPromise = savePromise.catch(() => false);
  return savePromise;
}

function queueFileSave() {
  window.clearTimeout(saveToFilesTimer);
  saveToFilesTimer = window.setTimeout(saveStaysToFiles, 250);
}

function applyReceiptSettings() {
  if (!settingsForm) return;
  receiptDirectoryInput.value = receiptConfig.receiptDirectory || "";
  receiptVatInput.value = receiptConfig.receiptVat || "19";
  cardPaymentCodeInput.value = receiptConfig.cardPaymentCode || "1";
  cashPaymentCodeInput.value = receiptConfig.cashPaymentCode || "0";
}

function readReceiptSettings() {
  receiptConfig = {
    receiptDirectory: receiptDirectoryInput.value.trim(),
    receiptVat: String(Math.max(0, Number(receiptVatInput.value || 0))),
    cardPaymentCode: String(cardPaymentCodeInput.value || "1").trim() || "1",
    cashPaymentCode: String(cashPaymentCodeInput.value || "0").trim() || "0"
  };
  localStorage.setItem("marinaParkReceiptDirectory", receiptConfig.receiptDirectory);
  localStorage.setItem("marinaParkReceiptVat", receiptConfig.receiptVat);
  localStorage.setItem("marinaParkCardPaymentCode", receiptConfig.cardPaymentCode);
  localStorage.setItem("marinaParkCashPaymentCode", receiptConfig.cashPaymentCode);
  queueFileSave();
  return receiptConfig;
}

function applySagaExportSettings() {
  if (!sagaExportForm) return;
  sagaExportForm.elements.companyCif.value = sagaExportConfig.companyCif || "";
  sagaExportForm.elements.companyName.value = sagaExportConfig.companyName || "Marina Park";
  sagaExportForm.elements.clientName.value = sagaExportConfig.clientName || "Client generic bar";
  sagaExportForm.elements.productName.value = sagaExportConfig.productName || "";
  sagaExportForm.elements.vatRate.value = ["", "0", "11", "21"].includes(String(sagaExportConfig.vatRate || "")) ? sagaExportConfig.vatRate : "";
}

function readSagaExportSettings() {
  sagaExportConfig = {
    companyCif: String(sagaExportForm.elements.companyCif.value || "").trim(),
    companyName: String(sagaExportForm.elements.companyName.value || "").trim() || "Marina Park",
    clientName: String(sagaExportForm.elements.clientName.value || "").trim() || "Client generic bar",
    productName: String(sagaExportForm.elements.productName.value || "").trim(),
    vatRate: ["0", "11", "21"].includes(String(sagaExportForm.elements.vatRate.value || ""))
      ? String(sagaExportForm.elements.vatRate.value)
      : ""
  };
  localStorage.setItem("marinaParkSagaCompanyCif", sagaExportConfig.companyCif);
  localStorage.setItem("marinaParkSagaCompanyName", sagaExportConfig.companyName);
  localStorage.setItem("marinaParkSagaClientName", sagaExportConfig.clientName);
  localStorage.setItem("marinaParkSagaProductName", sagaExportConfig.productName);
  localStorage.setItem("marinaParkSagaVatRate", sagaExportConfig.vatRate);
  queueFileSave();
  return sagaExportConfig;
}

function receiptAmountFor(stay) {
  if (!stay || stay.guest === "Disponibil") return 0;
  if (isStayFullyPaid(stay)) return 0;
  const price = normalizeMoneyValue(stay.price);
  const settledPrice = paymentCoveredPriceForStay(stay);
  if (settledPrice > 0) {
    return Math.max(0, normalizeMoneyValue(price - settledPrice));
  }
  return price;
}

function receiptDraftFromBookingForm(stay) {
  if (!bookingModal.classList.contains("is-open") || editingStayKey !== stay.key) {
    return null;
  }

  const selectedUnit = unitById(bookingForm.elements.unitId.value);
  const kind = selectedUnit?.kind || bookingForm.elements.kind.value || stay.kind;
  const group = selectedUnit?.group || groupFromKind(kind);
  const price = normalizeMoneyValue(bookingForm.elements.price.value || stay.price);
  const formBalance = normalizeMoneyValue(bookingForm.elements.balance.value || stay.balance || price);
  const amount = normalizeMoneyValue(receiptAmountFor({ ...stay, price, balance: formBalance }));

  return {
    amount,
    stay: {
      ...stay,
      id: selectedUnit?.id || stay.id,
      personId: stay.personId || bookingPersonId || normalizePersonId("", stay.key),
      group,
      kind,
      guest: String(bookingForm.elements.guest.value || stay.guest).trim() || stay.guest,
      phone: String(bookingForm.elements.phone.value || stay.phone).trim(),
      adults: Number(bookingForm.elements.adults.value || stay.adults || 0),
      children: Number(bookingForm.elements.children.value || stay.children || 0),
      party: Number(bookingForm.elements.party.value || stay.party || 0),
      car: String(bookingForm.elements.car.value || stay.car || "").trim(),
      start: bookingForm.elements.arrival.value || stay.start,
      end: bookingForm.elements.departure.value || stay.end,
      dates: formatStayDates(bookingForm.elements.arrival.value || stay.start, bookingForm.elements.departure.value || stay.end),
      basePrice: normalizeMoneyValue(bookingForm.elements.basePrice.value || stay.basePrice || stay.price),
      facilities: refreshFacilityNights(bookingFacilityDraft, bookingForm.elements.arrival.value || stay.start, bookingForm.elements.departure.value || stay.end),
      barItems: normalizeStayBarItems(stay.barItems),
      price,
      balance: formBalance,
      deposit: Math.max(0, price - formBalance),
      paymentMethod: bookingForm.elements.paymentMethod.value || stay.paymentMethod || "",
      note: String(bookingForm.elements.note.value || stay.note || "").trim()
    },
    source: "form"
  };
}

function receiptDraftForStay(stay) {
  const formDraft = receiptDraftFromBookingForm(stay);
  if (formDraft) return formDraft;

  return {
    amount: normalizeMoneyValue(receiptAmountFor(stay)),
    stay: { ...stay },
    source: "saved"
  };
}

function stationingDraftFromForm(record) {
  if (!stationingModal.classList.contains("is-open") || editingStationingKey !== record.key) {
    return null;
  }

  return normalizeStationingRecord({
    ...record,
    owner: String(stationingForm.elements.owner.value || record.owner).trim() || record.owner,
    phone: String(stationingForm.elements.phone.value || record.phone).trim(),
    caravan: String(stationingForm.elements.caravan.value || record.caravan).trim() || record.caravan,
    startDate: stationingForm.elements.startDate.value || record.startDate,
    prepaidNights: Number(stationingForm.elements.prepaidNights.value || record.prepaidNights || 1),
    nightlyPrice: Number(stationingForm.elements.nightlyPrice.value || record.nightlyPrice || 0),
    totalPrice: Number(stationingForm.elements.totalPrice.value || record.totalPrice || 0),
    paidAmount: Number(stationingForm.elements.paidAmount.value || record.paidAmount || 0),
    note: String(stationingForm.elements.note.value || record.note || "").trim()
  });
}

function receiptDraftForStationing(record) {
  const formDraft = stationingDraftFromForm(record);
  const sourceRecord = formDraft || record;
  return {
    amount: normalizeMoneyValue(sourceRecord.balance),
    stationing: { ...sourceRecord },
    stay: {
      key: sourceRecord.key,
      guest: sourceRecord.owner,
      id: sourceRecord.caravan,
      kind: "Staționare rulotă",
      price: sourceRecord.totalPrice,
      balance: sourceRecord.balance,
      note: sourceRecord.note
    },
    source: formDraft ? "form" : "saved"
  };
}

function openReceiptModal(stayKey) {
  const stay = stays.find((item) => item.key === stayKey);
  if (!stay || stay.guest === "Disponibil") return;

  readReceiptSettings();
  receiptTargetType = "stay";
  receiptStayKey = stay.key;
  receiptDraft = receiptDraftForStay(stay);
  const amount = receiptDraft.amount;
  if (amount <= 0) {
    showToast("Rezervarea este deja marcată ca achitată.");
    return;
  }
  receiptSummary.innerHTML = `
    <strong>Plata cu numerar, card sau voucher</strong>
    <span>${receiptDraft.stay.guest}</span>
    <span>${receiptDraft.stay.id} - ${receiptDraft.stay.kind}</span>
    <span>Sumă bon: ${formatCurrency(amount)}</span>
  `;
  receiptAmountInput.value = amount.toFixed(2);
  receiptAmountInput.removeAttribute("max");
  receiptModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  refreshIcons();
}

function openLinkedReceiptModal(personId) {
  const linked = linkedReservationsForPerson(personId).filter((s) => s.guest !== "Disponibil");
  if (!linked.length) return;

  const totalBalance = linked.reduce((sum, s) => sum + normalizeMoneyValue(receiptAmountFor(s)), 0);
  const totalPrice = linked.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const firstStay = linked[0];
  if (totalBalance <= 0) {
    showToast("Toate rezervările clientului sunt deja marcate ca achitate.");
    return;
  }

  readReceiptSettings();
  receiptTargetType = "stay";
  receiptStayKey = firstStay.key;
  receiptDraft = {
    amount: totalBalance,
    stay: { ...firstStay, price: totalPrice, balance: totalBalance },
    source: "saved",
    isLinkedTotal: true,
    linkedKeys: linked.map((s) => s.key)
  };

  const stayLines = linked.map((s, i) => {
    const nights = stayDetails(s).nights;
    const bal = receiptAmountFor(s);
    const paid = isStayFullyPaid(s);
    return `<span style="opacity:0.85;font-size:12px">  ${i + 1}. ${escapeHtml(s.id)} · ${nights} ${nights === 1 ? "noapte" : "nopți"} · ${formatCurrency(s.price || 0)} ${paid ? "✓" : `(rest ${formatCurrency(bal)})`}</span>`;
  }).join("");

  receiptSummary.innerHTML = `
    <strong>Plată totală – ${linked.length} rezervări</strong>
    <span>${escapeHtml(firstStay.guest)}</span>
    ${stayLines}
    <span style="margin-top:4px;font-weight:800;font-size:14px">Total de plată: ${formatCurrency(totalBalance)}</span>
  `;
  receiptAmountInput.value = totalBalance.toFixed(2);
  receiptAmountInput.removeAttribute("max");
  receiptModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  refreshIcons();
}

function openStationingReceiptModal(recordKey) {
  const record = stationing.find((item) => item.key === recordKey);
  if (!record) return;

  readReceiptSettings();
  receiptTargetType = "stationing";
  receiptStayKey = record.key;
  receiptDraft = receiptDraftForStationing(record);
  const amount = receiptDraft.amount;
  const details = stationingDetails(receiptDraft.stationing);
  receiptSummary.innerHTML = `
    <strong>Plata cu numerar, card sau voucher</strong>
    <span>${receiptDraft.stationing.owner}</span>
    <span>${receiptDraft.stationing.caravan} - staționare rulotă</span>
    <span>${details.paidNights} nopți plătite din ${details.prepaidNights}; rest curent ${formatCurrency(receiptDraft.stationing.balance)}</span>
  `;
  receiptAmountInput.value = amount.toFixed(2);
  receiptAmountInput.removeAttribute("max");
  receiptModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  refreshIcons();
}

function closeReceiptModal() {
  receiptModal.classList.remove("is-open");
  receiptStayKey = null;
  receiptDraft = null;
  receiptTargetType = "stay";
  setReceiptPaymentBusy(false);
  if (!bookingModal.classList.contains("is-open") && !stationingModal.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
}

function setReceiptPaymentBusy(isBusy) {
  receiptPaymentInProgress = isBusy;
  receiptForm.setAttribute("aria-busy", String(isBusy));
  receiptForm.querySelectorAll("[data-receipt-method]").forEach((button) => {
    button.disabled = isBusy;
  });
}

function unitDraftFromForm() {
  const adultPrice = firstUnitCalendarPrice(unitPricingDraft);
  return normalizeUnit({
    id: editingUnitId || unitForm.elements.id.value || "Unitate nouă",
    kind: unitForm.elements.kind.value || (activeMode === "camping" ? "Campare cort" : "Cameră dublă"),
    group: unitForm.elements.group.value || activeMode,
    pricingMode: unitForm.elements.pricingMode.value,
    adultPrice,
    childPrice: adultPrice / 2,
    dailyPrices: unitPricingDraft
  });
}

function firstUnitCalendarPrice(dailyPrices = unitPricingDraft) {
  const normalized = normalizeDailyPrices(dailyPrices);
  const firstPrice = Object.keys(normalized)
    .sort()
    .map((dateText) => normalized[dateText])
    .find((price) => Number(price || 0) > 0);
  return normalizeMoneyValue(firstPrice || 0);
}

function setUnitPricingSelection(startText, endText = startText) {
  const bounds = dateRangeBounds(startText, endText);
  if (!bounds) return;
  unitPricingSelectedDates = new Set(inclusiveDateTexts(bounds.start, bounds.end));
  const dailyPrices = normalizeDailyPrices(unitPricingDraft);
  const selectedRate = Object.prototype.hasOwnProperty.call(dailyPrices, bounds.startText) ? dailyPrices[bounds.startText] : 0;
  unitDayPriceInput.value = selectedRate.toFixed(2);
  renderUnitPricingCalendar();
}

function selectUnitPricingDate(dateText) {
  if (!unitPricingAnchorDate) {
    unitPricingAnchorDate = dateText;
    setUnitPricingSelection(dateText);
    return;
  }

  if (unitPricingAnchorDate === dateText) {
    setUnitPricingSelection(dateText);
    return;
  }

  setUnitPricingSelection(unitPricingAnchorDate, dateText);
  unitPricingAnchorDate = null;
}

function renderUnitPricingCalendar() {
  if (!unitPricingCalendar) return;
  const unit = unitDraftFromForm();
  const selectedCount = unitPricingSelectedDates.size;
  const selectedDates = [...unitPricingSelectedDates].sort();
  const selectedStart = selectedDates[0] || "";
  const selectedEnd = selectedDates[selectedDates.length - 1] || "";
  unitPricingMonthLabel.textContent = calendarMonthLabel(unitPricingMonth);
  unitPricingCalendar.innerHTML =
    calendarWeekdayHeader() +
    calendarGridDates(unitPricingMonth)
      .map((date) => {
        const dateText = toISODate(date);
        const rates = unitRatesForDate(unit, dateText);
        const isOutside = date.getMonth() !== unitPricingMonth.getMonth();
        const isSelected = unitPricingSelectedDates.has(dateText);
        const isRangeStart = isSelected && dateText === selectedStart;
        const isRangeEnd = isSelected && dateText === selectedEnd;
        const classNames = [
          "calendar-day",
          isOutside ? "is-outside" : "",
          dateText === toISODate(today) ? "is-today" : "",
          rates.hasCustomPrice ? "is-custom-price" : "",
          isSelected ? "is-selected" : "",
          isRangeStart ? "is-range-start" : "",
          isRangeEnd ? "is-range-end" : "",
          isRangeStart || isRangeEnd ? "is-range-edge" : ""
        ]
          .filter(Boolean)
          .join(" ");
        return `
          <button class="${classNames}" type="button" data-unit-price-date="${dateText}" aria-label="${date.toLocaleDateString("ro-RO")}, ${formatCurrency(rates.primaryPrice)}">
            <strong>${date.getDate()}</strong>
            <small>${formatCompactMoney(rates.primaryPrice)}</small>
          </button>
        `;
      })
      .join("");

  const baseLabel =
    unit.pricingMode === "per-person-night"
      ? "Per persoană: adult = tariful zilei, copil = jumătate"
      : "Pe noapte: tariful zilei";
  const customCount = Object.keys(normalizeDailyPrices(unitPricingDraft)).length;
  unitPricingSummary.textContent = `${selectedCount || 0} zile selectate · ${customCount} tarife calendar · ${baseLabel}`;
  refreshIcons();
}

function applyUnitSelectedDayPrice() {
  const selectedDates = [...unitPricingSelectedDates];
  if (!selectedDates.length) {
    showToast("Selectează cel puțin o zi în calendar");
    return;
  }

  const price = normalizeMoneyValue(unitDayPriceInput.value);
  selectedDates.forEach((dateText) => {
    if (price > 0) {
      unitPricingDraft[dateText] = price;
    } else {
      delete unitPricingDraft[dateText];
    }
  });
  renderUnitPricingCalendar();
}

function clearUnitSelectedDayPrice() {
  const selectedDates = [...unitPricingSelectedDates];
  if (!selectedDates.length) return;
  selectedDates.forEach((dateText) => delete unitPricingDraft[dateText]);
  renderUnitPricingCalendar();
}

function openUnitModal(unitId = null) {
  const requestedUnitId = typeof unitId === "string" ? unitId : null;
  const unit = requestedUnitId ? unitById(requestedUnitId) : null;
  editingUnitId = unit?.id || null;
  unitPricingDraft = normalizeDailyPrices(unit?.dailyPrices);
  const bookingDate = bookingModal.classList.contains("is-open") ? validDateFromISO(bookingForm.elements.arrival?.value) : null;
  const initialPricingDate = bookingDate || today;
  unitPricingMonth = monthStart(initialPricingDate);
  unitPricingSelectedDates = new Set([toISODate(initialPricingDate)]);
  unitPricingAnchorDate = toISODate(initialPricingDate);
  unitForm.reset();
  document.querySelector("#unitModalTitle").textContent = editingUnitId ? "Editează unitatea" : "Unitate nouă";
  unitForm.querySelector("[type='submit'] span").textContent = editingUnitId ? "Salvează unitatea" : "Adaugă unitatea";
  unitForm.elements.id.value = unit?.id || "";
  unitForm.elements.id.disabled = Boolean(editingUnitId);
  unitForm.elements.group.value = unit?.group || (activeMode === "camping" ? "camping" : "room");
  unitForm.elements.kind.value = unit?.kind || (activeMode === "camping" ? "Campare cort" : "Cameră dublă");
  unitForm.elements.pricingMode.value = unit?.pricingMode || "per-night";
  const calendarBasePrice = firstUnitCalendarPrice(unitPricingDraft);
  setUnitMoneyField("adultPrice", calendarBasePrice);
  setUnitMoneyField("childPrice", calendarBasePrice / 2);
  const selectedRate = unitRatesForDate(unitDraftFromForm(), toISODate(initialPricingDate)).primaryPrice;
  unitDayPriceInput.value = selectedRate.toFixed(2);
  renderUnitPricingCalendar();
  unitModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => unitForm.elements.id.focus(), 0);
}

function closeUnitModal() {
  unitModal.classList.remove("is-open");
  editingUnitId = null;
  unitForm.elements.id.disabled = false;
  if (
    !bookingModal.classList.contains("is-open") &&
    !receiptModal.classList.contains("is-open") &&
    !cloneUnitModal.classList.contains("is-open")
  ) {
    document.body.style.overflow = "";
  }
}

function setUnitMoneyField(name, value) {
  unitForm.elements[name].value = Number(value || 0).toFixed(2);
}

function cloneUnitOptionList() {
  return unitOptions().sort((first, second) => first.id.localeCompare(second.id, "ro-RO", { numeric: true }));
}

function syncCloneUnitPreview() {
  const sourceUnit = unitById(cloneUnitSourceSelect.value);
  if (!sourceUnit) {
    cloneUnitPreview.textContent = "Alege o unitate existentă pentru a copia setările.";
    return;
  }

  const modeLabel = sourceUnit.pricingMode === "per-person-night" ? "pe persoană/noapte" : "pe noapte";
  const groupLabel = sourceUnit.group === "camping" ? "Camping" : "Camere";
  const customCount = Object.keys(normalizeDailyPrices(sourceUnit.dailyPrices)).length;
  cloneUnitPreview.textContent = `Se copiază: ${sourceUnit.kind} · ${groupLabel} · ${modeLabel} · ${customCount} tarife calendar.`;
}

function renderCloneUnitOptions(selectedUnitId = "") {
  const allUnits = cloneUnitOptionList();
  cloneUnitSourceSelect.innerHTML = allUnits
    .map((unit) => `<option value="${escapeHtml(unit.id)}" ${unit.id === selectedUnitId ? "selected" : ""}>${escapeHtml(unit.id)} - ${escapeHtml(unit.kind)}</option>`)
    .join("");
  if (selectedUnitId && cloneUnitSourceSelect.value !== selectedUnitId) {
    cloneUnitSourceSelect.value = selectedUnitId;
  }
  syncCloneUnitPreview();
}

function openCloneUnitModal(sourceUnitId = "") {
  const allUnits = cloneUnitOptionList();
  if (!allUnits.length) {
    showToast("Nu există unități de clonat");
    return;
  }

  const selectedUnitId = allUnits.some((unit) => unit.id === sourceUnitId) ? sourceUnitId : allUnits[0].id;
  cloneUnitForm.reset();
  renderCloneUnitOptions(selectedUnitId);
  cloneUnitModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => cloneUnitForm.elements.newUnitId.focus(), 0);
}

function closeCloneUnitModal() {
  cloneUnitModal.classList.remove("is-open");
  if (
    !bookingModal.classList.contains("is-open") &&
    !receiptModal.classList.contains("is-open") &&
    !unitModal.classList.contains("is-open")
  ) {
    document.body.style.overflow = "";
  }
}

function cloneUnit(sourceUnitId, newUnitId) {
  const sourceUnit = unitById(sourceUnitId);
  const id = String(newUnitId || "").trim();
  if (!sourceUnit) {
    showToast("Alege unitatea de clonat");
    return false;
  }
  if (!id) {
    showToast("Numele unității noi este obligatoriu");
    return false;
  }
  if (unitById(id)) {
    showToast(`Există deja unitatea ${id}`);
    return false;
  }

  return saveUnit({
    ...sourceUnit,
    id,
    dailyPrices: { ...normalizeDailyPrices(sourceUnit.dailyPrices) }
  });
}

function saveUnit(unit) {
  const normalized = normalizeUnit(unit);
  if (!normalized.id) return false;

  const existingIndex = units.findIndex((item) => item.id === normalized.id);
  const previousUnit = existingIndex >= 0 ? { ...units[existingIndex] } : null;
  if (existingIndex >= 0) {
    units[existingIndex] = normalized;
  } else {
    units.push(normalized);
  }
  markPagesDirty("calendar", "clients", "settings", "statistics");
  units.sort((first, second) => first.id.localeCompare(second.id, "ro-RO", { numeric: true }));
  queueFileSave();
  renderAll();
  renderUnitList();
  renderUnitSelect(normalized.id);
  applySelectedUnitPricing();
  logActivity({
    eventType: existingIndex >= 0 ? "update" : "create",
    entityType: "unit",
    entityKey: normalized.id,
    entityLabel: `${normalized.id} (${normalized.kind})`,
    message:
      existingIndex >= 0
        ? `Unitatea ${normalized.id} a fost actualizată.`
        : `Unitatea ${normalized.id} a fost adăugată.`,
    data: {
      previous: previousUnit,
      current: normalized,
      changedFields: previousUnit
        ? ["kind", "group", "pricingMode", "dailyPrices"].filter(
            (field) => String(previousUnit[field] ?? "") !== String(normalized[field] ?? "")
          )
        : []
    }
  });
  return true;
}

function unitUsageCount(unitId) {
  return stays.filter((stay) => stay.id === unitId && stay.guest !== "Disponibil").length;
}

function renderUnitList() {
  if (!unitList) return;
  const allUnits = unitOptions().sort((first, second) => first.id.localeCompare(second.id, "ro-RO", { numeric: true }));
  if (!allUnits.length) {
    unitList.innerHTML = `<p class="empty-state">Nu există unități configurate.</p>`;
    return;
  }

  unitList.innerHTML = allUnits
    .map((unit) => {
      const usage = unitUsageCount(unit.id);
      const modeLabel = unit.pricingMode === "per-person-night" ? "pe persoană/noapte" : "pe noapte";
      const customCount = Object.keys(normalizeDailyPrices(unit.dailyPrices)).length;
      const pricingLabel =
        unit.pricingMode === "per-person-night"
          ? "adult = tarif zi, copil = jumătate"
          : "tarif pe zi/noapte";
      const escapedId = escapeHtml(unit.id);
      const escapedKind = escapeHtml(unit.kind);

      return `
        <article class="unit-list-card">
          <div>
            <strong>${escapedId}</strong>
            <span>${escapedKind} · ${unit.group === "camping" ? "Camping" : "Camere"}</span>
            <small>${modeLabel} · ${pricingLabel} · ${customCount} tarife calendar</small>
          </div>
          <div class="unit-list-actions">
            <span class="unit-usage">${usage} rezervări</span>
            <button class="icon-button compact" type="button" data-clone-unit="${escapedId}" title="Clonează unitatea" aria-label="Clonează unitatea ${escapedId}">
              <i data-lucide="copy" aria-hidden="true"></i>
            </button>
            <button class="icon-button compact" type="button" data-edit-unit="${escapedId}" title="Editează unitatea" aria-label="Editează unitatea ${escapedId}">
              <i data-lucide="pencil" aria-hidden="true"></i>
            </button>
            <button class="icon-button compact danger-button" type="button" data-delete-unit="${escapedId}" title="${usage ? "Unitatea are rezervări" : "Șterge unitatea"}" aria-label="Șterge unitatea ${escapedId}">
              <i data-lucide="trash-2" aria-hidden="true"></i>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
  refreshIcons();
}

function deleteUnit(unitId) {
  const usage = unitUsageCount(unitId);
  if (usage > 0) {
    showToast(`Unitatea ${unitId} are ${usage} rezervări. Mută sau șterge rezervările înainte.`);
    return;
  }
  const confirmed = window.confirm(`Ștergi unitatea ${unitId}?`);
  if (!confirmed) return;

  const deletedUnit = units.find((unit) => unit.id === unitId);
  units = units.filter((unit) => unit.id !== unitId);
  markPagesDirty("calendar", "clients", "settings", "statistics");
  queueFileSave();
  renderAll();
  renderUnitList();
  logActivity({
    eventType: "delete",
    entityType: "unit",
    entityKey: unitId,
    entityLabel: `${unitId} (${deletedUnit?.kind || "unitate"})`,
    message: `Unitatea ${unitId} a fost ștearsă.`,
    data: { unit: deletedUnit }
  });
  showToast(`Unitate ștearsă: ${unitId}`);
}

async function generateReceipt(stayKey, method) {
  if (receiptPaymentInProgress) return false;
  setReceiptPaymentBusy(true);
  const targetType = receiptTargetType;
  const isVoucher = method === "voucher";

  try {
    const config = isVoucher ? null : readReceiptSettings();
    if (!isVoucher && !config.receiptDirectory) {
      showToast("Configurează bonurile în Setări");
      closeReceiptModal();
      setActivePage("settings");
      return false;
    }

    const stay = targetType === "stay" ? stays.find((item) => item.key === stayKey) : null;
    const stationingRecord = targetType === "stationing" ? stationing.find((item) => item.key === stayKey) : null;
    if (targetType === "stay" && (!stay || stay.guest === "Disponibil")) return false;
    if (targetType === "stationing" && !stationingRecord) return false;

    const draft =
      targetType === "stationing"
        ? receiptDraft && receiptDraft.stationing?.key === stationingRecord.key
          ? receiptDraft
          : receiptDraftForStationing(stationingRecord)
        : receiptDraft && receiptDraft.stay?.key === stay.key
          ? receiptDraft
          : receiptDraftForStay(stay);
    const availableAmount = normalizeMoneyValue(draft.amount);
    const amount = normalizeMoneyValue(receiptAmountInput.value || availableAmount);
    if (targetType === "stay" && draft.isLinkedTotal && Array.isArray(draft.linkedKeys)) {
      const currentLinkedDue = draft.linkedKeys
        .map((key) => stays.find((item) => item.key === key))
        .filter(Boolean)
        .reduce((sum, item) => sum + receiptAmountFor(item), 0);
      if (currentLinkedDue <= 0) {
        showToast("Toate rezervÄƒrile clientului sunt deja marcate ca achitate.");
        return false;
      }
    } else if (targetType === "stay" && isStayFullyPaid(stay)) {
      showToast("Rezervarea este deja marcatÄƒ ca achitatÄƒ.");
      return false;
    }
    if (amount <= 0) {
      showToast("Prețul pentru bon trebuie să fie mai mare decât 0");
      return false;
    }

    const paymentBefore = targetType === "stationing" ? { ...stationingRecord } : { ...stay };
    const formEditChanges =
      targetType === "stationing" && draft.source === "form"
        ? stationingChangeList(paymentBefore, draft.stationing)
        : targetType === "stay" && draft.source === "form"
          ? stayChangeList(paymentBefore, draft.stay)
          : [];
    let savedStationingRecord = null;
    let linkedPaymentBefore = [];
    let linkedPaymentRecords = [];

    if (!isVoucher) {
      const response = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stay: draft.stay,
          method,
          amount,
          receiptConfig: config
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Nu am putut genera bonul");
    }

    if (targetType === "stationing") {
      const source = draft.stationing;
      const nextPaidAmount = Math.min(Number(source.totalPrice || 0), normalizeMoneyValue(Number(source.paidAmount || 0) + amount));
      const nextRecord = normalizeStationingRecord({
        ...source,
        paidAmount: nextPaidAmount
      });
      const recordIndex = stationing.findIndex((item) => item.key === stationingRecord.key);
      if (recordIndex >= 0) {
        stationing[recordIndex] = nextRecord;
      }
      savedStationingRecord = nextRecord;
      if (stationingModal.classList.contains("is-open") && editingStationingKey === nextRecord.key) {
        stationingForm.elements.paidAmount.value = nextRecord.paidAmount.toFixed(2);
        syncStationingTotals();
      }
    } else if (draft.isLinkedTotal && Array.isArray(draft.linkedKeys)) {
      linkedPaymentBefore = draft.linkedKeys
        .map((key) => stays.find((item) => item.key === key))
        .filter(Boolean)
        .map((item) => ({ ...item, barItems: normalizeStayBarItems(item.barItems) }));

      draft.linkedKeys.forEach((key) => {
        const linkedStay = stays.find((item) => item.key === key);
        if (!linkedStay || linkedStay.guest === "Disponibil") return;
        linkedStay.paymentMethod = method;
        linkedStay.paid = true;
        linkedStay.settledPrice = normalizeMoneyValue(linkedStay.price);
        linkedPaymentRecords.push(linkedStay);
      });
    } else {
      if (draft.source === "form") {
        Object.assign(stay, draft.stay, {
          paymentMethod: method
        });
      }
      stay.paymentMethod = method;
      stay.price = Number(draft.stay.price || stay.price || amount);
      stay.paid = true;
      stay.settledPrice = normalizeMoneyValue(stay.price);
      stay.actualPaidAmount = amount;
    }
    if (formEditChanges.length) {
      if (targetType === "stationing") {
        const editedRecord = savedStationingRecord || stationingRecord;
        await logActivity({
          eventType: "update",
          entityType: "stationing",
          entityKey: editedRecord.key,
          entityLabel: activityStationingLabel(editedRecord),
          message: `Fișa de staționare pentru ${editedRecord.owner} a fost salvată din popup-ul de plată: ${formEditChanges.join("; ")}.`,
          data: {
            previous: paymentBefore,
            current: draft.stationing,
            changes: formEditChanges,
            editSession: stationingEditSession,
            savedFromPaymentPopup: true
          }
        });
      } else {
        await logActivity({
          eventType: "update",
          entityType: "client",
          entityKey: stay.key,
          entityLabel: activityStayLabel(stay),
          message: `Fișa clientului ${stay.guest} a fost salvată din popup-ul de plată: ${formEditChanges.join("; ")}.`,
          data: {
            previous: paymentBefore,
            current: draft.stay,
            changes: formEditChanges,
            editSession: bookingEditSession,
            savedFromPaymentPopup: true
          }
        });
      }
    }
    if (targetType === "stationing") {
      const nextRecord = savedStationingRecord || stationingRecord;
      const originalTotalPrice = Number(paymentBefore.totalPrice || 0);
      await logActivity({
        eventType: "payment",
        entityType: "stationing",
        entityKey: nextRecord.key,
        entityLabel: activityStationingLabel(nextRecord),
        amount,
        method,
        message: isVoucher
          ? `${nextRecord.owner} paid by voucher: ${formatActivityMoney(amount)} pentru staționare. Preț inițial staționare: ${formatActivityMoney(originalTotalPrice)}; plătit efectiv: ${formatActivityMoney(amount)}.`
          : `${nextRecord.owner} a plătit ${formatActivityMoney(amount)} pentru staționare prin ${method}. Preț inițial staționare: ${formatActivityMoney(originalTotalPrice)}; plătit efectiv: ${formatActivityMoney(amount)}.`,
        data: {
          owner: nextRecord.owner,
          caravan: nextRecord.caravan,
          method,
          amount,
          originalTotalPrice,
          actualPaidAmount: amount,
          previousPaidAmount: Number(paymentBefore.paidAmount || 0),
          newPaidAmount: Number(nextRecord.paidAmount || 0),
          previousBalance: Number(paymentBefore.balance || 0),
          newBalance: Number(nextRecord.balance || 0),
          totalPrice: Number(nextRecord.totalPrice || 0),
          savedEdits: formEditChanges,
          editSession: stationingEditSession
        }
      });
    } else {
      const initialEditPrice = Number(bookingEditSession?.initialPrice ?? stay.price);
      const isLinkedTotalPayment = Boolean(draft.isLinkedTotal && linkedPaymentRecords.length);
      const linkedPreviousPrice = linkedPaymentBefore.reduce((sum, item) => sum + Number(item.price || 0), 0);
      const linkedPreviousBalance = linkedPaymentBefore.reduce((sum, item) => sum + Number(item.balance || 0), 0);
      const linkedCurrentPrice = linkedPaymentRecords.reduce((sum, item) => sum + Number(item.price || 0), 0);
      const linkedCurrentBalance = linkedPaymentRecords.reduce((sum, item) => sum + Number(item.balance || 0), 0);
      const linkedPreviousSettledPrice = linkedPaymentBefore.reduce((sum, item) => sum + paymentCoveredPriceForStay(item), 0);
      const linkedCurrentSettledPrice = linkedPaymentRecords.reduce((sum, item) => sum + paymentCoveredPriceForStay(item), 0);
      const originalCustomerPrice = isLinkedTotalPayment ? linkedPreviousPrice : Number(paymentBefore.price || 0);
      const customerPriceAtPayment = isLinkedTotalPayment ? linkedCurrentPrice : Number(stay.price || 0);
      const priceChangedDuringEdit = Boolean(
        draft.source === "form" &&
          bookingEditSession?.key === stay.key &&
          Number.isFinite(initialEditPrice) &&
          initialEditPrice !== customerPriceAtPayment
      );
      const priceEditMessage = priceChangedDuringEdit
        ? ` Prețul din fișa deschisă a fost modificat de la ${formatActivityMoney(initialEditPrice)} la ${formatActivityMoney(customerPriceAtPayment)} înainte de plată.`
        : "";
      const paymentEntityLabel = isLinkedTotalPayment
        ? `${stay.guest} (${linkedPaymentRecords.length} rezervări)`
        : activityStayLabel(stay);
      const paymentMessage = isLinkedTotalPayment
        ? `${stay.guest} a plătit ${formatActivityMoney(amount)} prin ${method} pentru ${linkedPaymentRecords.length} rezervări. Total client: ${formatActivityMoney(customerPriceAtPayment)}.`
        : isVoucher
          ? `${stay.guest} paid by voucher: ${formatActivityMoney(amount)}. Preț inițial client: ${formatActivityMoney(originalCustomerPrice)}; plătit efectiv: ${formatActivityMoney(amount)}.${priceEditMessage}`
          : `${stay.guest} a plătit ${formatActivityMoney(amount)} prin ${method}. Preț inițial client: ${formatActivityMoney(originalCustomerPrice)}; plătit efectiv: ${formatActivityMoney(amount)}.${priceEditMessage}`;
      await logActivity({
        eventType: "payment",
        entityType: "client",
        entityKey: stay.key,
        entityLabel: paymentEntityLabel,
        amount,
        method,
        message: paymentMessage,
        data: {
          client: stay.guest,
          unit: stay.id,
          kind: stay.kind,
          method,
          amount,
          originalCustomerPrice,
          customerPriceAtPayment,
          actualPaidAmount: amount,
          previousPrice: isLinkedTotalPayment ? linkedPreviousPrice : Number(paymentBefore.price || 0),
          newPrice: isLinkedTotalPayment ? linkedCurrentPrice : Number(stay.price || 0),
          previousBalance: isLinkedTotalPayment ? linkedPreviousBalance : Number(paymentBefore.balance || 0),
          newBalance: isLinkedTotalPayment ? linkedCurrentBalance : Number(stay.balance || 0),
          previousPaid: isLinkedTotalPayment ? linkedPaymentBefore.every(isStayFullyPaid) : isStayFullyPaid(paymentBefore),
          newPaid: isLinkedTotalPayment ? linkedPaymentRecords.every(isStayFullyPaid) : isStayFullyPaid(stay),
          previousSettledPrice: isLinkedTotalPayment ? linkedPreviousSettledPrice : paymentCoveredPriceForStay(paymentBefore),
          newSettledPrice: isLinkedTotalPayment ? linkedCurrentSettledPrice : paymentCoveredPriceForStay(stay),
          previousActualPaidAmount: isLinkedTotalPayment ? 0 : actualPaidAmountForStay(paymentBefore),
          newActualPaidAmount: isLinkedTotalPayment ? amount : actualPaidAmountForStay(stay),
          priceChangedDuringEdit,
          initialEditPrice,
          paidPrice: amount,
          savedEdits: formEditChanges,
          editOpenedAt: bookingEditSession?.openedAt || "",
          linkedPayment: isLinkedTotalPayment,
          linkedReservations: isLinkedTotalPayment
            ? linkedPaymentRecords.map((item) => ({
                key: item.key,
                id: item.id,
                price: Number(item.price || 0),
                previousBalance: Number(linkedPaymentBefore.find((previous) => previous.key === item.key)?.balance || 0),
                newBalance: Number(item.balance || 0),
                previousSettledPrice: paymentCoveredPriceForStay(linkedPaymentBefore.find((previous) => previous.key === item.key)),
                newSettledPrice: paymentCoveredPriceForStay(item),
                previousPaid: isStayFullyPaid(linkedPaymentBefore.find((previous) => previous.key === item.key)),
                newPaid: isStayFullyPaid(item)
              }))
            : []
        }
      });
    }
    saveStays();
    closeReceiptModal();
    renderAll();
    if (targetType === "stay" && bookingModal.classList.contains("is-open")) {
      const currentStay = editingStayKey ? stays.find((item) => item.key === editingStayKey) : null;
      if (currentStay) {
        bookingForm.elements.paymentMethod.value = currentStay.paymentMethod || "";
      }
      renderLinkedReservations();
      renderBookingBarItems();
    }
    showToast(isVoucher ? "Client marcat ca plătit cu voucher." : "Bon generat.");
    return true;
  } catch (error) {
    const message = String(error.message || "");
    showToast(message.toLowerCase().includes("director") ? "Verifică setările pentru bonuri" : message || "Nu am putut genera bonul");
    return false;
  } finally {
    setReceiptPaymentBusy(false);
  }
}

function timelineColumn(dateText, fallback) {
  if (!dateText) return fallback;
  const date = dateFromISO(dateText);
  const dayCount = daysInTimelineWindow();
  return Math.min(Math.max(daysBetween(timelineWindowStart, date) + 2, 2), dayCount + 1);
}

function timelineEndColumn(dateText, fallback) {
  if (!dateText) return fallback;
  const date = dateFromISO(dateText);
  const dayCount = daysInTimelineWindow();
  return Math.min(Math.max(daysBetween(timelineWindowStart, date) + 2, 3), dayCount + 2);
}

function stayDetails(stay) {
  if (!stay.start || !stay.end) {
    return { nights: 0, progress: 0, label: stay.dates };
  }

  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  if (!start || !end) {
    return { nights: 0, progress: 0, label: stay.dates };
  }
  const nights = Math.max(1, daysBetween(start, end));
  const elapsed = Math.min(Math.max(daysBetween(start, today), 0), nights);
  const progress = Math.round((elapsed / nights) * 100);

  return {
    nights,
    progress,
    label: `${nights} ${nights === 1 ? "noapte" : "nopți"} - ${stay.dates}`
  };
}

function clientUrgency(stay) {
  if (!stay.start || !stay.end) {
    return { className: "is-upcoming", priority: 3 };
  }

  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  if (!start || !end) {
    return { className: "is-upcoming", priority: 3 };
  }
  const daysUntilCheckout = daysBetween(today, end);
  const isCurrentlyStaying = start <= today && end > today;

  if (daysUntilCheckout < 0) {
    return { className: "is-overdue", priority: -1 };
  }

  if (daysUntilCheckout === 0) {
    return { className: "is-leaving-today", priority: 0 };
  }

  if (daysUntilCheckout === 1) {
    return { className: "is-leaving-tomorrow", priority: 1 };
  }

  if (isCurrentlyStaying) {
    return { className: "is-current-stay", priority: 2 };
  }

  return { className: "is-upcoming", priority: 3 };
}

function linkedReservationsForPerson(personId) {
  const normalizedId = String(personId || "").trim();
  if (!normalizedId) return [];

  return stays
    .filter((stay) => stay.guest !== "Disponibil" && String(stay.personId || "").trim() === normalizedId)
    .sort((first, second) => {
      const firstStart = String(first.start || "");
      const secondStart = String(second.start || "");
      if (firstStart !== secondStart) return firstStart.localeCompare(secondStart);
      return String(first.id || "").localeCompare(String(second.id || ""), "ro-RO", { numeric: true });
    });
}

function linkedReservationsCountFor(stay) {
  return linkedReservationsForPerson(stay?.personId).length;
}

function shouldShowClientInList(stay) {
  return stayOverlapsVisibleMonth(stay) || clientUrgency(stay).priority < 0;
}

function timelineRowHeight(laneCount) {
  return Math.max(TIMELINE_ROW_BASE_HEIGHT, laneCount * TIMELINE_LANE_HEIGHT + 14);
}

function timelineLaneCacheKey(unit) {
  const staySignature = unit.stays.map((stay) => `${stay.key}:${stay.start}:${stay.end}`).join("|");
  return `${activeMode}:${unit.id}:${toISODate(timelineWindowStart)}:${daysInTimelineWindow()}:${searchTerm}:${staySignature}`;
}

function timelineLaneItems(unit) {
  const cacheKey = timelineLaneCacheKey(unit);
  const cachedLayout = timelineLayoutCache.get(cacheKey);
  if (cachedLayout) return cachedLayout;

  const laneEnds = [];
  const sorted = [...unit.stays].sort((first, second) => {
    const startCompare = String(first.start || "").localeCompare(String(second.start || ""));
    if (startCompare !== 0) return startCompare;
    return String(first.end || "").localeCompare(String(second.end || ""));
  });

  const items = sorted.map((stay) => {
    const start = stayStartDate(stay) || timelineWindowStart;
    const end = stayEndDate(stay) || addDays(start, 1);
    let laneIndex = laneEnds.findIndex((laneEnd) => start >= laneEnd);

    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[laneIndex] = end;
    }

    return {
      stay,
      lane: laneIndex + 1
    };
  });

  const layout = {
    items,
    laneCount: Math.max(1, laneEnds.length)
  };
  if (timelineLayoutCache.size > 1200) timelineLayoutCache.clear();
  timelineLayoutCache.set(cacheKey, layout);
  return layout;
}

function timelineBarHtml(stay, lane, dayCount) {
  const startColumn = timelineColumn(stay.start, 2);
  const endColumn = stay.end ? timelineEndColumn(stay.end, dayCount + 2) : dayCount + 2;
  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  const duration = start && end ? daysBetween(start, end) : 0;
  const compactClass = duration <= 1 ? "is-compact" : duration <= 2 ? "is-tight" : "";
  const paymentClass = isStayFullyPaid(stay) ? "is-paid" : "is-unpaid";
  const typeClass = stay.group === "camping" ? "is-camping-stay" : "is-room-stay";

  return `
    <div class="timeline-bar ${compactClass} ${typeClass} ${paymentClass}" data-stay-key="${escapeHtml(stay.key)}" data-guest="${escapeHtml(stay.guest)}" style="grid-column: ${startColumn} / ${endColumn}; grid-row: ${lane};" title="Trage mijlocul pentru mutare sau marginile pentru redimensionare">
      <button class="timeline-handle" type="button" data-drag-mode="resize-start" aria-label="Mută începutul"></button>
      <div class="timeline-bar-content" data-drag-mode="move">
        <div>
          <strong>${escapeHtml(stay.guest)}</strong>
          <span>${escapeHtml(stay.dates)}</span>
        </div>
        <span>${escapeHtml(stay.party)} pers.</span>
      </div>
      <button class="timeline-handle" type="button" data-drag-mode="resize-end" aria-label="Mută finalul"></button>
    </div>
  `;
}

function timelineVisibleDayBounds() {
  const dayCount = daysInTimelineWindow();
  const left = Math.max(0, timelineShell.scrollLeft - timelineUnitColumnWidth);
  const right = Math.max(0, timelineShell.scrollLeft + timelineShell.clientWidth - timelineUnitColumnWidth);
  return {
    startDay: Math.max(0, Math.floor(left / timelineDayWidth) - TIMELINE_BAR_OVERSCAN_DAYS),
    endDay: Math.min(dayCount, Math.ceil(right / timelineDayWidth) + TIMELINE_BAR_OVERSCAN_DAYS)
  };
}

function timelineStayOverlapsDayBounds(stay, bounds) {
  const dayCount = daysInTimelineWindow();
  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  const startDay = start ? daysBetween(timelineWindowStart, start) : 0;
  const endDay = end ? daysBetween(timelineWindowStart, end) : dayCount;
  return startDay < bounds.endDay && endDay > bounds.startDay;
}

function timelineRowHtml(row, virtualized = false, dayBounds = timelineVisibleDayBounds()) {
  const { unit, lanes } = row;
  const dayCount = daysInTimelineWindow();
  const bars = lanes.items
    .filter(({ stay }) => timelineStayOverlapsDayBounds(stay, dayBounds))
    .map(({ stay, lane }) => timelineBarHtml(stay, lane, dayCount))
    .join("");
  const positionStyle = virtualized
    ? ` --timeline-row-top: ${row.top}px; --timeline-row-height: ${row.height}px;`
    : "";

  return `
    <article class="timeline-row ${bars ? "" : "is-empty"}" data-unit-id="${escapeHtml(unit.id)}" data-kind="${escapeHtml(unit.kind)}" data-group="${escapeHtml(unit.group)}" style="--timeline-lanes: ${lanes.laneCount};${positionStyle}">
      <div class="timeline-unit">
        <strong>${escapeHtml(unit.id)}</strong>
        <span>${escapeHtml(unit.kind)}</span>
      </div>
      ${bars}
    </article>
  `;
}

function timelineVisibleRange(rows) {
  if (!timelineRenderState.virtualized) {
    return { startIndex: 0, endIndex: rows.length };
  }

  const scaleOffset = timelineScale.offsetHeight + TIMELINE_ROW_GAP;
  const viewportTop = Math.max(0, timelineShell.scrollTop - scaleOffset);
  const viewportBottom = viewportTop + timelineShell.clientHeight;
  let startIndex = 0;
  while (startIndex < rows.length && rows[startIndex].top + rows[startIndex].height < viewportTop) {
    startIndex += 1;
  }
  startIndex = Math.max(0, startIndex - TIMELINE_ROW_OVERSCAN);

  let endIndex = startIndex;
  while (endIndex < rows.length && rows[endIndex].top < viewportBottom) {
    endIndex += 1;
  }
  endIndex = Math.min(rows.length, endIndex + TIMELINE_ROW_OVERSCAN);

  return { startIndex, endIndex };
}

function renderVisibleTimelineRows(force = false) {
  const { rows } = timelineRenderState;
  if (!rows.length) return;
  const { startIndex, endIndex } = timelineVisibleRange(rows);
  const { startDay, endDay } = timelineVisibleDayBounds();
  if (
    !force &&
    startIndex === timelineRenderState.startIndex &&
    endIndex === timelineRenderState.endIndex &&
    startDay === timelineRenderState.startDay &&
    endDay === timelineRenderState.endDay
  ) {
    return;
  }

  timelineRenderState.startIndex = startIndex;
  timelineRenderState.endIndex = endIndex;
  timelineRenderState.startDay = startDay;
  timelineRenderState.endDay = endDay;
  const dayBounds = { startDay, endDay };
  guestTimeline.innerHTML = rows
    .slice(startIndex, endIndex)
    .map((row) => timelineRowHtml(row, timelineRenderState.virtualized, dayBounds))
    .join("");
  if (dragState) {
    dragState.bar = findTimelineBarByStayKey(dragState.stay.key);
    dragState.row = dragState.bar?.closest(".timeline-row") || dragState.row;
    dragState.bar?.classList.add("is-dragging");
    dragState.row?.classList.add("is-drop-target");
    updateDraggedTimelineBar();
  }
}

function queueVisibleTimelineRowsRender() {
  if (!timelineRenderState.rows.length || timelineRenderFrame) return;
  timelineRenderFrame = window.requestAnimationFrame(() => {
    timelineRenderFrame = null;
    renderVisibleTimelineRows();
  });
}

function firstTimelineSearchStay(rows) {
  if (!searchTerm) return null;

  for (const row of rows) {
    const match = row.lanes.items.find(({ stay }) => matchesSearch(stay));
    if (match?.stay?.start) return match.stay;
  }
  return null;
}

function alignTimelineToSearchResult(rows, options = {}) {
  if (!searchTerm || options.preserveScroll) return;
  const firstMatch = firstTimelineSearchStay(rows);
  if (!firstMatch) return;

  const targetScrollLeft = Math.max(0, scrollLeftForDate(stayStartDate(firstMatch)) - timelineDayWidth * 2);
  if (Math.abs(timelineShell.scrollLeft - targetScrollLeft) >= timelineDayWidth) {
    timelineShell.scrollLeft = targetScrollLeft;
    timelineLastScrollLeft = timelineShell.scrollLeft;
  }
}

function updateTimelineMonthLabel() {
  monthLabel.textContent = visibleMonth.toLocaleDateString("ro-RO", { month: "long", year: "numeric" });
}

function renderGuestTimeline(options = {}) {
  if (timelineRenderFrame) {
    window.cancelAnimationFrame(timelineRenderFrame);
    timelineRenderFrame = null;
  }
  updateTimelineDayWidth();
  const previousScrollLeft = timelineShell.scrollLeft;
  const dayCount = daysInTimelineWindow();
  const units = timelineUnitRows();
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(timelineWindowStart, index);
    const isMonthStart = date.getDate() === 1;
    return `
      <span class="${isMonthStart ? "is-month-start" : ""}">
        <strong>${date.toLocaleDateString("ro-RO", { day: "numeric" })}</strong>
        <small>${date.toLocaleDateString("ro-RO", { month: "short" })}</small>
      </span>
    `;
  });

  guestTimelineMode.textContent = activeMode === "room" ? "Vedere camere" : "Vedere camping";
  updateTimelineMonthLabel();
  timelineShell.style.setProperty("--timeline-days", dayCount);
  timelineScale.innerHTML = `<span class="timeline-corner">Loc</span>${days.join("")}`;

  if (!units.length) {
    timelineRenderState = {
      rows: [],
      rowTops: [],
      totalHeight: 0,
      startIndex: 0,
      endIndex: 0,
      startDay: 0,
      endDay: 0,
      virtualized: false
    };
    guestTimeline.classList.remove("is-virtualized");
    guestTimeline.style.height = "";
    guestTimeline.innerHTML = `<p class="empty-state">Nu există locuri ${activeMode === "room" ? "pentru camere" : "pentru camping"} potrivite.</p>`;
    if (options.preserveScroll) timelineShell.scrollLeft = previousScrollLeft;
    return;
  }

  let nextTop = 0;
  const rows = units.map((unit) => {
    const lanes = timelineLaneItems(unit);
    const height = timelineRowHeight(lanes.laneCount);
    const row = {
      unit,
      lanes,
      top: nextTop,
      height
    };
    nextTop += height + TIMELINE_ROW_GAP;
    return row;
  });
  const virtualized = activeMode === "room" || rows.length > TIMELINE_VIRTUAL_ROW_THRESHOLD;
  timelineRenderState = {
    rows,
    rowTops: rows.map((row) => row.top),
    totalHeight: Math.max(0, nextTop - TIMELINE_ROW_GAP),
    startIndex: -1,
    endIndex: -1,
    startDay: -1,
    endDay: -1,
    virtualized
  };
  alignTimelineToSearchResult(rows, options);
  guestTimeline.classList.toggle("is-virtualized", virtualized);
  if (virtualized) {
    guestTimeline.style.height = `${Math.max(520, timelineRenderState.totalHeight)}px`;
    const maxScrollTop = Math.max(0, timelineScale.offsetHeight + TIMELINE_ROW_GAP + timelineRenderState.totalHeight - timelineShell.clientHeight);
    if (timelineShell.scrollTop > maxScrollTop) timelineShell.scrollTop = maxScrollTop;
    renderVisibleTimelineRows(true);
  } else {
    guestTimeline.style.height = "";
    renderVisibleTimelineRows(true);
  }

  if (options.preserveScroll) {
    timelineShell.scrollLeft = previousScrollLeft;
    timelineLastScrollLeft = timelineShell.scrollLeft;
  }
}

function setMode(mode) {
  activeMode = mode;
  document.body.dataset.mode = mode;
  modeSwitch.checked = mode === "camping";
  markPagesDirty("calendar", "clients", "statistics");
  renderMetrics();
  renderGuestTimeline();
  dirtyPages.delete("calendar");
  refreshIcons();
  queueFileSave();
  showToast(mode === "camping" ? "Calendar camping activ" : "Calendar camere activ");
}

function renderMetrics() {
  const reservations = stays.filter((stay) => stay.guest !== "Disponibil" && stayOverlapsVisibleMonth(stay) && matchesSearch(stay));
  const units = unitOptions();
  const occupiedUnitIds = new Set(reservations.map((stay) => stay.id));
  const roomPeople = reservations.filter((stay) => stay.group === "room").reduce((sum, stay) => sum + Number(stay.party || 0), 0);
  const campingPeople = reservations.filter((stay) => stay.group === "camping").reduce((sum, stay) => sum + Number(stay.party || 0), 0);
  const occupancy = units.length ? Math.round((occupiedUnitIds.size / units.length) * 100) : 0;

  const metrics = [
    { label: "M-01", value: reservations.length, detail: "set lunar", icon: "users" },
    { label: "M-02", value: `${occupancy}%`, detail: `${occupiedUnitIds.size}/${units.length}`, icon: "activity" },
    { label: "M-03", value: roomPeople, detail: "indice interior", icon: "bed-double" },
    { label: "M-04", value: campingPeople, detail: "indice exterior", icon: "tent" },
    { label: "Google", value: googleReviewData.rating.toFixed(1), detail: `${googleReviewData.total} recenzii`, icon: "star" },
    { label: "Recenzii noi", value: googleReviewDelta(), detail: "Fata de ultima verificare", icon: "message-square-plus" }
  ];

  metricGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <div>
            <span>${metric.label}</span>
            <strong>${metric.value}</strong>
            <span>${metric.detail}</span>
          </div>
          <div class="metric-icon"><i data-lucide="${metric.icon}" aria-hidden="true"></i></div>
        </article>
      `
    )
    .join("");
}

function renderReviewsPanel(message) {
  reviewStatus.textContent =
    message || `Scor Google ${googleReviewData.rating.toFixed(1)} din 5, pe baza a ${googleReviewData.total} recenzii. Ultima verificare: ${googleReviewData.checkedAt}.`;
  reviewList.innerHTML = googleReviewData.latest
    .map(
      (review) => `
        <article class="review-card">
          <strong>${review.author}</strong>
          <p>${review.text}</p>
        </article>
      `
    )
    .join("");
}

function parseGoogleReviewSnapshot(html) {
  const match = html.match(/Scorul de evaluare Google:\s*([\d,.]+)\s*din\s*5,\s*pe baza a\s*([\d\s.,]+)\s*de recenzii/i);
  if (!match) return null;
  return {
    rating: Number(match[1].replace(",", ".")),
    total: Number(match[2].replace(/[^\d]/g, ""))
  };
}

function normalizeReviewSnapshot(data) {
  const result = data.result || data;
  const total = result.user_ratings_total || result.total || result.reviewCount;
  const rating = result.rating;
  const reviews = result.reviews || [];
  if (!rating || !total) return null;

  return {
    rating: Number(rating),
    total: Number(total),
    latest: reviews.slice(0, 3).map((review) => ({
      author: review.author_name || review.author || "Client Google",
      text: review.text || review.comment || "Recenzie fără text."
    }))
  };
}

async function checkGoogleReviews() {
  checkGoogleReviewsButton.disabled = true;
  renderReviewsPanel("Se verifică recenziile Google...");

  try {
    const endpoint = localStorage.getItem("marinaParkReviewsEndpoint");
    if (!endpoint) {
      renderReviewsPanel("Snapshot curent: Google 4.7/5 din 801 recenzii. Pentru verificare live, configurează un endpoint backend în localStorage: marinaParkReviewsEndpoint.");
      return;
    }

    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    const snapshot = contentType.includes("application/json") ? normalizeReviewSnapshot(await response.json()) : parseGoogleReviewSnapshot(await response.text());
    if (!snapshot) throw new Error("Nu am găsit scorul Google în pagina sursă.");

    const previousTotal = storedGoogleReviewTotal();
    googleReviewData = {
      ...googleReviewData,
      rating: snapshot.rating,
      total: snapshot.total,
      latest: snapshot.latest?.length ? snapshot.latest : googleReviewData.latest,
      checkedAt: new Date().toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" })
    };
    localStorage.setItem("marinaParkGoogleReviewTotal", String(snapshot.total));
    queueFileSave();
    renderMetrics();
    renderReviewsPanel(snapshot.total > previousTotal ? `Au apărut ${snapshot.total - previousTotal} recenzii noi.` : "Nu au apărut recenzii noi.");
    refreshIcons();
  } catch {
    renderReviewsPanel("Nu am putut verifica live recenziile. Verificarea automată stabilă trebuie făcută prin Google Places API într-un mic backend.");
  } finally {
    checkGoogleReviewsButton.disabled = false;
  }
}

function renderReservations() {
  disconnectReservationAutoLoad();
  const visible = stays
    .filter((stay) => stay.guest !== "Disponibil" && shouldShowClientInList(stay) && matchesSearch(stay))
    .sort((first, second) => {
      if (searchTerm) {
        const scoreCompare = staySearchScore(first) - staySearchScore(second);
        if (scoreCompare !== 0) return scoreCompare;
      }

      const firstUrgency = clientUrgency(first);
      const secondUrgency = clientUrgency(second);

      if (firstUrgency.priority !== secondUrgency.priority) {
        return firstUrgency.priority - secondUrgency.priority;
      }

      return String(first.end || first.start).localeCompare(String(second.end || second.start));
    });

  const limit = RESERVATION_PAGE_SIZE * reservationPage;
  const pageVisible = visible.slice(0, limit);
  const hasMore = visible.length > limit;

  reservationCards.innerHTML = pageVisible
    .map(
      (stay) => {
        const details = stayDetails(stay);
        const paid = isStayFullyPaid(stay);
        const urgency = clientUrgency(stay);
        const paymentLabel = stay.paymentMethod ? `Plată: ${stay.paymentMethod}` : "Plată: nesetat";
        const facilityTags = normalizeStayFacilities(stay.facilities, stay)
          .map((facility) => `<span class="unit-tag">${escapeHtml(facility.name)}${facility.includedInBasePrice ? " · inclus" : ` · ${formatCurrency(facility.total)}`}</span>`)
          .join("");
        const linkedCount = linkedReservationsCountFor(stay);
        const linkedTag = linkedCount > 1 ? `<span class="unit-tag linked-count">${linkedCount} rezervări client</span>` : "";
        const barItemsPanel = reservationBarItemsMarkup(stay, { compact: true });

        return `
          <article class="client-card ${urgency.className}">
            <header>
              <div>
                <h3>${stay.guest}</h3>
                <p>${stay.id} - ${stay.kind}</p>
              </div>
              <div class="client-card-actions">
                <strong class="client-price">${formatCurrency(stay.price)}</strong>
                <button class="icon-button compact client-edit-button" type="button" data-edit-client="${stay.key}" title="Editează clientul" aria-label="Editează clientul ${stay.guest}">
                  <i data-lucide="pencil" aria-hidden="true"></i>
                </button>
                <button class="icon-button compact client-receipt-button" type="button" data-receipt-client="${stay.key}" title="Generează bon" aria-label="Generează bon pentru ${stay.guest}">
                  <i data-lucide="receipt-text" aria-hidden="true"></i>
                </button>
                <button class="icon-button compact client-delete-button" type="button" data-delete-client="${stay.key}" title="Șterge clientul" aria-label="Șterge clientul ${stay.guest}">
                  <i data-lucide="trash-2" aria-hidden="true"></i>
                </button>
              </div>
            </header>
            <div class="stay-progress">
              <div class="progress-meta">
                <span>${details.label}</span>
                <strong>${details.progress}%</strong>
              </div>
              <div class="progress-track" aria-label="Progres cazare">
                <span class="progress-fill" style="--progress: ${details.progress}%"></span>
              </div>
            </div>
            <span class="unit-tag">${stay.id} · ${stay.kind}</span>
            ${linkedTag}
            ${facilityTags}
            ${barItemsPanel}
            <div class="payment-row">
              <span class="payment-chip ${paid ? "is-paid" : "is-unpaid"}">${paid ? "Achitat" : "Neachitat"}</span>
              <span>${paymentLabel}</span>
            </div>
          </article>
        `;
      }
    )
    .join("");

  if (!pageVisible.length) {
    reservationCards.innerHTML = `<p class="empty-state">Nu există clienți potriviți.</p>`;
  } else if (hasMore) {
    reservationCards.insertAdjacentHTML("beforeend", `
      <div class="auto-load-sentinel" data-reservation-load-sentinel role="status" aria-live="polite">
        Se încarcă mai mulți clienți...
      </div>
    `);
    observeReservationLoadSentinel();
  }
}

function disconnectReservationAutoLoad() {
  if (reservationAutoLoadObserver) {
    reservationAutoLoadObserver.disconnect();
    reservationAutoLoadObserver = null;
  }
}

function loadMoreReservationsAutomatically() {
  if (activePage !== "clients" || reservationAutoLoadQueued) return;
  reservationAutoLoadQueued = true;
  window.requestAnimationFrame(() => {
    reservationAutoLoadQueued = false;
    reservationPage += 1;
    renderReservations();
    refreshIcons(reservationCards);
  });
}

function observeReservationLoadSentinel() {
  const sentinel = reservationCards.querySelector("[data-reservation-load-sentinel]");
  if (!sentinel) return;

  if (!("IntersectionObserver" in window)) {
    loadMoreReservationsAutomatically();
    return;
  }

  reservationAutoLoadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMoreReservationsAutomatically();
      }
    },
    {
      root: null,
      rootMargin: "260px 0px",
      threshold: 0
    }
  );
  reservationAutoLoadObserver.observe(sentinel);
}

function visibleStationingRecords() {
  return stationing
    .filter(matchesStationingSearch)
    .sort((first, second) => {
      if (searchTerm) {
        const scoreCompare = stationingSearchScore(first) - stationingSearchScore(second);
        if (scoreCompare !== 0) return scoreCompare;
      }

      const firstDetails = stationingDetails(first);
      const secondDetails = stationingDetails(second);
      if (firstDetails.status.priority !== secondDetails.status.priority) {
        return firstDetails.status.priority - secondDetails.status.priority;
      }

      return firstDetails.endDate.localeCompare(secondDetails.endDate);
    });
}

function renderStationingMetrics() {
  if (!stationingMetricGrid) return;
  const records = stationing.filter(matchesStationingSearch);
  const activeRecords = records.filter((record) => stationingDetails(record).remainingNights > 0);
  const totalRemaining = activeRecords.reduce((sum, record) => sum + stationingDetails(record).remainingNights, 0);
  const expiringSoon = records.filter((record) => {
    const remaining = stationingDetails(record).remainingNights;
    return remaining > 0 && remaining <= 7;
  }).length;
  const unpaidBalance = records.reduce((sum, record) => sum + Number(record.balance || 0), 0);

  const metrics = [
    { label: "S-01", value: activeRecords.length, detail: "lot deschis", icon: "caravan" },
    { label: "S-02", value: totalRemaining, detail: "rezervă timp", icon: "hourglass" },
    { label: "S-03", value: expiringSoon, detail: "atenție scurtă", icon: "triangle-alert" },
    { label: "Rest de plată", value: formatCompactMoney(unpaidBalance), detail: "lei neachitați", icon: "wallet-cards" }
  ];

  stationingMetricGrid.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card stationing-metric-card">
          <div>
            <span>${metric.label}</span>
            <strong>${metric.value}</strong>
            <span>${metric.detail}</span>
          </div>
          <div class="metric-icon"><i data-lucide="${metric.icon}" aria-hidden="true"></i></div>
        </article>
      `
    )
    .join("");
}

function renderStationing() {
  if (!stationingCards) return;
  renderStationingMetrics();
  const records = visibleStationingRecords();

  stationingCards.innerHTML = records
    .map((record) => {
      const details = stationingDetails(record);
      const paid = Number(record.balance || 0) <= 0;
      const note = record.note ? `<p>${record.note}</p>` : "";

      return `
        <article class="stationing-card ${details.status.className}">
          <header>
            <div>
              <h3>${record.owner}</h3>
              <p>${record.phone || "fără telefon"}</p>
            </div>
            <div class="client-card-actions">
              <button class="icon-button compact client-edit-button" type="button" data-edit-stationing="${record.key}" title="Editează staționarea" aria-label="Editează staționarea ${record.owner}">
                <i data-lucide="pencil" aria-hidden="true"></i>
              </button>
              <button class="icon-button compact client-receipt-button" type="button" data-receipt-stationing="${record.key}" title="Încasează cu bon" aria-label="Încasează staționarea pentru ${record.owner}">
                <i data-lucide="receipt-text" aria-hidden="true"></i>
              </button>
              <button class="icon-button compact client-delete-button" type="button" data-delete-stationing="${record.key}" title="Șterge staționarea" aria-label="Șterge staționarea ${record.owner}">
                <i data-lucide="trash-2" aria-hidden="true"></i>
              </button>
            </div>
          </header>
          <div class="stationing-card-main">
            <span class="unit-tag">${record.caravan}</span>
            <span class="stationing-status ${details.status.className}">${details.status.label}</span>
          </div>
          <div class="stay-progress">
            <div class="progress-meta">
              <span>${details.remainingNights} din ${details.prepaidNights} nopți rămase · ${details.paidNights} nopți plătite</span>
              <strong>${details.paidProgress}% plătit</strong>
            </div>
            <div class="progress-track stationing-payment-track" aria-label="Nopți plătite din staționare">
              <span class="progress-fill" style="--progress: ${details.paidProgress}%"></span>
            </div>
          </div>
          <dl class="stationing-facts">
            <div class="stationing-paid-fact">
              <dt>Plătit</dt>
              <dd>${formatCurrency(record.paidAmount)}</dd>
            </div>
            <div>
              <dt>Început</dt>
              <dd>${formatDateLabel(record.startDate)}</dd>
            </div>
            <div>
              <dt>Final estimat</dt>
              <dd>${formatDateLabel(details.endDate)}</dd>
            </div>
            <div>
              <dt>Rest</dt>
              <dd>${formatCurrency(record.balance)}</dd>
            </div>
          </dl>
          <div class="payment-row">
            <span class="payment-chip ${paid ? "is-paid" : "is-unpaid"}">${paid ? "Achitat" : "Neachitat"}</span>
            <span>${formatCurrency(record.totalPrice)} total · ${formatCurrency(record.nightlyPrice)} / noapte</span>
          </div>
          ${note}
        </article>
      `;
    })
    .join("");

  if (!records.length) {
    stationingCards.innerHTML = `
      <div class="empty-state stationing-empty">
        <strong>Nu există rulote în staționare.</strong>
        <span>Adaugă o rulotă cu nopți preplătite ca să vezi automat nopțile rămase.</span>
        <button class="primary-button" type="button" data-open-stationing-empty>
          <i data-lucide="plus" aria-hidden="true"></i>
          <span>Staționare nouă</span>
        </button>
      </div>
    `;
  }
}

function sortedVisibleBarArticles() {
  return barArticles
    .filter(matchesBarArticleSearch)
    .sort((first, second) => {
      if (searchTerm) {
        const scoreCompare = barArticleSearchScore(first) - barArticleSearchScore(second);
        if (scoreCompare !== 0) return scoreCompare;
      }

      if (first.stock <= 0 !== second.stock <= 0) {
        return first.stock <= 0 ? 1 : -1;
      }

      return first.name.localeCompare(second.name, "ro-RO", { numeric: true });
    });
}

function normalizeBarCart() {
  let changed = false;
  barCart = barCart
    .map((item) => {
      const article = barArticleByKey(item.key);
      if (!article) {
        changed = true;
        return null;
      }
      const quantity = Math.min(article.stock, Math.max(0, Math.floor(Number(item.quantity || 0))));
      if (quantity !== item.quantity) changed = true;
      return quantity > 0 ? { key: article.key, quantity } : null;
    })
    .filter(Boolean);
  return changed;
}

function barCartLines() {
  normalizeBarCart();
  return barCart
    .map((item) => {
      const article = barArticleByKey(item.key);
      if (!article) return null;
      const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
      const subtotal = normalizeMoneyValue(article.price * quantity);
      const sgrTotal = article.hasSgr ? normalizeMoneyValue(0.5 * quantity) : 0;
      return {
        key: article.key,
        name: article.name,
        price: article.price,
        vatRate: article.vatRate,
        hasSgr: article.hasSgr,
        stock: article.stock,
        quantity,
        subtotal,
        sgrTotal,
        lineTotal: normalizeMoneyValue(subtotal + sgrTotal)
      };
    })
    .filter(Boolean);
}

function barCartTotals() {
  const lines = barCartLines();
  const productsTotal = normalizeMoneyValue(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const sgrTotal = normalizeMoneyValue(lines.reduce((sum, line) => sum + line.sgrTotal, 0));
  const total = normalizeMoneyValue(productsTotal + sgrTotal);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  return { lines, productsTotal, sgrTotal, total, itemCount };
}

function renderBarArticles() {
  if (!barArticleGrid) return;
  const visibleArticles = sortedVisibleBarArticles();
  if (!visibleArticles.length) {
    barArticleGrid.innerHTML = `
      <div class="empty-state bar-empty">
        <strong>Nu există articole potrivite.</strong>
        <span>Adaugă produse cu preț, stoc, TVA și SGR pentru vânzarea de la bar.</span>
      </div>
    `;
    return;
  }

  barArticleGrid.innerHTML = visibleArticles
    .map((article) => {
      const cartQuantity = barCartQuantity(article.key);
      const hasStock = article.stock > cartQuantity;
      const stockLabel = cartQuantity ? `${article.stock - cartQuantity} disponibile · ${cartQuantity} în bon` : `${article.stock} în stoc`;
      return `
        <article class="bar-product-card ${hasStock ? "" : "is-out-of-stock"}" data-bar-article="${article.key}" tabindex="0" aria-label="Adaugă ${escapeHtml(article.name)} la checkout">
          <header>
            <h3>${escapeHtml(article.name)}</h3>
            <button class="icon-button compact" type="button" data-edit-bar-article="${article.key}" title="Editează articolul" aria-label="Editează articolul ${escapeHtml(article.name)}">
              <i data-lucide="pencil" aria-hidden="true"></i>
            </button>
          </header>
          <div class="bar-product-price">${formatCurrency(article.price)}</div>
          <div class="bar-product-line" aria-hidden="true"></div>
          <footer>
            <span class="bar-stock ${hasStock ? "" : "is-empty"}">x ${stockLabel}</span>
            <span class="bar-dot">•</span>
            <span>${article.vatRate}% TVA</span>
            ${article.hasSgr ? `<span class="bar-sgr-chip">SGR +0.50</span>` : ""}
          </footer>
        </article>
      `;
    })
    .join("");
}

function renderBarCheckout() {
  if (!barCheckoutList || !barCheckoutSummary || !barCheckoutPayButton) return;
  const totals = barCartTotals();
  if (!totals.lines.length) {
    barCheckoutList.innerHTML = `<p class="empty-state bar-checkout-empty">Checkout-ul este gol.</p>`;
  } else {
    barCheckoutList.innerHTML = totals.lines
      .map(
        (line) => `
          <article class="bar-checkout-item">
            <div>
              <strong>${escapeHtml(line.name)}</strong>
              <span>${formatCurrency(line.price)} · TVA ${line.vatRate}%${line.hasSgr ? " · SGR 0.50 lei" : ""}</span>
            </div>
            <div class="bar-quantity-control" aria-label="Cantitate ${escapeHtml(line.name)}">
              <button class="icon-button compact" type="button" data-bar-quantity="${line.key}" data-delta="-1" aria-label="Scade cantitatea">
                <i data-lucide="minus" aria-hidden="true"></i>
              </button>
              <strong>${line.quantity}</strong>
              <button class="icon-button compact" type="button" data-bar-quantity="${line.key}" data-delta="1" aria-label="Crește cantitatea" ${line.quantity >= line.stock ? "disabled" : ""}>
                <i data-lucide="plus" aria-hidden="true"></i>
              </button>
            </div>
            <span>${formatCurrency(line.lineTotal)}</span>
          </article>
        `
      )
      .join("");
  }

  barCheckoutSummary.innerHTML = `
    <dl>
      <div>
        <dt>Articole</dt>
        <dd>${totals.itemCount}</dd>
      </div>
      <div>
        <dt>Produse</dt>
        <dd>${formatCurrency(totals.productsTotal)}</dd>
      </div>
      <div>
        <dt>SGR 0%</dt>
        <dd>${formatCurrency(totals.sgrTotal)}</dd>
      </div>
      <div class="bar-summary-total">
        <dt>Total</dt>
        <dd>${formatCurrency(totals.total)}</dd>
      </div>
    </dl>
  `;
  barCheckoutPayButton.disabled = totals.lines.length === 0;
  if (barAttachReservationButton) barAttachReservationButton.disabled = totals.lines.length === 0;
  clearBarCheckoutButton.disabled = totals.lines.length === 0;
}

function renderBarPage() {
  normalizeBarCart();
  renderBarArticles();
  renderBarCheckout();
}

function addBarArticleToCheckout(articleKey) {
  const article = barArticleByKey(articleKey);
  if (!article) return false;
  const existing = barCart.find((item) => item.key === article.key);
  const currentQuantity = existing?.quantity || 0;
  if (currentQuantity >= article.stock) {
    showToast("Stoc insuficient pentru articolul ales");
    return false;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    barCart.push({ key: article.key, quantity: 1 });
  }
  renderBarPage();
  refreshIcons();
  return true;
}

function changeBarCartQuantity(articleKey, delta) {
  const article = barArticleByKey(articleKey);
  if (!article) return;
  const existing = barCart.find((item) => item.key === articleKey);
  if (!existing && delta > 0) {
    addBarArticleToCheckout(articleKey);
    return;
  }
  if (!existing) return;

  const nextQuantity = Math.min(article.stock, Math.max(0, existing.quantity + delta));
  if (nextQuantity <= 0) {
    barCart = barCart.filter((item) => item.key !== articleKey);
  } else {
    existing.quantity = nextQuantity;
  }
  renderBarPage();
  refreshIcons();
}

function openBarArticleModal(articleKey = null) {
  const article = articleKey ? barArticleByKey(articleKey) : null;
  editingBarArticleKey = article?.key || null;
  barArticleModalTitle.textContent = editingBarArticleKey ? "Editează articolul" : "Articol nou";
  barArticleSubmitLabel.textContent = editingBarArticleKey ? "Salvează articolul" : "Adaugă articolul";
  deleteBarArticleButton.hidden = !editingBarArticleKey;
  barArticleForm.reset();
  barArticleForm.elements.name.value = article?.name || "";
  barArticleForm.elements.price.value = Number(article?.price || 0).toFixed(2);
  barArticleForm.elements.stock.value = Number(article?.stock || 0);
  barArticleForm.elements.vatRate.value = String(article?.vatRate || 21);
  barArticleForm.elements.hasSgr.checked = Boolean(article?.hasSgr);
  barArticleModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => barArticleForm.elements.name.focus(), 0);
}

function closeBarArticleModal() {
  barArticleModal.classList.remove("is-open");
  if (!receiptModal.classList.contains("is-open") && !bookingModal.classList.contains("is-open") && !stationingModal.classList.contains("is-open") && !barPaymentModal.classList.contains("is-open") && !sagaExportModal.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
  editingBarArticleKey = null;
  deleteBarArticleButton.hidden = true;
}

function saveBarArticleFromForm() {
  const data = new FormData(barArticleForm);
  const name = String(data.get("name") || "").trim();
  if (!name) {
    showToast("Numele articolului este obligatoriu");
    return false;
  }

  const previousArticle = editingBarArticleKey ? barArticleByKey(editingBarArticleKey) : null;
  const now = new Date().toISOString();
  const normalized = normalizeBarArticle({
    key: previousArticle?.key || `bar-${Date.now()}`,
    name,
    price: normalizeMoneyValue(data.get("price")),
    stock: Number(data.get("stock") || 0),
    vatRate: Number(data.get("vatRate") || 21),
    hasSgr: Boolean(data.get("hasSgr")),
    createdAt: previousArticle?.createdAt || now,
    updatedAt: now
  });

  if (previousArticle) {
    const index = barArticles.findIndex((article) => article.key === previousArticle.key);
    if (index >= 0) barArticles[index] = normalized;
  } else {
    barArticles.unshift(normalized);
  }

  normalizeBarCart();
  saveStays();
  renderBarPage();
  refreshIcons();
  const changes = previousArticle ? barArticleChangeList(previousArticle, normalized) : [];
  logActivity({
    eventType: previousArticle ? "update" : "create",
    entityType: "bar_article",
    entityKey: normalized.key,
    entityLabel: activityBarArticleLabel(normalized),
    message: previousArticle
      ? `Articolul de bar ${normalized.name} a fost actualizat${changes.length ? `: ${changes.join("; ")}` : "."}`
      : `Articol de bar adăugat: ${normalized.name}, ${formatActivityMoney(normalized.price)}, stoc ${normalized.stock}, TVA ${normalized.vatRate}%${normalized.hasSgr ? ", SGR 0.50 lei" : ""}.`,
    data: {
      previous: previousArticle,
      current: normalized,
      changes
    }
  });
  closeBarArticleModal();
  showToast(previousArticle ? `Articol actualizat: ${normalized.name}` : `Articol adăugat: ${normalized.name}`);
  return true;
}

function deleteBarArticle() {
  const article = editingBarArticleKey ? barArticleByKey(editingBarArticleKey) : null;
  if (!article) return false;
  const confirmed = window.confirm(`Ștergi articolul ${article.name}?`);
  if (!confirmed) return false;

  barArticles = barArticles.filter((item) => item.key !== article.key);
  barCart = barCart.filter((item) => item.key !== article.key);
  saveStays();
  renderBarPage();
  refreshIcons();
  logActivity({
    eventType: "delete",
    entityType: "bar_article",
    entityKey: article.key,
    entityLabel: activityBarArticleLabel(article),
    message: `Articolul de bar ${article.name} a fost șters. Stoc rămas înainte de ștergere: ${article.stock}.`,
    data: { article }
  });
  closeBarArticleModal();
  showToast(`Articol șters: ${article.name}`);
  return true;
}

function renderBarPaymentSummary() {
  if (!barPaymentSummary) return;
  const totals = barCartTotals();
  barPaymentSummary.innerHTML = `
    <strong>${formatCurrency(totals.total)}</strong>
    <span>${totals.itemCount} articole în bon</span>
    <div class="bar-payment-lines">
      ${totals.lines
        .map(
          (line) => `
            <div>
              <span>${escapeHtml(line.name)} x${line.quantity}</span>
              <strong>${formatCurrency(line.lineTotal)}</strong>
              <small>TVA ${line.vatRate}%${line.hasSgr ? ` · SGR ${formatCurrency(line.sgrTotal)} cu TVA 0%` : ""}</small>
            </div>
          `
        )
        .join("")}
    </div>
    <span>Produse ${formatCurrency(totals.productsTotal)} · SGR ${formatCurrency(totals.sgrTotal)}</span>
  `;
}

function openBarPaymentModal() {
  const totals = barCartTotals();
  if (!totals.lines.length) {
    showToast("Adaugă articole înainte de plată");
    return;
  }
  renderBarPaymentSummary();
  barPaymentModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeBarPaymentModal(options = {}) {
  if (barPaymentInProgress && !options.force) return;
  barPaymentModal.classList.remove("is-open");
  if (!receiptModal.classList.contains("is-open") && !bookingModal.classList.contains("is-open") && !stationingModal.classList.contains("is-open") && !barArticleModal.classList.contains("is-open") && !sagaExportModal.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
}

function syncSagaExportDateFields() {
  const allSales = Boolean(sagaExportForm.elements.allSales.checked);
  sagaExportForm.elements.fromDate.disabled = allSales;
  sagaExportForm.elements.toDate.disabled = allSales;
}

function openSagaExportModal() {
  const todayText = toISODate(today);
  applySagaExportSettings();
  if (!sagaExportForm.elements.fromDate.value) sagaExportForm.elements.fromDate.value = todayText;
  if (!sagaExportForm.elements.toDate.value) sagaExportForm.elements.toDate.value = todayText;
  syncSagaExportDateFields();
  sagaExportModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => sagaExportForm.elements.companyCif.focus(), 0);
}

function closeSagaExportModal() {
  sagaExportModal.classList.remove("is-open");
  if (!receiptModal.classList.contains("is-open") && !bookingModal.classList.contains("is-open") && !stationingModal.classList.contains("is-open") && !barArticleModal.classList.contains("is-open") && !barPaymentModal.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function filenameFromDisposition(disposition) {
  const match = String(disposition || "").match(/filename="?([^"]+)"?/i);
  return match ? match[1] : "";
}

async function exportSagaBarSales() {
  const config = readSagaExportSettings();
  if (!config.companyCif) {
    showToast("Completează codul fiscal al firmei pentru SAGA");
    return false;
  }

  const allSales = Boolean(sagaExportForm.elements.allSales.checked);
  const fromDate = sagaExportForm.elements.fromDate.value;
  const toDate = sagaExportForm.elements.toDate.value;
  if (!allSales && (!fromDate || !toDate || fromDate > toDate)) {
    showToast("Alege o perioadă validă pentru export");
    return false;
  }

  const params = new URLSearchParams({
    companyCif: config.companyCif,
    companyName: config.companyName,
    clientName: config.clientName
  });
  if (config.productName) params.set("productName", config.productName);
  if (config.vatRate) params.set("vatRate", config.vatRate);
  if (allSales) {
    params.set("all", "1");
  } else {
    params.set("from", fromDate);
    params.set("to", toDate);
  }

  try {
    const response = await fetch(`/api/saga/bar-sales?${params.toString()}`, { cache: "no-store" });
    const body = await response.blob();
    if (!response.ok) {
      const text = await body.text();
      let errorMessage = text;
      try {
        errorMessage = JSON.parse(text).error || text;
      } catch {
        // Keep raw server text.
      }
      throw new Error(errorMessage || "Nu am putut genera exportul SAGA");
    }

    const filename = filenameFromDisposition(response.headers.get("Content-Disposition")) || "saga-bar-sales.xml";
    downloadBlob(body, filename);
    logActivity({
      eventType: "export",
      entityType: "bar",
      entityKey: "saga-bar-sales",
      entityLabel: "Export SAGA bar",
      message: `Export SAGA generat pentru vânzări bar${allSales ? " - toate vânzările" : ` ${fromDate} - ${toDate}`}${config.productName ? `, produs ${config.productName}` : ""}${config.vatRate ? `, TVA ${config.vatRate}%` : ""}.`,
      data: { allSales, fromDate, toDate, productName: config.productName, vatRate: config.vatRate, sagaExportConfig: config }
    });
    closeSagaExportModal();
    showToast("Exportul SAGA a fost generat");
    return true;
  } catch (error) {
    showToast(error.message || "Nu am putut genera exportul SAGA");
    return false;
  }
}

function setBarPaymentBusy(isBusy) {
  barPaymentInProgress = isBusy;
  barPaymentForm.setAttribute("aria-busy", String(isBusy));
  barPaymentForm.querySelectorAll("[data-bar-payment-method]").forEach((button) => {
    button.disabled = isBusy;
  });
}

function barStockChangesFromLines(lines) {
  return lines.map((line) => {
    const article = barArticleByKey(line.key);
    const previousStock = Number(article?.stock || 0);
    return {
      key: line.key,
      name: line.name,
      quantity: line.quantity,
      previousStock,
      newStock: Math.max(0, previousStock - line.quantity)
    };
  });
}

async function generateBarReceipt(method) {
  if (barPaymentInProgress) return false;
  const isVoucher = method === "voucher";
  const totals = barCartTotals();
  if (!totals.lines.length) {
    showToast("Checkout-ul este gol");
    return false;
  }

  const invalidLine = totals.lines.find((line) => line.quantity > line.stock);
  if (invalidLine) {
    showToast(`Stoc insuficient pentru ${invalidLine.name}`);
    renderBarPage();
    refreshIcons();
    return false;
  }

  setBarPaymentBusy(true);
  try {
    const stockChanges = barStockChangesFromLines(totals.lines);
    if (!isVoucher) {
      const config = readReceiptSettings();
      if (!config.receiptDirectory) {
        showToast("Configurează bonurile în Setări");
        closeBarPaymentModal({ force: true });
        setActivePage("settings");
        return false;
      }

      const response = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bar",
          method,
          amount: totals.total,
          sale: {
            items: totals.lines.map((line) => ({
              key: line.key,
              name: line.name,
              price: line.price,
              quantity: line.quantity,
              vatRate: line.vatRate,
              hasSgr: line.hasSgr
            })),
            productsTotal: totals.productsTotal,
            sgrTotal: totals.sgrTotal,
            total: totals.total
          },
          receiptConfig: config
        })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Nu am putut genera bonul de bar");
    }

    stockChanges.forEach((change) => {
      const article = barArticleByKey(change.key);
      if (article) {
        article.stock = change.newStock;
        article.updatedAt = new Date().toISOString();
      }
    });

    const itemMessage = totals.lines.map((line) => `${line.name} x${line.quantity}`).join(", ");
    const stockMessage = stockChanges.map((change) => `${change.name}: ${change.previousStock} -> ${change.newStock}`).join("; ");
    await logActivity({
      eventType: "payment",
      entityType: "bar",
      entityKey: "bar-checkout",
      entityLabel: "Checkout bar",
      amount: totals.total,
      method,
      message: isVoucher
        ? `Bar paid by voucher: ${formatActivityMoney(totals.total)} pentru ${itemMessage}. Stoc actualizat: ${stockMessage}.`
        : `Bar a încasat ${formatActivityMoney(totals.total)} prin ${method} pentru ${itemMessage}. SGR ${formatActivityMoney(totals.sgrTotal)} cu TVA 0%. Stoc actualizat: ${stockMessage}.`,
      data: {
        method,
        items: totals.lines,
        productsTotal: totals.productsTotal,
        sgrTotal: totals.sgrTotal,
        total: totals.total,
        stockChanges,
        voucherOnly: isVoucher
      }
    });

    barCart = [];
    saveStays();
    closeBarPaymentModal({ force: true });
    renderBarPage();
    refreshIcons();
    showToast(isVoucher ? "Plată voucher înregistrată la bar" : "Bon de bar generat");
    return true;
  } catch (error) {
    showToast(error.message || "Nu am putut finaliza plata de bar");
    return false;
  } finally {
    setBarPaymentBusy(false);
  }
}

function reservableStays() {
  return stays
    .filter((stay) => stay.guest !== "Disponibil")
    .sort((first, second) => {
      const firstUrgency = clientUrgency(first);
      const secondUrgency = clientUrgency(second);
      if (firstUrgency.priority !== secondUrgency.priority) return firstUrgency.priority - secondUrgency.priority;
      const firstStart = String(first.start || "");
      const secondStart = String(second.start || "");
      if (firstStart !== secondStart) return firstStart.localeCompare(secondStart);
      return String(first.guest || "").localeCompare(String(second.guest || ""), "ro-RO", { numeric: true });
    });
}

function matchesBarAttachSearch(stay) {
  const query = String(barAttachSearch?.value || "").trim();
  if (!query) return true;
  return Number.isFinite(
    Math.min(
      fuzzyMatchScore(query, stay.guest),
      fuzzyMatchScore(query, stay.id),
      fuzzyMatchScore(query, stay.kind),
      fuzzyMatchScore(query, stay.phone),
      fuzzyMatchScore(query, stay.dates)
    )
  );
}

function renderBarAttachChoices() {
  if (!barReservationChoices) return;
  const allMatches = reservableStays().filter(matchesBarAttachSearch);
  const choices = allMatches.slice(0, 80);
  if (!choices.length) {
    barReservationChoices.innerHTML = `<p class="empty-state">Nu există rezervări potrivite.</p>`;
    return;
  }

  const limitNote =
    allMatches.length > choices.length
      ? `<p class="empty-state compact">Se afișează primele ${choices.length} rezervări din ${allMatches.length}. Caută după nume sau unitate pentru rezultate mai precise.</p>`
      : "";

  barReservationChoices.innerHTML = limitNote + choices
    .map((stay) => {
      const barTotal = reservationBarTotal(stay.barItems);
      const paid = isStayFullyPaid(stay);
      return `
        <button class="bar-reservation-choice ${paid ? "is-paid" : ""}" type="button" data-attach-bar-reservation="${escapeHtml(stay.key)}">
          <span>
            <strong>${escapeHtml(stay.guest)}</strong>
            <small>${escapeHtml(stay.id)} · ${escapeHtml(stay.kind)} · ${escapeHtml(stay.dates || "")}</small>
          </span>
          <span>
            <strong>${formatCurrency(stay.price)}</strong>
            <small>${barTotal > 0 ? `bar ${formatCurrency(barTotal)}` : paid ? "achitat" : `rest ${formatCurrency(receiptAmountFor(stay))}`}</small>
          </span>
        </button>
      `;
    })
    .join("");
}

function openBarAttachModal() {
  const totals = barCartTotals();
  if (!totals.lines.length) {
    showToast("Checkout-ul este gol");
    return;
  }

  const invalidLine = totals.lines.find((line) => line.quantity > line.stock);
  if (invalidLine) {
    showToast(`Stoc insuficient pentru ${invalidLine.name}`);
    renderBarPage();
    refreshIcons();
    return;
  }

  barAttachSummary.innerHTML = `
    <strong>Articole pregătite pentru rezervare</strong>
    <span>${totals.itemCount} articole · produse ${formatCurrency(totals.productsTotal)}</span>
    <span>SGR ${formatCurrency(totals.sgrTotal)} · total ${formatCurrency(totals.total)}</span>
  `;
  if (barAttachSearch) barAttachSearch.value = "";
  renderBarAttachChoices();
  barAttachModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  refreshIcons(barAttachModal);
  setTimeout(() => barAttachSearch?.focus(), 0);
}

function closeBarAttachModal(options = {}) {
  if (barAttachInProgress && !options.force) return;
  barAttachModal.classList.remove("is-open");
  if (
    !receiptModal.classList.contains("is-open") &&
    !bookingModal.classList.contains("is-open") &&
    !stationingModal.classList.contains("is-open") &&
    !barArticleModal.classList.contains("is-open") &&
    !barPaymentModal.classList.contains("is-open") &&
    !sagaExportModal.classList.contains("is-open")
  ) {
    document.body.style.overflow = "";
  }
}

function setBarAttachBusy(isBusy) {
  barAttachInProgress = isBusy;
  barAttachModal?.setAttribute("aria-busy", String(isBusy));
  barReservationChoices?.querySelectorAll("button").forEach((button) => {
    button.disabled = isBusy;
  });
}

function updateBookingFormForBarDelta(stayKey, deltaTotal) {
  if (!bookingModal.classList.contains("is-open") || editingStayKey !== stayKey) return;
  const nextPrice = Math.max(0, normalizeMoneyValue(Number(bookingForm.elements.price.value || 0) + deltaTotal));
  setMoneyField("price", nextPrice);
  setMoneyField("deposit", 0);
  setMoneyField("balance", nextPrice);
  renderBookingBarItems();
  renderLinkedReservations();
}

async function attachBarCartToReservation(stayKey) {
  if (barAttachInProgress) return false;
  const stay = stays.find((item) => item.key === stayKey);
  if (!stay || stay.guest === "Disponibil") return false;

  const totals = barCartTotals();
  if (!totals.lines.length) {
    showToast("Checkout-ul este gol");
    return false;
  }

  const invalidLine = totals.lines.find((line) => line.quantity > line.stock);
  if (invalidLine) {
    showToast(`Stoc insuficient pentru ${invalidLine.name}`);
    renderBarPage();
    refreshIcons();
    return false;
  }

  setBarAttachBusy(true);
  try {
    const previousStay = { ...stay, barItems: normalizeStayBarItems(stay.barItems) };
    const settledBeforeAttach = isStayFullyPaid(stay)
      ? Math.max(settledPriceForStay(stay), normalizeMoneyValue(stay.price))
      : paymentCoveredPriceForStay(stay);
    const stockChanges = barStockChangesFromLines(totals.lines);
    const addedItems = reservationBarItemsFromCartLines(totals.lines);

    stockChanges.forEach((change) => {
      const article = barArticleByKey(change.key);
      if (article) {
        article.stock = change.newStock;
        article.updatedAt = new Date().toISOString();
      }
    });

    stay.barItems = mergeReservationBarItems(stay.barItems, addedItems);
    stay.price = normalizeMoneyValue(Number(stay.price || 0) + totals.total);
    stay.balance = stay.price;
    stay.deposit = 0;
    if (settledBeforeAttach > 0) {
      stay.settledPrice = Math.min(normalizeMoneyValue(stay.price), settledBeforeAttach);
    }
    stay.paid = false;

    const itemMessage = totals.lines.map((line) => `${line.name} x${line.quantity}`).join(", ");
    await logActivity({
      eventType: "update",
      entityType: "client",
      entityKey: stay.key,
      entityLabel: activityStayLabel(stay),
      amount: totals.total,
      method: "bar-reservation",
      message: `Articole bar adăugate pe rezervarea ${stay.guest}: ${itemMessage}. Total rezervare +${formatActivityMoney(totals.total)}.`,
      data: {
        previous: previousStay,
        current: { ...stay, barItems: normalizeStayBarItems(stay.barItems) },
        addedItems,
        productsTotal: totals.productsTotal,
        sgrTotal: totals.sgrTotal,
        total: totals.total,
        stockChanges
      }
    });

    barCart = [];
    saveStays();
    closeBarAttachModal({ force: true });
    renderBarPage();
    renderAll({ force: true });
    refreshIcons();
    showToast(`Articole adăugate la ${stay.guest}`);
    return true;
  } finally {
    setBarAttachBusy(false);
  }
}

function changeReservationBarItem(stayKey, itemId, delta, options = {}) {
  const stay = stays.find((item) => item.key === stayKey);
  if (!stay || stay.guest === "Disponibil") return false;
  if (isStayFullyPaid(stay)) {
    showToast("Rezervarea este deja achitată. Articolele de bar nu mai pot fi modificate.");
    return false;
  }

  const items = normalizeStayBarItems(stay.barItems);
  const item = items.find((entry) => entry.id === itemId);
  if (!item) return false;
  const previousStay = { ...stay, barItems: items.map((entry) => ({ ...entry })) };
  const removeAll = options.remove === true;
  const currentQuantity = Number(item.quantity || 1);
  const nextQuantity = removeAll ? 0 : Math.max(0, currentQuantity + Number(delta || 0));
  if (nextQuantity === currentQuantity) return false;

  const quantityDelta = nextQuantity - currentQuantity;
  const unitLineTotal = normalizeMoneyValue(item.price + (item.hasSgr ? 0.5 : 0));
  const priceDelta = normalizeMoneyValue(unitLineTotal * quantityDelta);
  const article = item.articleKey ? barArticleByKey(item.articleKey) : null;
  if (quantityDelta > 0) {
    if (!article || article.stock < quantityDelta) {
      showToast(`Stoc insuficient pentru ${item.name}`);
      return false;
    }
    article.stock = Math.max(0, Number(article.stock || 0) - quantityDelta);
    article.updatedAt = new Date().toISOString();
  } else if (article) {
    article.stock = Number(article.stock || 0) + Math.abs(quantityDelta);
    article.updatedAt = new Date().toISOString();
  }

  if (nextQuantity <= 0) {
    stay.barItems = items.filter((entry) => entry.id !== itemId);
  } else {
    item.quantity = nextQuantity;
    item.updatedAt = new Date().toISOString();
    stay.barItems = items.map((entry) => (entry.id === itemId ? normalizeReservationBarItem(item) : entry));
  }
  stay.price = Math.max(0, normalizeMoneyValue(Number(stay.price || 0) + priceDelta));
  stay.balance = stay.price;
  stay.deposit = 0;
  const settledPrice = paymentCoveredPriceForStay(stay);
  if (settledPrice > 0 && normalizeMoneyValue(stay.price) <= settledPrice) {
    stay.settledPrice = normalizeMoneyValue(stay.price);
    stay.paid = true;
  } else if (settledPrice > 0) {
    stay.paid = false;
  }

  saveStays();
  updateBookingFormForBarDelta(stay.key, priceDelta);
  renderAll({ force: true });
  refreshIcons();
  logActivity({
    eventType: "update",
    entityType: "client",
    entityKey: stay.key,
    entityLabel: activityStayLabel(stay),
    amount: Math.abs(priceDelta),
    method: "bar-reservation-edit",
    message:
      quantityDelta > 0
        ? `Cantitatea pentru ${item.name} a crescut pe rezervarea ${stay.guest}. Total +${formatActivityMoney(priceDelta)}.`
        : `Cantitatea pentru ${item.name} a fost redusă pe rezervarea ${stay.guest}. Total ${formatActivityMoney(priceDelta)}.`,
    data: {
      previous: previousStay,
      current: { ...stay, barItems: normalizeStayBarItems(stay.barItems) },
      item,
      previousQuantity: currentQuantity,
      nextQuantity,
      priceDelta
    }
  });
  showToast(nextQuantity <= 0 ? `Articol eliminat: ${item.name}` : `Articol actualizat: ${item.name}`);
  return true;
}

function syncStationingTotals() {
  if (!stationingForm) return;
  const startDate = stationingForm.elements.startDate.value || toISODate(today);
  const prepaidNights = Math.max(1, Number(stationingForm.elements.prepaidNights.value || 1));
  const nightlyPrice = normalizeMoneyValue(stationingForm.elements.nightlyPrice.value);
  const totalPrice = normalizeMoneyValue(prepaidNights * nightlyPrice);
  const paidAmount = Math.min(totalPrice, normalizeMoneyValue(stationingForm.elements.paidAmount.value));
  const balance = Math.max(0, totalPrice - paidAmount);
  const endDate = stationingEndDate({ startDate, prepaidNights });
  const details = stationingDetails({ startDate, prepaidNights, nightlyPrice, totalPrice, paidAmount });

  stationingForm.elements.totalPrice.value = totalPrice.toFixed(2);
  if (normalizeMoneyValue(stationingForm.elements.paidAmount.value) > totalPrice) {
    stationingForm.elements.paidAmount.value = paidAmount.toFixed(2);
  }
  stationingForm.elements.balance.value = balance.toFixed(2);
  stationingForm.elements.endDate.value = formatDateLabel(endDate);
  stationingRangeSummary.textContent = `${details.usedNights} nopți folosite · ${details.remainingNights} nopți rămase · ${details.paidNights} nopți plătite · final estimat ${formatDateLabel(endDate)}.`;
}

function openStationingModal(recordKey = null) {
  const record = recordKey ? stationing.find((item) => item.key === recordKey) : null;
  editingStationingKey = record?.key || null;
  stationingModalTitle.textContent = editingStationingKey ? "Editează staționarea" : "Staționare nouă";
  stationingSubmitLabel.textContent = editingStationingKey ? "Salvează staționarea" : "Adaugă staționarea";
  deleteStationingButton.hidden = !editingStationingKey;
  receiptFromStationingButton.hidden = !editingStationingKey;
  stationingEditSession = editingStationingKey
    ? {
        key: editingStationingKey,
        openedAt: new Date().toISOString(),
        owner: record.owner,
        initialTotalPrice: Number(record.totalPrice || 0),
        initialPaidAmount: Number(record.paidAmount || 0),
        initialBalance: Number(record.balance || 0)
      }
    : null;
  if (stationingEditSession) {
    logActivity({
      eventType: "open",
      entityType: "stationing",
      entityKey: editingStationingKey,
      entityLabel: activityStationingLabel(record),
      message: `Fișa de staționare pentru ${record.owner} a fost deschisă pentru editare.`,
      data: stationingEditSession
    });
  }

  stationingForm.reset();
  stationingForm.elements.owner.value = record?.owner || "";
  stationingForm.elements.phone.value = record?.phone || "";
  stationingForm.elements.caravan.value = record?.caravan || "";
  stationingForm.elements.startDate.value = record?.startDate || toISODate(today);
  stationingForm.elements.prepaidNights.value = record?.prepaidNights || 30;
  stationingForm.elements.nightlyPrice.value = Number(record?.nightlyPrice || 0).toFixed(2);
  stationingForm.elements.paidAmount.value = Number(record?.paidAmount || 0).toFixed(2);
  stationingForm.elements.note.value = record?.note || "";
  syncStationingTotals();

  stationingModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => stationingForm.elements.owner.focus(), 0);
}

function closeStationingModal() {
  stationingModal.classList.remove("is-open");
  if (!receiptModal.classList.contains("is-open")) {
    document.body.style.overflow = "";
  }
  editingStationingKey = null;
  deleteStationingButton.hidden = true;
  receiptFromStationingButton.hidden = true;
  stationingEditSession = null;
}

function saveStationingRecord(record) {
  const normalized = normalizeStationingRecord(record);
  const existingIndex = stationing.findIndex((item) => item.key === normalized.key);
  const previousRecord = existingIndex >= 0 ? { ...stationing[existingIndex] } : null;
  if (existingIndex >= 0) {
    stationing[existingIndex] = normalized;
  } else {
    stationing.unshift(normalized);
  }

  saveStays();
  renderStationing();
  refreshIcons();
  const changes = previousRecord ? stationingChangeList(previousRecord, normalized) : [];
  logActivity({
    eventType: previousRecord ? "update" : "create",
    entityType: "stationing",
    entityKey: normalized.key,
    entityLabel: activityStationingLabel(normalized),
    message: previousRecord
      ? `Staționarea pentru ${normalized.owner} a fost actualizată${changes.length ? `: ${changes.join("; ")}` : "."}`
      : `Staționare adăugată pentru ${normalized.owner}, ${normalized.caravan}, ${normalized.prepaidNights} nopți.`,
    data: {
      previous: previousRecord,
      current: normalized,
      changes,
      editSession: stationingEditSession
    }
  });
}

function deleteStationing(recordKey) {
  const record = stationing.find((item) => item.key === recordKey);
  if (!record) return false;
  const confirmed = window.confirm(`Ștergi staționarea pentru ${record.owner}?`);
  if (!confirmed) return false;

  stationing = stationing.filter((item) => item.key !== recordKey);
  saveStays();
  closeStationingModal();
  renderStationing();
  refreshIcons();
  logActivity({
    eventType: "delete",
    entityType: "stationing",
    entityKey: record.key,
    entityLabel: activityStationingLabel(record),
    message: `Staționarea pentru ${record.owner} (${record.caravan}) a fost ștearsă.`,
    data: { record }
  });
  showToast(`Staționare ștearsă: ${record.owner}`);
  return true;
}

function refreshIcons(container) {
  if (window.lucide) {
    if (container) {
      const nodes = container.querySelectorAll("[data-lucide]:not(.lucide)");
      if (nodes.length) window.lucide.createIcons({ nodes });
    } else {
      window.lucide.createIcons();
    }
  }
}

function renderAll(options = {}) {
  const force = options.force === true;
  if (!force && !dirtyPages.has(activePage)) return;

  if (activePage === "calendar") {
    renderGuestTimeline();
  } else if (activePage === "clients") {
    renderReservations();
    refreshIcons(reservationCards);
  } else if (activePage === "stationing") {
    renderStationing();
  } else if (activePage === "bar") {
    renderBarPage();
  } else if (activePage === "settings") {
    renderUnitList();
    renderFacilityList();
  } else if (activePage === "statistics") {
    renderMetrics();
    refreshIcons(metricGrid);
    renderReviewsPanel();
  }
  dirtyPages.delete(activePage);
  const activeSection = document.querySelector(`[data-page-section="${activePage}"]`);
  if (activeSection) refreshIcons(activeSection);
}

function runWhenIdle(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 1200 });
    return;
  }
  window.setTimeout(() => callback({ timeRemaining: () => 16 }), 80);
}

function warmHiddenPages() {
  const pagesToWarm = pageNames.filter((page) => page !== activePage && dirtyPages.has(page));
  if (!pagesToWarm.length) return;

  const warmNext = (deadline) => {
    while (pagesToWarm.length && deadline.timeRemaining() > 6) {
      const page = pagesToWarm.shift();
      const previousPage = activePage;
      activePage = page;
      renderAll({ force: true });
      activePage = previousPage;
    }
    if (pagesToWarm.length) runWhenIdle(warmNext);
  };

  runWhenIdle(warmNext);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function closeTimelineContextMenu() {
  timelineContextMenu.hidden = true;
  contextStayKey = null;
}

function openTimelineContextMenu(event) {
  const bar = event.target.closest(".timeline-bar");
  if (!bar) {
    closeTimelineContextMenu();
    return;
  }

  event.preventDefault();
  contextStayKey = bar.dataset.stayKey;
  const menuWidth = 190;
  const menuHeight = 92;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 12);
  timelineContextMenu.style.left = `${Math.max(12, left)}px`;
  timelineContextMenu.style.top = `${Math.max(12, top)}px`;
  timelineContextMenu.hidden = false;
  refreshIcons();
}

function applySidebarState() {
  appShell.classList.toggle("is-sidebar-collapsed", sidebarCollapsed);
  sidebarToggle.title = sidebarCollapsed ? "Extinde meniul" : "Restrânge meniul";
  sidebarToggle.setAttribute("aria-label", sidebarToggle.title);
  sidebarToggle.innerHTML = `<i data-lucide="${sidebarCollapsed ? "panel-left-open" : "panel-left-close"}" aria-hidden="true"></i>`;
  refreshIcons();
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem("marinaParkSidebarCollapsed", String(sidebarCollapsed));
  applySidebarState();
  requestAnimationFrame(() => setVisibleMonth(visibleMonth));
  queueFileSave();
}

function groupFromKind(kind) {
  const value = String(kind || "").toLowerCase();
  if (value === "camping" || value.includes("camping") || value.includes("campare") || value.includes("rulot")) {
    return "camping";
  }
  return "room";
}

function kindOptionForGroup(group) {
  return group === "camping" ? "camping" : "room";
}

function prefixFromKind(kind) {
  const value = kind.toLowerCase();
  if (value.includes("camping")) return "T";
  if (value.includes("rulot")) return "RV";
  if (value.includes("campare")) return "T";
  if (value.includes("bungalou")) return "B";
  if (value.includes("cvadrupl")) return "Q";
  return "D";
}

function renderUnitSelect(selectedUnitId = "") {
  const currentKind = bookingForm.elements.kind.value || kindOptionForGroup(activeMode);
  const group = groupFromKind(currentKind);
  const options = activeUnitOptions(group);
  const selectedExists = options.some((unit) => unit.id === selectedUnitId);
  const fallbackId = selectedExists ? selectedUnitId : options[0]?.id || "";

  bookingForm.elements.unitId.innerHTML = options.length
    ? options
        .map((unit) => `<option value="${unit.id}" ${unit.id === fallbackId ? "selected" : ""}>${unit.id} - ${unit.kind}</option>`)
        .join("")
    : `<option value="">Nu există unități</option>`;
}

function ensureKindOption(kind) {
  const value = kindOptionForGroup(groupFromKind(kind));
  if (!value) return;
  if (![...bookingForm.elements.kind.options].some((option) => option.value === value)) {
    bookingForm.elements.kind.add(new Option(value === "camping" ? "Camping" : "Camere", value));
  }
}

function syncKindFromSelectedUnit() {
  const unit = unitById(bookingForm.elements.unitId.value);
  if (!unit) return;
  bookingForm.elements.kind.value = kindOptionForGroup(unit.group);
  syncBookingPaymentFields();
  renderBookingRangeCalendar();
}

let lastPricingSnapshot = { arrival: "", departure: "", nights: 0, adults: 0, children: 0 };

function lockImportedPricing() {
  bookingForm.dataset.pricingMode = "imported";
}

function clearImportedPricing() {
  delete bookingForm.dataset.pricingMode;
}

function isImportedPricingLocked() {
  return bookingForm.dataset.pricingMode === "imported";
}

function currentPricingSnapshot() {
  return {
    arrival: bookingForm.elements.arrival.value || "",
    departure: bookingForm.elements.departure.value || "",
    nights: Math.max(1, Number(bookingForm.elements.nights.value || 1)),
    adults: Math.max(0, Number(bookingForm.elements.adults.value || 0)),
    children: Math.max(0, Number(bookingForm.elements.children.value || 0))
  };
}

function savePricingSnapshot() {
  lastPricingSnapshot = currentPricingSnapshot();
}

function billablePricingQuantityChanged() {
  const previous = lastPricingSnapshot;
  const current = currentPricingSnapshot();
  const unit = unitById(bookingForm.elements.unitId.value);

  if (current.arrival !== previous.arrival) return true;
  if (current.departure !== previous.departure) return true;
  if (current.nights !== previous.nights) return true;
  if (unit?.pricingMode !== "per-person-night") return false;

  return current.adults !== previous.adults || current.children !== previous.children;
}

function priceFromSelectedUnit() {
  const unit = unitById(bookingForm.elements.unitId.value);
  if (!unit) return null;

  const adults = Math.max(0, Number(bookingForm.elements.adults.value || 0));
  const children = Math.max(0, Number(bookingForm.elements.children.value || 0));
  return priceForUnitRange(unit, bookingForm.elements.arrival.value, bookingForm.elements.departure.value, adults, children);
}

function deriveProportionalPrice() {
  const currentPrice = Math.max(0, Number(bookingForm.elements.price.value || 0) - currentBookingBarTotal());
  if (currentPrice <= 0) return null;

  const prev = lastPricingSnapshot;
  const now = currentPricingSnapshot();
  const prevNights = Math.max(1, prev.nights);

  if (now.nights === prevNights) {
    return null;
  }

  const nightsRatio = now.nights / prevNights;
  return Math.round(currentPrice * nightsRatio * 100) / 100;
}

function applySelectedUnitPricing() {
  if (isImportedPricingLocked()) {
    savePricingSnapshot();
    renderBookingRangeCalendar();
    return;
  }

  const selectedUnit = unitById(bookingForm.elements.unitId.value);
  const unitPrice = priceFromSelectedUnit();
  if (unitPrice !== null) {
    setBookingBasePrice(unitPrice);
    syncBookingTotalFromFacilities();
    savePricingSnapshot();
    renderBookingRangeCalendar();
    return;
  }

  if (selectedUnit) {
    setBookingBasePrice(0);
    syncBookingTotalFromFacilities();
    savePricingSnapshot();
    renderBookingRangeCalendar();
    return;
  }

  const derived = deriveProportionalPrice();
  if (derived !== null) {
    setBookingBasePrice(derived);
    syncBookingTotalFromFacilities();
    savePricingSnapshot();
  }
  renderBookingRangeCalendar();
}

function recalculateBookingPrice(options = {}) {
  if (options.unlockImported) {
    clearImportedPricing();
  }
  updatePartyTotal();
  if (options.onlyWhenBillableChanged && !billablePricingQuantityChanged()) {
    savePricingSnapshot();
    renderBookingRangeCalendar();
    return;
  }
  applySelectedUnitPricing();
}

function recalculateBookingPriceAfterUserChange() {
  recalculateBookingPrice({ unlockImported: true, onlyWhenBillableChanged: true });
}

function nextReservationId(kind) {
  const prefix = prefixFromKind(kind);
  const numbers = stays
    .filter((stay) => stay.id?.startsWith(`${prefix}-`))
    .map((stay) => Number(stay.id.split("-")[1]))
    .filter(Number.isFinite);
  const nextNumber = Math.max(0, ...numbers) + 1;
  return `${prefix}-${String(nextNumber).padStart(2, "0")}`;
}

function syncBookingPaymentFields() {
  bookingForm.elements.deposit.disabled = false;
  setMoneyField("deposit", 0);
  setMoneyField("balance", Number(bookingForm.elements.price.value || 0));
}

function updatePartyTotal() {
  const adults = Math.max(0, Number(bookingForm.elements.adults.value || 0));
  const children = Math.max(0, Number(bookingForm.elements.children.value || 0));
  bookingForm.elements.party.value = Math.max(1, adults + children);
}

function syncNightsFromDates() {
  const arrival = bookingForm.elements.arrival.value;
  const departure = bookingForm.elements.departure.value;
  if (!arrival || !departure) return;

  const nights = daysBetween(dateFromISO(arrival), dateFromISO(departure));
  if (nights > 0) {
    bookingForm.elements.nights.value = nights;
  }
}

function syncDepartureFromNights() {
  const arrival = bookingForm.elements.arrival.value;
  const nights = Number(bookingForm.elements.nights.value || 1);
  if (!arrival || nights < 1) return;

  bookingForm.elements.departure.value = toISODate(addDays(dateFromISO(arrival), nights));
}

function syncBalanceFromPrice() {
  const price = Number(bookingForm.elements.price.value || 0);
  setMoneyField("deposit", 0);
  setMoneyField("balance", normalizeMoneyValue(price));
}

function syncBasePriceFromTotalInput() {
  const total = normalizeMoneyValue(bookingForm.elements.price.value);
  setBookingBasePrice(Math.max(0, total - manualFacilityTotal(bookingFacilityDraft) - currentBookingBarTotal()));
  syncBalanceFromPrice();
  renderBookingFacilities();
  renderBookingBarItems();
}

function openBookingModal(defaults = {}) {
  clearImportedPricing();
  const defaultArrival = defaults.arrival ? dateFromISO(defaults.arrival) : defaultArrivalDate();
  const defaultDeparture = defaults.departure || defaults.end || toISODate(addDays(defaultArrival, 2));
  const nights = Math.max(1, daysBetween(defaultArrival, dateFromISO(defaultDeparture)));
  const kind = kindOptionForGroup(defaults.group || groupFromKind(defaults.kind || activeMode));
  const price = Number(defaults.price ?? 600);
  const balance = normalizeMoneyValue(defaults.balance ?? price);
  const deposit = 0;
  const defaultStayContext = { start: toISODate(defaultArrival), end: defaultDeparture };
  bookingFacilityDraft = normalizeStayFacilities(defaults.facilities, defaultStayContext);
  const barTotal = reservationBarTotal(defaults.barItems);
  const basePrice = normalizeMoneyValue(defaults.basePrice ?? Math.max(0, price - manualFacilityTotal(bookingFacilityDraft) - barTotal));

  editingStayKey = defaults.key || null;
  const defaultPersonId = String(defaults.personId || "").trim();
  bookingPersonId = defaultPersonId || (editingStayKey ? normalizePersonId("", editingStayKey) : createPersonId(defaults.guest || defaults.phone || ""));
  bookingUnitId = defaults.unitId || defaults.id || null;
  guestFormTitle.textContent = editingStayKey ? "Editează clientul" : "Rezervare nouă";
  bookingSubmitLabel.textContent = editingStayKey ? "Salvează clientul" : "Adaugă rezervarea";
  deleteBookingButton.hidden = !editingStayKey;
  receiptFromBookingButton.hidden = !editingStayKey;
  if (addLinkedReservationButton) addLinkedReservationButton.hidden = !editingStayKey;
  bookingEditSession = editingStayKey
    ? {
        key: editingStayKey,
        openedAt: new Date().toISOString(),
        guest: defaults.guest || "",
        initialPrice: Number(defaults.price || 0),
        initialBalance: Number(defaults.balance || 0),
        initialPaid: isStayFullyPaid(defaults),
        initialSettledPrice: paymentCoveredPriceForStay(defaults),
        initialActualPaidAmount: actualPaidAmountForStay(defaults),
        initialPaymentMethod: defaults.paymentMethod || "",
        personId: bookingPersonId
      }
    : null;
  if (bookingEditSession) {
    logActivity({
      eventType: "open",
      entityType: "client",
      entityKey: editingStayKey,
      entityLabel: activityStayLabel(defaults),
      message: `Fișa clientului ${defaults.guest || "client"} a fost deschisă pentru editare.`,
      data: {
        initialPrice: bookingEditSession.initialPrice,
        initialBalance: bookingEditSession.initialBalance,
        initialPaid: bookingEditSession.initialPaid,
        initialSettledPrice: bookingEditSession.initialSettledPrice,
        initialActualPaidAmount: bookingEditSession.initialActualPaidAmount,
        initialPaymentMethod: bookingEditSession.initialPaymentMethod,
        personId: bookingEditSession.personId,
        linkedReservationCount: linkedReservationsCountFor(defaults),
        openedAt: bookingEditSession.openedAt
      }
    });
  }

  ensureKindOption(kind);
  bookingForm.elements.kind.value = kind;
  renderUnitSelect(bookingUnitId);
  syncKindFromSelectedUnit();
  bookingForm.elements.guest.value = defaults.guest || "";
  bookingForm.elements.phone.value = defaults.phone || "";
  bookingForm.elements.adults.value = Math.max(0, Number(defaults.adults ?? defaults.party ?? 2));
  bookingForm.elements.children.value = Math.max(0, Number(defaults.children || 0));
  bookingForm.elements.car.value = defaults.car || "";
  updatePartyTotal();
  bookingForm.elements.arrival.value = toISODate(defaultArrival);
  bookingForm.elements.departure.value = defaultDeparture;
  bookingForm.elements.nights.value = nights;
  syncBookingCalendarMonthToArrival();
  setBookingBasePrice(basePrice);
  setMoneyField("price", price);
  setMoneyField("deposit", deposit);
  setMoneyField("balance", balance);
  bookingForm.elements.paymentMethod.value = defaults.paymentMethod || "";
  bookingForm.elements.note.value = defaults.note || "";
  sourceBookings = [];
  syncSourceModeFromKind();
  renderSourceBookings();
  sourceRecordStatus.textContent = "Se încarcă ultimele 300 rezervări.";
  syncBookingPaymentFields();
  if (!editingStayKey && !defaults.price) {
    applySelectedUnitPricing();
  } else {
    renderBookingFacilities();
    renderBookingBarItems();
    renderBookingRangeCalendar();
  }
  renderLinkedReservations();
  savePricingSnapshot();
  bookingModal.classList.add("is-open");
  document.body.style.overflow = "hidden";
  setTimeout(() => {
    bookingForm.elements.guest.focus();
    loadSourceBookings();
  }, 0);
}

function closeBookingModal() {
  bookingModal.classList.remove("is-open");
  document.body.style.overflow = "";
  editingStayKey = null;
  bookingPersonId = null;
  bookingUnitId = null;
  bookingRangeAnchorDate = null;
  bookingFacilityDraft = [];
  if (linkedReservationsSection) linkedReservationsSection.hidden = true;
  if (linkedReservationsTrack) linkedReservationsTrack.innerHTML = "";
  if (linkedReservationsCount) linkedReservationsCount.textContent = "";
  if (addLinkedReservationButton) addLinkedReservationButton.hidden = true;
  bookingModal.classList.remove("has-reservation-tabs");
  _lastLinkedTabKeys = [];
  if (bookingBarSection) bookingBarSection.hidden = true;
  if (bookingBarItems) bookingBarItems.innerHTML = "";
  clearImportedPricing();
  deleteBookingButton.hidden = true;
  receiptFromBookingButton.hidden = true;
  bookingEditSession = null;
}

function setMoneyField(name, value) {
  bookingForm.elements[name].value = Number(value || 0).toFixed(2);
}

function setBookingBasePrice(value) {
  setMoneyField("basePrice", normalizeMoneyValue(value));
}

function currentBookingGroup() {
  const selectedUnit = unitById(bookingForm.elements.unitId.value);
  return selectedUnit?.group || groupFromKind(bookingForm.elements.kind.value);
}

function syncBookingFacilityTotals() {
  const group = currentBookingGroup();
  bookingFacilityDraft = bookingFacilityDraft.filter((facility) => {
    const catalogItem = facilityByKey(facility.key);
    if (!catalogItem) return true;
    if (catalogItem.active === false) return true;
    return catalogItem.group === "all" || catalogItem.group === group;
  });
  bookingFacilityDraft = refreshFacilityNights(
    bookingFacilityDraft,
    bookingForm.elements.arrival.value,
    bookingForm.elements.departure.value
  );
}

function syncBookingTotalFromFacilities() {
  syncBookingFacilityTotals();
  const basePrice = normalizeMoneyValue(bookingForm.elements.basePrice.value);
  const nextTotal = normalizeMoneyValue(priceWithFacilities(basePrice, bookingFacilityDraft) + currentBookingBarTotal());
  setMoneyField("price", nextTotal);
  syncBalanceFromPrice();
  renderBookingFacilities();
  renderBookingBarItems();
}

let _lastLinkedTabKeys = [];

function renderLinkedReservations() {
  if (!linkedReservationsSection || !linkedReservationsTrack) return;
  const existingLinked = linkedReservationsForPerson(bookingPersonId);
  const linked = [...existingLinked];

  if (!editingStayKey && existingLinked.length > 0) {
    const defaultArrival = bookingForm.elements.arrival?.value || toISODate(localToday());
    const defaultDeparture = bookingForm.elements.departure?.value || toISODate(addDays(localToday(), 1));
    const unitId = bookingForm.elements.unitId?.value || "Nou";
    const price = Number(bookingForm.elements.price?.value || 0);
    const balance = Number(bookingForm.elements.balance?.value || 0);
    const nights = Math.max(1, daysBetween(dateFromISO(defaultArrival), dateFromISO(defaultDeparture)));

    linked.push({
      key: "new-draft",
      isDraft: true,
      id: unitId,
      dates: formatStayDates(defaultArrival, defaultDeparture),
      nights: nights,
      balance: balance,
      price: price
    });
  }

  if (linked.length <= 1) {
    linkedReservationsSection.hidden = true;
    linkedReservationsTrack.innerHTML = "";
    if (linkedReservationsCount) linkedReservationsCount.textContent = "";
    bookingModal.classList.remove("has-reservation-tabs");
    _lastLinkedTabKeys = [];
    return;
  }

  const currentKeys = linked.map((s) => [
    s.key,
    s.id,
    s.dates,
    s.price,
    receiptAmountFor(s),
    isStayFullyPaid(s) ? "paid" : "unpaid",
    s.isDraft ? "draft" : "saved"
  ].join("|"));
  const keysMatch = currentKeys.length === _lastLinkedTabKeys.length && currentKeys.every((k, i) => k === _lastLinkedTabKeys[i]);

  if (keysMatch) {
    /* Same set of linked stays — just toggle is-current, no re-render */
    const buttons = linkedReservationsTrack.querySelectorAll("[data-linked-reservation]");
    buttons.forEach((btn) => {
      const isCurrent = btn.dataset.linkedReservation === (editingStayKey || "new-draft");
      btn.classList.toggle("is-current", isCurrent);
      btn.setAttribute("aria-selected", String(isCurrent));
    });
    return;
  }

  /* Different set — full render */
  _lastLinkedTabKeys = currentKeys;

  const currentIndex = Math.max(0, linked.findIndex((stay) => stay.key === (editingStayKey || "new-draft")));
  const tabColors = [
    { accent: "#0f6e7a", bg: "#e8f6f6", text: "#12363a" },
    { accent: "#b86f38", bg: "#fff0e5", text: "#4d2917" },
    { accent: "#4f7f46", bg: "#eef7eb", text: "#203d21" },
    { accent: "#8b5e92", bg: "#f6edf7", text: "#412347" },
    { accent: "#6f5a3c", bg: "#f4ecdd", text: "#3c2f1f" }
  ];
  linkedReservationsSection.hidden = false;
  bookingModal.classList.add("has-reservation-tabs");

  /* Summary tab aggregates saved linked reservations. Drafts must be saved before payment. */
  const summaryLinked = existingLinked.length ? existingLinked : linked.filter((stay) => !stay.isDraft);
  const totalPrice = summaryLinked.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const totalBalance = summaryLinked.reduce((sum, s) => sum + receiptAmountFor(s), 0);
  const totalNights = summaryLinked.reduce((sum, s) => {
    const n = s.nights !== undefined ? s.nights : stayDetails(s).nights;
    return sum + n;
  }, 0);
  const allPaid = summaryLinked.length > 0 && summaryLinked.every(isStayFullyPaid);
  const hasDraft = linked.some((stay) => stay.isDraft);
  const summaryCountLabel = hasDraft ? `${summaryLinked.length} salvate` : `${summaryLinked.length} rezervări`;

  const summaryTab = `
    <button class="linked-reservation-summary" data-linked-reservation="summary" type="button" title="${hasDraft ? "Salvează rezervarea nouă înainte de plata totală" : "Plată totală client"}">
      <div class="summary-header">
        <span class="summary-icon">Σ</span>
        <strong>Total client</strong>
      </div>
      <div class="summary-details">
        <span>${summaryCountLabel} · ${totalNights} ${totalNights === 1 ? "noapte" : "nopți"}</span>
        <span class="summary-total">${formatCurrency(totalPrice)}</span>
        <em class="${allPaid ? "is-paid" : "is-unpaid"}">${allPaid ? "Achitat integral" : `De încasat ${formatCurrency(totalBalance)}`}</em>
      </div>
    </button>
  `;

  const tabsHtml = linked
    .map((stay, index) => {
      const current = index === currentIndex;
      const paid = isStayFullyPaid(stay);
      const status = paid ? "Achitat integral" : `De încasat ${formatCurrency(receiptAmountFor(stay))}`;
      const stayNights = stay.nights !== undefined ? stay.nights : stayDetails(stay).nights;
      const color = tabColors[index % tabColors.length];
      const style = [
        `--tab-accent:${color.accent}`,
        `--tab-bg:${color.bg}`,
        `--tab-text:${color.text}`,
        `--tab-index:${index}`
      ].join(";");

      return `
        <button class="linked-reservation-tab ${current ? "is-current" : ""} ${paid ? "is-paid" : "is-unpaid"} ${stay.isDraft ? "is-draft" : ""}" type="button" role="tab" aria-selected="${current}" data-linked-reservation="${escapeHtml(stay.key)}" style="${style}">
          <strong>${escapeHtml(stay.dates || "")}</strong>
          <span class="linked-tab-number">${index + 1}</span>
          <span>${escapeHtml(stay.id)} · ${stayNights} ${stayNights === 1 ? "noapte" : "nopți"}</span>
          <em>${stay.isDraft ? "Nou" : status}</em>
        </button>
      `;
    })
    .join("");

  linkedReservationsTrack.innerHTML = summaryTab + tabsHtml;

  if (linkedReservationsCount) {
    linkedReservationsCount.textContent = `${linked.length} rezervări`;
  }
}

function openLinkedReservationDraft() {
  const source = editingStayKey ? stays.find((stay) => stay.key === editingStayKey) : null;
  if (!source || source.guest === "Disponibil") return;
  if (!source.personId) {
    source.personId = normalizePersonId("", source.key);
    saveStays();
  }

  openBookingModal({
    personId: source.personId,
    group: source.group,
    kind: kindOptionForGroup(source.group),
    guest: source.guest,
    phone: source.phone,
    adults: source.adults,
    children: source.children,
    car: source.car,
    note: source.note
  });
  showToast("Alege unitatea și perioada pentru aceeași persoană.");
}

function reservationBarItemsMarkup(stay, options = {}) {
  const items = normalizeStayBarItems(stay?.barItems);
  if (!items.length) return "";
  const total = reservationBarTotal(items);
  const controls = options.controls !== false;
  const disabled = isStayFullyPaid(stay);
  const stayKey = escapeHtml(stay.key);
  const compact = options.compact === true;

  return `
    <div class="reservation-bar-panel ${disabled ? "is-locked" : ""} ${compact ? "is-compact" : ""}">
      <div class="reservation-bar-head">
        <span><i data-lucide="martini" aria-hidden="true"></i> Bar pe rezervare</span>
        <strong>${formatCurrency(total)}</strong>
      </div>
      <div class="reservation-bar-items">
        ${items
          .map((item) => {
            const itemId = escapeHtml(item.id);
            const quantityLabel = `x${item.quantity}`;
            const itemMeta = `${formatCurrency(item.price)}${item.hasSgr ? " · SGR inclus" : ""}`;
            const buttons =
              controls && !disabled
                ? `
                  <div class="reservation-bar-actions">
                    <button class="icon-button compact" type="button" data-client-bar-stay="${stayKey}" data-client-bar-item="${itemId}" data-delta="-1" title="Scade cantitatea" aria-label="Scade cantitatea pentru ${escapeHtml(item.name)}">
                      <i data-lucide="minus" aria-hidden="true"></i>
                    </button>
                    <button class="icon-button compact" type="button" data-client-bar-stay="${stayKey}" data-client-bar-item="${itemId}" data-delta="1" title="Crește cantitatea" aria-label="Crește cantitatea pentru ${escapeHtml(item.name)}">
                      <i data-lucide="plus" aria-hidden="true"></i>
                    </button>
                    <button class="icon-button compact danger-button" type="button" data-client-bar-stay="${stayKey}" data-client-bar-item="${itemId}" data-remove="true" title="Elimină articolul" aria-label="Elimină ${escapeHtml(item.name)}">
                      <i data-lucide="x" aria-hidden="true"></i>
                    </button>
                  </div>
                `
                : `<small>${disabled ? "achitat" : ""}</small>`;
            return `
              <article class="reservation-bar-item">
                <div>
                  <strong>${escapeHtml(item.name)} <span>${quantityLabel}</span></strong>
                  <small>${itemMeta}</small>
                </div>
                <span>${formatCurrency(item.lineTotal)}</span>
                ${buttons}
              </article>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderBookingBarItems() {
  if (!bookingBarSection || !bookingBarItems) return;
  const stay = editingStayKey ? stays.find((item) => item.key === editingStayKey) : null;
  const markup = stay ? reservationBarItemsMarkup(stay) : "";
  bookingBarSection.hidden = !markup;
  bookingBarItems.innerHTML = markup || "";
  refreshIcons(bookingBarItems);
}

function renderBookingFacilities() {
  if (!bookingFacilities) return;

  syncBookingFacilityTotals();
  const group = currentBookingGroup();
  const stayNights = stayNightCount(bookingForm.elements.arrival.value, bookingForm.elements.departure.value);
  const availableMap = new Map(activeFacilitiesForGroup(group).map((facility) => [facility.key, facility]));
  bookingFacilityDraft.forEach((facility) => {
    if (!availableMap.has(facility.key)) {
      availableMap.set(facility.key, { ...facility, active: false, savedOnly: true });
    }
  });
  const available = [...availableMap.values()];
  if (!available.length) {
    bookingFacilities.innerHTML = `<p class="empty-state">Nu există facilități pentru această categorie.</p>`;
    return;
  }

  bookingFacilities.innerHTML = available
    .map((facility) => {
      const selected = bookingFacilityDraft.find((item) => item.key === facility.key);
      const checked = Boolean(selected);
      const included = selected?.includedInBasePrice === true;
      const pricePerNight = normalizeMoneyValue(selected?.pricePerNight ?? facility.pricePerNight);
      const selectedNights = selected ? Math.min(stayNights, Math.max(1, Number(selected.nights || stayNights))) : stayNights;
      const total = selected ? selected.total : normalizeMoneyValue(pricePerNight * stayNights);
      const daysControl =
        checked && !included
          ? `
          <label class="facility-days-control">
            <span>Zile</span>
            <input type="number" min="1" max="${stayNights}" step="1" value="${selectedNights}" data-facility-days-key="${escapeHtml(facility.key)}" aria-label="Zile pentru ${escapeHtml(selected?.name || facility.name)}" />
          </label>
        `
          : "";
      const inactiveText = facility.active === false ? " · inactivă" : "";
      return `
        <article class="facility-toggle ${included ? "is-included" : ""}">
          <label class="facility-toggle-main">
            <input type="checkbox" data-facility-key="${escapeHtml(facility.key)}" ${checked ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(selected?.name || facility.name)}</strong>
            <span>${formatCurrency(pricePerNight)} / noapte${included ? " · inclus din MySQL" : ""}${inactiveText}</span>
          </span>
          </label>
          ${daysControl}
          <small>${checked && !included ? formatCurrency(total) : ""}</small>
        </article>
      `;
    })
    .join("");
}

function setBookingFacilityEnabled(key, enabled) {
  bookingFacilityDraft = bookingFacilityDraft.filter((item) => item.key !== key);
  if (!enabled) {
    syncBookingTotalFromFacilities();
    return;
  }

  const facility = facilityByKey(key);
  if (!facility || facility.active === false) return;
  const nights = stayNightCount(bookingForm.elements.arrival.value, bookingForm.elements.departure.value);
  bookingFacilityDraft.push({
    key: facility.key,
    name: facility.name,
    pricePerNight: facility.pricePerNight,
    nights,
    customNights: false,
    total: normalizeMoneyValue(facility.pricePerNight * nights),
    includedInBasePrice: false,
    source: "manual"
  });
  syncBookingTotalFromFacilities();
}

function setBookingFacilityDays(key, days) {
  const maxNights = stayNightCount(bookingForm.elements.arrival.value, bookingForm.elements.departure.value);
  const nextDays = Math.min(maxNights, Math.max(1, Number(days || 1)));
  const facility = bookingFacilityDraft.find((item) => item.key === key);
  if (!facility || facility.includedInBasePrice) return;

  facility.nights = nextDays;
  facility.customNights = nextDays !== maxNights;
  facility.total = normalizeMoneyValue(facility.pricePerNight * nextDays);
  syncBookingTotalFromFacilities();
}

function bookingCalendarPriceLabel(unit, dateText) {
  if (!unit) return "0";
  const rates = unitRatesForDate(unit, dateText);
  return formatCompactMoney(rates.primaryPrice);
}

function renderBookingRangeCalendar() {
  if (!bookingRangeCalendar) return;
  const unit = unitById(bookingForm.elements.unitId.value);
  const arrival = validDateFromISO(bookingForm.elements.arrival.value);
  const departure = validDateFromISO(bookingForm.elements.departure.value);
  bookingCalendarMonthLabel.textContent = calendarMonthLabel(bookingCalendarMonth);

  bookingRangeCalendar.innerHTML =
    calendarWeekdayHeader() +
    calendarGridDates(bookingCalendarMonth)
      .map((date) => {
        const dateText = toISODate(date);
        const isOutside = date.getMonth() !== bookingCalendarMonth.getMonth();
        const isSelected = arrival && departure && date >= arrival && date <= departure;
        const isCheckout = Boolean(arrival && departure && dateText === toISODate(departure));
        const isRangeStart = isSelected && dateText === toISODate(arrival);
        const isRangeEnd = isSelected && isCheckout;
        const isRangeEdge = isRangeStart || isRangeEnd;
        const rates = unit ? unitRatesForDate(unit, dateText) : { primaryPrice: 0, hasCustomPrice: false };
        const classNames = [
          "calendar-day",
          isOutside ? "is-outside" : "",
          dateText === toISODate(today) ? "is-today" : "",
          rates.hasCustomPrice ? "is-custom-price" : "",
          isSelected ? "is-selected" : "",
          isCheckout ? "is-checkout" : "",
          isRangeStart ? "is-range-start" : "",
          isRangeEnd ? "is-range-end" : "",
          isRangeEdge ? "is-range-edge" : ""
        ]
          .filter(Boolean)
          .join(" ");
        return `
          <button class="${classNames}" type="button" data-booking-range-date="${dateText}" aria-label="${date.toLocaleDateString("ro-RO")}, ${formatCurrency(rates.primaryPrice)}">
            <strong>${date.getDate()}</strong>
            <small>${isCheckout ? "final" : bookingCalendarPriceLabel(unit, dateText)}</small>
          </button>
        `;
      })
      .join("");

  if (!unit) {
    bookingRangeSummary.textContent = "Alege o unitate pentru a vedea tarifele pe zile.";
  } else if (!arrival || !departure || departure <= arrival) {
    bookingRangeSummary.textContent = "Alege o perioadă validă. Ziua finală nu se taxează.";
  } else {
    const nights = daysBetween(arrival, departure);
    const total = priceForUnitRange(
      unit,
      bookingForm.elements.arrival.value,
      bookingForm.elements.departure.value,
      Number(bookingForm.elements.adults.value || 0),
      Number(bookingForm.elements.children.value || 0)
    );
    const modeText = unit.pricingMode === "per-person-night" ? "pe persoană/noapte" : "pe noapte";
    bookingRangeSummary.textContent =
      total === null
        ? `${nights} nopți selectate · lipsește tarif calendar pentru cel puțin o noapte.`
        : `${nights} nopți selectate · total ${formatCurrency(total)} · calcul ${modeText}, fără ziua finală.`;
  }
}

function syncBookingCalendarMonthToArrival() {
  const arrival = validDateFromISO(bookingForm.elements.arrival.value);
  if (arrival) {
    bookingCalendarMonth = monthStart(arrival);
  }
}

function setBookingRangeFromCalendar(startText, endText = startText) {
  const bounds = dateRangeBounds(startText, endText);
  if (!bounds) return;
  bookingForm.elements.arrival.value = bounds.startText;
  bookingForm.elements.departure.value = bounds.startText === bounds.endText ? toISODate(addDays(bounds.end, 1)) : bounds.endText;
  syncNightsFromDates();
  syncBookingCalendarMonthToArrival();
  recalculateBookingPriceAfterUserChange();
}

function selectBookingRangeDate(dateText) {
  if (!bookingRangeAnchorDate) {
    bookingRangeAnchorDate = dateText;
    setBookingRangeFromCalendar(dateText);
    return;
  }

  if (bookingRangeAnchorDate === dateText) {
    setBookingRangeFromCalendar(dateText);
    return;
  }

  setBookingRangeFromCalendar(bookingRangeAnchorDate, dateText);
  bookingRangeAnchorDate = null;
}

function calendarDateFromPointer(event, selector, datasetKey) {
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const dayButton = element?.closest(selector);
  return dayButton?.dataset?.[datasetKey] || null;
}

function finishUnitPricingDrag() {
  if (unitPricingDrag?.moved) {
    suppressUnitCalendarClick = true;
    window.setTimeout(() => {
      suppressUnitCalendarClick = false;
    }, 0);
    unitPricingAnchorDate = null;
  }
  unitPricingDrag = null;
}

function finishBookingCalendarDrag() {
  if (bookingCalendarDrag?.moved) {
    suppressBookingCalendarClick = true;
    window.setTimeout(() => {
      suppressBookingCalendarClick = false;
    }, 0);
    bookingRangeAnchorDate = null;
  }
  bookingCalendarDrag = null;
}

function finishCalendarDrags() {
  finishUnitPricingDrag();
  finishBookingCalendarDrag();
}

function renderSourceBookings() {
  if (!sourceBookings.length) {
    sourceRecordRows.innerHTML = `
      <tr>
        <td colspan="4">Nu sunt date încărcate.</td>
      </tr>
    `;
    return;
  }

  const todayText = toISODate(new Date());
  const orderedBookings = orderedSourceBookings(todayText);
  const todayBookings = orderedBookings.filter((booking) => booking.start === todayText);
  const otherBookings = orderedBookings.filter((booking) => booking.start !== todayText);
  const rowForBooking = (booking, index) => `
    <tr data-source-index="${index}">
      <td>
        <strong>${booking.guest}</strong>
        <span>${booking.phone || "fără telefon"}</span>
      </td>
      <td>
        <strong>${booking.start} - ${booking.end}</strong>
        <span>${booking.kind}${booking.unitHint ? ` · ${booking.unitHint}` : ""}</span>
      </td>
      <td>${booking.party}</td>
      <td>${formatCurrency(Number(booking.price || 0))}</td>
    </tr>
  `;
  const todayRows = todayBookings.map((booking) => rowForBooking(booking, sourceBookings.indexOf(booking)));
  const separator =
    todayBookings.length && otherBookings.length
      ? [
          `
          <tr class="source-record-separator" aria-hidden="true">
            <td colspan="4"><span>------------</span></td>
          </tr>
        `
        ]
      : [];
  const noTodayRow =
    !todayBookings.length && otherBookings.length
      ? [
          `
          <tr class="source-record-separator source-record-empty-today">
            <td colspan="4"><span>Nu există rezervări pentru azi (${todayText})</span></td>
          </tr>
        `
        ]
      : [];
  const otherRows = otherBookings.map((booking) => rowForBooking(booking, sourceBookings.indexOf(booking)));

  sourceRecordRows.innerHTML = [...todayRows, ...separator, ...noTodayRow, ...otherRows].join("");
}

function sourceRecordDateValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function sourceRecordModifiedValue(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

function orderedSourceBookings(todayText = toISODate(new Date())) {
  const todayValue = sourceRecordDateValue(todayText);
  return [...sourceBookings].sort((first, second) => {
    const firstStart = sourceRecordDateValue(first.start);
    const secondStart = sourceRecordDateValue(second.start);
    const firstGroup = first.start === todayText ? 0 : firstStart > todayValue ? 1 : 2;
    const secondGroup = second.start === todayText ? 0 : secondStart > todayValue ? 1 : 2;

    if (firstGroup !== secondGroup) return firstGroup - secondGroup;

    const startCompare = firstGroup === 2 ? secondStart - firstStart : firstStart - secondStart;
    if (startCompare !== 0) return startCompare;

    return sourceRecordModifiedValue(second.modifiedAt) - sourceRecordModifiedValue(first.modifiedAt);
  });
}

function sourceTodayArrivalCount() {
  const todayText = toISODate(new Date());
  return sourceBookings.filter((booking) => booking.start === todayText).length;
}

function setSourceRecordsMode(mode) {
  sourceRecordsMode = mode === "camping" ? "camping" : "room";
  sourceModeSwitch.checked = sourceRecordsMode === "camping";
}

function syncSourceModeFromKind() {
  setSourceRecordsMode(groupFromKind(bookingForm.elements.kind.value));
}

function applySourceBooking(booking) {
  if (!booking) return;

  const hintedUnit = booking.unitHint ? unitById(booking.unitHint) : null;
  const bookingGroup = hintedUnit?.group || booking.group || groupFromKind(booking.kind || sourceRecordsMode);
  const bookingKind = kindOptionForGroup(bookingGroup);
  ensureKindOption(bookingKind);
  bookingForm.elements.kind.value = bookingKind;
  bookingUnitId = hintedUnit?.id || bookingUnitId;
  renderUnitSelect(bookingUnitId);
  if (hintedUnit) {
    syncKindFromSelectedUnit();
  }
  bookingForm.elements.guest.value = booking.guest || "";
  bookingForm.elements.phone.value = booking.phone || "";
  bookingForm.elements.adults.value = Math.max(0, Number(booking.adults || 0));
  bookingForm.elements.children.value = Math.max(0, Number(booking.children || 0));
  bookingForm.elements.car.value = booking.car || "";
  updatePartyTotal();
  bookingForm.elements.arrival.value = booking.start;
  bookingForm.elements.departure.value = booking.end;
  syncNightsFromDates();
  syncBookingCalendarMonthToArrival();
  bookingForm.elements.paymentMethod.value = "";
  bookingForm.elements.note.value = booking.note || "";
  syncBookingPaymentFields();
  lockImportedPricing();
  bookingFacilityDraft = normalizeStayFacilities(booking.facilities, { start: booking.start, end: booking.end });
  setBookingBasePrice(booking.basePrice ?? booking.price);
  setMoneyField("price", booking.price);
  setMoneyField("deposit", 0);
  setMoneyField("balance", booking.price);
  renderBookingFacilities();
  renderBookingRangeCalendar();
  savePricingSnapshot();
  showToast(`Date preluate pentru ${booking.guest}`);
}

async function loadSourceBookings() {
  const mode = sourceRecordsMode;
  loadSourceBookingsButton.disabled = true;
  sourceRecordStatus.textContent = `Se încarcă ultimele 300 rezervări pentru ${mode === "camping" ? "camping" : "camere"}...`;

  try {
    const response = await fetch(`/api/source-bookings?mode=${mode}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Nu am putut citi baza de date");

    sourceBookings = Array.isArray(result.bookings) ? result.bookings : [];
    renderSourceBookings();
    const todayCount = sourceTodayArrivalCount();
    sourceRecordStatus.textContent = sourceBookings.length
      ? `${sourceBookings.length} rezervări încărcate. ${todayCount} rezervări pentru azi, apoi restul după dată.`
      : "Nu am găsit rezervări valide pentru modul curent.";
  } catch (error) {
    sourceBookings = [];
    renderSourceBookings();
    sourceRecordStatus.textContent = error.message || "Nu s-a putut face conexiunea la baza de date.";
  } finally {
    loadSourceBookingsButton.disabled = false;
    refreshIcons();
  }
}

function openEditClient(stayKey) {
  const stay = stays.find((item) => item.key === stayKey);
  if (!stay || stay.guest === "Disponibil") return;

  openBookingModal({
    ...stay,
    unitId: stay.id,
    arrival: stay.start,
    departure: stay.end,
    deposit: stay.deposit ?? Math.max(0, Number(stay.price || 0) - Number(stay.balance || 0))
  });
}

function availablePlaceholderFor(stay) {
  return {
    id: stay.id,
    key: `${stay.id}-available-${Date.now()}`,
    personId: "",
    group: stay.group,
    kind: stay.kind,
    guest: "Disponibil",
    phone: "",
    adults: 0,
    children: 0,
    car: "",
    party: 0,
    status: "available",
    start: null,
    end: null,
    dates: "Liber",
    barItems: [],
    price: 0,
    balance: 0,
    deposit: 0,
    paymentMethod: "",
    note: "Loc disponibil"
  };
}

function deleteClient(stayKey) {
  const stayIndex = stays.findIndex((stay) => stay.key === stayKey);
  if (stayIndex < 0) return false;

  const stay = stays[stayIndex];
  if (stay.guest === "Disponibil") return false;
  const confirmed = window.confirm(`Ștergi clientul ${stay.guest}?`);
  if (!confirmed) return false;

  stays.splice(stayIndex, 1);
  if (!stays.some((item) => item.id === stay.id)) {
    stays.push(availablePlaceholderFor(stay));
  }

  saveStays();

  if (editingStayKey === stayKey) {
    const linkedStays = linkedReservationsForPerson(stay.personId);
    if (linkedStays.length > 0) {
      openEditClient(linkedStays[0].key);
    } else {
      closeBookingModal();
    }
  } else if (!editingStayKey) {
    closeBookingModal();
  }

  renderAll();
  setVisibleMonth(stay.start ? dateFromISO(stay.start) : visibleMonth);
  logActivity({
    eventType: "delete",
    entityType: "client",
    entityKey: stay.key,
    entityLabel: activityStayLabel(stay),
    message: `Clientul ${stay.guest} a fost șters din ${stay.id}, perioada ${stay.dates}.`,
    data: { stay }
  });
  showToast(`Client șters: ${stay.guest}`);
  return true;
}

function timelineDateFromPointer(event, row, options = {}) {
  const shellRect = timelineShell.getBoundingClientRect();
  const rawDayIndex = Math.floor((event.clientX - shellRect.left + timelineShell.scrollLeft - timelineUnitColumnWidth) / timelineDayWidth);
  const dayIndex = options.clamp === false ? rawDayIndex : Math.min(Math.max(rawDayIndex, 0), daysInTimelineWindow() - 1);
  return addDays(timelineWindowStart, dayIndex);
}

function autoScrollTimelineDuringDrag(event) {
  const rect = timelineShell.getBoundingClientRect();
  const edgeSize = 72;
  const step = timelineDayWidth * 2;

  if (event.clientX > rect.right - edgeSize) {
    timelineShell.scrollLeft += step;
    timelineLastScrollLeft = timelineShell.scrollLeft;
    virtualizeTimelineWindow(true);
    return true;
  }

  if (event.clientX < rect.left + edgeSize) {
    timelineShell.scrollLeft -= step;
    timelineLastScrollLeft = timelineShell.scrollLeft;
    virtualizeTimelineWindow(true);
    return true;
  }

  return false;
}

function timelineBarSelectorValue(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function findTimelineBarByStayKey(key) {
  return guestTimeline.querySelector(`[data-stay-key="${timelineBarSelectorValue(key)}"]`);
}

function updateDraggedTimelineBar() {
  if (!dragState?.bar) return;
  const { stay, bar } = dragState;
  const dayCount = daysInTimelineWindow();
  const startColumn = timelineColumn(stay.start, 2);
  const endColumn = stay.end ? timelineEndColumn(stay.end, dayCount + 2) : dayCount + 2;
  const start = stayStartDate(stay);
  const end = stayEndDate(stay);
  const duration = start && end ? daysBetween(start, end) : 0;

  bar.style.gridColumn = `${startColumn} / ${endColumn}`;
  bar.dataset.guest = stay.guest || "";
  bar.classList.toggle("is-compact", duration <= 1);
  bar.classList.toggle("is-tight", duration > 1 && duration <= 2);
  bar.classList.toggle("is-paid", isStayFullyPaid(dragState.stay));
  bar.classList.toggle("is-unpaid", !isStayFullyPaid(dragState.stay));

  const guestLabel = bar.querySelector(".timeline-bar-content strong");
  const dateLabel = bar.querySelector(".timeline-bar-content div span");
  const partyLabel = bar.querySelector(".timeline-bar-content > span");
  if (guestLabel) guestLabel.textContent = stay.guest || "";
  if (dateLabel) dateLabel.textContent = stay.dates || "";
  if (partyLabel) partyLabel.textContent = `${stay.party || 0} pers.`;
}

function updateVisibleMonthFromScroll() {
  if (suppressTimelineScrollMonthUpdate || performance.now() < timelineMonthNavigationLockedUntil) return;
  const visibleDayIndex = Math.max(0, Math.round(timelineShell.scrollLeft / timelineDayWidth));
  const month = monthStart(addDays(timelineWindowStart, visibleDayIndex));
  if (month.getTime() === visibleMonth.getTime()) return;
  visibleMonth = month;
  updateTimelineMonthLabel();
  renderMetrics();
  refreshIcons(metricGrid);
  if (activePage === "clients") {
    renderReservations();
    refreshIcons(reservationCards);
  }
}

function virtualizeTimelineWindow(force = false) {
  const maxScroll = timelineShell.scrollWidth - timelineShell.clientWidth;
  const edgeDistance = timelineDayWidth * 21;
  const now = performance.now();
  if (!force && now - timelineLastVirtualShiftAt < 300) {
    return false;
  }

  if (timelineShell.scrollLeft > maxScroll - edgeDistance) {
    timelineLastVirtualShiftAt = now;
    shiftTimelineWindow(timelineVirtualShiftMonths);
    return true;
  }

  if (timelineShell.scrollLeft < edgeDistance) {
    timelineLastVirtualShiftAt = now;
    shiftTimelineWindow(-timelineVirtualShiftMonths);
    return true;
  }

  return false;
}

function shiftTimelineWindow(monthDelta) {
  const oldStart = timelineWindowStart;
  const oldScrollLeft = timelineShell.scrollLeft;
  timelineWindowStart = addMonths(timelineWindowStart, monthDelta);
  const shiftedDays = daysBetween(oldStart, timelineWindowStart);
  const scrollAdjustment = shiftedDays * timelineDayWidth;
  renderGuestTimeline();
  timelineShell.scrollLeft = oldScrollLeft - scrollAdjustment;
  timelineLastScrollLeft = timelineShell.scrollLeft;
  renderVisibleTimelineRows(true);
  if (dragState) {
    dragState.scrollLeft -= scrollAdjustment;
    dragState.bar = findTimelineBarByStayKey(dragState.stay.key);
    dragState.row = dragState.bar?.closest(".timeline-row") || dragState.row;
    dragState.bar?.classList.add("is-dragging");
    dragState.row?.classList.add("is-drop-target");
    updateDraggedTimelineBar();
  }
}

function handleTimelineScroll() {
  const currentScrollLeft = timelineShell.scrollLeft;
  const horizontalChanged = Math.abs(currentScrollLeft - timelineLastScrollLeft) >= 1;
  timelineLastScrollLeft = currentScrollLeft;
  if (suppressTimelineScrollMonthUpdate || performance.now() < timelineMonthNavigationLockedUntil) {
    queueVisibleTimelineRowsRender();
    return;
  }
  const shifted = horizontalChanged ? virtualizeTimelineWindow() : false;
  if (horizontalChanged || shifted) updateVisibleMonthFromScroll();
  queueVisibleTimelineRowsRender();
}

function normalizedWheelDelta(event) {
  const factor = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? timelineShell.clientWidth : 1;
  return {
    x: event.deltaX * factor,
    y: event.deltaY * factor
  };
}

function handleTimelineWheel(event) {
  if (dragState) return;
  timelineMonthNavigationLockedUntil = 0;
  suppressTimelineScrollMonthUpdate = false;

  const delta = normalizedWheelDelta(event);
  const horizontalDelta = event.shiftKey ? delta.y : delta.x;
  const isHorizontalScroll = event.shiftKey || Math.abs(horizontalDelta) > Math.abs(delta.y);

  if (!isHorizontalScroll || horizontalDelta === 0) return;

  event.preventDefault();
  const maxDelta = timelineDayWidth * timelineWheelMaxDays;
  const cappedDelta = Math.min(Math.max(horizontalDelta, -maxDelta), maxDelta);
  timelineShell.scrollLeft += cappedDelta;
  timelineLastScrollLeft = timelineShell.scrollLeft;
  const shifted = virtualizeTimelineWindow();
  updateVisibleMonthFromScroll();
  if (!shifted) queueVisibleTimelineRowsRender();
}

function beginTimelineDrag(event) {
  closeTimelineContextMenu();
  if (event.button !== 0) return;
  const bar = event.target.closest(".timeline-bar");
  if (!bar || bar.classList.contains("is-open")) return;

  const row = bar.closest(".timeline-row");
  const stay = stays.find((item) => item.key === bar.dataset.stayKey);
  if (!row || !stay || !stay.start) return;

  event.preventDefault();
  try {
    bar.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic events and older browsers may not allow capture; document listeners still handle the drag.
  }
  bar.classList.add("is-dragging");
  row.classList.add("is-drop-target");
  const handleMode = event.target.closest("[data-drag-mode]")?.dataset.dragMode;
  const barRect = bar.getBoundingClientRect();
  const edgeSize = 18;
  let mode = handleMode || "move";
  if (!handleMode && event.clientX - barRect.left <= edgeSize) {
    mode = "resize-start";
  } else if (!handleMode && barRect.right - event.clientX <= edgeSize) {
    mode = "resize-end";
  }
  const pointerDate = timelineDateFromPointer(event, row);
  const start = dateFromISO(stay.start);
  const end = dateFromISO(stay.end);
  dragState = {
    pointerId: event.pointerId,
    bar,
    row,
    stay,
    mode,
    originalStart: start,
    originalEnd: end,
    originalPrice: Number(stay.price || 0),
    originalDeposit: Number(stay.deposit || 0),
    originalBalance: Number(stay.balance || 0),
    originalPaidAmount: Math.max(0, Number(stay.price || 0) - Number(stay.balance || 0)),
    pointerDate,
    pointerClientX: event.clientX,
    scrollLeft: timelineShell.scrollLeft,
    dayWidth: timelineDayWidth,
    duration: Math.max(1, daysBetween(start, end)),
    lastStart: stay.start,
    lastEnd: stay.end,
    changed: false
  };
}

function updateTimelineDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;

  autoScrollTimelineDuringDrag(event);
  const scrollDelta = timelineShell.scrollLeft - dragState.scrollLeft;
  const pointerDelta = Math.round((event.clientX - dragState.pointerClientX + scrollDelta) / dragState.dayWidth);
  let start = new Date(dragState.originalStart);
  let end = new Date(dragState.originalEnd);

  if (dragState.mode === "resize-start") {
    start = addDays(dragState.originalStart, pointerDelta);
    if (start >= end) start = addDays(end, -1);
  } else if (dragState.mode === "resize-end") {
    end = addDays(dragState.originalEnd, pointerDelta);
    if (end <= start) end = addDays(start, 1);
  } else {
    start = addDays(dragState.originalStart, pointerDelta);
    end = addDays(dragState.originalEnd, pointerDelta);
  }

  const nextStart = toISODate(start);
  const nextEnd = toISODate(end);
  if (nextStart === dragState.lastStart && nextEnd === dragState.lastEnd) return;

  dragState.stay.start = nextStart;
  dragState.stay.end = nextEnd;
  dragState.stay.dates = formatStayDates(dragState.stay.start, dragState.stay.end);
  syncStayDateCache(dragState.stay);
  if (!recalculateStayPricingFromUnit(dragState.stay, { paidAmount: dragState.originalPaidAmount })) {
    restoreTimelineDragPrice();
  }
  dragState.lastStart = nextStart;
  dragState.lastEnd = nextEnd;
  dragState.changed = true;
  updateDraggedTimelineBar();
  dragState.bar?.classList.add("is-dragging");
  dragState.row?.classList.add("is-drop-target");
}

function finishTimelineDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState.bar?.classList.remove("is-dragging");
  dragState.row?.classList.remove("is-drop-target");
  if (dragState.changed) {
    const priceRecalculated = recalculateStayPricingFromUnit(dragState.stay, { paidAmount: dragState.originalPaidAmount });
    if (!priceRecalculated) {
      restoreTimelineDragPrice();
    }
    saveStays();
    updateVisibleMonthFromScroll();
    renderMetrics();
    renderGuestTimeline({ preserveScroll: true });
    if (activePage === "clients") {
      renderReservations();
      refreshIcons(reservationCards);
    }
    logActivity({
      eventType: "update",
      entityType: "client",
      entityKey: dragState.stay.key,
      entityLabel: activityStayLabel(dragState.stay),
      message: `Rezervarea ${dragState.stay.guest} a fost mutată/redimensionată din calendar: ${formatStayDates(toISODate(dragState.originalStart), toISODate(dragState.originalEnd))} -> ${dragState.stay.dates}.`,
      data: {
        previousStart: toISODate(dragState.originalStart),
        previousEnd: toISODate(dragState.originalEnd),
        newStart: dragState.stay.start,
        newEnd: dragState.stay.end,
        previousPrice: dragState.originalPrice,
        newPrice: Number(dragState.stay.price || 0),
        previousBalance: dragState.originalBalance,
        newBalance: Number(dragState.stay.balance || 0)
      }
    });
    showToast(
      priceRecalculated
        ? `Rezervare actualizata: ${dragState.stay.id}, ${dragState.stay.dates}`
        : "Tarif calendar 0 sau lipsa; totalul vechi a fost pastrat."
    );
  }
  dragState = null;
}

function openBookingFromTimeline(event) {
  const clickedBar = event.target.closest(".timeline-bar");
  if (clickedBar && !clickedBar.classList.contains("is-open")) {
    openEditClient(clickedBar.dataset.stayKey);
    return;
  }

  const row =
    event.target.closest(".timeline-row") ||
    [...guestTimeline.querySelectorAll(".timeline-row")].find((timelineRow) => {
      const rect = timelineRow.getBoundingClientRect();
      return event.clientY >= rect.top && event.clientY <= rect.bottom && event.clientX >= rect.left && event.clientX <= rect.right;
    });
  if (!row) return;

  const arrival = timelineDateFromPointer(event, row);
  openBookingModal({
    unitId: row.dataset.unitId,
    kind: row.dataset.kind,
    arrival: toISODate(arrival),
    departure: toISODate(addDays(arrival, 1))
  });
}

function setActivePage(page) {
  if (!page) return;
  const previousPage = activePage;
  activePage = page;
  if (page === "clients" && dirtyPages.has("clients")) {
    reservationPage = 1;
  }
  if (page !== "clients") disconnectReservationAutoLoad();
  jumpToFormButton.hidden = !["calendar", "clients"].includes(page);
  openUnitModalButton.hidden = page !== "settings";
  pageSections.forEach((section) => {
    const isActive = section.dataset.pageSection === page;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.page === page);
    item.setAttribute("aria-current", item.dataset.page === page ? "page" : "false");
  });
  if (previousPage === page) return;
  if (pageSwitchRenderFrame) cancelAnimationFrame(pageSwitchRenderFrame);
  pageSwitchRenderFrame = requestAnimationFrame(() => {
    pageSwitchRenderFrame = null;
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

window.setActivePage = setActivePage;

modeSwitch.addEventListener("change", () => {
  setMode(modeSwitch.checked ? "camping" : "room");
});

function setVisibleMonth(month) {
  const targetMonth = monthStart(month);
  const targetMonthTime = targetMonth.getTime();
  visibleMonth = targetMonth;
  markPagesDirty("calendar", "clients", "statistics");
  ensureTimelineWindowContains(targetMonth);
  reservationPage = 1;
  if (timelineProgrammaticScrollFrame) {
    cancelAnimationFrame(timelineProgrammaticScrollFrame);
  }
  suppressTimelineScrollMonthUpdate = true;
  timelineMonthNavigationLockedUntil = performance.now() + 900;
  if (activePage === "calendar") {
    timelineShell.scrollLeft = scrollLeftForDate(targetMonth);
    timelineLastScrollLeft = timelineShell.scrollLeft;
  }
  updateTimelineMonthLabel();
  renderMetrics();
  if (activePage === "calendar") {
    renderGuestTimeline({ preserveScroll: true });
    dirtyPages.delete("calendar");
  }
  if (activePage === "clients") {
    renderReservations();
    refreshIcons(reservationCards);
    dirtyPages.delete("clients");
  }
  refreshIcons();
  queueFileSave();
  timelineProgrammaticScrollFrame = requestAnimationFrame(() => {
    timelineProgrammaticScrollFrame = null;
    timelineShell.scrollLeft = scrollLeftForDate(targetMonth);
    timelineLastScrollLeft = timelineShell.scrollLeft;
    renderVisibleTimelineRows(true);
    requestAnimationFrame(() => {
      if (visibleMonth.getTime() === targetMonthTime) {
        suppressTimelineScrollMonthUpdate = false;
        visibleMonth = targetMonth;
        updateTimelineMonthLabel();
      }
    });
  });
}

function moveVisibleMonth(monthDelta) {
  const baseMonth = monthStart(visibleMonth);
  const targetMonth = addMonths(baseMonth, monthDelta);
  setVisibleMonth(targetMonth);
}

function jumpToCurrentMonth() {
  setVisibleMonth(today);
}

function timelineMonthNavigationPointerDown(event) {
  const button = event.target.closest("#prevMonth, #nextMonth, #currentMonth");
  if (!button) return;
  const direction = button.id === "prevMonth" ? -1 : button.id === "nextMonth" ? 1 : 0;
  button.dataset.pendingMonth = toISODate(direction === 0 ? monthStart(today) : addMonths(monthStart(visibleMonth), direction));
}

function timelineMonthNavigationClick(event) {
  const button = event.target.closest("#prevMonth, #nextMonth, #currentMonth");
  if (!button) return;
  const pendingMonth = button.dataset.pendingMonth;
  delete button.dataset.pendingMonth;
  if (pendingMonth) {
    setVisibleMonth(dateFromISO(pendingMonth));
    return;
  }
  if (button.id === "prevMonth") {
    moveVisibleMonth(-1);
  } else if (button.id === "nextMonth") {
    moveVisibleMonth(1);
  } else {
    jumpToCurrentMonth();
  }
}

[prevMonthButton, nextMonthButton, currentMonthButton].forEach((button) => {
  button.addEventListener("pointerdown", timelineMonthNavigationPointerDown);
  button.addEventListener("click", timelineMonthNavigationClick);
});

checkGoogleReviewsButton.addEventListener("click", checkGoogleReviews);
timelineShell.addEventListener("scroll", handleTimelineScroll, { passive: true });
timelineShell.addEventListener("wheel", handleTimelineWheel, { passive: false });
sidebarToggle.addEventListener("click", toggleSidebar);

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  readReceiptSettings();
  saveStaysToFiles({ showMessage: true });
  logActivity({
    eventType: "settings",
    entityType: "settings",
    entityKey: "receipt",
    entityLabel: "Setări bonuri",
    message: "Setările pentru bonuri au fost salvate.",
    data: { receiptConfig }
  });
  showToast("Setările pentru bonuri au fost salvate");
});

pickReceiptDirectoryButton.addEventListener("click", async () => {
  try {
    pickReceiptDirectoryButton.disabled = true;
    const response = await fetch("/api/pick-receipt-directory", { method: "POST" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "Nu am putut alege directorul");
    if (result.path) {
      receiptDirectoryInput.value = result.path;
      readReceiptSettings();
      await saveStaysToFiles();
      showToast("Directorul pentru bonuri a fost salvat");
    }
  } catch (error) {
    showToast(error.message || "Nu am putut alege directorul");
  } finally {
    pickReceiptDirectoryButton.disabled = false;
  }
});

document.querySelector(".nav-list").addEventListener("click", (event) => {
  const button = event.target.closest(".nav-item");
  if (!button) return;
  event.preventDefault();
  if (button.hasAttribute("data-open-booking")) {
    openBookingModal();
    return;
  }
  setActivePage(button.dataset.page);
});

searchInput.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  reservationPage = 1;
  markPagesDirty("calendar", "clients", "stationing", "bar", "statistics");
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderAll();
  }, 150);
});

closeBooking.addEventListener("click", closeBookingModal);
closeReceiptModalButton.addEventListener("click", closeReceiptModal);
openUnitModalButton.addEventListener("click", openUnitModal);
settingsAddUnitButton.addEventListener("click", () => openUnitModal());
settingsCloneUnitButton.addEventListener("click", () => openCloneUnitModal());
settingsNewFacilityButton.addEventListener("click", resetFacilityForm);
cancelFacilityEditButton.addEventListener("click", resetFacilityForm);
closeUnitModalButton.addEventListener("click", closeUnitModal);
closeCloneUnitModalButton.addEventListener("click", closeCloneUnitModal);
openStationingModalButton.addEventListener("click", () => openStationingModal());
closeStationingModalButton.addEventListener("click", closeStationingModal);
openBarArticleModalButton.addEventListener("click", () => openBarArticleModal());
closeBarArticleModalButton.addEventListener("click", closeBarArticleModal);
barAttachReservationButton?.addEventListener("click", openBarAttachModal);
closeBarAttachModalButton?.addEventListener("click", closeBarAttachModal);
closeBarPaymentModalButton.addEventListener("click", () => closeBarPaymentModal());
openSagaExportModalButton.addEventListener("click", openSagaExportModal);
closeSagaExportModalButton.addEventListener("click", closeSagaExportModal);
addLinkedReservationButton?.addEventListener("click", openLinkedReservationDraft);
linkedReservationsTrack?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-linked-reservation]");
  if (!button) return;
  const stayKey = button.dataset.linkedReservation;

  /* Summary tab → open payment modal with total balance */
  if (stayKey === "summary") {
    if (!editingStayKey) {
      showToast("Salvează rezervarea nouă înainte de plata totală.");
      return;
    }
    if (bookingPersonId) {
      openLinkedReceiptModal(bookingPersonId);
    }
    return;
  }

  if (stayKey === "new-draft") {
    if (editingStayKey) openLinkedReservationDraft();
    return;
  }
  if (stayKey && stayKey !== editingStayKey) {
    openEditClient(stayKey);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTimelineContextMenu();
  }
  if (event.key === "Escape" && receiptModal.classList.contains("is-open")) {
    closeReceiptModal();
    return;
  }
  if (event.key === "Escape" && unitModal.classList.contains("is-open")) {
    closeUnitModal();
    return;
  }
  if (event.key === "Escape" && cloneUnitModal.classList.contains("is-open")) {
    closeCloneUnitModal();
    return;
  }
  if (event.key === "Escape" && stationingModal.classList.contains("is-open")) {
    closeStationingModal();
    return;
  }
  if (event.key === "Escape" && barPaymentModal.classList.contains("is-open")) {
    closeBarPaymentModal();
    return;
  }
  if (event.key === "Escape" && barAttachModal?.classList.contains("is-open")) {
    closeBarAttachModal();
    return;
  }
  if (event.key === "Escape" && barArticleModal.classList.contains("is-open")) {
    closeBarArticleModal();
    return;
  }
  if (event.key === "Escape" && sagaExportModal.classList.contains("is-open")) {
    closeSagaExportModal();
    return;
  }
  if (event.key === "Escape" && bookingModal.classList.contains("is-open")) {
    closeBookingModal();
  }
});

document.addEventListener("click", (event) => {
  if (!timelineContextMenu.hidden && !event.target.closest("#timelineContextMenu")) {
    closeTimelineContextMenu();
  }
});

window.addEventListener("beforeunload", saveStays);
window.addEventListener("focus", refreshTodayIfNeeded);
window.addEventListener("resize", () => {
  window.clearTimeout(updateTimelineDayWidth.resizeTimer);
  updateTimelineDayWidth.resizeTimer = window.setTimeout(() => setVisibleMonth(visibleMonth), 120);
});
window.setInterval(refreshTodayIfNeeded, 60000);

bookingForm.elements.kind.addEventListener("change", () => {
  renderUnitSelect();
  syncKindFromSelectedUnit();
  syncBookingPaymentFields();
  recalculateBookingPrice({ unlockImported: true });
  sourceBookings = [];
  syncSourceModeFromKind();
  renderSourceBookings();
  loadSourceBookings();
});
bookingForm.elements.unitId.addEventListener("change", () => {
  syncKindFromSelectedUnit();
  recalculateBookingPrice({ unlockImported: true });
});
const syncDepartureAndPricing = () => {
  syncDepartureFromNights();
  syncBookingCalendarMonthToArrival();
  recalculateBookingPriceAfterUserChange();
};

const syncNightsAndPricing = () => {
  syncNightsFromDates();
  syncBookingCalendarMonthToArrival();
  recalculateBookingPriceAfterUserChange();
};

bookingForm.elements.arrival.addEventListener("change", syncDepartureAndPricing);
bookingForm.elements.nights.addEventListener("input", syncDepartureAndPricing);
bookingForm.elements.nights.addEventListener("change", syncDepartureAndPricing);
bookingForm.elements.departure.addEventListener("change", syncNightsAndPricing);
bookingForm.elements.price.addEventListener("input", syncBasePriceFromTotalInput);
bookingForm.elements.adults.addEventListener("input", recalculateBookingPriceAfterUserChange);
bookingForm.elements.adults.addEventListener("change", recalculateBookingPriceAfterUserChange);
bookingForm.elements.children.addEventListener("input", recalculateBookingPriceAfterUserChange);
bookingForm.elements.children.addEventListener("change", recalculateBookingPriceAfterUserChange);
bookingFacilities?.addEventListener("change", (event) => {
  const daysInput = event.target.closest("[data-facility-days-key]");
  if (daysInput) {
    setBookingFacilityDays(daysInput.dataset.facilityDaysKey, daysInput.value);
    return;
  }
  const checkbox = event.target.closest("[data-facility-key]");
  if (!checkbox) return;
  setBookingFacilityEnabled(checkbox.dataset.facilityKey, checkbox.checked);
});
loadSourceBookingsButton.addEventListener("click", loadSourceBookings);
sourceModeSwitch.addEventListener("change", () => {
  setSourceRecordsMode(sourceModeSwitch.checked ? "camping" : "room");
  sourceBookings = [];
  renderSourceBookings();
  loadSourceBookings();
});
sourceRecordRows.addEventListener("click", (event) => {
  const row = event.target.closest("[data-source-index]");
  if (!row) return;
  sourceRecordRows.querySelectorAll("tr").forEach((item) => item.classList.toggle("is-selected", item === row));
  applySourceBooking(sourceBookings[Number(row.dataset.sourceIndex)]);
});

guestTimeline.addEventListener("pointerdown", beginTimelineDrag);
guestTimeline.addEventListener("dblclick", openBookingFromTimeline);
guestTimeline.addEventListener("contextmenu", openTimelineContextMenu);
document.addEventListener("pointermove", updateTimelineDrag);
document.addEventListener("pointerup", finishTimelineDrag);
document.addEventListener("pointercancel", finishTimelineDrag);

jumpToFormButton.addEventListener("click", () => {
  openBookingModal();
});

reservationCards.addEventListener("click", (event) => {
  const barItemButton = event.target.closest("[data-client-bar-item]");
  if (barItemButton) {
    event.stopPropagation();
    changeReservationBarItem(
      barItemButton.dataset.clientBarStay,
      barItemButton.dataset.clientBarItem,
      Number(barItemButton.dataset.delta || 0),
      { remove: barItemButton.dataset.remove === "true" }
    );
    return;
  }

  const deleteButton = event.target.closest("[data-delete-client]");
  if (deleteButton) {
    deleteClient(deleteButton.dataset.deleteClient);
    return;
  }

  const receiptButton = event.target.closest("[data-receipt-client]");
  if (receiptButton) {
    openReceiptModal(receiptButton.dataset.receiptClient);
    return;
  }

  const editButton = event.target.closest("[data-edit-client]");
  if (!editButton) return;
  openEditClient(editButton.dataset.editClient);
});

stationingCards.addEventListener("click", (event) => {
  const emptyButton = event.target.closest("[data-open-stationing-empty]");
  if (emptyButton) {
    openStationingModal();
    return;
  }

  const deleteButton = event.target.closest("[data-delete-stationing]");
  if (deleteButton) {
    deleteStationing(deleteButton.dataset.deleteStationing);
    return;
  }

  const receiptButton = event.target.closest("[data-receipt-stationing]");
  if (receiptButton) {
    openStationingReceiptModal(receiptButton.dataset.receiptStationing);
    return;
  }

  const editButton = event.target.closest("[data-edit-stationing]");
  if (editButton) {
    openStationingModal(editButton.dataset.editStationing);
  }
});

barArticleGrid.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-bar-article]");
  if (editButton) {
    event.stopPropagation();
    openBarArticleModal(editButton.dataset.editBarArticle);
    return;
  }

  const card = event.target.closest("[data-bar-article]");
  if (!card) return;
  addBarArticleToCheckout(card.dataset.barArticle);
});

barArticleGrid.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest("[data-bar-article]");
  if (!card || event.target.closest("button")) return;
  event.preventDefault();
  addBarArticleToCheckout(card.dataset.barArticle);
});

barCheckoutList.addEventListener("click", (event) => {
  const quantityButton = event.target.closest("[data-bar-quantity]");
  if (!quantityButton) return;
  changeBarCartQuantity(quantityButton.dataset.barQuantity, Number(quantityButton.dataset.delta || 0));
});

clearBarCheckoutButton.addEventListener("click", () => {
  if (!barCart.length) return;
  barCart = [];
  renderBarPage();
  refreshIcons();
});

barCheckoutPayButton.addEventListener("click", openBarPaymentModal);

barAttachSearch?.addEventListener("input", renderBarAttachChoices);

barReservationChoices?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-attach-bar-reservation]");
  if (!button) return;
  attachBarCartToReservation(button.dataset.attachBarReservation);
});

barArticleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveBarArticleFromForm();
});

deleteBarArticleButton.addEventListener("click", deleteBarArticle);

barPaymentForm.addEventListener("click", (event) => {
  const methodButton = event.target.closest("[data-bar-payment-method]");
  if (!methodButton) return;
  generateBarReceipt(methodButton.dataset.barPaymentMethod);
});

sagaExportForm.elements.allSales.addEventListener("change", syncSagaExportDateFields);
sagaExportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  exportSagaBarSales();
});

deleteBookingButton.addEventListener("click", () => {
  if (editingStayKey) {
    deleteClient(editingStayKey);
  }
});

receiptFromBookingButton.addEventListener("click", () => {
  if (editingStayKey) {
    openReceiptModal(editingStayKey);
  }
});

bookingBarItems?.addEventListener("click", (event) => {
  const barItemButton = event.target.closest("[data-client-bar-item]");
  if (!barItemButton) return;
  changeReservationBarItem(
    barItemButton.dataset.clientBarStay,
    barItemButton.dataset.clientBarItem,
    Number(barItemButton.dataset.delta || 0),
    { remove: barItemButton.dataset.remove === "true" }
  );
});

["startDate", "prepaidNights", "nightlyPrice", "paidAmount"].forEach((name) => {
  stationingForm.elements[name].addEventListener("input", syncStationingTotals);
  stationingForm.elements[name].addEventListener("change", syncStationingTotals);
});

stationingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(stationingForm);
  const owner = String(data.get("owner") || "").trim();
  const caravan = String(data.get("caravan") || "").trim();
  if (!owner || !caravan) {
    showToast("Proprietarul și rulota sunt obligatorii");
    return;
  }

  const wasEditing = Boolean(editingStationingKey);
  const key = editingStationingKey || `stationing-${Date.now()}`;
  saveStationingRecord({
    key,
    owner,
    phone: String(data.get("phone") || "").trim(),
    caravan,
    startDate: String(data.get("startDate") || toISODate(today)),
    prepaidNights: Number(data.get("prepaidNights") || 1),
    nightlyPrice: Number(data.get("nightlyPrice") || 0),
    totalPrice: Number(data.get("totalPrice") || 0),
    paidAmount: Number(data.get("paidAmount") || 0),
    balance: Number(data.get("balance") || 0),
    note: String(data.get("note") || "").trim()
  });

  closeStationingModal();
  showToast(wasEditing ? `Staționare actualizată: ${owner}` : `Staționare adăugată: ${owner}`);
});

deleteStationingButton.addEventListener("click", () => {
  if (editingStationingKey) {
    deleteStationing(editingStationingKey);
  }
});

receiptFromStationingButton.addEventListener("click", () => {
  if (editingStationingKey) {
    openStationingReceiptModal(editingStationingKey);
  }
});

receiptForm.addEventListener("click", (event) => {
  const methodButton = event.target.closest("[data-receipt-method]");
  if (!methodButton || !receiptStayKey) return;
  generateReceipt(receiptStayKey, methodButton.dataset.receiptMethod);
});

unitPricingPrevButton.addEventListener("click", () => {
  unitPricingMonth = addMonths(unitPricingMonth, -1);
  renderUnitPricingCalendar();
});

unitPricingNextButton.addEventListener("click", () => {
  unitPricingMonth = addMonths(unitPricingMonth, 1);
  renderUnitPricingCalendar();
});

applyUnitDayPriceButton.addEventListener("click", applyUnitSelectedDayPrice);
clearUnitDayPriceButton.addEventListener("click", clearUnitSelectedDayPrice);

unitPricingCalendar.addEventListener("pointerdown", (event) => {
  const dayButton = event.target.closest("[data-unit-price-date]");
  if (!dayButton || event.button !== 0) return;
  event.preventDefault();
  const clickedDate = dayButton.dataset.unitPriceDate;
  unitPricingDrag = { start: clickedDate, last: clickedDate, moved: false };
});

unitPricingCalendar.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-unit-price-date]");
  if (!dayButton) return;
  if (suppressUnitCalendarClick) {
    suppressUnitCalendarClick = false;
    return;
  }
  selectUnitPricingDate(dayButton.dataset.unitPriceDate);
});

bookingCalendarPrevButton.addEventListener("click", () => {
  bookingCalendarMonth = addMonths(bookingCalendarMonth, -1);
  renderBookingRangeCalendar();
});

bookingCalendarNextButton.addEventListener("click", () => {
  bookingCalendarMonth = addMonths(bookingCalendarMonth, 1);
  renderBookingRangeCalendar();
});

bookingRangeCalendar.addEventListener("pointerdown", (event) => {
  const dayButton = event.target.closest("[data-booking-range-date]");
  if (!dayButton || event.button !== 0) return;
  event.preventDefault();
  const clickedDate = dayButton.dataset.bookingRangeDate;
  bookingCalendarDrag = { start: clickedDate, last: clickedDate, moved: false };
});

bookingRangeCalendar.addEventListener("click", (event) => {
  const dayButton = event.target.closest("[data-booking-range-date]");
  if (!dayButton) return;
  if (suppressBookingCalendarClick) {
    suppressBookingCalendarClick = false;
    return;
  }
  selectBookingRangeDate(dayButton.dataset.bookingRangeDate);
});

document.addEventListener("pointermove", (event) => {
  if (unitPricingDrag) {
    if (event.buttons !== 1) {
      finishUnitPricingDrag();
    } else {
      const dateText = calendarDateFromPointer(event, "[data-unit-price-date]", "unitPriceDate");
      if (dateText && dateText !== unitPricingDrag.last) {
        unitPricingDrag.last = dateText;
        unitPricingDrag.moved = unitPricingDrag.moved || dateText !== unitPricingDrag.start;
        unitPricingAnchorDate = null;
        setUnitPricingSelection(unitPricingDrag.start, dateText);
      }
    }
  }

  if (bookingCalendarDrag) {
    if (event.buttons !== 1) {
      finishBookingCalendarDrag();
    } else {
      const dateText = calendarDateFromPointer(event, "[data-booking-range-date]", "bookingRangeDate");
      if (dateText && dateText !== bookingCalendarDrag.last) {
        bookingCalendarDrag.last = dateText;
        bookingCalendarDrag.moved = bookingCalendarDrag.moved || dateText !== bookingCalendarDrag.start;
        bookingRangeAnchorDate = null;
        setBookingRangeFromCalendar(bookingCalendarDrag.start, dateText);
      }
    }
  }
});

document.addEventListener("pointerup", finishCalendarDrags, true);
document.addEventListener("pointercancel", finishCalendarDrags, true);
window.addEventListener("mouseup", finishCalendarDrags, true);
window.addEventListener("blur", finishCalendarDrags);

unitForm.elements.pricingMode.addEventListener("change", renderUnitPricingCalendar);
unitForm.elements.kind.addEventListener("input", renderUnitPricingCalendar);
unitForm.elements.group.addEventListener("change", renderUnitPricingCalendar);

unitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(unitForm);
  const id = editingUnitId || String(data.get("id") || "").trim();
  if (!id) {
    showToast("Numele unității este obligatoriu");
    return;
  }

  const saved = saveUnit({
    id,
    kind: String(data.get("kind") || "").trim(),
    group: data.get("group"),
    pricingMode: data.get("pricingMode"),
    adultPrice: firstUnitCalendarPrice(unitPricingDraft),
    childPrice: firstUnitCalendarPrice(unitPricingDraft) / 2,
    dailyPrices: unitPricingDraft
  });

  if (saved) {
    const wasEditing = Boolean(editingUnitId);
    closeUnitModal();
    showToast(wasEditing ? `Unitate actualizată: ${id}` : `Unitate adăugată: ${id}`);
  }
});

cloneUnitSourceSelect.addEventListener("change", syncCloneUnitPreview);

cloneUnitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(cloneUnitForm);
  const sourceUnitId = String(data.get("sourceUnitId") || "");
  const newUnitId = String(data.get("newUnitId") || "").trim();
  if (cloneUnit(sourceUnitId, newUnitId)) {
    closeCloneUnitModal();
    showToast(`Unitate clonată: ${newUnitId}`);
  }
});

unitList.addEventListener("click", (event) => {
  const cloneButton = event.target.closest("[data-clone-unit]");
  if (cloneButton) {
    openCloneUnitModal(cloneButton.dataset.cloneUnit);
    return;
  }

  const editButton = event.target.closest("[data-edit-unit]");
  if (editButton) {
    openUnitModal(editButton.dataset.editUnit);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-unit]");
  if (deleteButton) {
    deleteUnit(deleteButton.dataset.deleteUnit);
  }
});

facilityCatalogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveFacilityFromForm();
});

facilityList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-facility]");
  if (editButton) {
    editFacility(editButton.dataset.editFacility);
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-facility]");
  if (!toggleButton) return;
  setFacilityActive(toggleButton.dataset.toggleFacility, toggleButton.dataset.active === "true");
});

timelineContextMenu.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-context-action]");
  if (!actionButton || !contextStayKey) return;

  const stayKey = contextStayKey;
  closeTimelineContextMenu();
  if (actionButton.dataset.contextAction === "edit") {
    openEditClient(stayKey);
    return;
  }
  if (actionButton.dataset.contextAction === "delete") {
    deleteClient(stayKey);
  }
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(bookingForm);
  const selectedUnit = unitById(String(data.get("unitId") || ""));
  const kind = selectedUnit?.kind || data.get("kind");
  const group = selectedUnit?.group || groupFromKind(kind);
  const arrival = dateFromISO(data.get("arrival"));
  const departure = dateFromISO(data.get("departure"));
  const existingIndex = editingStayKey ? stays.findIndex((stay) => stay.key === editingStayKey) : -1;
  const existingStay = existingIndex >= 0 ? stays[existingIndex] : null;
  const previousStay = existingStay ? { ...existingStay } : null;
  const id = selectedUnit?.id || existingStay?.id || bookingUnitId || nextReservationId(kind);
  if (departure <= arrival) {
    showToast("Data finală trebuie să fie după data de început");
    return;
  }
  const price = Math.max(0, Number(data.get("price") || 0));
  const basePrice = normalizeMoneyValue(data.get("basePrice") || price);
  const facilities = refreshFacilityNights(bookingFacilityDraft, data.get("arrival"), data.get("departure"));
  const barItems = normalizeStayBarItems(existingStay?.barItems);
  const balance = normalizeMoneyValue(price);
  const deposit = 0;
  const existingPaid = existingStay ? isStayFullyPaid(existingStay) : false;
  const preservedSettledPrice = existingStay ? paymentCoveredPriceForStay(existingStay) : 0;
  const settledPrice = existingPaid ? price : Math.min(price, preservedSettledPrice);
  const paid = existingStay ? isStayFullyPaid({ ...existingStay, price, settledPrice, paid: existingPaid }) : false;
  const adults = Math.max(0, Number(data.get("adults") || 0));
  const children = Math.max(0, Number(data.get("children") || 0));
  const party = Math.max(1, adults + children);
  const dates = formatStayDates(data.get("arrival"), data.get("departure"));
  const personId = existingStay?.personId || bookingPersonId || createPersonId(data.get("guest") || id);
  const paymentMethod = String(data.get("paymentMethod") || existingStay?.paymentMethod || "");

  const nextStay = {
    id,
    key: existingStay?.key || `${id}-${Date.now()}`,
    personId,
    group,
    kind,
    guest: String(data.get("guest") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    adults,
    children,
    car: String(data.get("car") || "").trim(),
    party,
    status: existingStay?.status || "arriving",
    start: data.get("arrival"),
    end: data.get("departure"),
    dates,
    basePrice,
    facilities,
    barItems,
    price,
    balance,
    deposit,
    paid,
    settledPrice,
    actualPaidAmount: existingStay ? actualPaidAmountForStay(existingStay) : 0,
    paymentMethod,
    note: String(data.get("note") || "").trim()
  };

  if (existingIndex >= 0) {
    stays[existingIndex] = nextStay;
    const placeholderIndex = stays.findIndex((stay, index) => index !== existingIndex && stay.id === id && stay.guest === "Disponibil");
    if (placeholderIndex >= 0) {
      stays.splice(placeholderIndex, 1);
    }
  } else {
    const availableIndex = stays.findIndex((stay) => stay.id === id && stay.guest === "Disponibil");
    if (availableIndex >= 0) {
      nextStay.key = stays[availableIndex].key;
      nextStay.status = "arriving";
      stays[availableIndex] = nextStay;
    } else {
      stays.unshift(nextStay);
    }
  }

  saveStays();
  const linkedAfterSave = linkedReservationsForPerson(nextStay.personId);
  const createdForSameClient = !previousStay && linkedAfterSave.length >= 2;
  const changes = previousStay ? stayChangeList(previousStay, nextStay) : [];
  logActivity({
    eventType: previousStay ? "update" : "create",
    entityType: "client",
    entityKey: nextStay.key,
    entityLabel: activityStayLabel(nextStay),
    message: previousStay
      ? `Clientul ${nextStay.guest} a fost actualizat${changes.length ? `: ${changes.join("; ")}` : "."}`
      : createdForSameClient
        ? `Rezervare adăugată pentru același client ${nextStay.guest}, ${nextStay.id}, ${nextStay.dates}, ${formatActivityMoney(nextStay.price)}. Clientul are acum ${linkedAfterSave.length} rezervări.`
        : `Rezervare adăugată pentru ${nextStay.guest}, ${nextStay.id}, ${nextStay.dates}, ${formatActivityMoney(nextStay.price)}.`,
    data: {
      previous: previousStay,
      current: nextStay,
      changes,
      editSession: bookingEditSession,
      personId: nextStay.personId,
      linkedReservationCount: linkedAfterSave.length,
      linkedReservationKeys: linkedAfterSave.map((stay) => stay.key),
      createdForSameClient
    }
  });
  visibleMonth = monthStart(arrival);
  activeMode = group;
  document.body.dataset.mode = group;
  modeSwitch.checked = group === "camping";
  bookingForm.reset();
  bookingForm.elements.adults.value = 2;
  bookingForm.elements.children.value = 0;
  bookingForm.elements.car.value = "";
  bookingForm.elements.party.value = 2;
  bookingForm.elements.arrival.value = toISODate(defaultArrivalDate());
  bookingForm.elements.departure.value = toISODate(addDays(defaultArrivalDate(), 2));
  bookingForm.elements.nights.value = 2;
  bookingForm.elements.basePrice.value = "600.00";
  bookingForm.elements.price.value = "600.00";
  bookingForm.elements.deposit.value = "0.00";
  bookingForm.elements.balance.value = "600.00";
  bookingForm.elements.paymentMethod.value = "";
  bookingForm.elements.note.value = "";
  renderUnitSelect();
  bookingFacilityDraft = [];
  renderBookingFacilities();
  syncBookingCalendarMonthToArrival();
  applySelectedUnitPricing();
  editingStayKey = null;
  bookingUnitId = null;

  if (linkedAfterSave.length >= 2) {
    renderAll();
    setVisibleMonth(arrival);
    openEditClient(nextStay.key);
    showToast(existingStay ? `Client actualizat: ${nextStay.guest}` : `Rezervarea ${id} a fost adăugată`);
  } else {
    closeBookingModal();
    renderAll();
    setVisibleMonth(arrival);
    showToast(existingStay ? `Client actualizat: ${nextStay.guest}` : `Rezervarea ${id} a fost adăugată`);
  }
});


rebuildStaysByUnitIndex();
renderAll();
setActivePage(activePage);
setVisibleMonth(today);
syncLocalActivityLog();
warmHiddenPages();

fetch("/api/version", { cache: "no-store" })
  .then((response) => response.json())
  .then((result) => {
    const label = document.querySelector("#appVersionLabel");
    if (label && result.version) label.textContent = `· v${result.version}`;
  })
  .catch(() => {});
