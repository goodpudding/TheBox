import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { RPC_RULES } from "./rpc-policy";

const ADMIN = "u-admin";
const MAYA = "u-maya";
const JORDAN = "u-jordan";
const SAM = "u-sam";

const NOW = new Date("2026-11-21T18:00:00Z");
const day = (n: number, hour = 18) =>
  new Date(NOW.getTime() + n * 86_400_000 + (hour - 18) * 3_600_000).toISOString();

function classInput(over: Record<string, unknown> = {}) {
  return {
    title: "Painting with Paul",
    startsAt: day(7),
    endsAt: day(7, 20),
    capacity: 2,
    instructorId: "u-staff",
    priceCents: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("class description", () => {
  it("is saved with the class, cleaned, and is what the public reads", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(
      classInput({
        description:
          '<p onclick="steal()">Bring an <b>apron</b>.</p><script>alert(1)</script>',
      }),
    );
    expect(session.descriptionSlug).not.toBe("class-generic");
    expect("description" in session).toBe(false);
    const page = await admin.getContentBySlug(session.descriptionSlug);
    expect(page?.category).toBe("class");
    expect(page?.html).toContain("<b>apron</b>");
    expect(page?.html).not.toMatch(/script|onclick/i);
  });

  it("gives each session its own text, so one edit does not change another class", async () => {
    const admin = createMockDataProvider(ADMIN);
    const first = await admin.adminUpsertClass(classInput({ description: "<p>Week one.</p>" }));
    const second = await admin.adminUpsertClass(
      classInput({ startsAt: day(14), endsAt: day(14, 20), description: "<p>Week two.</p>" }),
    );
    expect(first.descriptionSlug).not.toBe(second.descriptionSlug);
    await admin.adminUpsertClass({ ...first, description: "<p>Week one, new room.</p>" });
    expect((await admin.getContentBySlug(second.descriptionSlug))?.html).toBe("<p>Week two.</p>");
    expect((await admin.getContentBySlug(first.descriptionSlug))?.html).toBe(
      "<p>Week one, new room.</p>",
    );
  });

  it("leaves the description alone when a save does not send one", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ description: "<p>Bring an apron.</p>" }));
    const own = session.descriptionSlug;
    expect(own).not.toBe("class-generic");
    const again = await admin.adminUpsertClass({ ...session, capacity: 5 });
    expect(again.descriptionSlug).toBe(own);
    expect((await admin.getContentBySlug(again.descriptionSlug))?.html).toBe("<p>Bring an apron.</p>");
  });

  it("goes back to the shared wording when the description is emptied", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ description: "<p>Bring an apron.</p>" }));
    const own = session.descriptionSlug;
    expect(own).not.toBe("class-generic");
    const emptied = await admin.adminUpsertClass({ ...session, description: "<p> </p>" });
    expect(emptied.descriptionSlug).toBe("class-generic");
    expect(await admin.getContentBySlug(own)).toBeNull();
  });

  it("does not show class descriptions in the list of policies", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ description: "<p>Bring an apron.</p>" }));
    expect((await admin.listPolicies()).map((p) => p.slug)).not.toContain(session.descriptionSlug);
  });
});

describe("class address", () => {
  it("saves two sessions with the same title", async () => {
    const admin = createMockDataProvider(ADMIN);
    const first = await admin.adminUpsertClass(classInput());
    const second = await admin.adminUpsertClass(classInput({ startsAt: day(14), endsAt: day(14, 20) }));
    const third = await admin.adminUpsertClass(classInput({ startsAt: day(14), endsAt: day(14, 20) }));
    expect(new Set([first.slug, second.slug, third.slug]).size).toBe(3);
    expect(first.slug).toBe("painting-with-paul");
  });

  it("keeps a session's address when it is renamed or sent a different one", async () => {
    const admin = createMockDataProvider(ADMIN);
    const first = await admin.adminUpsertClass(classInput());
    // The provider hands back the stored object, so read the address now.
    const address = first.slug;
    const edited = await admin.adminUpsertClass({
      ...first,
      title: "Painting with Paula",
      slug: "something-else",
    });
    expect(edited.title).toBe("Painting with Paula");
    expect(edited.slug).toBe(address);
  });
});

