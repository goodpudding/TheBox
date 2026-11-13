import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { action: string; occurredAt: Date; metadata: string };
const rows: Row[] = [];
const create = vi.fn(async (args: { data: Row }) => {
  rows.push(args.data);
  return args.data;
});
const findMany = vi.fn(
  async (args: {
    where: {
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
});

describe("durable PIN throttle", () => {
  beforeEach(() => {
    rows.length = 0;
    create.mockClear();
    findMany.mockClear();
  });

  it("locks an email after five recorded failures, across any desk", async () => {
    const { isPinLockedDurably, recordPinFailure } = await load();
    for (let i = 0; i < 4; i++) {
      await recordPinFailure({
        email: "Maya@Example.com",
        userId: "u-maya",
        entityId: "ws-pc-1",
        now: NOW + i,
      });
    }
    expect(await isPinLockedDurably("maya@example.com", NOW + 10)).toBe(false);
    await recordPinFailure({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "qr-approve",
      now: NOW + 5,
    });
    expect(await isPinLockedDurably(" maya@example.com ", NOW + 10)).toBe(true);
    expect(await isPinLockedDurably("other@example.com", NOW + 10)).toBe(false);
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
    const { isPinLockedDurably, recordPinFailure, recordPinSuccess } = await load();
    for (let i = 0; i < 5; i++) {
      await recordPinFailure({
        email: "maya@example.com",
        userId: "u-maya",
        entityId: "ws-pc-1",
        now: NOW + i,
      });
    }
    expect(await isPinLockedDurably("maya@example.com", NOW + 10)).toBe(true);
    await recordPinSuccess({
      email: "maya@example.com",
      userId: "u-maya",
      entityId: "ws-pc-1",
      now: NOW + 20,
    });
    expect(await isPinLockedDurably("maya@example.com", NOW + 30)).toBe(false);
  });

  it("fails open when the audit table cannot be read", async () => {
    const { isPinLockedDurably } = await load();
    findMany.mockRejectedValueOnce(new Error("D1 unavailable"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await isPinLockedDurably("maya@example.com", NOW)).toBe(false);
    spy.mockRestore();
  });
});
