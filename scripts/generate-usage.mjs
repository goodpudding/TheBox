/**
 * Generates ~200 usage sessions spanning 2026-03-01 .. 2026-09-03.
 * Can be imported by generate-mock-fixtures.mjs or run standalone:
 *   node scripts/generate-usage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MOCK = path.join(ROOT, "data", "mock");
const TZ = "-07:00";

/** Deterministic PRNG (mulberry32) */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function isoLocal(y, m, d, h, min, s = 0) {
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(s)}${TZ}`;
}

function addMinutes(y, m, d, h, min, add) {
  const dt = new Date(Date.UTC(y, m - 1, d, h, min) + add * 60_000);
  // Interpret as wall-clock pieces for -07:00 fixture timestamps
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
    h: dt.getUTCHours(),
    min: dt.getUTCMinutes(),
  };
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/**
 * @param {{ machines: any[], badges: any[], users: any[] }} refs
 * @returns {import('../src/lib/data/types').UsageSession[]}
 */
export function generateUsageSessions(refs) {
  const rand = mulberry32(20260904);
  const { machines, badges } = refs;

  // Prefer members with linked badges
  const badgePool = badges.filter((b) => b.userId && b.active);
  if (!badgePool.length || !machines.length) {
    throw new Error("generateUsageSessions: need badges and machines");
  }

  // Weight popular machines higher
  const machineWeights = machines.map((m) => {
    let w = 1;
    if (m.area === "3d_printing") w = 3;
    else if (m.area === "laser") w = 2.5;
    else if (m.area === "woodshop") w = 2;
    else if (m.area === "textiles_vinyl") w = 1.5;
    return { m, w };
  });
  const totalW = machineWeights.reduce((s, x) => s + x.w, 0);

  function pickMachine() {
    let r = rand() * totalW;
    for (const { m, w } of machineWeights) {
      r -= w;
      if (r <= 0) return m;
    }
    return machineWeights[machineWeights.length - 1].m;
  }

  function pickBadge() {
    return badgePool[Math.floor(rand() * badgePool.length)];
  }

  const endedByOptions = ["reader", "reader", "reader", "timeout", "staff", "system"];
  const sessions = [];
  const TARGET = 200;

  // Spread across Mar 1 – Sep 3 2026
  const start = { y: 2026, m: 3, d: 1 };
  const endExclusive = { y: 2026, m: 9, d: 4 }; // up to Sep 3

  for (let i = 0; i < TARGET; i++) {
    // Linear-ish day distribution with jitter
    const spanDays =
      (endExclusive.y - start.y) * 365 +
      (endExclusive.m - start.m) * 30 +
      (endExclusive.d - start.d);
    const dayOffset = Math.floor((i / TARGET) * spanDays + (rand() - 0.5) * 3);
    let y = 2026;
    let m = 3;
    let d = 1 + Math.max(0, dayOffset);
    while (d > daysInMonth(y, m)) {
      d -= daysInMonth(y, m);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    // Clamp to Sep 3
    if (m > 9 || (m === 9 && d > 3)) {
      m = 9;
      d = 1 + Math.floor(rand() * 3);
    }

    // Typical open-hours-ish start: 10–19
    const startH = 10 + Math.floor(rand() * 9);
    const startMin = rand() < 0.5 ? 0 : 30;
    const duration = 30 + Math.floor(rand() * 7) * 15; // 30–120 in 15s
    const endParts = addMinutes(y, m, d, startH, startMin, duration);

    const machine = pickMachine();
    const badge = pickBadge();
    const endedBy = endedByOptions[Math.floor(rand() * endedByOptions.length)];
    const startedAt = isoLocal(y, m, d, startH, startMin);
    const endedAt = isoLocal(endParts.y, endParts.m, endParts.d, endParts.h, endParts.min);

    sessions.push({
      id: `us-${String(i + 1).padStart(3, "0")}`,
      userId: badge.userId,
      machineId: machine.id,
      badgeId: badge.id,
      startedAt,
      endedAt,
      reservationId: null,
      endedBy,
      createdAt: startedAt,
      updatedAt: endedAt,
    });
  }

  // Link a few sessions to known completed reservations if ids exist in reservations file later — keep null for generator purity
  // Sort chronologically
  sessions.sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
  return sessions;
}

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(MOCK, name), "utf8"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const machines = loadJson("machines.json");
  const badges = loadJson("badges.json").filter((b) => b.userId && b.active);
  const users = loadJson("users.json");
  const sessions = generateUsageSessions({ machines, badges, users });
  fs.writeFileSync(
    path.join(MOCK, "usage-sessions.json"),
    JSON.stringify(sessions, null, 2) + "\n",
    "utf8",
  );
  console.log(`Wrote ${sessions.length} usage sessions to data/mock/usage-sessions.json`);
}
