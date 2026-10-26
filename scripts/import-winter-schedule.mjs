/**
 * Import Winter 2026 Schedule CSV → data/mock/class-sessions.json
 * Source: The Box Nov/Dec 2026 spreadsheet (Schedule tab).
 *
 * Usage: node scripts/import-winter-schedule.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const schedulePath = path.join(root, "data/mock/winter-2026-schedule.csv");
const catalogPath = path.join(root, "data/mock/winter-2026-catalog.csv");
const outPath = path.join(root, "data/mock/class-sessions.json");

const YEAR = 2026;
const TZ = "-08:00"; // PST for Nov/Dec
const NOW = "2026-09-06T12:00:00-07:00";

const MONTHS = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\r") {
      // skip
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function clean(s) {
  return String(s ?? "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(raw) {
  const s = clean(raw);
  if (!s || s === "-" || s === "—") return 0;
  const n = Number(s.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function parseSeats(raw, fallback = 8) {
  const s = clean(raw);
  if (!s || s === "-" || s === "—") return fallback;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseDate(dateLabel) {
  // "Tue Nov 3" or "Sat Dec 26"
  const m = clean(dateLabel).match(
    /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Za-z]+)\s+(\d{1,2})$/,
  );
  if (!m) return null;
  const month = MONTHS[m[1]];
  const day = Number(m[2]);
  if (!month || !day) return null;
  return { month, day };
}

function parseTime(raw) {
  const s = clean(raw);
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && hour !== 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

function toIso({ month, day }, time) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${YEAR}-${pad(month)}-${pad(day)}T${pad(time.hour)}:${pad(time.minute)}:00${TZ}`;
}

function slugify(title, startsAt) {
  const date = startsAt.slice(0, 10);
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base}-${date}`;
}

function categoryFor(kind, title, catalogClass) {
  const blob = `${kind} ${title} ${catalogClass}`.toLowerCase();
  if (blob.includes("orientation") || /\b101\b/.test(blob)) {
    return "orientation";
  }
  if (
    kind === "Open shop" ||
    kind === "Club" ||
    blob.includes("make night") ||
    blob.includes("open studio") ||
    blob.includes("open shop")
  ) {
    return "open_studio";
  }
  if (blob.includes("checkoff") || blob.includes("certification")) {
    return "certification_checkoff";
  }
  return "workshop";
}

function descriptionSlugFor(category, catalogClass, title) {
  const key = clean(catalogClass || title).toLowerCase();
  if (key.includes("laser") || key.includes("3d printing 101")) {
    return "class-shop-orientation";
  }
  if (key.includes("sewing") || key.includes("stocking") || key.includes("bowl")) {
    return "class-sewing-basics";
  }
  if (key.includes("cutting board") || key.includes("wood")) {
    return "class-woodshop-safety";
  }
  if (key.includes("stained glass")) return "class-laser-basics";
  if (key.includes("open") || key.includes("make night") || key.includes("club")) {
    return "class-open-studio-night";
  }
  if (category === "orientation") return "class-shop-orientation";
  return "class-3d-printing-intro";
}

function prereqsFor(category, title) {
  const t = title.toLowerCase();
  if (category === "orientation") return [];
  if (
    t.includes("kids") ||
    t.includes("homeschool") ||
    t.includes("winter break") ||
    t.includes("nerd") ||
    t.includes("queer") ||
    t.includes("junk") ||
    t.includes("cosplay")
  ) {
    return [];
  }
  if (category === "open_studio") return ["cert-shop-orientation"];
  if (t.includes("laser") || t.includes("cutting board") || t.includes("3d")) {
    return ["cert-shop-orientation"];
  }
  return [];
}

const catalogRows = parseCsv(fs.readFileSync(catalogPath, "utf8"));
const catalogHeader = catalogRows[0];
const catalogByName = new Map();
for (const r of catalogRows.slice(1)) {
  const obj = Object.fromEntries(catalogHeader.map((h, i) => [h, r[i] ?? ""]));
  const name = clean(obj.Class);
  if (!name || name === "TOTAL" || name.startsWith("Legend")) continue;
  catalogByName.set(name, obj);
}

const scheduleRows = parseCsv(fs.readFileSync(schedulePath, "utf8"));
const header = scheduleRows[0];
const sessions = [];
let idx = 0;

const INCLUDE_KINDS = new Set([
  "Class",
  "Club",
  "Open shop",
  "Corporate hold",
]);

for (const r of scheduleRows.slice(1)) {
  const row = Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]));
  const kind = clean(row.Kind);
  if (!INCLUDE_KINDS.has(kind)) continue;

  const date = parseDate(row.Date);
  const start = parseTime(row.Start);
  const end = parseTime(row.End);
  if (!date || !start || !end) continue;

  const title = clean(row.Title);
  if (!title) continue;

  const catalogName = clean(row["Catalog class"]);
  const catalog = catalogName ? catalogByName.get(catalogName) : null;

  let priceCents = parsePrice(row.Price);
  let capacity = parseSeats(row.Seats, 0);

  // Day-2 / continuation rows often have blank seats/price — still show on calendar.
  if (!capacity && catalog) {
    capacity = parseSeats(catalog["Max seats"], 8);
  }
  if (!capacity) {
    if (kind === "Club") capacity = 15;
    else if (kind === "Open shop") capacity = 15;
    else if (kind === "Corporate hold") capacity = 1;
    else capacity = 8;
  }

  // Continuation day: don't double-charge
  if (
    /day 2 of 2/i.test(title) &&
    (!clean(row.Price) || clean(row.Price) === "-")
  ) {
    priceCents = 0;
  }

  if (catalog && priceCents === 0 && clean(row.Price) && clean(row.Price) !== "-") {
    // keep parsed
  } else if (catalog && priceCents === 0 && !clean(row.Price)) {
    // day 2 already handled
  } else if (catalog && !clean(row.Price)) {
    priceCents = parsePrice(catalog.Price);
  }

  const category = categoryFor(kind, title, catalogName);
  const startsAt = toIso(date, start);
  const endsAt = toIso(date, end);
  idx += 1;
  const id = `class-w26-${String(idx).padStart(3, "0")}`;

  sessions.push({
    id,
    title,
    slug: slugify(title, startsAt),
    descriptionSlug: descriptionSlugFor(category, catalogName, title),
    category,
    instructorId: kind === "Corporate hold" ? "u-admin" : "u-staff",
    startsAt,
    endsAt,
    capacity,
    priceCents,
    zeffyUrl: null,
    prerequisiteCertificationIds: prereqsFor(category, title),
    location: "The Box",
    cancellationCutoffHours: kind === "Open shop" ? 12 : 24,
    published: true,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

fs.writeFileSync(outPath, JSON.stringify(sessions, null, 2) + "\n");
console.log(`Wrote ${sessions.length} sessions → ${path.relative(root, outPath)}`);
console.log(
  "By category:",
  Object.fromEntries(
    [...new Set(sessions.map((s) => s.category))].map((c) => [
      c,
      sessions.filter((s) => s.category === c).length,
    ]),
  ),
);