describe("cancelling a class", () => {
  it("takes it off the public lists, refuses new bookings, and restores it", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput());
    const cancelled = await admin.adminCancelClass(session.id);
    expect(cancelled.cancelledAt).toBeTruthy();
    // The hourly Zeffy pull leaves a staff cancel alone.
    expect(cancelled.staffEditedFields).toContain("cancelledAt");
    expect((await admin.listClasses()).map((c) => c.id)).not.toContain(session.id);
    await expect(admin.book(session.id, MAYA)).rejects.toThrow("This class was cancelled.");

    const restored = await admin.adminRestoreClass(session.id);
    expect(restored.cancelledAt).toBeNull();
    expect(restored.staffEditedFields ?? []).not.toContain("cancelledAt");
    expect((await admin.listClasses()).map((c) => c.id)).toContain(session.id);
  });

  it("records who cancelled and who restored", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput());
    await admin.adminCancelClass(session.id);
    await admin.adminRestoreClass(session.id);
    const actions = (await admin.adminListAuditEvents())
      .filter((e) => e.entityId === session.id)
      .map((e) => `${e.action}:${e.actorId}`);
    expect(actions).toContain(`class_cancelled:${ADMIN}`);
    expect(actions).toContain(`class_restored:${ADMIN}`);
  });

  it("leaves the bookings as they are", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput());
    const booking = await admin.book(session.id, MAYA);
    await admin.adminCancelClass(session.id);
    const roster = await admin.adminListRoster(session.id);
    expect(roster.find((r) => r.id === booking.id)?.status).toBe("booked");
  });
});

describe("the staff list of classes", () => {
  it("includes drafts, cancelled and past classes, upcoming first", async () => {
    const admin = createMockDataProvider(ADMIN);
    const soon = await admin.adminUpsertClass(classInput({ title: "Soon", startsAt: day(2), endsAt: day(2, 20) }));
    const later = await admin.adminUpsertClass(classInput({ title: "Later", startsAt: day(9), endsAt: day(9, 20) }));
    const draft = await admin.adminUpsertClass(
      classInput({ title: "Draft", startsAt: day(5), endsAt: day(5, 20), published: false }),
    );
    const gone = await admin.adminUpsertClass(classInput({ title: "Gone", startsAt: day(6), endsAt: day(6, 20) }));
    await admin.adminCancelClass(gone.id);
    const past = await admin.adminUpsertClass(
      classInput({ title: "Past", startsAt: day(-3), endsAt: day(-3, 20) }),
    );

    const all = await admin.adminListClasses();
    const ids = all.map((c) => c.id);
    for (const s of [soon, later, draft, gone, past]) expect(ids).toContain(s.id);
    // Upcoming in date order, then the past, newest first.
    expect(ids.indexOf(soon.id)).toBeLessThan(ids.indexOf(draft.id));
    expect(ids.indexOf(draft.id)).toBeLessThan(ids.indexOf(gone.id));
    expect(ids.indexOf(gone.id)).toBeLessThan(ids.indexOf(later.id));
    expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(past.id));
    expect(all.find((c) => c.id === soon.id)?.bookedCount).toBe(0);

    const publicIds = (await admin.listClasses()).map((c) => c.id);
    expect(publicIds).not.toContain(draft.id);
    expect(publicIds).not.toContain(gone.id);
  });
});

