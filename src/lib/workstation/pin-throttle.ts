import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * PIN attempt limit that survives across Worker isolates.
 *
 * The in-memory counter in pin-attempts.ts only sees one isolate, and the
 * phone-approval route is reachable from anywhere, so a 4-digit PIN could be
 * guessed by spreading requests. Failures are already written to AuditEvent
 * for staff; this reads them back to decide whether an email is locked.
 */

export const PIN_FAILED_ACTION = "workstation.pin_failed";
export const PIN_OK_ACTION = "workstation.pin_ok";
/** A new PIN was set, by staff or by the signed-in member. */
export const PIN_SET_ACTION = "workstation.pin_set";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_FAILURES_PER_DAY = 20;

/**
 * D1 refuses a LIKE pattern over 50 bytes, and `contains` sends
 * LIKE '%value%'. The full 64-character hash made every read fail, which the
 * catch below turned into "not locked". The first 40 characters (160 bits)
 * still pick out one email, and match rows that store the whole hash.
 */
const HASH_MATCH_CHARS = 40;

export function pinEmailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/** Failures at or before the last PIN reset no longer count toward any lock. */
function countedFailures(
  failures: number[],
  resetAt: number | null | undefined,
  now: number,
): number[] {
  return failures.filter((at) => now - at < DAY_MS && at > (resetAt ?? 0));
}

/**
 * Locked when there are 5 failures in the last 10 minutes since the last
 * success, or 20 failures in the last day regardless of successes. A new PIN
 * starts both counts again, so staff can always let a member back in.
 */
export function pinLockDecision(input: {
  failures: number[];
  lastSuccessAt: number | null;
  resetAt?: number | null;
  now: number;
}): boolean {
  const { failures, lastSuccessAt, resetAt, now } = input;
  const daily = countedFailures(failures, resetAt, now);
  if (daily.length >= MAX_FAILURES_PER_DAY) return true;
  const floor = Math.max(now - WINDOW_MS, lastSuccessAt ?? 0);
  return daily.filter((at) => at > floor).length >= MAX_FAILURES;
}

export type PinThrottleState = {
  locked: boolean;
  /**
   * Wrong PINs are still counting toward the short lock, whichever route or
   * Worker took them. A correct PIN must be recorded to clear them.
   */
  pendingFailures: boolean;
  /** When the last success or PIN reset was recorded, if any today. */
  clearedAt: number | null;
};

const UNKNOWN: PinThrottleState = {
  locked: false,
  pendingFailures: false,
  clearedAt: null,
};

export async function readPinThrottle(
  email: string,
  now = Date.now(),
): Promise<PinThrottleState> {
  try {
    const rows = await prisma.auditEvent.findMany({
      where: {
        action: { in: [PIN_FAILED_ACTION, PIN_OK_ACTION, PIN_SET_ACTION] },
        occurredAt: { gte: new Date(now - DAY_MS) },
        metadata: {
          contains: pinEmailHash(email).slice(0, HASH_MATCH_CHARS),
        },
      },
      select: { action: true, occurredAt: true },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
    const failures: number[] = [];
    let lastSuccessAt: number | null = null;
    let resetAt: number | null = null;
    for (const row of rows) {
      const at = row.occurredAt.getTime();
      if (row.action === PIN_FAILED_ACTION) failures.push(at);
      else if (row.action === PIN_SET_ACTION) resetAt = Math.max(resetAt ?? 0, at);
      else lastSuccessAt = Math.max(lastSuccessAt ?? 0, at);
    }
    const clearedAt =
      lastSuccessAt == null && resetAt == null
        ? null
        : Math.max(lastSuccessAt ?? 0, resetAt ?? 0);
    const floor = Math.max(now - WINDOW_MS, clearedAt ?? 0);
    return {
      locked: pinLockDecision({ failures, lastSuccessAt, resetAt, now }),
      pendingFailures: failures.some((at) => at > floor),
      clearedAt,
    };
  } catch (err) {
    // The in-memory limit still applies. A database hiccup must not lock
    // every member out of the shop PCs.
    console.error("workstation pin throttle read", err);
    return UNKNOWN;
  }
}

async function record(
  action: string,
  input: {
    email: string;
    userId: string | null;
    /** Workstation id, or the name of the route that took the PIN. */
    entityId: string;
    now?: number;
  },
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        id: `audit_${randomBytes(8).toString("hex")}`,
        action,
        actorId: null,
        subjectUserId: input.userId,
        entityType: "workstation",
        entityId: input.entityId,
        metadata: JSON.stringify({
          workstationId: input.entityId,
          emailHash: pinEmailHash(input.email),
        }),
        occurredAt: new Date(input.now ?? Date.now()),
      },
    });
  } catch (err) {
    console.error("workstation pin throttle write", err);
  }
}

/** One wrong PIN. Never stores the email or the attempted PIN. */
export function recordPinFailure(input: {
  email: string;
  userId: string | null;
  entityId: string;
  now?: number;
}): Promise<void> {
  return record(PIN_FAILED_ACTION, input);
}

/** Marks a correct PIN so earlier typos stop counting toward the short lock. */
export function recordPinSuccess(input: {
  email: string;
  userId: string | null;
  entityId: string;
  now?: number;
}): Promise<void> {
  return record(PIN_OK_ACTION, input);
}

/**
 * Marks a new PIN, so every wrong PIN before it stops counting. Without this
 * a member who was locked out, by their own typos or by someone guessing at
 * their email, stayed locked after staff gave them a new PIN.
 */
export function recordPinSet(input: {
  email: string;
  userId: string | null;
  /** Which route set the PIN. */
  entityId: string;
  now?: number;
}): Promise<void> {
  return record(PIN_SET_ACTION, input);
}
