/**
 * The current time in epoch milliseconds, as `useNow` reports it. It is null
 * on the server and while the page hydrates, when the time is not known yet;
 * every check here answers "no" until it is.
 */
export type Now = number | null;

const ms = (iso: string) => new Date(iso).getTime();

/** Started and not yet over. */
export function isHappeningNow(startsAt: string, endsAt: string, now: Now): boolean {
  return now !== null && ms(startsAt) <= now && ms(endsAt) > now;
}

/** The moment has not been reached yet. */
export function isStillAhead(at: string, now: Now): boolean {
  return now !== null && ms(at) > now;
}

/** The moment is behind us. */
export function hasStarted(at: string, now: Now): boolean {
  return now !== null && ms(at) < now;
}

/** Sessions that start now or later, soonest first. */
export function upcomingByStart<T extends { startsAt: string }>(
  sessions: readonly T[],
  now: Now,
): T[] {
  if (now === null) return [];
  return sessions
    .filter((s) => ms(s.startsAt) >= now)
    .sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
}
