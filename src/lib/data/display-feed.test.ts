import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockDataProvider } from "./mock-provider";

/**
 * Which promo slides the lobby display shows on a given day. The clock is
 * pinned because the fixture promos have fixed dates: the browser test that
 * used to check this against today's date would have started failing on
 * 1 December 2026, when the holiday promo begins.
 */
async function promoIdsOn(isoDate: string): Promise<string[]> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(isoDate));
  const feed = await createMockDataProvider(null).getDisplayFeed();
  return feed.promos.map((promo) => promo.id);
}

describe("lobby display promos", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows running promos and leaves out ones that have ended", async () => {
    const ids = await promoIdsOn("2026-11-14T12:00:00-08:00");
    expect(ids).toContain("promo-welcome");
    expect(ids).not.toContain("promo-expired-summer");
    expect(ids).not.toContain("promo-expired-old");
  });

  it("holds a promo back until its start date", async () => {
    expect(await promoIdsOn("2026-11-30T23:00:00-07:00")).not.toContain(
      "promo-future-holiday",
    );
    expect(await promoIdsOn("2026-12-01T00:00:01-07:00")).toContain(
      "promo-future-holiday",
    );
  });

  it("drops a promo at its end date", async () => {
    expect(await promoIdsOn("2027-01-14T23:59:00-07:00")).toContain(
      "promo-future-holiday",
    );
    expect(await promoIdsOn("2027-01-15T00:00:00-07:00")).not.toContain(
      "promo-future-holiday",
    );
  });
});

/**
 * Whether the display says the shop is open. The makerspace is closed on
 * Mondays; the other days' hours are [open, close) in Burien's time.
 */
describe("lobby display opening hours", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function feedAt(isoDate: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(isoDate));
    return createMockDataProvider(null).getDisplayFeed();
  }

  it("is closed all day on a Monday", async () => {
    // Monday 23 November 2026, 5 PM in Burien.
    const feed = await feedAt("2026-11-23T17:00:00-08:00");
    expect(feed.isOpen).toBe(false);
    expect(feed.hours.closed).toBe(true);
    expect(feed.hours.label).toBe("Monday · Closed");
  });

  it("is open on a weekday from 1 PM to 8 PM", async () => {
    const evening = await feedAt("2026-11-24T17:00:00-08:00");
    expect(evening.isOpen).toBe(true);
    expect(evening.hours.closed).toBe(false);
    expect(evening.hours.label).toBe("Tuesday 1:00 PM – 8:00 PM");
    expect((await feedAt("2026-11-24T12:59:00-08:00")).isOpen).toBe(false);
    expect((await feedAt("2026-11-24T13:00:00-08:00")).isOpen).toBe(true);
    expect((await feedAt("2026-11-24T20:00:00-08:00")).isOpen).toBe(false);
  });

  it("closes at 5 on Saturday and at 4 on Sunday", async () => {
    expect((await feedAt("2026-11-28T16:59:00-08:00")).isOpen).toBe(true);
    expect((await feedAt("2026-11-28T17:00:00-08:00")).isOpen).toBe(false);
    expect((await feedAt("2026-11-29T15:59:00-08:00")).isOpen).toBe(true);
    expect((await feedAt("2026-11-29T16:00:00-08:00")).isOpen).toBe(false);
    expect((await feedAt("2026-11-29T10:59:00-08:00")).isOpen).toBe(false);
  });
});
