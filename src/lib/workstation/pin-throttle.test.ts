import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = {
  id: string;
  action: string;
  occurredAt: Date;
  metadata: string;
  subjectUserId: string | null;
};
const rows: Row[] = [];
const update = vi.fn(async (args: { where: { id: string }; data: { action: string } }) => {
  const row = rows.find((r) => r.id === args.where.id);
  if (!row) throw new Error("Record to update not found.");
  row.action = args.data.action;
  return row;
});
const remove = vi.fn(async (args: { where: { id: string } }) => {
  const index = rows.findIndex((r) => r.id === args.where.id);
  if (index < 0) throw new Error("Record to delete does not exist.");
  rows.splice(index, 1);
});
const deleteMany = vi.fn(
  async (args: {
    where: {
      OR: { action: string; subjectUserId?: null; occurredAt: { lt: Date } }[];
    };
  }) => {
    const before = rows.length;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const row = rows[i]!;
      const hit = args.where.OR.some(
        (rule) =>
          row.action === rule.action &&
          row.occurredAt < rule.occurredAt.lt &&
          (!("subjectUserId" in rule) || row.subjectUserId === null),
      );
      if (hit) rows.splice(i, 1);
    }
    return { count: before - rows.length };
  },
);
const create = vi.fn(async (args: { data: Row }) => {
  rows.push(args.data);
  return args.data;
});
const findMany = vi.fn(
  async (args: {
    where: {
      id?: { not: string };
      action: { in: string[] };
      occurredAt: { gte: Date };
      metadata: { contains: string };
    };
  }) => {
    // D1 refuses a LIKE pattern over 50 bytes, and `contains` becomes
    // LIKE '%value%'. Refuse it here too, or a too-long match passes these
    // tests and then fails on every read in production.
    if (Buffer.byteLength(`%${args.where.metadata.contains}%`) > 50) {
      throw new Error("D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR");
    }
    return rows
      .filter(
        (row) =>
          row.id !== args.where.id?.not &&
          args.where.action.in.includes(row.action) &&
          row.occurredAt >= args.where.occurredAt.gte &&
          row.metadata.includes(args.where.metadata.contains),
      )
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  },
);

vi.mock("@/lib/db", () => ({
  prisma: {
    auditEvent: {
      create: (args: { data: Row }) => create(args),
      findMany: (args: never) => findMany(args),
      update: (args: never) => update(args),
      delete: (args: never) => remove(args),
      deleteMany: (args: never) => deleteMany(args),
    },
  },
}));

const NOW = 1_800_000_000_000;
const MIN = 60_000;

async function load() {
  return import("./pin-throttle");
}

describe("pinLockDecision", () => {
  it("locks on the 5th failure inside ten minutes", async () => {
    const { pinLockDecision } = await load();
    const four = [1, 2, 3, 4].map((i) => NOW - i * MIN);
    expect(pinLockDecision({ failures: four, lastSuccessAt: null, now: NOW })).toBe(false);
    expect(
      pinLockDecision({ failures: [...four, NOW - 5 * MIN], lastSuccessAt: null, now: NOW }),
    ).toBe(true);
  });

  it("ignores failures older than the window", async () => {
    const { pinLockDecision } = await load();
    const old = [11, 12, 13, 14, 15].map((i) => NOW - i * MIN);
    expect(pinLockDecision({ failures: old, lastSuccessAt: null, now: NOW })).toBe(false);
  });

  it("a success resets the short window", async () => {
    const { pinLockDecision } = await load();
    const failures = [2, 3, 4, 5, 6].map((i) => NOW - i * MIN);
    expect(
      pinLockDecision({ failures, lastSuccessAt: NOW - 1 * MIN, now: NOW }),
    ).toBe(false);
  });

  it("locks after 20 failures in a day even when spread out, success or not", async () => {
    const { pinLockDecision } = await load();
    const failures = Array.from({ length: 20 }, (_, i) => NOW - (i + 1) * 30 * MIN);
    expect(
      pinLockDecision({ failures, lastSuccessAt: NOW - 1 * MIN, now: NOW }),
    ).toBe(true);
  });

  it("a PIN reset clears both the short lock and the daily lock", async () => {
    const { pinLockDecision } = await load();
    const recent = [2, 3, 4, 5, 6].map((i) => NOW - i * MIN);
    expect(
      pinLockDecision({ failures: recent, lastSuccessAt: null, resetAt: NOW - 1 * MIN, now: NOW }),
    ).toBe(false);
    const daily = Array.from({ length: 20 }, (_, i) => NOW - (i + 1) * 30 * MIN);
    expect(
      pinLockDecision({ failures: daily, lastSuccessAt: null, resetAt: NOW - 1 * MIN, now: NOW }),
    ).toBe(false);
  });

  it("failures after a PIN reset count again", async () => {
    const { pinLockDecision } = await load();
    const failures = [1, 2, 3, 4, 5].map((i) => NOW - i * MIN);
    expect(
      pinLockDecision({ failures, lastSuccessAt: null, resetAt: NOW - 6 * MIN, now: NOW }),
    ).toBe(true);
  });
});

