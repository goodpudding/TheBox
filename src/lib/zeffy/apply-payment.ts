import type { Booking, ClassSession, User } from "@/lib/data/types";
import { isMembershipPayment } from "@/lib/zeffy/memberships";
import type { ZeffyApplyResult, ZeffyPayment } from "@/lib/zeffy/types";

const ACTIVE_SEAT: Booking["status"][] = [
  "booked",
  "awaiting_payment",
  "attended",
];

export function extractBuyerEmail(payment: ZeffyPayment): string | null {
  const raw = payment.buyer?.email?.trim();
  if (!raw) return null;
  return raw.toLowerCase();
}

export function isTicketingPayment(payment: ZeffyPayment): boolean {
  // Membership programs are ticketing campaigns with category MembershipV2.
  // They must not create class bookings.
  if (isMembershipPayment(payment)) return false;
  if (payment.campaign_type === "ticketing") return true;
  if (payment.campaign_category === "event") return true;
  const items = payment.items ?? [];
  return items.some((i) => i.type === "ticket");
}

export interface ZeffyBookingStore {
  findBookingByPaymentId(paymentId: string): Booking | null;
  findClassByCampaignId(campaignId: string): ClassSession | null;
  findUserByEmail(email: string): User | null;
  listBookingsForClass(classSessionId: string): Booking[];
  createBookedPaid(input: {
    classSessionId: string;
    userId: string;
    paymentId: string;
    paidAt: string;
  }): Booking;
  markPaidFromZeffy(input: {
    bookingId: string;
    paymentId: string;
    paidAt: string;
  }): Booking;
}

/**
 * Map a completed Zeffy payment onto a portal booking.
 * Idempotent on payment id. Does not create members — unmatched emails are ignored.
 */
export function applyZeffyPaymentToStore(
  payment: ZeffyPayment,
  store: ZeffyBookingStore,
  paidAtIso?: string,
): ZeffyApplyResult {
  const existing = store.findBookingByPaymentId(payment.id);
  if (existing) {
    return { status: "duplicate", bookingId: existing.id };
  }

  if (!isTicketingPayment(payment)) {
    return {
      status: "ignored",
      reason: "not_ticketing",
      detail: payment.campaign_type,
    };
  }

  const session = store.findClassByCampaignId(payment.campaign_id);
  if (!session) {
    return {
      status: "ignored",
      reason: "no_campaign_match",
      detail: payment.campaign_id,
    };
  }

  const email = extractBuyerEmail(payment);
  if (!email) {
    return { status: "ignored", reason: "no_email" };
  }

  const user = store.findUserByEmail(email);
  if (!user) {
    return { status: "ignored", reason: "no_member", detail: email };
  }

  const paidAt =
    paidAtIso ??
    new Date((payment.created || Date.now() / 1000) * 1000).toISOString();

  const classBookings = store.listBookingsForClass(session.id);
  const open = classBookings.find(
    (b) =>
      b.userId === user.id &&
      b.status !== "cancelled" &&
      b.status !== "no_show",
  );

  if (open) {
    const booking = store.markPaidFromZeffy({
      bookingId: open.id,
      paymentId: payment.id,
      paidAt,
    });
    return {
      status: "applied",
      bookingId: booking.id,
      classSessionId: session.id,
      userId: user.id,
      created: false,
    };
  }

  const seatsTaken = classBookings.filter((b) =>
    ACTIVE_SEAT.includes(b.status),
  ).length;
  if (seatsTaken >= session.capacity) {
    return {
      status: "ignored",
      reason: "class_full",
      detail: session.id,
    };
  }

  const booking = store.createBookedPaid({
    classSessionId: session.id,
    userId: user.id,
    paymentId: payment.id,
    paidAt,
  });

  return {
    status: "applied",
    bookingId: booking.id,
    classSessionId: session.id,
    userId: user.id,
    created: true,
  };
}

export function syncClassUrlsFromCampaigns(input: {
  classes: Array<{ id: string; zeffyCampaignId?: string | null; zeffyUrl?: string | null }>;
  campaigns: Array<{ id: string; url: string | null }>;
}): Array<{ classId: string; campaignId: string; zeffyUrl: string }> {
  const byId = new Map(input.campaigns.map((c) => [c.id, c]));
  const updates: Array<{ classId: string; campaignId: string; zeffyUrl: string }> =
    [];

  for (const session of input.classes) {
    const campaignId = session.zeffyCampaignId?.trim();
    if (!campaignId) continue;
    const campaign = byId.get(campaignId);
    const url = campaign?.url?.trim();
    if (!url) continue;
    if (session.zeffyUrl === url) continue;
    updates.push({ classId: session.id, campaignId, zeffyUrl: url });
  }

  return updates;
}
