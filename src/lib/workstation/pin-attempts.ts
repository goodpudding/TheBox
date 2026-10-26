const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;

export const PIN_LOCK_MESSAGE =
  "Too many attempts. Try again in a few minutes or ask staff to reset your PIN.";

export const PIN_MISMATCH_MESSAGE = "Email or PIN didn't match";

type Bucket = {
  failures: number[];
  lockedUntil: number;
};

const buckets = new Map<string, Bucket>();

function key(workstationId: string, email: string): string {
  return `${workstationId}\n${email.trim().toLowerCase()}`;
}

function bucket(workstationId: string, email: string, now: number): Bucket {
  const id = key(workstationId, email);
  const current = buckets.get(id) ?? { failures: [], lockedUntil: 0 };
  current.failures = current.failures.filter((at) => now - at < WINDOW_MS);
  buckets.set(id, current);
  return current;
}

export function isPinAttemptLocked(
  workstationId: string,
  email: string,
  now = Date.now(),
): boolean {
  return bucket(workstationId, email, now).lockedUntil > now;
}

/** Record one failed attempt. The 5th failure locks the desk for 10 minutes. */
export function recordFailedPinAttempt(
  workstationId: string,
  email: string,
  now = Date.now(),
): void {
  const current = bucket(workstationId, email, now);
  current.failures.push(now);
  if (current.failures.length >= MAX_FAILURES) {
    current.lockedUntil = now + WINDOW_MS;
  }
}

export function clearPinAttempts(workstationId: string, email: string): void {
  buckets.delete(key(workstationId, email));
}

export function resetPinAttemptStore(): void {
  buckets.clear();
}
