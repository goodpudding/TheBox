/**
 * Conversions for `<input type="datetime-local">`, which shows and returns
 * the clock time where the browser is, with no zone: "2026-11-21T12:00".
 * Stored times are ISO strings in UTC. Mixing the two moved a promo's dates
 * by the UTC offset every time it was saved.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** A stored time as the local clock time an input shows, to the minute. */
export function toLocalInput(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The moment a local clock time from an input stands for, as an ISO string. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}
