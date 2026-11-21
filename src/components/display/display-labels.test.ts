import { describe, expect, it } from "vitest";
import {
  dateBlock,
  longDayLabel,
  priceLabel,
  timeRangeLabel,
} from "./display-parts";

describe("event slide labels", () => {
  it("writes an event's day in full and as a date block, in Burien's time", () => {
    // 02:00 UTC on the 16th is Tuesday evening the 15th in Burien.
    expect(longDayLabel("2026-12-16T02:00:00.000Z")).toBe("Tuesday, December 15");
    expect(dateBlock("2026-12-16T02:00:00.000Z")).toEqual(["TUE", "Dec 15"]);
  });

  it("writes a time range once with AM or PM when both ends share it", () => {
    expect(
      timeRangeLabel("2026-12-16T02:00:00.000Z", "2026-12-16T04:00:00.000Z"),
    ).toBe("6:00 – 8:00 PM");
    expect(
      timeRangeLabel("2026-12-15T19:00:00.000Z", "2026-12-15T21:30:00.000Z"),
    ).toBe("11:00 AM – 1:30 PM");
  });

  it("gives only the start when an event has no real end", () => {
    expect(
      timeRangeLabel("2026-12-16T02:00:00.000Z", "2026-12-16T02:00:00.000Z"),
    ).toBe("6:00 PM");
  });

  it("writes prices without needless cents", () => {
    expect(priceLabel(6500)).toBe("$65");
    expect(priceLabel(1250)).toBe("$12.50");
  });
});
