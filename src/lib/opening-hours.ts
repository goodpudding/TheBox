/**
 * When the makerspace is open: [openHour, closeHour) in America/Los_Angeles,
 * or null on a day it does not open. 0 = Sunday.
 *
 * This is the one place the hours are written in code. The lobby display's
 * "Open now", the hours machines can be reserved in, and (through a test) the
 * published Hours page all follow it.
 */
export const OPENING_HOURS: Record<number, readonly [number, number] | null> = {
  0: [11, 16],
  1: null,
  2: [13, 20],
  3: [13, 20],
  4: [13, 20],
  5: [13, 20],
  6: [11, 17],
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function clock(hour: number): { time: string; half: "AM" | "PM" } {
  return { time: `${((hour + 11) % 12) + 1}:00`, half: hour < 12 ? "AM" : "PM" };
}

/**
 * The week as the Hours page lists it, Sunday first: "Sunday 11:00 AM –
 * 4:00 PM", "Monday Closed", "Tuesday 1:00 – 8:00 PM".
 */
export function openingHoursLines(): string[] {
  return DAY_NAMES.map((day, weekday) => {
    const window = OPENING_HOURS[weekday];
    if (!window) return `${day} Closed`;
    const open = clock(window[0]);
    const close = clock(window[1]);
    const from = open.half === close.half ? open.time : `${open.time} ${open.half}`;
    return `${day} ${from} – ${close.time} ${close.half}`;
  });
}
