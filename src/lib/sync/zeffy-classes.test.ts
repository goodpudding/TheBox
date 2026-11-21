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
    location: "Discover Burien Makerspace",
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

  it("leaves a class staff cancelled alone, and takes over again once they restore it", () => {
    const base = {
      now: NOW,
      defaultInstructorId: "u-admin",
      defaultCapacity: 8,
      campaigns: [campaign({ id: "single", title: "Still on in Zeffy" })],
    };
    const cancelledAt = "2026-10-30T18:00:00.000Z";
    // Admin → Classes → Cancel this class marks the field as staff-owned.
    const staffCancelled = planClassSync({
      ...base,
      existing: [
        row({
          id: "cancelled-by-staff",
          zeffyCampaignId: "single",
          zeffyOccurrenceId: "default",
          cancelledAt,
          staffEditedFields: ["cancelledAt"],
        }),
      ],
    });
    expect(staffCancelled.upserts[0]?.fields.cancelledAt).toBe(cancelledAt);
    expect(staffCancelled.cancelIds).toEqual([]);

    // Restoring clears both, so Zeffy decides again.
    const restored = planClassSync({
      ...base,
      existing: [
        row({
          id: "restored",
          zeffyCampaignId: "single",
          zeffyOccurrenceId: "default",
          cancelledAt: null,
          staffEditedFields: null,
        }),
      ],
    });
    expect(restored.upserts[0]?.fields.cancelledAt).toBeNull();
  });
});

/**
 * What an event is about is written once, on its Zeffy page. The pull copies
 * it across so the site and the lobby display can show it.
 */
describe("event descriptions from Zeffy", () => {
  const plan = (campaigns: ZeffyCampaign[], existing: ClassSyncRow[] = []) =>
    planClassSync({
      campaigns,
      existing,
      now: NOW,
      defaultInstructorId: "u-admin",
      defaultCapacity: 8,
    });

  it("gives a class the description written on its Zeffy page", () => {
    const result = plan([
      campaign({
        id: "camp-repair",
        title: "Repair Café",
        description: "<p>Bring something broken. Volunteers help you fix it.</p>",
      }),
    ]);
    expect(result.descriptions).toEqual([
      {
        slug: "class-zeffy-camp-repair",
        title: "Repair Café",
        html: "<p>Bring something broken. Volunteers help you fix it.</p>",
      },
    ]);
    expect(result.upserts[0]!.fields.descriptionSlug).toBe("class-zeffy-camp-repair");
  });

  it("gives every date of a repeating event the one description", () => {
    const start = Math.floor(NOW.getTime() / 1000) + DAY;
    const result = plan([
      campaign({
        id: "camp-paint",
        title: "Painting with Paul",
        description: "<p>A relaxed painting hour.</p>",
        occurrences: [
          { id: "o1", start, end: start + 3600, is_archived: false },
          { id: "o2", start: start + 7 * DAY, end: start + 7 * DAY + 3600, is_archived: false },
        ],
      }),
    ]);
    expect(result.descriptions).toHaveLength(1);
    expect(result.upserts.map((u) => u.fields.descriptionSlug)).toEqual([
      "class-zeffy-camp-paint",
      "class-zeffy-camp-paint",
    ]);
  });

  it("moves a class already on the site from the general wording to its own", () => {
    const result = plan(
      [campaign({ id: "camp-1", title: "Dovetails", description: "<p>Cut by hand.</p>" })],
      [row({ id: "class_1", zeffyCampaignId: "camp-1", zeffyOccurrenceId: "default" })],
    );
    expect(result.upserts[0]!.fields.descriptionSlug).toBe("class-zeffy-camp-1");
  });

  it("keeps a description staff wrote on the site", () => {
    const result = plan(
      [campaign({ id: "camp-1", title: "Dovetails", description: "<p>From Zeffy.</p>" })],
      [
        row({
          id: "class_1",
          zeffyCampaignId: "camp-1",
          zeffyOccurrenceId: "default",
          descriptionSlug: "class-description-class-1",
          staffEditedFields: ["descriptionSlug"],
        }),
      ],
    );
    expect(result.upserts[0]!.fields.descriptionSlug).toBe("class-description-class-1");
  });

  it("leaves a class on the general wording when Zeffy has nothing written", () => {
    for (const description of ["", "   ", "<p></p>", "<p>&nbsp;</p>"]) {
      const result = plan([campaign({ id: "camp-1", title: "Dovetails", description })]);
      expect(result.descriptions).toEqual([]);
      expect(result.upserts[0]!.fields.descriptionSlug).toBe("class-generic");
    }
  });

  it("goes back to the general wording when the Zeffy description is removed", () => {
    const result = plan(
      [campaign({ id: "camp-1", title: "Dovetails", description: "" })],
      [
        row({
          id: "class_1",
          zeffyCampaignId: "camp-1",
          zeffyOccurrenceId: "default",
          descriptionSlug: "class-zeffy-camp-1",
        }),
      ],
    );
    expect(result.upserts[0]!.fields.descriptionSlug).toBe("class-generic");
  });

  it("keeps only safe formatting from what Zeffy sends", () => {
    const result = plan([
      campaign({
        id: "camp-1",
        title: "Dovetails",
        description:
          '<p onclick="x()">Hand tools <strong>only</strong>.</p><script>alert(1)</script><iframe src="https://evil.example"></iframe>',
      }),
    ]);
    const html = result.descriptions[0]!.html;
    expect(html).toContain("<strong>only</strong>");
    expect(html).not.toMatch(/script|iframe|onclick/i);
  });

  it("turns plain text with blank lines into paragraphs", () => {
    const result = plan([
      campaign({
        id: "camp-1",
        title: "Dovetails",
        description: "Bring a mug & a friend.\n\nAll materials provided.",
      }),
    ]);
    expect(result.descriptions[0]!.html).toBe(
      "<p>Bring a mug &amp; a friend.</p><p>All materials provided.</p>",
    );
  });

  it("writes nothing for an event it is not listing", () => {
    const result = plan([
      campaign({
        id: "camp-old",
        title: "Long gone",
        description: "<p>Past.</p>",
        start_date: Math.floor(NOW.getTime() / 1000) - 90 * DAY,
        end_date: Math.floor(NOW.getTime() / 1000) - 90 * DAY + 3600,
      }),
    ]);
    expect(result.descriptions).toEqual([]);
  });
});

