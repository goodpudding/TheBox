import { describe, expect, it } from "vitest";
import { fitDurationSlots } from "./reservation-duration";

describe("fitDurationSlots", () => {
  it("keeps a length that still fits the open run", () => {
    expect(fitDurationSlots(1, 4)).toBe(1);
    expect(fitDurationSlots(3, 4)).toBe(3);
    expect(fitDurationSlots(4, 4)).toBe(4);
  });

  it("falls back to an hour, or less if that is all there is, when the length no longer fits", () => {
    expect(fitDurationSlots(6, 4)).toBe(2);
    expect(fitDurationSlots(3, 2)).toBe(2);
    expect(fitDurationSlots(2, 1)).toBe(1);
  });

  it("never goes below one slot", () => {
    expect(fitDurationSlots(0, 3)).toBe(1);
  });

  it("leaves the length alone when no start time can be booked", () => {
    expect(fitDurationSlots(5, 0)).toBe(5);
  });
});
