import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstUser = vi.fn();
const readPinThrottle = vi.fn();
const recordPinFailure = vi.fn();
const reservePinAttempt = vi.fn();
const confirmPinFailure = vi.fn();
const recordPinSuccess = vi.fn();
const removePinAttempt = vi.fn();
const verifyKioskPin = vi.fn();

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: (args: unknown) => findFirstUser(args) },
  },
}));
vi.mock("./pin-throttle", () => ({
  readPinThrottle: (...args: unknown[]) => readPinThrottle(...args),
  recordPinFailure: (...args: unknown[]) => recordPinFailure(...args),
  reservePinAttempt: (...args: unknown[]) => reservePinAttempt(...args),
  confirmPinFailure: (...args: unknown[]) => confirmPinFailure(...args),
  recordPinSuccess: (...args: unknown[]) => recordPinSuccess(...args),
  removePinAttempt: (...args: unknown[]) => removePinAttempt(...args),
}));
vi.mock("./pin", async () => {
  const actual = await vi.importActual<typeof import("./pin")>("./pin");
  return {
    ...actual,
    verifyKioskPin: (...args: unknown[]) => verifyKioskPin(...args),
  };
});

const CLEAN = { locked: false, pendingFailures: false, clearedAt: null };
const MAYA = { id: "u-maya", email: "maya@example.com", kioskPinHash: "scrypt:aa:bb" };

async function status(run: () => Promise<unknown>): Promise<number | "ok"> {
  try {
    await run();
    return "ok";
  } catch (err) {
    return (err as { status?: number }).status ?? -1;
  }
}

