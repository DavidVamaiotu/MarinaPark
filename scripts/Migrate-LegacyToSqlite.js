const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const rootDir = path.resolve(__dirname, "..");

function parseArguments(argv) {
  const options = {
    database: path.join(rootDir, "marina-park.sqlite2"),
    dbField: path.join(rootDir, "dbField-2.json"),
    stationing: path.join(rootDir, "Stationare.json"),
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (["--database", "--dbfield", "--stationing"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Lipsește valoarea pentru ${argument}.`);
      options[
        argument === "--database"
          ? "database"
          : argument === "--dbfield"
            ? "dbField"
            : "stationing"
      ] = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      console.log(`Utilizare:
  npm run migrate:legacy -- [--dry-run]
    [--database marina-park.sqlite2]
    [--dbfield dbField-2.json]
    [--stationing Stationare.json]

Importă rezervările și staționările fără să modifice barul.`);
      process.exit(0);
    }
    throw new Error(`Argument necunoscut: ${argument}`);
  }

  return options;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Nu pot citi JSON-ul din ${filePath}: ${error.message}`);
  }
}

function sha256File(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function stableHash(value, length = 16) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex")
    .slice(0, length);
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIdentity(value) {
  return normalizeText(value)
    .toLocaleLowerCase("ro-RO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizePhone(value) {
  return String(value ?? "").replace(/[^0-9+]/g, "");
}

function normalizeMoney(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/,(?=\d{1,2}$)/, ".")
    .replace(/[^0-9.-]/g, "");
  const number = Number(normalized || 0);
  return Number.isFinite(number)
    ? Math.max(0, Math.round(number * 100) / 100)
    : 0;
}

function positiveInteger(value, fallback = 0) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function parseLegacyDate(value, fieldName) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) throw new Error(`Dată invalidă în ${fieldName}: ${value}`);
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error(`Dată imposibilă în ${fieldName}: ${value}`);
  }
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  return Math.round(
    (new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000,
  );
}

function formatDateRange(start, end) {
  const format = (value) => {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  };
  return `${format(start)} - ${format(end)}`;
}

function parseAdvance(note) {
  const match = String(note ?? "").match(
    /avans\s*:\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
  );
  return match ? normalizeMoney(match[1]) : 0;
}

function categoryUnit(category, legacy) {
  const normalizedCategory = normalizeIdentity(category);
  const tags = Array.isArray(legacy.clTag)
    ? legacy.clTag.map(normalizeText).filter(Boolean)
    : [];
  if (normalizedCategory === "cort") {
    return { id: "Cort", group: "camping", kind: "Campare cort" };
  }
  if (normalizedCategory === "rulota") {
    return { id: "Rulote", group: "camping", kind: "Campare rulotă" };
  }

  const id =
    tags[0] ||
    `legacy-${normalizedCategory || "camera"}-${String(legacy.GUID).slice(0, 8)}`;
  if (normalizeIdentity(id).startsWith("bungalow")) {
    return { id, group: "room", kind: "Bungalou" };
  }
  if (normalizedCategory === "cvadruple") {
    return { id, group: "room", kind: "Cameră cvadruplă" };
  }
  return { id, group: "room", kind: "Cameră dublă" };
}

function legacyFacilities(value, nights) {
  if (!Array.isArray(value)) return [];
  const facilities = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    for (const [rawKey, rawPrice] of Object.entries(item)) {
      const pricePerNight = normalizeMoney(rawPrice);
      if (!normalizeText(rawKey) || pricePerNight <= 0) continue;
      const isElectricity = normalizeIdentity(rawKey).includes("electricitate");
      facilities.push({
        key: isElectricity
          ? "electricitate"
          : `legacy-${normalizeIdentity(rawKey).replace(/[^a-z0-9]+/g, "-")}`,
        name: isElectricity ? "Electricitate" : normalizeText(rawKey),
        pricePerNight,
        nights,
        customNights: false,
        total: 0,
        includedInBasePrice: true,
        source: "manual",
      });
    }
  }
  return facilities;
}

function reservationBarTotal(items) {
  if (!Array.isArray(items)) return 0;
  return normalizeMoney(
    items.reduce((sum, item) => {
      const quantity = Math.max(0, Number(item?.quantity || 0));
      const fallback =
        Number(item?.price || 0) * quantity +
        (item?.hasSgr ? 0.5 * quantity : 0);
      return sum + Number(item?.lineTotal ?? fallback);
    }, 0),
  );
}

