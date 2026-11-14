import { describe, expect, it } from "vitest";
import {
  hasStarted,
  isHappeningNow,
  isStillAhead,
  upcomingByStart,
} from "./time-window";

const START = "2026-09-08T17:00:00-07:00";
const END = "2026-09-08T19:00:00-07:00";
const at = (iso: string) => new Date(iso).getTime();

describe("isHappeningNow", () => {
  it("is true from the start up to, not including, the end", () => {
    expect(isHappeningNow(START, END, at("2026-09-08T16:59:59-07:00"))).toBe(false);
    expect(isHappeningNow(START, END, at(START))).toBe(true);
    expect(isHappeningNow(START, END, at("2026-09-08T18:59:59-07:00"))).toBe(true);
    expect(isHappeningNow(START, END, at(END))).toBe(false);
  });

  it("is false while the time is not known yet", () => {
    expect(isHappeningNow(START, END, null)).toBe(false);
  });
});

describe("isStillAhead", () => {
  it("is true only strictly before the moment", () => {
    expect(isStillAhead(START, at("2026-09-08T16:59:59-07:00"))).toBe(true);
    expect(isStillAhead(START, at(START))).toBe(false);
    expect(isStillAhead(START, at(END))).toBe(false);
  });

  it("is false while the time is not known yet", () => {
    expect(isStillAhead(START, null)).toBe(false);
  });
});

describe("hasStarted", () => {
  it("is true only strictly after the moment", () => {
    expect(hasStarted(START, at("2026-09-08T16:59:59-07:00"))).toBe(false);
    expect(hasStarted(START, at(START))).toBe(false);
    expect(hasStarted(START, at("2026-09-08T17:00:01-07:00"))).toBe(true);
  });

  it("is false while the time is not known yet", () => {
    expect(hasStarted(START, null)).toBe(false);
  });
});

describe("upcomingByStart", () => {
  const sessions = [
    { id: "late", startsAt: "2026-11-06T18:00:00-08:00" },
    { id: "gone", startsAt: "2026-11-03T18:00:00-08:00" },
    { id: "soon", startsAt: "2026-11-05T10:00:00-08:00" },
    { id: "starting", startsAt: "2026-11-04T14:00:00-08:00" },
  ];

  it("keeps sessions starting now or later, soonest first", () => {
    const now = at("2026-11-04T14:00:00-08:00");
    expect(upcomingByStart(sessions, now).map((s) => s.id)).toEqual([
      "starting",
      "soon",
      "late",
    ]);
  });

  it("does not reorder the list it was given", () => {
    upcomingByStart(sessions, at("2026-11-01T00:00:00-08:00"));
    expect(sessions[0]!.id).toBe("late");
  });

  it("lists nothing while the time is not known yet", () => {
    expect(upcomingByStart(sessions, null)).toEqual([]);
  });
});
