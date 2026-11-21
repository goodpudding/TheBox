import { describe, expect, it } from "vitest";
import { dayLabel, pageOf, spotsLabel, timeLabel } from "./display-parts";

describe("pageOf", () => {
  const seventeen = Array.from({ length: 17 }, (_, i) => i);

  it("splits a long list into even screens", () => {
    expect(pageOf(seventeen, 9, 0)).toMatchObject({ page: 0, pages: 2 });
    expect(pageOf(seventeen, 9, 0).items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pageOf(seventeen, 9, 1).items).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("comes back to the first screen after the last", () => {
    expect(pageOf(seventeen, 9, 2).page).toBe(0);
    expect(pageOf(seventeen, 9, 5).page).toBe(1);
  });

  it("shows everything on one screen when it fits, and copes with none", () => {
    expect(pageOf([1, 2, 3], 9, 4)).toEqual({ items: [1, 2, 3], page: 0, pages: 1 });
    expect(pageOf([], 9, 3)).toEqual({ items: [], page: 0, pages: 1 });
  });

  it("never drops an item between screens", () => {
    for (let n = 0; n <= 40; n++) {
      const list = Array.from({ length: n }, (_, i) => i);
      const { pages } = pageOf(list, 9, 0);
      const seen = Array.from({ length: pages }, (_, turn) =>
        pageOf(list, 9, turn).items,
      ).flat();
      expect(seen).toEqual(list);
      for (let turn = 0; turn < pages; turn++) {
        expect(pageOf(list, 9, turn).items.length).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe("display labels", () => {
  it("writes times and days in Burien's time zone", () => {
    expect(timeLabel("2026-11-22T21:00:00.000Z")).toBe("1:00 PM");
    // 02:00 UTC on the 25th is still the evening of the 24th in Burien.
    expect(dayLabel("2026-11-25T02:00:00.000Z")).toBe("Tue Nov 24");
  });

  it("says how many spots are left", () => {
    expect(spotsLabel(8)).toBe("8 spots left");
    expect(spotsLabel(1)).toBe("1 spot left");
    expect(spotsLabel(0)).toBe("Full");
  });
});
