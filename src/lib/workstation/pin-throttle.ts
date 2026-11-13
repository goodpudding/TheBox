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

/**
 * Locked when there are 5 failures in the last 10 minutes since the last
 * success, or 20 failures in the last day regardless of successes.
 */
export function pinLockDecision(input: {
  failures: number[];
  lastSuccessAt: number | null;
  now: number;
}): boolean {
  const { failures, lastSuccessAt, now } = input;
  const daily = failures.filter((at) => now - at < DAY_MS);
  if (daily.length >= MAX_FAILURES_PER_DAY) return true;
  const floor = Math.max(now - WINDOW_MS, lastSuccessAt ?? 0);
  return daily.filter((at) => at > floor).length >= MAX_FAILURES;
}

export async function isPinLockedDurably(
  email: string,
  now = Date.now(),
): Promise<boolean> {
  try {
    const rows = await prisma.auditEvent.findMany({
      where: {
        action: { in: [PIN_FAILED_ACTION, PIN_OK_ACTION] },
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
    for (const row of rows) {
      const at = row.occurredAt.getTime();
      if (row.action === PIN_FAILED_ACTION) failures.push(at);
      else if (lastSuccessAt == null || at > lastSuccessAt) lastSuccessAt = at;
    }
    return pinLockDecision({ failures, lastSuccessAt, now });
  } catch (err) {
    // The in-memory limit still applies. A database hiccup must not lock
    // every member out of the shop PCs.
    console.error("workstation pin throttle read", err);
    return false;
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
