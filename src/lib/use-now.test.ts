import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW_TICK_MS, readNow, subscribeToNow } from "./use-now";

// A tick boundary, so the arithmetic below is easy to follow.
const T0 = 1_800_000_000_000 - (1_800_000_000_000 % NOW_TICK_MS);

describe("the shared clock behind useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: T0 + 10_000 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the same value for the whole tick, then moves on", () => {
    expect(readNow()).toBe(T0);
    vi.setSystemTime(T0 + NOW_TICK_MS - 1);
    expect(readNow()).toBe(T0);
    vi.setSystemTime(T0 + NOW_TICK_MS);
    expect(readNow()).toBe(T0 + NOW_TICK_MS);
  });

  it("tells a listener at each tick boundary", () => {
    const seen: number[] = [];
    const stop = subscribeToNow(() => seen.push(readNow()));

    vi.advanceTimersByTime(NOW_TICK_MS - 10_000 - 1);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual([T0 + NOW_TICK_MS]);
    vi.advanceTimersByTime(NOW_TICK_MS);
    expect(seen).toEqual([T0 + NOW_TICK_MS, T0 + 2 * NOW_TICK_MS]);

    stop();
  });

  it("leaves no timer behind once the listener is gone", () => {
    const listener = vi.fn();
    const stop = subscribeToNow(listener);
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(3 * NOW_TICK_MS);
    expect(listener).not.toHaveBeenCalled();
  });
});