function paymentCoveredByExisting(existing) {
  const oldPrice = normalizeMoney(existing?.price);
  if (normalizeMoney(existing?.settledPrice) > 0)
    return Math.min(oldPrice, normalizeMoney(existing.settledPrice));
  if (existing?.paid === true && oldPrice > 0) return oldPrice;
  if (normalizeMoney(existing?.deposit) > 0)
    return Math.min(oldPrice, normalizeMoney(existing.deposit));
  if (oldPrice > 0 && Number.isFinite(Number(existing?.balance))) {
    return Math.max(0, oldPrice - normalizeMoney(existing.balance));
  }
  return Math.min(oldPrice, normalizeMoney(existing?.actualPaidAmount));
}

function personIdentity(name, phone) {
  const normalizedPhone = normalizePhone(phone);
  return `${normalizeIdentity(name)}|${normalizedPhone || "no-phone"}`;
}

function buildPersonIndex(existingReservations) {
  const index = new Map();
  for (const reservation of existingReservations) {
    if (!reservation.personId) continue;
    index.set(
      personIdentity(reservation.guest, reservation.phone),
      reservation.personId,
    );
  }
  return index;
}

function personIdFor(legacy, personIndex) {
  const identity = personIdentity(legacy.nume, legacy.telefon);
  if (personIndex.has(identity)) return personIndex.get(identity);
  const id = `person-legacy-${stableHash(identity === "|no-phone" ? legacy.GUID : identity)}`;
  personIndex.set(identity, id);
  return id;
}

function flattenLegacyReservations(dbField) {
  if (!Array.isArray(dbField?.Parkline))
    throw new Error("dbField-2.json nu conține lista Parkline.");
  return dbField.Parkline.flatMap((category) => {
    const reservations = Array.isArray(category?.Rezervari)
      ? category.Rezervari
      : [];
    return reservations.map((reservation) => ({
      category: normalizeText(category.NumeArray),
      legacy: reservation,
    }));
  });
}

function mapReservation(entry, context) {
  const { category, legacy } = entry;
  const guid = normalizeText(legacy.GUID);
  if (!guid) throw new Error(`Rezervare fără GUID în categoria ${category}.`);
  const key = `legacy-dbfield-${guid}`;
  const start = parseLegacyDate(legacy.date1, `${guid}.date1`);
  const end = parseLegacyDate(legacy.date2, `${guid}.date2`);
  if (end <= start)
    throw new Error(
      `Interval invalid pentru rezervarea ${guid}: ${start} - ${end}`,
    );
  const rangeNights = daysBetween(start, end);
  const nights = Math.max(1, positiveInteger(legacy.nopti, rangeNights));
  const unit = categoryUnit(category, legacy);
  const existing = context.existingByKey.get(key);
  const legacyPrice = normalizeMoney(legacy.pret);
  const barItems = Array.isArray(existing?.barItems) ? existing.barItems : [];
  const barTotal = reservationBarTotal(barItems);
  const price = normalizeMoney(legacyPrice + barTotal);
  const explicitAdvance = Math.min(legacyPrice, parseAdvance(legacy.notes));
  const coveredPrice = existing
    ? Math.min(price, paymentCoveredByExisting(existing))
    : explicitAdvance;
  const stationingGuid = normalizeText(legacy.StationareGUID);
  const stationing = stationingGuid
    ? context.stationingByGuid.get(stationingGuid)
    : null;
  const paymentMethod = normalizeText(existing?.paymentMethod || legacy.plata);

  const mapped = {
    id: unit.id,
    key,
    personId: existing?.personId || personIdFor(legacy, context.personIndex),
    group: unit.group,
    kind: unit.kind,
    guest: normalizeText(legacy.nume) || "Client necunoscut",
    phone: normalizePhone(legacy.telefon),
    adults: positiveInteger(legacy.adulti),
    children: positiveInteger(legacy.copii),
    car: normalizeText(legacy.masina),
    party: positiveInteger(legacy.adulti) + positiveInteger(legacy.copii),
    status: "occupied",
    start,
    end,
    dates: formatDateRange(start, end),
    basePrice: legacyPrice,
    facilities: legacyFacilities(legacy.pretSuplimentar, nights),
    barItems,
    price,
    balance: normalizeMoney(price - coveredPrice),
    deposit: coveredPrice,
    paid: price > 0 && coveredPrice >= price,
    settledPrice: coveredPrice,
    actualPaidAmount: existing
      ? normalizeMoney(existing.actualPaidAmount)
      : explicitAdvance,
    paymentMethod,
    stationingDeduction: stationing
      ? {
          recordKey: stationing.key,
          recordLabel: `${stationing.owner} (${stationing.caravan})`,
          selectedAt: context.importedAt,
          appliedAt: "",
          appliedNights: 0,
          appliedAmount: 0,
          nights,
        }
      : null,
    note: normalizeText(legacy.notes),
    legacySource: {
      type: "dbField-2.json",
      sha256: context.dbFieldHash,
      guid,
      category,
      stationingGuid,
      importedAt: context.importedAt,
    },
  };

  for (const field of ["paidAt", "receiptId"]) {
    if (existing?.[field]) mapped[field] = existing[field];
  }

  return { mapped, unit, existing };
}

