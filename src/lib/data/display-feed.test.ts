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
