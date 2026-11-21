import { describe, expect, it } from "vitest";
import { buildDisplayFeed } from "./display-feed";
import { loadFixtures } from "./load-fixtures";
import type { ClassSession, ContentPage } from "./types";

const NOW = new Date("2026-11-21T20:00:00.000Z"); // Saturday noon in Burien
const DAY = 24 * 3600_000;

function session(
  id: string,
  title: string,
  daysAhead: number,
  patch: Partial<ClassSession> = {},
): ClassSession {
  const startsAt = new Date(NOW.getTime() + daysAhead * DAY).toISOString();
  return {
    id,
    title,
    slug: id,
    descriptionSlug: "class-generic",
    category: "workshop",
    instructorId: "u-admin",
    startsAt,
    endsAt: new Date(NOW.getTime() + daysAhead * DAY + 2 * 3600_000).toISOString(),
    capacity: 8,
    priceCents: 5000,
    zeffyUrl: `https://www.zeffy.com/ticketing/${id}`,
    prerequisiteCertificationIds: [],
    location: "611 SW 152nd St, Burien, WA",
    cancellationCutoffHours: null,
    published: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...patch,
  };
}

function page(slug: string, html: string, patch: Partial<ContentPage> = {}): ContentPage {
  return {
    id: `content-${slug}`,
    slug,
    title: slug,
    html,
    category: "class",
    version: "1",
    published: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...patch,
  };
}

function feed(classSessions: ClassSession[], contentPages: ContentPage[] = []) {
  const fixtures = loadFixtures();
  return buildDisplayFeed({
    now: NOW,
    machines: [],
    usageSessions: [],
    reservations: [],
    maintenanceBlocks: [],
    classSessions,
    bookings: [],
    users: [],
    certifications: [],
    learningModules: [],
    membershipProducts: [],
    promoSlides: [],
    displayConfig: fixtures.displayConfig,
    contentPages,
  });
}

describe("lobby display event spotlight", () => {
  it("lists the next three weeks of events, soonest first, with what each is about", () => {
    const result = feed(
      [
        session("c2", "Stained Glass Ornaments", 9, { descriptionSlug: "class-zeffy-glass" }),
        session("c1", "Repair Café", 3, {
          category: "open_studio",
          priceCents: 0,
          descriptionSlug: "class-zeffy-repair",
        }),
      ],
      [
        page(
          "class-zeffy-repair",
          "<p>Bring something broken.</p>\n<p>Volunteers help you <strong>fix</strong> it &amp; keep it going.</p>",
        ),
        page("class-zeffy-glass", "<p>Make two ornaments.</p>"),
      ],
    );
    expect(result.spotlight.map((e) => e.title)).toEqual([
      "Repair Café",
      "Stained Glass Ornaments",
    ]);
    expect(result.spotlight[0]).toMatchObject({
      id: "c1",
      category: "open_studio",
      priceCents: 0,
      spotsRemaining: 8,
      bookingUrl: "https://www.zeffy.com/ticketing/c1",
      description:
        "Bring something broken. Volunteers help you fix it & keep it going.",
    });
  });

  it("has no description for a class on the general wording, or a hidden page", () => {
    const result = feed(
      [
        session("c1", "Dovetails", 2),
        session("c2", "Sewing", 3, { descriptionSlug: "class-zeffy-sew" }),
        session("c3", "Painting", 4, { descriptionSlug: "class-zeffy-gone" }),
      ],
      [
        page("class-generic", "<p>Details at the front desk.</p>"),
        page("class-zeffy-sew", "<p>Hidden.</p>", { published: false }),
        page("class-zeffy-gone", "<p>Deleted.</p>", { deletedAt: NOW.toISOString() }),
      ],
    );
    expect(result.spotlight.map((e) => e.description)).toEqual([null, null, null]);
  });

  it("shows a repeating event once, on its next date", () => {
    const result = feed([
      session("c2", "Painting with Paul", 11),
      session("c1", "Painting with Paul", 4),
      session("c3", "Painting with Paul", 18),
    ]);
    expect(result.spotlight.map((e) => e.id)).toEqual(["c1"]);
  });

  it("leaves out events that are past, cancelled, unpublished or more than three weeks off", () => {
    const result = feed([
      session("past", "Yesterday", -1),
      session("cancelled", "Called off", 2, { cancelledAt: NOW.toISOString() }),
      session("draft", "Not announced", 2, { published: false }),
      session("deleted", "Removed", 2, { deletedAt: NOW.toISOString() }),
      session("far", "Next month", 22),
      session("ok", "This week", 5),
    ]);
    expect(result.spotlight.map((e) => e.id)).toEqual(["ok"]);
  });

  it("cuts a long description at a word, with an ellipsis", () => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const result = feed(
      [session("c1", "Long one", 2, { descriptionSlug: "class-zeffy-long" })],
      [page("class-zeffy-long", `<p>${long}</p>`)],
    );
    const text = result.spotlight[0]!.description!;
    expect(text.length).toBeLessThanOrEqual(421);
    expect(text.endsWith("…")).toBe(true);
    expect(long.startsWith(text.slice(0, -1))).toBe(true);
    expect(text.slice(0, -1)).toMatch(/word\d+$/);
  });

  it("shows at most eight events", () => {
    const result = feed(
      Array.from({ length: 12 }, (_, i) => session(`c${i}`, `Event ${i}`, 1 + i)),
    );
    expect(result.spotlight).toHaveLength(8);
  });
});

describe("lobby display community events", () => {
  it("lists free open events for the next five weeks, each once", () => {
    const open = { category: "open_studio", priceCents: 0 } as const;
    const result = feed([
      session("w1", "Hand-Cut Dovetails Workshop", 1),
      session("q2", "Queer Makers Night", 31, open),
      session("q1", "Queer Makers Night", 3, open),
      session("r1", "Repair Café", 24, open),
      session("j1", "Junk Journaling Night", 10, open),
      session("far", "Spring Fair", 36, open),
    ]);
    expect(result.community.map((e) => e.id)).toEqual(["q1", "j1", "r1"]);
    expect(result.community[0]).toMatchObject({
      title: "Queer Makers Night",
      priceCents: 0,
      bookingUrl: "https://www.zeffy.com/ticketing/q1",
    });
  });

  it("is empty when nothing open is coming up", () => {
    expect(feed([session("w1", "Dovetails", 1)]).community).toEqual([]);
  });
});

describe("the feed the old display page reads", () => {
  it("still has this week's classes", () => {
    const result = feed([session("c1", "Dovetails", 2), session("c2", "Later", 9)]);
    expect(result.upcoming.map((e) => e.id)).toEqual(["c1"]);
  });
});