describe("durable PIN throttle", () => {
  beforeEach(() => {
    rows.length = 0;
    create.mockClear();
    findMany.mockClear();
  });

  it("locks an email after five recorded failures, across any desk", async () => {
    const { readPinThrottle, recordPinFailure } = await load();
    for (let i = 0; i < 4; i++) {
      await recordPinFailure({
        email: "Maya@Example.com",
        userId: "u-maya",
        entityId: "ws-pc-1",
        now: NOW + i,
      });
    }
    expect((await readPinThrottle("maya@example.com", NOW + 10)).locked).toBe(false);
    await recordPinFailure({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "qr-approve",
      now: NOW + 5,
    });
    expect((await readPinThrottle(" maya@example.com ", NOW + 10)).locked).toBe(true);
    expect((await readPinThrottle("other@example.com", NOW + 10)).locked).toBe(false);
  });

  it("never stores the email or the attempted PIN", async () => {
    const { recordPinFailure } = await load();
    await recordPinFailure({
      email: "maya@example.com",
      userId: null,
      entityId: "ws-pc-1",
      now: NOW,
    });
    const stored = JSON.stringify(create.mock.calls[0]![0]);
    expect(stored).not.toContain("maya@example.com");
    expect(stored).toContain("workstation.pin_failed");
  });

  it("a recorded success clears the short lock", async () => {
    const { readPinThrottle, recordPinFailure, recordPinSuccess } = await load();
    for (let i = 0; i < 5; i++) {
      await recordPinFailure({
        email: "maya@example.com",
        userId: "u-maya",
        entityId: "ws-pc-1",
        now: NOW + i,
      });
    }
    expect((await readPinThrottle("maya@example.com", NOW + 10)).locked).toBe(true);
    await recordPinSuccess({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "ws-pc-1",
      now: NOW + 20,
    });
    expect((await readPinThrottle("maya@example.com", NOW + 30)).locked).toBe(false);
  });

  it("says when wrong PINs are still counting, so a sign-in knows to clear them", async () => {
    const { readPinThrottle, recordPinFailure, recordPinSuccess } = await load();
    expect((await readPinThrottle("maya@example.com", NOW)).pendingFailures).toBe(false);
    await recordPinFailure({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "qr-approve",
      now: NOW,
    });
    expect((await readPinThrottle("maya@example.com", NOW + 10)).pendingFailures).toBe(true);
    await recordPinSuccess({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "ws-pc-1",
      now: NOW + 20,
    });
    const after = await readPinThrottle("maya@example.com", NOW + 30);
    expect(after.pendingFailures).toBe(false);
    expect(after.clearedAt).toBe(NOW + 20);
    // Past the short window a success changes nothing, so none is needed.
    await recordPinFailure({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "ws-pc-1",
      now: NOW + 40,
    });
    expect(
      (await readPinThrottle("maya@example.com", NOW + 40 + 11 * MIN)).pendingFailures,
    ).toBe(false);
  });

  it("a new PIN lifts the daily lock for that email only", async () => {
    const { readPinThrottle, recordPinFailure, recordPinSet } = await load();
    for (const email of ["maya@example.com", "jordan@example.com"]) {
      for (let i = 0; i < 20; i++) {
        await recordPinFailure({
          email,
          userId: null,
          entityId: "qr-approve",
          now: NOW + i * 30 * MIN,
        });
      }
    }
    const later = NOW + 20 * 30 * MIN;
    expect((await readPinThrottle("maya@example.com", later)).locked).toBe(true);
    await recordPinSet({
      email: " Maya@Example.com ",
      userId: "u-maya",
      entityId: "staff-reset",
      now: later + 1,
    });
    const lifted = await readPinThrottle("maya@example.com", later + 2);
    expect(lifted.locked).toBe(false);
    expect(lifted.clearedAt).toBe(later + 1);
    expect((await readPinThrottle("jordan@example.com", later + 2)).locked).toBe(true);
  });

  it("fails open when the audit table cannot be read", async () => {
    const { readPinThrottle } = await load();
    findMany.mockRejectedValueOnce(new Error("D1 unavailable"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await readPinThrottle("maya@example.com", NOW)).locked).toBe(false);
    spy.mockRestore();
  });
});