function stationingOutstanding(note) {
  const text = String(note ?? "");
  const patterns = [
    /([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:lei\s*)?(?:restan(?:ță|ta)|rest\s+de\s+plat[ăa])/i,
    /(?:restan(?:ță|ta)|rest\s+de\s+plat[ăa]|rest)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
    /de\s+achitat\s*([0-9]+(?:[.,][0-9]{1,2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return normalizeMoney(match[1]);
  }
  return null;
}

function mapStationing(legacy, linkedReservations, context) {
  const guid = normalizeText(legacy.StationareGUID);
  if (!guid) throw new Error("Staționare fără StationareGUID.");
  const key = `legacy-stationing-${guid}`;
  const startDate = parseLegacyDate(legacy.date1, `${guid}.date1`);
  const nightlyPrice = normalizeMoney(legacy.pretnoapte);
  const legacyTotal = normalizeMoney(legacy.pret);
  const usedNights = positiveInteger(legacy.cazate);
  const purchasedNights =
    nightlyPrice > 0 ? Math.round(legacyTotal / nightlyPrice) : 0;
  const prepaidNights = Math.max(
    1,
    Math.min(1095, purchasedNights + usedNights),
  );
  const totalPrice =
    nightlyPrice > 0
      ? normalizeMoney(Math.max(0, prepaidNights - usedNights) * nightlyPrice)
      : legacyTotal;
  const outstanding = stationingOutstanding(legacy.notes);
  const explicitlyPaid =
    /\bachitat\b/i.test(String(legacy.notes ?? "")) &&
    !/de\s+achitat/i.test(String(legacy.notes ?? ""));
  const paidAmount = explicitlyPaid
    ? totalPrice
    : outstanding === null
      ? 0
      : normalizeMoney(
          Math.max(0, totalPrice - Math.min(totalPrice, outstanding)),
        );
  const linked = linkedReservations.get(guid) || [];
  const phone =
    linked.map((entry) => normalizePhone(entry.legacy.telefon)).find(Boolean) ||
    "";
  const caravan =
    linked.map((entry) => normalizeText(entry.legacy.masina)).find(Boolean) ||
    "Rulotă staționată";
  const owner = normalizeText(legacy.nume) || "Proprietar necunoscut";
  const deductions =
    usedNights > 0
      ? [
          {
            key: `legacy-stationing-usage-${guid}`,
            stayKey: `legacy-stationing-usage-${guid}`,
            guest: owner,
            unitId: "Utilizare importată",
            start: startDate,
            end: addDays(startDate, usedNights),
            nights: usedNights,
            amount: normalizeMoney(usedNights * nightlyPrice),
            appliedAt: context.importedAt,
            legacyUsage: true,
          },
        ]
      : [];

  return {
    key,
    owner,
    phone,
    caravan,
    startDate,
    prepaidNights,
    nightlyPrice,
    totalPrice,
    paidAmount,
    balance: normalizeMoney(totalPrice - paidAmount),
    deductions,
    note: normalizeText(legacy.notes),
    legacySource: {
      type: "Stationare.json",
      sha256: context.stationingHash,
      guid,
      legacyTotal,
      legacyUsedNights: usedNights,
      importedAt: context.importedAt,
    },
  };
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} duplicat: ${value}`);
    seen.add(value);
  }
}

function assertSchema(db) {
  const required = ["reservations", "units", "stationing", "bar_articles"];
  const tables = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name),
  );
  for (const table of required) {
    if (!tables.has(table))
      throw new Error(`Baza țintă nu conține tabela ${table}.`);
  }
}

function readReservationRows(db) {
  return db
    .prepare(
      "SELECT key, order_index, data FROM reservations ORDER BY order_index",
    )
    .all()
    .map((row) => {
      let data;
      try {
        data = JSON.parse(row.data);
      } catch (error) {
        throw new Error(
          `Rezervare coruptă în baza sursă (cheia ${row.key}): ${error.message}`,
        );
      }
      return {
        key: row.key,
        orderIndex: row.order_index,
        data,
      };
    });
}

function barFingerprint(db) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        db
          .prepare(
            "SELECT key, name, stock, vat_rate, updated_at, data FROM bar_articles ORDER BY key",
          )
          .all(),
      ),
    )
    .digest("hex");
}

function existingReservationBarFingerprint(rows) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.key,
          Array.isArray(row.data.barItems) ? row.data.barItems : [],
        ]),
      ),
    )
    .digest("hex");
}

function backupDatabase(databasePath) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const backupPath = `${databasePath}.backup-${stamp}.sqlite`;
  fs.copyFileSync(databasePath, backupPath, fs.constants.COPYFILE_EXCL);
  return backupPath;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  for (const filePath of [
    options.database,
    options.dbField,
    options.stationing,
  ]) {
    if (!fs.existsSync(filePath))
      throw new Error(`Fișier inexistent: ${filePath}`);
  }

  const dbField = readJson(options.dbField);
  const stationingFile = readJson(options.stationing);
  const reservationEntries = flattenLegacyReservations(dbField);
  const stationingEntries = Array.isArray(stationingFile?.Stationari)
    ? stationingFile.Stationari
    : null;
  if (!stationingEntries)
    throw new Error("Stationare.json nu conține lista Stationari.");
  assertUnique(
    reservationEntries.map((entry) => normalizeText(entry.legacy.GUID)),
    "GUID rezervare",
  );
  assertUnique(
    stationingEntries.map((entry) => normalizeText(entry.StationareGUID)),
    "GUID staționare",
  );

  const linkedReservations = new Map();
  for (const entry of reservationEntries) {
    const guid = normalizeText(entry.legacy.StationareGUID);
    if (!guid) continue;
    if (
      !stationingEntries.some(
        (item) => normalizeText(item.StationareGUID) === guid,
      )
    ) {
      throw new Error(
        `Rezervarea ${entry.legacy.GUID} indică o staționare inexistentă: ${guid}`,
      );
    }
    if (!linkedReservations.has(guid)) linkedReservations.set(guid, []);
    linkedReservations.get(guid).push(entry);
  }

  let db = new DatabaseSync(options.database, { readOnly: options.dryRun });
  assertSchema(db);
  const importedAt = new Date().toISOString();
  const dbFieldHash = sha256File(options.dbField);
  const stationingHash = sha256File(options.stationing);
  const existingRows = readReservationRows(db);
  const existingByKey = new Map(existingRows.map((row) => [row.key, row.data]));
  const existingOrder = new Map(
    existingRows.map((row) => [row.key, row.orderIndex]),
  );
  const personIndex = buildPersonIndex(existingRows.map((row) => row.data));
  const stationingContext = { importedAt, stationingHash };
  const mappedStationing = stationingEntries.map((entry) =>
    mapStationing(entry, linkedReservations, stationingContext),
  );
  const stationingByGuid = new Map(
    mappedStationing.map((entry) => [entry.legacySource.guid, entry]),
  );
  const reservationContext = {
    importedAt,
    dbFieldHash,
    existingByKey,
    personIndex,
    stationingByGuid,
  };
  const mappedReservations = reservationEntries.map((entry) =>
    mapReservation(entry, reservationContext),
  );
  const insertedReservations = mappedReservations.filter(
    (entry) => !entry.existing,
  ).length;
  const updatedReservations = mappedReservations.length - insertedReservations;
  const existingStationingKeys = new Set(
    db
      .prepare("SELECT key FROM stationing")
      .all()
      .map((row) => row.key),
  );
  const insertedStationing = mappedStationing.filter(
    (record) => !existingStationingKeys.has(record.key),
  ).length;
  const updatedStationing = mappedStationing.length - insertedStationing;
  const unitsToInsert = new Map(
    mappedReservations.map((entry) => [entry.unit.id, entry.unit]),
  );
  const existingUnitIds = new Set(
    db
      .prepare("SELECT id FROM units")
      .all()
      .map((row) => row.id),
  );
  const missingUnits = [...unitsToInsert.values()].filter(
    (unit) => !existingUnitIds.has(unit.id),
  );
  const barBefore = barFingerprint(db);
  const reservationBarsBefore = existingReservationBarFingerprint(existingRows);

  console.log(`Bază țintă: ${options.database}`);
  console.log(
    `Rezervări legacy: ${mappedReservations.length} (${insertedReservations} noi, ${updatedReservations} actualizate)`,
  );
  console.log(
    `Staționări legacy: ${mappedStationing.length} (${insertedStationing} noi, ${updatedStationing} actualizate)`,
  );
  console.log(`Unități noi necesare: ${missingUnits.length}`);
  console.log(`Legături rezervare-staționare: ${linkedReservations.size}`);
  console.log(
    `Bar protejat: ${db.prepare("SELECT COUNT(*) AS count FROM bar_articles").get().count} articole`,
  );

  if (options.dryRun) {
    db.close();
    console.log("Dry-run finalizat: baza nu a fost modificată.");
    return;
  }

  db.exec("PRAGMA wal_checkpoint(FULL)");
  db.close();
  const backupPath = backupDatabase(options.database);
  db = new DatabaseSync(options.database);
  assertSchema(db);

  const now = importedAt;
  const insertUnit = db.prepare(`
    INSERT OR IGNORE INTO units (id, group_name, kind, pricing_mode, adult_price, child_price, updated_at, data)
    VALUES (?, ?, ?, 'per-night', 0, 0, ?, ?)
  `);
  const upsertReservation = db.prepare(`
    INSERT INTO reservations (key, order_index, id, guest, group_name, kind, start_date, end_date, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      id = excluded.id,
      guest = excluded.guest,
      group_name = excluded.group_name,
      kind = excluded.kind,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      updated_at = excluded.updated_at,
      data = excluded.data
  `);
  const upsertStationing = db.prepare(`
    INSERT INTO stationing (key, owner, caravan, start_date, end_date, updated_at, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      owner = excluded.owner,
      caravan = excluded.caravan,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      updated_at = excluded.updated_at,
      data = excluded.data
  `);

  let nextOrder =
    existingRows.reduce(
      (maximum, row) => Math.max(maximum, row.orderIndex),
      -1,
    ) + 1;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const unit of missingUnits) {
      const data = {
        ...unit,
        pricingMode: "per-night",
        adultPrice: 0,
        childPrice: 0,
        dailyPrices: {},
      };
      insertUnit.run(unit.id, unit.group, unit.kind, now, JSON.stringify(data));
    }
    for (const entry of mappedReservations) {
      const reservation = entry.mapped;
      const orderIndex = existingOrder.has(reservation.key)
        ? existingOrder.get(reservation.key)
        : nextOrder++;
      upsertReservation.run(
        reservation.key,
        orderIndex,
        reservation.id,
        reservation.guest,
        reservation.group,
        reservation.kind,
        reservation.start,
        reservation.end,
        now,
        JSON.stringify(reservation),
      );
    }
    for (const record of mappedStationing) {
      upsertStationing.run(
        record.key,
        record.owner,
        record.caravan,
        record.startDate,
        addDays(record.startDate, record.prepaidNights),
        now,
        JSON.stringify(record),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const barAfter = barFingerprint(db);
  const allRowsAfter = readReservationRows(db);
  const previousKeys = new Set(existingRows.map((row) => row.key));
  const existingRowsAfter = allRowsAfter.filter((row) =>
    previousKeys.has(row.key),
  );
  const reservationBarsAfter =
    existingReservationBarFingerprint(existingRowsAfter);
  if (barAfter !== barBefore)
    throw new Error(
      "Protecția barului a eșuat: tabela bar_articles s-a modificat.",
    );
  if (reservationBarsAfter !== reservationBarsBefore)
    throw new Error(
      "Protecția barului a eșuat: produsele de bar ale unei rezervări existente s-au modificat.",
    );
  const integrity = db.prepare("PRAGMA integrity_check").get().integrity_check;
  if (integrity !== "ok")
    throw new Error(`Verificarea SQLite a eșuat: ${integrity}`);
  const finalReservationCount = db
    .prepare("SELECT COUNT(*) AS count FROM reservations")
    .get().count;
  const finalStationingCount = db
    .prepare("SELECT COUNT(*) AS count FROM stationing")
    .get().count;
  const finalBarCount = db
    .prepare("SELECT COUNT(*) AS count FROM bar_articles")
    .get().count;
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db.close();

  console.log(`Backup: ${backupPath}`);
  console.log(
    `Rezultat: ${finalReservationCount} rezervări, ${finalStationingCount} staționări, ${finalBarCount} articole bar.`,
  );
  console.log(`SQLite integrity_check: ${integrity}`);
  console.log(`Bar neschimbat: SHA-256 ${barAfter}`);
}

try {
  main();
} catch (error) {
  console.error(`Migrarea a eșuat: ${error.message}`);
  process.exitCode = 1;
}
