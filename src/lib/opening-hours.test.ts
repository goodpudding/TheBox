import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockDataProvider } from "./data/mock-provider";
import { loadFixtures } from "./data/load-fixtures";
import { OPENING_HOURS, openingHoursLines } from "./opening-hours";

/**
 * Tuesday to Friday 1 to 8 PM, Saturday 11 to 5, Sunday 11 to 4, closed on
 * Mondays. The lobby display, machine reservations and the published Hours
 * page all have to say the same thing.
 */
describe("opening hours", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("are the hours the makerspace keeps", () => {
    expect(openingHoursLines()).toEqual([
      "Sunday 11:00 AM – 4:00 PM",
      "Monday Closed",
      "Tuesday 1:00 – 8:00 PM",
      "Wednesday 1:00 – 8:00 PM",
      "Thursday 1:00 – 8:00 PM",
      "Friday 1:00 – 8:00 PM",
      "Saturday 11:00 AM – 5:00 PM",
    ]);
    expect(OPENING_HOURS[1]).toBeNull();
  });

  it("the Hours page shipped with the site lists the same hours", () => {
    const page = loadFixtures().contentPages.find((p) => p.slug === "hours")!;
    for (const line of openingHoursLines()) {
      expect(page.html).toContain(`<li>${line}</li>`);
    }
    expect(page.html.match(/<li>/g)).toHaveLength(7);
  });

  it("a migration puts the same hours on the live Hours page", () => {
    const dir = path.join(process.cwd(), "migrations");
    const sql = readdirSync(dir)
      .filter((name) => name.includes("opening_hours"))
      .map((name) => readFileSync(path.join(dir, name), "utf8"))
      .join("\n");
    for (const line of openingHoursLines()) {
      expect(sql).toContain(`<li>${line}</li>`);
    }
  });

  /** Which half-hour starts on a day can be booked, by Burien clock time. */
  async function bookable(day: string): Promise<string[]> {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T09:00:00-08:00"));
    const provider = createMockDataProvider("u-maya");
    const slots = await provider.getMachineAvailability("m-bambu-a1", day, day);
    return slots
      .filter((s) => s.reason !== "closed" && s.reason !== "past")
      .filter(
        (s) =>
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Los_Angeles",
          }).format(new Date(s.startsAt)) === day,
      )
      .map((s) =>
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "America/Los_Angeles",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(s.startsAt)),
      );
  }

  it("no machine can be reserved on a Monday", async () => {
    expect(await bookable("2026-11-23")).toEqual([]);
  });

  it("a weekday can be reserved from 1 PM to 8 PM", async () => {
    const tuesday = await bookable("2026-11-24");
    expect(tuesday[0]).toBe("13:00");
    expect(tuesday.at(-1)).toBe("19:30");
  });

  it("Saturday runs 11 to 5 and Sunday 11 to 4", async () => {
    const saturday = await bookable("2026-11-28");
    expect([saturday[0], saturday.at(-1)]).toEqual(["11:00", "16:30"]);
    const sunday = await bookable("2026-11-29");
    expect([sunday[0], sunday.at(-1)]).toEqual(["11:00", "15:30"]);
  });
});