describe("verifyPinLogin", () => {
  beforeEach(async () => {
    findFirstUser.mockReset();
    readPinThrottle.mockReset();
    recordPinFailure.mockReset();
    reservePinAttempt.mockReset();
    confirmPinFailure.mockReset();
    recordPinSuccess.mockReset();
    removePinAttempt.mockReset();
    verifyKioskPin.mockReset();
    readPinThrottle.mockResolvedValue(CLEAN);
    // The attempt is written down before the PIN is looked at.
    reservePinAttempt.mockResolvedValue("audit_reserved");
    const { resetPinAttemptStore } = await import("./pin-attempts");
    resetPinAttemptStore();
  });

  it("returns the member when the PIN matches", async () => {
    const { verifyPinLogin } = await import("./server");
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(true);
    const user = await verifyPinLogin({
      email: " Maya@Example.com ",
      pin: "4821",
      scope: "qr-approve",
    });
    expect(user.id).toBe("u-maya");
    // The attempt was written down first, then taken back: nothing is left.
    expect(reservePinAttempt).toHaveBeenCalledTimes(1);
    expect(removePinAttempt).toHaveBeenCalledWith("audit_reserved");
    expect(confirmPinFailure).not.toHaveBeenCalled();
    expect(readPinThrottle).toHaveBeenCalledWith("maya@example.com", {
      excludeId: "audit_reserved",
    });
    // A clean sign-in leaves no success marker either.
    expect(recordPinSuccess).not.toHaveBeenCalled();
  });

  it("records the success when the database still counts wrong PINs this process never saw", async () => {
    const { verifyPinLogin } = await import("./server");
    readPinThrottle.mockResolvedValue({ ...CLEAN, pendingFailures: true });
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(true);
    await verifyPinLogin({ email: MAYA.email, pin: "4821", scope: "ws-pc-1" });
    expect(recordPinSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ email: MAYA.email, userId: "u-maya", entityId: "ws-pc-1" }),
    );
  });

  it("records a failure and answers 401 for a wrong PIN", async () => {
    const { verifyPinLogin } = await import("./server");
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(false);
    expect(
      await status(() =>
        verifyPinLogin({ email: MAYA.email, pin: "0001", scope: "qr-approve" }),
      ),
    ).toBe(401);
    expect(reservePinAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        email: MAYA.email,
        userId: "u-maya",
        entityId: "qr-approve",
      }),
    );
    // A wrong PIN turns the attempt into the failure record.
    expect(confirmPinFailure).toHaveBeenCalledWith("audit_reserved");
    expect(removePinAttempt).not.toHaveBeenCalled();
  });

  it("writes the attempt down before it looks at the PIN", async () => {
    const { verifyPinLogin } = await import("./server");
    const order: string[] = [];
    findFirstUser.mockResolvedValue(MAYA);
    reservePinAttempt.mockImplementation(async () => {
      order.push("record");
      return "audit_reserved";
    });
    readPinThrottle.mockImplementation(async () => {
      order.push("read");
      return CLEAN;
    });
    verifyKioskPin.mockImplementation(async () => {
      order.push("verify");
      return false;
    });
    await status(() => verifyPinLogin({ email: MAYA.email, pin: "0001", scope: "ws-pc-1" }));
    expect(order).toEqual(["record", "read", "verify"]);
  });

  it("still checks the PIN when the attempt could not be written", async () => {
    const { verifyPinLogin } = await import("./server");
    reservePinAttempt.mockResolvedValue(null);
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(true);
    const user = await verifyPinLogin({ email: MAYA.email, pin: "4821", scope: "ws-pc-1" });
    expect(user.id).toBe("u-maya");
    expect(removePinAttempt).not.toHaveBeenCalled();
  });

  it("still records a wrong PIN when the attempt could not be written first", async () => {
    const { verifyPinLogin } = await import("./server");
    reservePinAttempt.mockResolvedValue(null);
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(false);
    expect(
      await status(() => verifyPinLogin({ email: MAYA.email, pin: "0001", scope: "ws-pc-1" })),
    ).toBe(401);
    expect(recordPinFailure).toHaveBeenCalledWith(
      expect.objectContaining({ email: MAYA.email, userId: "u-maya", entityId: "ws-pc-1" }),
    );
  });

  it("a burst in one process gets five tries when the audit table cannot be read or written", async () => {
    const { verifyPinLogin } = await import("./server");
    // Database down: no row written, nothing read back. This process's own
    // count is then the only limit.
    reservePinAttempt.mockResolvedValue(null);
    readPinThrottle.mockResolvedValue(CLEAN);
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockImplementation(async (pin: string) => pin === "4821");
    const pins = Array.from({ length: 49 }, (_, i) => String(1000 + i));
    pins.push("4821");
    const results = await Promise.all(
      pins.map((pin) =>
        status(() => verifyPinLogin({ email: MAYA.email, pin, scope: "qr-approve" })),
      ),
    );
    // Counted before the PIN is looked at, with no await in between.
    expect(verifyKioskPin).toHaveBeenCalledTimes(5);
    expect(results.filter((s) => s === 401)).toHaveLength(5);
    expect(results.filter((s) => s === 429)).toHaveLength(45);
    expect(results).not.toContain("ok");
  });

  it("gives an unknown email the same 401 and still counts the attempt", async () => {
    const { verifyPinLogin } = await import("./server");
    findFirstUser.mockResolvedValue(null);
    expect(
      await status(() =>
        verifyPinLogin({ email: "nobody@example.com", pin: "4821", scope: "ws-pc-1" }),
      ),
    ).toBe(401);
    expect(reservePinAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nobody@example.com", userId: null }),
    );
  });

  it("answers 429 without checking the PIN once the email is locked", async () => {
    const { verifyPinLogin } = await import("./server");
    readPinThrottle.mockResolvedValue({ ...CLEAN, locked: true });
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(true);
    expect(
      await status(() =>
        verifyPinLogin({ email: MAYA.email, pin: "4821", scope: "qr-approve" }),
      ),
    ).toBe(429);
    expect(verifyKioskPin).not.toHaveBeenCalled();
    // A refused attempt is not counted.
    expect(removePinAttempt).toHaveBeenCalledWith("audit_reserved");
  });

  it("locks the phone-approval path after five wrong PINs in this process", async () => {
    const { verifyPinLogin } = await import("./server");
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(false);
    for (let i = 0; i < 5; i++) {
      expect(
        await status(() =>
          verifyPinLogin({ email: MAYA.email, pin: "0001", scope: "qr-approve" }),
        ),
      ).toBe(401);
    }
    verifyKioskPin.mockResolvedValue(true);
    expect(
      await status(() =>
        verifyPinLogin({ email: MAYA.email, pin: "4821", scope: "qr-approve" }),
      ),
    ).toBe(429);
  });

  it("authenticatePin goes through the same limit", async () => {
    const { authenticatePin } = await import("./server");
    readPinThrottle.mockResolvedValue({ ...CLEAN, locked: true });
    expect(await status(() => authenticatePin(MAYA.email, "4821"))).toBe(429);
  });
});
