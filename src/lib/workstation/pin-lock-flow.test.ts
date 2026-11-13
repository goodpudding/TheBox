import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The attempt limit end to end: the real counters and the real audit rows,
 * with only the database and the PIN hash check replaced.
 */

type Row = { action: string; occurredAt: Date; metadata: string };
const rows: Row[] = [];
const RIGHT_PIN = "4821";
const JORDAN = {
  id: "u-jordan",
  email: "jordan@example.com",
  kioskPinHash: "scrypt:aa:bb",
};

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: async (args: { where: { email: string } }) =>
        args.where.email === JORDAN.email ? JORDAN : null,
    },
    auditEvent: {
      create: async (args: { data: Row }) => {
        rows.push(args.data);
        return args.data;
      },
      findMany: async (args: {
        where: {
          action: { in: string[] };
          occurredAt: { gte: Date };
          metadata: { contains: string };
        };
      }) => {
        // Same limit as D1: see pin-throttle.test.ts.
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
    },
  },
}));
vi.mock("./pin", async () => {
  const actual = await vi.importActual<typeof import("./pin")>("./pin");
  return { ...actual, verifyKioskPin: async (pin: string) => pin === RIGHT_PIN };
});

const START = 1_800_000_000_000;
const MIN = 60_000;
let clock = START;

/** Each attempt happens one second after the last. */
async function attempt(scope: string, pin: string): Promise<number> {
  clock += 1000;
  vi.setSystemTime(clock);
  const { verifyPinLogin } = await import("./server");
  try {
    await verifyPinLogin({ email: JORDAN.email, pin, scope });
    return 200;
  } catch (err) {
    return (err as { status?: number }).status ?? -1;
  }
}

async function setNewPin() {
  clock += 1000;
  vi.setSystemTime(clock);
  const { recordPinSet } = await import("./pin-throttle");
  await recordPinSet({ email: JORDAN.email, userId: JORDAN.id, entityId: "staff-reset" });
}

describe("PIN lock across routes and resets", () => {
  beforeEach(async () => {
    rows.length = 0;
    clock = START;
    vi.useFakeTimers({ toFake: ["Date"] });
    const { resetPinAttemptStore } = await import("./pin-attempts");
    resetPinAttemptStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a sign-in at the desk clears wrong PINs typed on the phone page", async () => {
    for (let i = 0; i < 4; i++) {
      expect(await attempt("qr-approve", "0001")).toBe(401);
    }
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(200);
    expect(await attempt("ws-pc-1", "0001")).toBe(401);
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(200);
    // The phone page starts from a clean count too.
    expect(await attempt("qr-approve", "0001")).toBe(401);
    expect(await attempt("qr-approve", RIGHT_PIN)).toBe(200);
  });

  it("a sign-in with no wrong PINs before it writes nothing", async () => {
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(200);
    expect(rows).toHaveLength(0);
  });

  it("a new PIN lifts the short lock at the desk that earned it", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await attempt("ws-pc-1", "0001")).toBe(401);
    }
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(429);
    await setNewPin();
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(200);
  });

  it("a new PIN lifts the daily lock, and wrong PINs after it count again", async () => {
    // Four bursts of five, far enough apart that the short lock has passed.
    for (let burst = 0; burst < 4; burst++) {
      for (let i = 0; i < 5; i++) {
        expect(await attempt("qr-approve", "0001")).toBe(401);
      }
      clock += 11 * MIN;
    }
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(429);
    await setNewPin();
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(200);
    for (let i = 0; i < 5; i++) {
      expect(await attempt("ws-pc-1", "0001")).toBe(401);
    }
    expect(await attempt("ws-pc-1", RIGHT_PIN)).toBe(429);
  });
});
