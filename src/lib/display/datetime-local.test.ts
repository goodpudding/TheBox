import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "./datetime-local";

/**
 * The promo form's date boxes show and take the clock time where the staff
 * member is. Burien is 8 hours behind UTC in winter and 7 in summer.
 */
describe("promo form dates", () => {
  const before = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    process.env.TZ = before;
  });

  it("shows a stored time as the local clock time", () => {
    expect(toLocalInput("2026-11-21T20:00:00.000Z")).toBe("2026-11-21T12:00");
    expect(toLocalInput(new Date("2026-07-04T19:30:00.000Z"))).toBe(
      "2026-07-04T12:30",
    );
  });

  it("reads a typed local time back as the same moment", () => {
    expect(fromLocalInput("2026-11-21T12:00")).toBe("2026-11-21T20:00:00.000Z");
    expect(fromLocalInput("2026-07-04T12:30")).toBe("2026-07-04T19:30:00.000Z");
  });

  it("does not move a promo's dates when it is opened and saved unchanged", () => {
    for (const stored of [
      "2026-11-21T20:00:00.000Z",
      "2026-12-01T07:00:00.000Z",
      "2027-03-14T10:30:00.000Z",
    ]) {
      expect(fromLocalInput(toLocalInput(stored))).toBe(stored);
    }
  });

  it("a promo made now has already started", () => {
    const now = new Date("2026-11-21T20:17:45.000Z");
    expect(new Date(fromLocalInput(toLocalInput(now))).getTime()).toBeLessThanOrEqual(
      now.getTime(),
    );
  });
});
