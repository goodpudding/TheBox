import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstUser = vi.fn();
const isPinLockedDurably = vi.fn();
const recordPinFailure = vi.fn();
const recordPinSuccess = vi.fn();
const verifyKioskPin = vi.fn();

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: (args: unknown) => findFirstUser(args) },
  },
}));
vi.mock("./pin-throttle", () => ({
  isPinLockedDurably: (...args: unknown[]) => isPinLockedDurably(...args),
  recordPinFailure: (...args: unknown[]) => recordPinFailure(...args),
  recordPinSuccess: (...args: unknown[]) => recordPinSuccess(...args),
}));
vi.mock("./pin", async () => {
  const actual = await vi.importActual<typeof import("./pin")>("./pin");
  return {
    ...actual,
    verifyKioskPin: (...args: unknown[]) => verifyKioskPin(...args),
  };
});

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
    isPinLockedDurably.mockReset();
    recordPinFailure.mockReset();
    recordPinSuccess.mockReset();
    verifyKioskPin.mockReset();
    isPinLockedDurably.mockResolvedValue(false);
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
    expect(recordPinFailure).not.toHaveBeenCalled();
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
    expect(recordPinFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        email: MAYA.email,
        userId: "u-maya",
        entityId: "qr-approve",
      }),
    );
  });

  it("gives an unknown email the same 401 and still counts the attempt", async () => {
    const { verifyPinLogin } = await import("./server");
    findFirstUser.mockResolvedValue(null);
    expect(
      await status(() =>
        verifyPinLogin({ email: "nobody@example.com", pin: "4821", scope: "ws-pc-1" }),
      ),
    ).toBe(401);
    expect(recordPinFailure).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nobody@example.com", userId: null }),
    );
  });

  it("answers 429 without checking the PIN once the email is locked", async () => {
    const { verifyPinLogin } = await import("./server");
    isPinLockedDurably.mockResolvedValue(true);
    findFirstUser.mockResolvedValue(MAYA);
    verifyKioskPin.mockResolvedValue(true);
    expect(
      await status(() =>
        verifyPinLogin({ email: MAYA.email, pin: "4821", scope: "qr-approve" }),
      ),
    ).toBe(429);
    expect(verifyKioskPin).not.toHaveBeenCalled();
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
    isPinLockedDurably.mockResolvedValue(true);
    expect(await status(() => authenticatePin(MAYA.email, "4821"))).toBe(429);
  });
});