describe("PIN attempts written before the PIN is checked", () => {
  const who = { email: "maya@example.com", userId: "u-maya", entityId: "ws-pc-1" };

  beforeEach(() => {
    rows.length = 0;
  });

  it("counts toward the lock while the request is in flight, then stops", async () => {
    const { readPinThrottle, recordPinFailure, reservePinAttempt } = await load();
    for (let i = 0; i < 4; i++) await recordPinFailure({ ...who, now: NOW + i });
    await reservePinAttempt({ ...who, now: NOW + 10 });
    // Another request sees it: four wrong PINs and one being checked.
    expect((await readPinThrottle(who.email, NOW + 20)).locked).toBe(true);
    // Left behind (the request died, or its clean-up failed), it expires.
    expect((await readPinThrottle(who.email, NOW + 31_000)).locked).toBe(false);
  });

  it("is not a wrong PIN until it is confirmed as one", async () => {
    const { readPinThrottle, reservePinAttempt, confirmPinFailure } = await load();
    const id = await reservePinAttempt({ ...who, now: NOW });
    expect(id).toBeTruthy();
    // Someone signing in at the same moment is not a typo to clear.
    expect((await readPinThrottle(who.email, NOW + 5)).pendingFailures).toBe(false);
    await confirmPinFailure(id!);
    expect(rows[0]?.action).toBe("workstation.pin_failed");
    expect((await readPinThrottle(who.email, NOW + 60_000)).pendingFailures).toBe(true);
  });

  it("never reaches the daily count when left behind", async () => {
    const { readPinThrottle, reservePinAttempt } = await load();
    for (let i = 0; i < 25; i++) await reservePinAttempt({ ...who, now: NOW + i });
    expect((await readPinThrottle(who.email, NOW + 60_000)).locked).toBe(false);
  });

  it("a failed clean-up does not throw", async () => {
    const { removePinAttempt, confirmPinFailure } = await load();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(removePinAttempt("audit_gone")).resolves.toBeUndefined();
    await expect(confirmPinFailure("audit_gone")).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("prunePinRows", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("drops day-old wrong PINs for emails nobody has, and stale attempts, and keeps members' rows", async () => {
    const { prunePinRows, recordPinFailure, reservePinAttempt } = await load();
    const DAY = 24 * 60 * MIN;
    const old = NOW - DAY - MIN;
    await recordPinFailure({ email: "made-up-1@example.com", userId: null, entityId: "ws", now: old });
    await recordPinFailure({ email: "made-up-2@example.com", userId: null, entityId: "ws", now: NOW - MIN });
    await recordPinFailure({ email: "maya@example.com", userId: "u-maya", entityId: "ws", now: old });
    await reservePinAttempt({ email: "maya@example.com", userId: "u-maya", entityId: "ws", now: old });
    await reservePinAttempt({ email: "maya@example.com", userId: "u-maya", entityId: "ws", now: NOW - 1000 });

    const removed = await prunePinRows(NOW);
    expect(removed).toBe(2);
    expect(rows.map((row) => `${row.action}:${row.subjectUserId}:${row.occurredAt.getTime() === old}`)).toEqual([
      "workstation.pin_failed:null:false",
      "workstation.pin_failed:u-maya:true",
      "workstation.pin_attempt:u-maya:false",
    ]);
  });

  it("reports nothing removed when the database refuses", async () => {
    const { prunePinRows } = await load();
    deleteMany.mockRejectedValueOnce(new Error("D1 unavailable"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await prunePinRows(NOW)).toBe(0);
    spy.mockRestore();
  });
});
