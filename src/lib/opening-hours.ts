/**
 * When the makerspace is open, as one week: for each day, the minutes since
 * midnight it opens and closes in America/Los_Angeles, or null on a day it
 * does not open. Index 0 is Sunday.
 *
 * Staff edit the week under Admin → Settings and it is kept in the database
 * (the `openingHours` site record). That stored week is the one source: the
 * lobby display's "Open now", the hours machines can be reserved in and the
 * hours members read on the Join page are all worked out from it. The week
 * below is where it starts, and what a missing or damaged day falls back to.
 */
export type DayHours = { open: number; close: number } | null;

export type OpeningHours = DayHours[];

const hour = (h: number) => h * 60;

export const DEFAULT_OPENING_HOURS: OpeningHours = [
  { open: hour(11), close: hour(16) },
  null,
  { open: hour(13), close: hour(20) },
  { open: hour(13), close: hour(20) },
  { open: hour(13), close: hour(20) },
  { open: hour(13), close: hour(20) },
  { open: hour(11), close: hour(17) },
];

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Times are kept on the hour or the half hour, like the reservation slots. */
export const OPENING_STEP_MINUTES = 30;

const DAY_MINUTES = 24 * 60;

function clock(minutes: number): { time: string; half: "AM" | "PM" } {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return {
    time: `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`,
    half: h < 12 ? "AM" : "PM",
  };
}

/** "1:00 PM", "10:30 AM". */
export function timeLabel(minutes: number): string {
  const { time, half } = clock(minutes);
  return `${time} ${half}`;
}

/** One day as members read it: "1:00 – 8:00 PM", "11:00 AM – 4:00 PM", "Closed". */
export function dayHoursLabel(day: DayHours): string {
  if (!day) return "Closed";
  const open = clock(day.open);
  const close = clock(day.close);
  const from = open.half === close.half ? open.time : `${open.time} ${open.half}`;
  return `${from} – ${close.time} ${close.half}`;
}

/**
 * The week as the Join page lists it, Sunday first: "Sunday 11:00 AM –
 * 4:00 PM", "Monday Closed", "Tuesday 1:00 – 8:00 PM".
 */
export function openingHoursLines(hours: OpeningHours): string[] {
  return DAY_NAMES.map((day, weekday) => `${day} ${dayHoursLabel(hours[weekday] ?? null)}`);
}

/** Why one day will not do, or null when it is fine. */
function dayProblem(day: unknown): string | null {
  if (day === null) return null;
  if (!day || typeof day !== "object") return "set an opening and a closing time, or mark it closed.";
  const { open, close } = day as { open?: unknown; close?: unknown };
  if (
    typeof open !== "number" ||
    typeof close !== "number" ||
    !Number.isInteger(open) ||
    !Number.isInteger(close)
  ) {
    return "set an opening and a closing time, or mark it closed.";
  }
  if (open < 0 || close > DAY_MINUTES) return "keep the times within one day.";
  if (open % OPENING_STEP_MINUTES !== 0 || close % OPENING_STEP_MINUTES !== 0) {
    return "use times on the hour or the half hour.";
  }
  if (close <= open) return "closes before it opens";
  return null;
}

/**
 * The week as read back from the database. A day that is missing or is not
 * something the form would accept takes the default for that day, one day at
 * a time, so a damaged row can never close the shop or leave a day undefined.
 * A stored null is a real "closed" and is kept.
 */
export function normalizeOpeningHours(raw: unknown): OpeningHours {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return DEFAULT_OPENING_HOURS.map((day) => (day ? { ...day } : null));
  }
  return DEFAULT_OPENING_HOURS.map((fallback, weekday) => {
    const stored = raw[weekday] as unknown;
    if (stored === null) return null;
    if (stored === undefined || dayProblem(stored) !== null) {
      return fallback ? { ...fallback } : null;
    }
    const { open, close } = stored as { open: number; close: number };
    return { open, close };
  });
}

/**
 * The week staff sent, checked. Throws a sentence staff can act on for the
 * first day that will not do.
 */
export function checkedOpeningHours(input: unknown): OpeningHours {
  if (!Array.isArray(input) || input.length !== 7) throw new Error("Send all seven days.");
  const week = input.map((day, weekday) => {
    const why = dayProblem(day);
    if (why === "closes before it opens") {
      throw new Error(
        `${DAY_NAMES[weekday]} closes before it opens. Set the closing time after the opening time.`,
      );
    }
    if (why) throw new Error(`${DAY_NAMES[weekday]}: ${why}`);
    if (day === null) return null;
    const { open, close } = day as { open: number; close: number };
    return { open, close };
  });
  if (week.every((day) => day === null)) {
    throw new Error(
      "Leave at least one day open. For a holiday closure, add a note on the Hours page instead.",
    );
  }
  return week;
}

/** The days that differ, as { Monday: { from, to } }, for the audit trail. */
export function openingHoursChanges(
  before: OpeningHours,
  after: OpeningHours,
): Record<string, { from: string; to: string }> {
  const changes: Record<string, { from: string; to: string }> = {};
  DAY_NAMES.forEach((name, weekday) => {
    const from = dayHoursLabel(before[weekday] ?? null);
    const to = dayHoursLabel(after[weekday] ?? null);
    if (from !== to) changes[name] = { from, to };
  });
  return changes;
}
