import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The attempt limit end to end: the real counters and the real audit rows,
 * with only the database and the PIN hash check replaced.
 */

type Row = { id: string; action: string; occurredAt: Date; metadata: string };
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
      delete: async (args: { where: { id: string } }) => {
        const index = rows.findIndex((row) => row.id === args.where.id);
        if (index >= 0) rows.splice(index, 1);
      },
      findMany: async (args: {
        where: {
          id?: { not: string };
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
              row.id !== args.where.id?.not &&
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

  /** Many guesses sent at the same moment, the right PIN among them. */
  async function burst(scopeFor: (i: number) => string): Promise<number[]> {
    vi.setSystemTime(clock + 1000);
    const { verifyPinLogin } = await import("./server");
    const pins = Array.from({ length: 49 }, (_, i) => String(1000 + i));
    pins.push(RIGHT_PIN);
    return Promise.all(
      pins.map((pin, i) =>
        verifyPinLogin({ email: JORDAN.email, pin, scope: scopeFor(i) }).then(
          () => 200,
          (err: { status?: number }) => err.status ?? -1,
        ),
      ),
    );
  }

  it("guesses sent all at once still get five tries at most", async () => {
    const results = await burst(() => "qr-approve");
    expect(results.filter((status) => status === 401).length).toBeLessThanOrEqual(5);
    expect(results).not.toContain(200);
    expect(results.every((status) => status === 401 || status === 429)).toBe(true);
    expect(
      rows.filter((row) => row.action === "workstation.pin_failed").length,
    ).toBeLessThanOrEqual(5);
  });

  it("the same holds when every guess lands on a different desk or Worker", async () => {
    // A scope of its own per request means this process's counter cannot
    // help: only the database count stands between the burst and the PIN.
    const results = await burst((i) => `ws-${i}`);
    expect(results.filter((status) => status === 401).length).toBeLessThanOrEqual(5);
    expect(results).not.toContain(200);
    expect(
      rows.filter((row) => row.action === "workstation.pin_failed").length,
    ).toBeLessThanOrEqual(5);
  });

  it("a refused attempt is not counted, so the lock does not feed itself", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await attempt("ws-pc-1", "0001")).toBe(401);
    }
    for (let i = 0; i < 10; i++) {
      expect(await attempt("ws-pc-1", "0001")).toBe(429);
    }
    expect(rows.filter((row) => row.action === "workstation.pin_failed")).toHaveLength(5);
  });
});
