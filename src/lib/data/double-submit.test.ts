import { describe, expect, it } from "vitest";
import { MockDataProvider, createMockDataProvider } from "./mock-provider";

/**
 * A button pressed twice sends two requests. On the live site each one loads
 * the database for itself, so both pass every check. They must then write the
 * same rows, not two of each: ids for a booking, its payment and its refund
 * are worked out from what is being done, so the second save lands on the
 * first.
 */
async function withPaidClass() {
  const base = createMockDataProvider("u-admin");
  const starts = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const session = await base.adminUpsertClass({
    title: "Double submit test class",
    startsAt: new Date(starts).toISOString(),
    endsAt: new Date(starts + 2 * 60 * 60 * 1000).toISOString(),
    capacity: 8,
    instructorId: "u-staff",
    priceCents: 1000,
  });
  await base.adminGrantCredits({
    userId: "u-maya",
    amountCents: 5000,
    actorId: "u-admin",
    note: "test",
  });
  return { base, classId: session.id };
}

/** Two requests that each loaded the same data. */
function twoRequests(from: MockDataProvider, userId: string) {
  const state = from.getState();
  return [new MockDataProvider(state, userId), new MockDataProvider(state, userId)] as const;
}

function ledgerFor(provider: MockDataProvider, bookingId: string, kind: string) {
  return provider
    .getState()
    .creditLedgerEntries.filter((e) => e.bookingId === bookingId && e.kind === kind);
}

describe("the same request sent twice at once", () => {
  it("books one seat", async () => {
    const { base, classId } = await withPaidClass();
    const [a, b] = twoRequests(base, "u-maya");
    const first = await a.book(classId, "u-maya");
    const second = await b.book(classId, "u-maya");
    expect(second.id).toBe(first.id);
  });

  it("charges credits once", async () => {
    const { base, classId } = await withPaidClass();
    const booking = await base.book(classId, "u-maya");
    expect(booking.status).toBe("awaiting_payment");
    const [a, b] = twoRequests(base, "u-maya");
    await a.payBookingWithCredits(booking.id, "u-maya");
    await b.payBookingWithCredits(booking.id, "u-maya");
    const [paidA] = ledgerFor(a, booking.id, "class");
    const [paidB] = ledgerFor(b, booking.id, "class");
    expect(paidA?.amountCents).toBe(-1000);
    expect(paidB?.id).toBe(paidA?.id);
  });

  it("refunds a cancelled booking once", async () => {
    const { base, classId } = await withPaidClass();
    const booking = await base.book(classId, "u-maya");
    await base.payBookingWithCredits(booking.id, "u-maya");
    const [a, b] = twoRequests(base, "u-maya");
    await a.cancel(booking.id, "u-maya");
    await b.cancel(booking.id, "u-maya");
    const [refundA] = ledgerFor(a, booking.id, "class_refund");
    const [refundB] = ledgerFor(b, booking.id, "class_refund");
    expect(refundA?.amountCents).toBe(1000);
    expect(refundB?.id).toBe(refundA?.id);
  });

  it("a rebooking after a cancel is a new booking with its own payment", async () => {
    const { base, classId } = await withPaidClass();
    const first = await base.book(classId, "u-maya");
    await base.payBookingWithCredits(first.id, "u-maya");
    await base.cancel(first.id, "u-maya");
    const second = await base.book(classId, "u-maya");
    expect(second.id).not.toBe(first.id);
    await base.payBookingWithCredits(second.id, "u-maya");
    const ids = base
      .getState()
      .creditLedgerEntries.filter(
        (e) => e.bookingId === first.id || e.bookingId === second.id,
      )
      .map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });
});
