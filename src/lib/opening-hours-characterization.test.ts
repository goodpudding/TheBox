import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockDataProvider } from "./data/mock-provider";

/**
 * What the opening hours did on the day they moved from a constant in the
 * code to a setting staff edit. Written against the constant, before any of
 * the code that reads the hours was touched, and not edited since: with
 * nothing changed in Admin → Settings, the lobby display and the hours a
 * machine can be reserved in must come out exactly as they did.
 */
describe("opening hours, as they were in the code", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" });

  /** Sunday 22 to Saturday 28 November 2026. */
  const WEEK = [
    "2026-11-22",
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
    "2026-11-27",
    "2026-11-28",
  ];

  it("the half-hour starts a machine can be reserved for, day by day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T09:00:00-08:00"));
    const provider = createMockDataProvider("u-maya");
    const week: Record<string, string> = {};
    for (const day of WEEK) {
      const slots = await provider.getMachineAvailability("m-bambu-a1", day, day);
      const open = slots
        .filter((s) => s.reason !== "closed" && s.reason !== "past")
        .filter((s) => date.format(new Date(s.startsAt)) === day)
        .map((s) => time.format(new Date(s.startsAt)));
      week[day] = open.length ? `${open[0]} to ${open.at(-1)} (${open.length} starts)` : "none";
    }
    expect(week).toMatchInlineSnapshot(`
      {
        "2026-11-22": "11:00 to 15:30 (10 starts)",
        "2026-11-23": "none",
        "2026-11-24": "13:00 to 19:30 (14 starts)",
        "2026-11-25": "13:00 to 19:30 (14 starts)",
        "2026-11-26": "13:00 to 19:30 (14 starts)",
        "2026-11-27": "13:00 to 19:30 (14 starts)",
        "2026-11-28": "11:00 to 16:30 (12 starts)",
      }
    `);
  });

  it("what the lobby display says through the week", async () => {
    const moments = [
      "2026-11-22T10:59:00-08:00",
      "2026-11-22T11:00:00-08:00",
      "2026-11-22T15:59:00-08:00",
      "2026-11-22T16:00:00-08:00",
      "2026-11-23T14:00:00-08:00",
      "2026-11-24T12:59:00-08:00",
      "2026-11-24T13:00:00-08:00",
      "2026-11-24T19:59:00-08:00",
      "2026-11-24T20:00:00-08:00",
      "2026-11-25T17:00:00-08:00",
      "2026-11-26T08:00:00-08:00",
      "2026-11-27T19:30:00-08:00",
      "2026-11-28T10:30:00-08:00",
      "2026-11-28T11:00:00-08:00",
      "2026-11-28T16:59:00-08:00",
      "2026-11-28T17:00:00-08:00",
    ];
    const seen: Record<string, string> = {};
    for (const moment of moments) {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(moment));
      const feed = await createMockDataProvider(null).getDisplayFeed();
      seen[moment.slice(0, 16)] = [
        feed.isOpen ? "open" : "shut",
        feed.hours.label,
        feed.hours.closed ? "closed day" : `${feed.hours.openHour}-${feed.hours.closeHour}`,
      ].join(" | ");
      vi.useRealTimers();
    }
    expect(seen).toMatchInlineSnapshot(`
      {
        "2026-11-22T10:59": "shut | Sunday 11:00 AM – 4:00 PM | 11-16",
        "2026-11-22T11:00": "open | Sunday 11:00 AM – 4:00 PM | 11-16",
        "2026-11-22T15:59": "open | Sunday 11:00 AM – 4:00 PM | 11-16",
        "2026-11-22T16:00": "shut | Sunday 11:00 AM – 4:00 PM | 11-16",
        "2026-11-23T14:00": "shut | Monday · Closed | closed day",
        "2026-11-24T12:59": "shut | Tuesday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-24T13:00": "open | Tuesday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-24T19:59": "open | Tuesday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-24T20:00": "shut | Tuesday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-25T17:00": "open | Wednesday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-26T08:00": "shut | Thursday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-27T19:30": "open | Friday 1:00 PM – 8:00 PM | 13-20",
        "2026-11-28T10:30": "shut | Saturday 11:00 AM – 5:00 PM | 11-17",
        "2026-11-28T11:00": "open | Saturday 11:00 AM – 5:00 PM | 11-17",
        "2026-11-28T16:59": "open | Saturday 11:00 AM – 5:00 PM | 11-17",
        "2026-11-28T17:00": "shut | Saturday 11:00 AM – 5:00 PM | 11-17",
      }
    `);
  });

  it("which reservations the shop's hours allow", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T09:00:00-08:00"));
    const attempts: Array<[string, string, string]> = [
      ["Tuesday, inside", "2026-11-24T13:00:00-08:00", "2026-11-24T14:00:00-08:00"],
      ["Tuesday, starts before opening", "2026-11-24T12:30:00-08:00", "2026-11-24T13:30:00-08:00"],
      ["Tuesday, ends at closing", "2026-11-24T19:00:00-08:00", "2026-11-24T20:00:00-08:00"],
      ["Tuesday, runs past closing", "2026-11-24T19:30:00-08:00", "2026-11-24T20:30:00-08:00"],
      ["Monday", "2026-11-23T14:00:00-08:00", "2026-11-23T15:00:00-08:00"],
      ["Saturday, ends at closing", "2026-11-28T16:00:00-08:00", "2026-11-28T17:00:00-08:00"],
      ["Saturday, runs past closing", "2026-11-28T16:30:00-08:00", "2026-11-28T17:30:00-08:00"],
      ["Sunday, before opening", "2026-11-22T10:00:00-08:00", "2026-11-22T11:00:00-08:00"],
      ["Sunday, last hour", "2026-11-29T15:00:00-08:00", "2026-11-29T16:00:00-08:00"],
    ];
    const outcome: Record<string, string> = {};
    for (const [label, startsAt, endsAt] of attempts) {
      const provider = createMockDataProvider("u-maya");
      try {
        await provider.reserve({
          userId: "u-maya",
          createdById: "u-maya",
          machineId: "m-bambu-a1",
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        });
        outcome[label] = "booked";
      } catch (err) {
        outcome[label] = err instanceof Error ? err.message : "refused";
      }
    }
    expect(outcome).toMatchInlineSnapshot(`
      {
        "Monday": "Reservation is outside opening hours",
        "Saturday, ends at closing": "booked",
        "Saturday, runs past closing": "Reservation is outside opening hours",
        "Sunday, before opening": "Reservation is outside opening hours",
        "Sunday, last hour": "booked",
        "Tuesday, ends at closing": "booked",
        "Tuesday, inside": "booked",
        "Tuesday, runs past closing": "Reservation is outside opening hours",
        "Tuesday, starts before opening": "Reservation is outside opening hours",
      }
    `);
  });
});
