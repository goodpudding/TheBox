import { describe, expect, it } from "vitest";
import { isIdleFor, overrunMinutes, summarizeSamples } from "./metering";

const laser = { idleWatts: 15, activeWatts: 60, minEventSeconds: 30 };
const sawgrass = { idleWatts: 8, activeWatts: 20, minEventSeconds: 45 };

function series(spec: Array<[seconds: number, watts: number]>) {
  const out = [];
  let t = 0;
  for (const [sec, w] of spec) {
    for (let i = 0; i < sec; i++) out.push({ atMs: (t + i) * 1000, watts: w });
    t += sec;
  }
  return out;
}

describe("summarizeSamples", () => {
  it("counts active seconds above activeWatts", () => {
    const s = summarizeSamples(series([[60, 5], [600, 300], [60, 5]]), laser);
    expect(Math.round(s.activeSeconds)).toBe(600);
    expect(s.events).toBe(1);
  });
  it("counts Sawgrass prints as separate events and ignores blips", () => {
    const s = summarizeSamples(
      series([[30, 5], [90, 40], [20, 5], [120, 40], [10, 40], [5, 5], [10, 40], [30, 5]]),
      sawgrass,
    );
    expect(s.events).toBe(2); // 90 s and 120+10 s prints; the 10 s blip is dropped
  });
});

describe("isIdleFor", () => {
  it("is true after 60 s below idle", () => {
    expect(isIdleFor(series([[300, 300], [61, 5]]), laser, 60)).toBe(true);
  });
  it("is false while still cutting", () => {
    expect(isIdleFor(series([[300, 300], [20, 5], [5, 300]]), laser, 60)).toBe(false);
  });
});

describe("overrunMinutes", () => {
  it("ignores small overruns", () => {
    expect(overrunMinutes(30, 36 * 60)).toBe(0); // 36 ≤ 33+5
  });
  it("bills the overrun rounded to 5", () => {
    expect(overrunMinutes(30, 52 * 60)).toBe(25); // 22 over → 25
  });
});
