import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { loadFixtures } from "./data/load-fixtures";
import {
  DEFAULT_OPENING_HOURS,
  checkedOpeningHours,
  normalizeOpeningHours,
  openingHoursLines,
  timeLabel,
} from "./opening-hours";

/**
 * Tuesday to Friday 1 to 8 PM, Saturday 11 to 5, Sunday 11 to 4, closed on
 * Mondays, until staff save other hours under Admin → Settings. The lobby
 * display, machine reservations and the hours members read all come from the
 * same stored week; see opening-hours-admin.test.ts for that.
 */
describe("opening hours", () => {
  it("start as the hours the makerspace keeps", () => {
    expect(openingHoursLines(DEFAULT_OPENING_HOURS)).toEqual([
      "Sunday 11:00 AM – 4:00 PM",
      "Monday Closed",
      "Tuesday 1:00 – 8:00 PM",
      "Wednesday 1:00 – 8:00 PM",
      "Thursday 1:00 – 8:00 PM",
      "Friday 1:00 – 8:00 PM",
      "Saturday 11:00 AM – 5:00 PM",
    ]);
    expect(DEFAULT_OPENING_HOURS[1]).toBeNull();
    expect(loadFixtures().openingHours).toEqual(DEFAULT_OPENING_HOURS);
  });

  it("write a half hour the way a clock shows it", () => {
    expect(timeLabel(10 * 60 + 30)).toBe("10:30 AM");
    expect(timeLabel(12 * 60)).toBe("12:00 PM");
    expect(timeLabel(24 * 60)).toBe("12:00 AM");
    const week = DEFAULT_OPENING_HOURS.map((day, i) =>
      i === 1 ? { open: 10 * 60 + 30, close: 14 * 60 + 30 } : day,
    );
    expect(openingHoursLines(week)[1]).toBe("Monday 10:30 AM – 2:30 PM");
  });

  it("the Hours page no longer repeats the week, so it cannot disagree with it", () => {
    const page = loadFixtures().contentPages.find((p) => p.slug === "hours")!;
    expect(page.html).not.toMatch(/Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday/);
    expect(page.html).toContain("Holiday closures");
  });
});

describe("hours read back from the database", () => {
  it("take the default for a day that is damaged, and only that day", () => {
    const stored = [
      { open: 600, close: 900 },
      null,
      { open: "noon", close: 1200 },
      { open: 900, close: 600 },
      { open: 615, close: 900 },
      undefined,
      { open: 0, close: 1440 },
    ];
    expect(normalizeOpeningHours(stored)).toEqual([
      { open: 600, close: 900 },
      null,
      DEFAULT_OPENING_HOURS[2],
      DEFAULT_OPENING_HOURS[3],
      DEFAULT_OPENING_HOURS[4],
      DEFAULT_OPENING_HOURS[5],
      { open: 0, close: 1440 },
    ]);
  });

  it("are the default week when nothing usable is stored", () => {
    for (const stored of [null, undefined, "closed", {}, [], [null, null]]) {
      expect(normalizeOpeningHours(stored)).toEqual(DEFAULT_OPENING_HOURS);
    }
  });
});

describe("hours staff try to save", () => {
  const week = () => DEFAULT_OPENING_HOURS.map((d) => (d ? { ...d } : null));

  it("are refused in plain words when they make no sense", () => {
    const closesFirst = week();
    closesFirst[2] = { open: 20 * 60, close: 13 * 60 };
    expect(() => checkedOpeningHours(closesFirst)).toThrow(
      "Tuesday closes before it opens. Set the closing time after the opening time.",
    );
    const oddMinute = week();
    oddMinute[3] = { open: 13 * 60 + 10, close: 20 * 60 };
    expect(() => checkedOpeningHours(oddMinute)).toThrow(
      "Wednesday: use times on the hour or the half hour.",
    );
    const pastMidnight = week();
    pastMidnight[6] = { open: 11 * 60, close: 25 * 60 };
    expect(() => checkedOpeningHours(pastMidnight)).toThrow(/Saturday/);
    expect(() => checkedOpeningHours([null, null, null, null, null, null, null])).toThrow(
      "Leave at least one day open. For a holiday closure, add a note on the Hours page instead.",
    );
    expect(() => checkedOpeningHours(week().slice(0, 5))).toThrow("Send all seven days.");
    expect(() => checkedOpeningHours("always")).toThrow("Send all seven days.");
  });

  it("are kept as sent when they are fine", () => {
    const fine = week();
    fine[1] = { open: 10 * 60 + 30, close: 14 * 60 };
    fine[0] = null;
    expect(checkedOpeningHours(fine)).toEqual(fine);
  });
});

describe("the migration that takes the week off the live Hours page", () => {
  function hoursPageAfter(html: string): string {
    const db = new DatabaseSync(":memory:");
    db.exec('CREATE TABLE "ContentPage" ("slug" TEXT PRIMARY KEY, "html" TEXT, "updatedAt" TEXT)');
    db.prepare('INSERT INTO "ContentPage" ("slug", "html", "updatedAt") VALUES (?, ?, ?)').run(
      "hours",
      html,
      "2026-11-21T00:00:00.000Z",
    );
    const dir = path.join(process.cwd(), "migrations");
    db.exec(readFileSync(path.join(dir, "0022_hours_page_notes.sql"), "utf8"));
    return String(
      (db.prepare('SELECT "html" FROM "ContentPage" WHERE "slug" = ?').get("hours") as { html: string }).html,
    );
  }

  /** What migration 0013 wrote, which is what the live page holds. */
  const live = /SET "html" = '([^']+)'/.exec(
    readFileSync(path.join(process.cwd(), "migrations", "0013_opening_hours.sql"), "utf8"),
  )![1]!;

  it("leaves the note and drops the list of days", () => {
    expect(hoursPageAfter(live)).toBe(
      "<p>Holiday closures and special events are posted at the shop and on the Discover Burien calendar.</p>",
    );
  });

  it("does not touch a page staff have rewritten", () => {
    const rewritten = "<p>Closed 24 to 26 December.</p><ul><li>Sunday 12 to 4</li></ul>";
    expect(hoursPageAfter(rewritten)).toBe(rewritten);
  });
});