describe("staff bookings", () => {
  it("adds a member to a class and records who did it", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput());
    const booking = await admin.adminAddBooking(session.id, MAYA);
    expect(booking.status).toBe("booked");
    const audit = (await admin.adminListAuditEvents(MAYA)).find(
      (e) => e.action === "booking_added_by_staff",
    );
    expect(audit).toMatchObject({ actorId: ADMIN, entityId: booking.id });
  });

  it("holds a seat for payment on a paid class, as a member's own booking does", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ priceCents: 3000 }));
    const booking = await admin.adminAddBooking(session.id, MAYA);
    expect(booking.status).toBe("awaiting_payment");
    expect(booking.paymentHoldExpiresAt).toBeTruthy();
  });

  it("puts the next person on the waitlist when the class is full", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ capacity: 1 }));
    await admin.adminAddBooking(session.id, MAYA);
    const second = await admin.adminAddBooking(session.id, JORDAN);
    expect(second.status).toBe("waitlisted");
    expect(second.waitlistPosition).toBe(1);
  });

  it("refuses a second booking for the same person, a suspended member and a cancelled class", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput());
    await admin.adminAddBooking(session.id, MAYA);
    await expect(admin.adminAddBooking(session.id, MAYA)).rejects.toThrow(/already/i);
    await expect(admin.adminAddBooking(session.id, "u-casey")).rejects.toThrow(/suspended/i);
    await admin.adminCancelClass(session.id);
    await expect(admin.adminAddBooking(session.id, JORDAN)).rejects.toThrow("This class was cancelled.");
  });

  it("cancels a booking after the member cutoff and moves the waitlist up", async () => {
    const admin = createMockDataProvider(ADMIN);
    // Starts in two hours: far inside the 24 hour cutoff a member is held to.
    const session = await admin.adminUpsertClass(
      classInput({
        capacity: 1,
        startsAt: new Date(NOW.getTime() + 2 * 3_600_000).toISOString(),
        endsAt: new Date(NOW.getTime() + 4 * 3_600_000).toISOString(),
      }),
    );
    const seat = await admin.adminAddBooking(session.id, MAYA);
    const waiting = await admin.adminAddBooking(session.id, JORDAN);
    await expect(admin.cancel(seat.id, MAYA)).rejects.toThrow(/cutoff/i);

    const cancelled = await admin.adminCancelBooking(seat.id);
    expect(cancelled.status).toBe("cancelled");
    const roster = await admin.adminListRoster(session.id);
    expect(roster.find((r) => r.id === waiting.id)?.status).toBe("booked");
    const audit = (await admin.adminListAuditEvents(MAYA)).find(
      (e) => e.action === "booking_cancelled_by_staff",
    );
    expect(audit).toMatchObject({ actorId: ADMIN, entityId: seat.id });
  });

  it("renumbers the waitlist when a waiting booking is cancelled", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ capacity: 1 }));
    await admin.adminAddBooking(session.id, MAYA);
    const first = await admin.adminAddBooking(session.id, JORDAN);
    const second = await admin.adminAddBooking(session.id, SAM);
    await admin.adminCancelBooking(first.id);
    const roster = await admin.adminListRoster(session.id);
    expect(roster.find((r) => r.id === second.id)?.waitlistPosition).toBe(1);
  });

  it("gives back credits a member paid with, as their own cancel does", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput({ priceCents: 1000 }));
    await admin.adminGrantCredits({ userId: MAYA, amountCents: 5000, actorId: ADMIN, note: "test" });
    const before = (await admin.getCreditWallet(MAYA)).balanceCents;
    const booking = await admin.adminAddBooking(session.id, MAYA);
    await admin.payBookingWithCredits(booking.id, MAYA);
    expect((await admin.getCreditWallet(MAYA)).balanceCents).toBe(before - 1000);
    await admin.adminCancelBooking(booking.id);
    expect((await admin.getCreditWallet(MAYA)).balanceCents).toBe(before);
  });

  it("will not cancel a booking twice", async () => {
    const admin = createMockDataProvider(ADMIN);
    const session = await admin.adminUpsertClass(classInput());
    const booking = await admin.adminAddBooking(session.id, MAYA);
    await admin.adminCancelBooking(booking.id);
    await expect(admin.adminCancelBooking(booking.id)).rejects.toThrow(/already cancelled/i);
  });
});

describe("who may use the staff class methods", () => {
  it("keeps every one of them staff-only", () => {
    for (const name of [
      "adminListClasses",
      "adminCancelClass",
      "adminRestoreClass",
      "adminAddBooking",
      "adminCancelBooking",
    ] as const) {
      expect(RPC_RULES[name].access, name).toBe("staff");
    }
  });
});
