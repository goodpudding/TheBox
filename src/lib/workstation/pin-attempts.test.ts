import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPinAttempts,
  forgetPinAttemptsBefore,
  hasPinFailures,
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

  it("forgets a lock and failures from before a recorded success or reset, not later ones", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 5; i++) {
      recordFailedPinAttempt("ws-pc-1", "maya@example.com", now + i);
    }
    // A reset older than the failures changes nothing.
    forgetPinAttemptsBefore("ws-pc-1", "maya@example.com", now - 1, now + 5);
    expect(isPinAttemptLocked("ws-pc-1", "maya@example.com", now + 5)).toBe(true);

    forgetPinAttemptsBefore("ws-pc-1", "maya@example.com", now + 10, now + 20);
    expect(isPinAttemptLocked("ws-pc-1", "maya@example.com", now + 20)).toBe(false);
    expect(hasPinFailures("ws-pc-1", "maya@example.com", now + 20)).toBe(false);

    recordFailedPinAttempt("ws-pc-1", "maya@example.com", now + 30);
    forgetPinAttemptsBefore("ws-pc-1", "maya@example.com", now + 10, now + 40);
    expect(hasPinFailures("ws-pc-1", "maya@example.com", now + 40)).toBe(true);
  });
});
