import { describe, expect, it } from "vitest";
import { idleAction } from "./idle";

const MIN = 60_000;
const limits = { idleLockMinutes: 10, idleLogoutMinutes: 30 };

describe("idleAction", () => {
  it("does nothing while the member is active", () => {
    expect(idleAction(0, limits)).toBeNull();
    expect(idleAction(10 * MIN - 1, limits)).toBeNull();
  });

  it("locks the desk once the lock time is reached", () => {
    expect(idleAction(10 * MIN, limits)).toBe("lock");
    expect(idleAction(30 * MIN - 1, limits)).toBe("lock");
  });

  it("logs out once the logout time is reached", () => {
    expect(idleAction(30 * MIN, limits)).toBe("logout");
    expect(idleAction(90 * MIN, limits)).toBe("logout");
  });

  it("logs out rather than locks when both times are the same", () => {
    expect(idleAction(5 * MIN, { idleLockMinutes: 5, idleLogoutMinutes: 5 })).toBe(
      "logout",
    );
  });
});
