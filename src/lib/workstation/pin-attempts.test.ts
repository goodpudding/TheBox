import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPinAttempts,
  isPinAttemptLocked,
  recordFailedPinAttempt,
  resetPinAttemptStore,
} from "./pin-attempts";

describe("workstation PIN attempt limit", () => {
  beforeEach(() => {
    resetPinAttemptStore();
  });

  it("locks after 5 failures so the next attempt is rejected, then a success clears it", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 4; i++) {
      recordFailedPinAttempt("ws-pc-1", "maya@example.com", now + i);
      expect(isPinAttemptLocked("ws-pc-1", "maya@example.com", now + i)).toBe(
        false,
      );
    }
    recordFailedPinAttempt("ws-pc-1", "maya@example.com", now + 4);
    expect(isPinAttemptLocked("ws-pc-1", "maya@example.com", now + 5)).toBe(
      true,
    );
    expect(
      isPinAttemptLocked("ws-pc-1", "other@example.com", now + 5),
    ).toBe(false);

    clearPinAttempts("ws-pc-1", "maya@example.com");
    expect(isPinAttemptLocked("ws-pc-1", "maya@example.com", now + 5)).toBe(
      false,
    );
  });
});
