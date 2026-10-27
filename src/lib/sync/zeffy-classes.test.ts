import { describe, expect, it } from "vitest";
import type { ZeffyCampaign } from "@/lib/zeffy/types";
import {
  capacityFromRates,
  lowestPriceCents,
  planClassSync,
  type ClassSyncRow,
} from "@/lib/sync/zeffy-classes";

const NOW = new Date("2026-11-01T18:00:00.000Z");
const DAY = 24 * 60 * 60;

function campaign(partial: Partial<ZeffyCampaign> & Pick<ZeffyCampaign, "id" | "title">): ZeffyCampaign {
  return {
    object: "campaign",
    type: "ticketing",
    category: "Event",
    status: "active",
    description: "",
    url: `https://www.zeffy.com/en-US/ticketing/${partial.id}`,
    is_archived: false,
    start_date: Math.floor(NOW.getTime() / 1000) + DAY,
    end_date: Math.floor(NOW.getTime() / 1000) + DAY + 7200,
    ...partial,
  };
}

function row(partial: Partial<ClassSyncRow> & Pick<ClassSyncRow, "id">): ClassSyncRow {
  return {
    title: "Old",
    slug: "old",
    descriptionSlug: "class-generic",
    category: "workshop",
    instructorId: "u-admin",
    startsAt: NOW.toISOString(),
    endsAt: NOW.toISOString(),
    capacity: 8,
    priceCents: 1000,
    zeffyUrl: null,
    zeffyCampaignId: null,
    zeffyOccurrenceId: null,
    source: "zeffy",
    location: "The Box",
    published: true,
    cancelledAt: null,
    staffEditedFields: null,
    prerequisiteCertificationIds: [],
    cancellationCutoffHours: null,
    ...partial,
  };
}

describe("planClassSync", () => {
  it("derives price and capacity from rates", () => {
    expect(
      lowestPriceCents([
        { id: "a", title: "Free", amount: 0, currency: "usd" },
        { id: "b", title: "Paid", amount: 3500, currency: "usd" },
        { id: "c", title: "Higher", amount: 5000, currency: "usd", is_add_on: true },
      ]),
    ).toBe(3500);
    expect(
      capacityFromRates(
        [
          { id: "a", title: "A", amount: 0, currency: "usd", seats: 4 },
          { id: "b", title: "B", amount: 100, currency: "usd", seats: 6 },
        ],
        8,
      ),
    ).toBe(10);
    expect(capacityFromRates([], 8)).toBe(8);
  });

  it("creates one row for a single date, two for occurrences, and a free class", () => {
    const plan = planClassSync({
      now: NOW,
      defaultInstructorId: "u-admin",
      defaultCapacity: 8,
      existing: [],
      campaigns: [
        campaign({ id: "single", title: "Lathe night" }),
        campaign({
          id: "board",
          title: "Cutting Board",
          occurrences: [
            { id: "day1", start: NOW.getTime() / 1000 + DAY, end: NOW.getTime() / 1000 + DAY + 3600, is_archived: false },
            { id: "day2", start: NOW.getTime() / 1000 + 2 * DAY, end: NOW.getTime() / 1000 + 2 * DAY + 3600, is_archived: false },
          ],
        }),
        campaign({
          id: "free",
          title: "Open shop",
          rates: [{ id: "r", title: "RSVP", amount: 0, currency: "usd", seats: 20 }],
        }),
      ],
    });

    expect(plan.created).toBe(4);
    const free = plan.upserts.find((item) => item.fields.zeffyCampaignId === "free");
    expect(free?.fields.priceCents).toBe(0);
    expect(free?.fields.category).toBe("open_studio");
    expect(free?.fields.capacity).toBe(20);
    expect(
      plan.upserts.filter((item) => item.fields.zeffyCampaignId === "board"),
    ).toHaveLength(2);
  });

  it("cancels a zeffy row whose campaign disappeared and ignores csv and admin rows", () => {
    const plan = planClassSync({
      now: NOW,
      defaultInstructorId: "u-admin",
      defaultCapacity: 8,
      existing: [
        row({
          id: "gone",
          zeffyCampaignId: "missing",
          zeffyOccurrenceId: "default",
          endsAt: new Date(NOW.getTime() + DAY * 1000).toISOString(),
        }),
        row({
          id: "archived",
          zeffyCampaignId: "still",
          zeffyOccurrenceId: "default",
        }),
        row({ id: "csv", source: "csv", zeffyCampaignId: null }),
        row({ id: "admin", source: "admin", title: "Closure" }),
      ],
      campaigns: [campaign({ id: "still", title: "Still happening", is_archived: true })],
    });

    expect(plan.cancelIds).toEqual(["gone"]);
    expect(plan.upserts.map((item) => item.id)).toEqual(["archived"]);
    expect(plan.upserts[0]?.fields.cancelledAt).toBeTruthy();
    expect(plan.upserts.some((item) => item.id === "csv" || item.id === "admin")).toBe(false);
  });

  it("does not import a past occurrence and cancels one that already ended", () => {
    const plan = planClassSync({
      now: NOW,
      defaultInstructorId: "u-admin",
      defaultCapacity: 8,
      existing: [
        row({
          id: "past",
          title: "Painting with Paul",
          zeffyCampaignId: "paul",
          zeffyOccurrenceId: "jan",
          endsAt: "2026-01-28T22:00:00.000Z",
        }),
      ],
      campaigns: [
        campaign({
          id: "paul",
          title: "Painting with Paul",
          occurrences: [
            {
              id: "jan",
              start: Date.parse("2026-01-28T20:00:00.000Z") / 1000,
              end: Date.parse("2026-01-28T22:00:00.000Z") / 1000,
              is_archived: false,
            },
            {
              id: "nov",
              start: Date.parse("2026-11-10T20:00:00.000Z") / 1000,
              end: Date.parse("2026-11-10T22:00:00.000Z") / 1000,
              is_archived: false,
            },
          ],
        }),
      ],
    });

    expect(plan.cancelIds).toEqual(["past"]);
    expect(plan.created).toBe(1);
    expect(plan.upserts[0]?.fields.zeffyOccurrenceId).toBe("nov");
  });

  it("keeps staff-edited fields", () => {
    const plan = planClassSync({
      now: NOW,
      defaultInstructorId: "u-admin",
      defaultCapacity: 8,
      existing: [
        row({
          id: "kept",
          title: "Staff title",
          instructorId: "u-teacher",
          zeffyCampaignId: "single",
          zeffyOccurrenceId: "default",
          staffEditedFields: ["title", "instructorId"],
        }),
      ],
      campaigns: [campaign({ id: "single", title: "Zeffy title" })],
    });

    expect(plan.updated).toBe(1);
    expect(plan.upserts[0]?.fields.title).toBe("Staff title");
    expect(plan.upserts[0]?.fields.instructorId).toBe("u-teacher");
    expect(plan.upserts[0]?.fields.zeffyUrl).toContain("single");
  });
});
