import { describe, expect, it } from "vitest";
import {
  applyZeffyPaymentToStore,
  syncClassUrlsFromCampaigns,
  type ZeffyBookingStore,
} from "./apply-payment";
import type { Booking, ClassSession, User } from "@/lib/data/types";
import type { ZeffyPayment } from "./types";
import { signZeffyPayload, verifyZeffySignature } from "./verify";

function payment(overrides: Partial<ZeffyPayment> = {}): ZeffyPayment {
  return {
    id: "pay-1",
    object: "payment",
    created: 1_700_000_000,
    amount: 3500,
    currency: "usd",
    status: "succeeded",
    campaign_id: "camp-1",
    campaign_type: "ticketing",
    campaign_category: "event",
    buyer: {
      email: "maya.chen@example.com",
      first_name: "Maya",
      last_name: "Chen",
    },
    items: [{ id: "i1", type: "ticket", amount: 3500, currency: "usd" }],
    ...overrides,
  };
}

function makeStore(seed?: {
  classes?: ClassSession[];
  users?: User[];
  bookings?: Booking[];
}): ZeffyBookingStore & { bookings: Booking[] } {
  const classes: ClassSession[] = seed?.classes ?? [
    {
      id: "class-1",
      title: "Intro",
      slug: "intro",
      descriptionSlug: "x",
      category: "workshop",
      instructorId: "u-staff",
      startsAt: "2026-09-07T13:00:00-07:00",
      endsAt: "2026-09-07T15:00:00-07:00",
      capacity: 2,
      priceCents: 3500,
      zeffyCampaignId: "camp-1",
      prerequisiteCertificationIds: [],
      location: "The Box",
      cancellationCutoffHours: 24,
      published: true,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
  ];
  const users: User[] = seed?.users ?? [
    {
      id: "u-maya",
      email: "maya.chen@example.com",
      firstName: "Maya",
      lastName: "Chen",
      displayName: "Maya Chen",
      role: "member",
      status: "active",
      tier: "maker",
      shopAccess: true,
      profileComplete: true,
      createdAt: "2026-08-01T00:00:00Z",
      updatedAt: "2026-08-01T00:00:00Z",
    },
  ];
  const bookings: Booking[] = seed?.bookings ?? [];

  return {
    bookings,
    findBookingByPaymentId(paymentId) {
      return bookings.find((b) => b.zeffyPaymentId === paymentId) ?? null;
    },
    findClassByCampaignId(campaignId) {
      return classes.find((c) => c.zeffyCampaignId === campaignId) ?? null;
    },
    findUserByEmail(email) {
      return users.find((u) => u.email.toLowerCase() === email) ?? null;
    },
    listBookingsForClass(classSessionId) {
      return bookings.filter((b) => b.classSessionId === classSessionId);
    },
    createBookedPaid(input) {
      const b: Booking = {
        id: `bk-${bookings.length + 1}`,
        classSessionId: input.classSessionId,
        userId: input.userId,
        status: "booked",
        paidAt: input.paidAt,
        zeffyPaymentId: input.paymentId,
        createdAt: input.paidAt,
        updatedAt: input.paidAt,
      };
      bookings.push(b);
      return b;
    },
    markPaidFromZeffy(input) {
      const b = bookings.find((x) => x.id === input.bookingId)!;
      b.status = "booked";
      b.paidAt = input.paidAt;
      b.zeffyPaymentId = input.paymentId;
      return b;
    },
  };
}

describe("verifyZeffySignature", () => {
  it("accepts a valid signature", () => {
    const body = '{"id":"evt-1"}';
    const secret = "whsec_test";
    const header = signZeffyPayload(body, secret, 1_700_000_000);
    expect(
      verifyZeffySignature(body, header, secret, 1_700_000_000),
    ).toEqual({ ok: true });
  });

  it("rejects a bad signature", () => {
    const body = '{"id":"evt-1"}';
    const result = verifyZeffySignature(
      body,
      "t=1700000000,v1=deadbeef",
      "whsec_test",
      1_700_000_000,
    );
    expect(result.ok).toBe(false);
  });
});

describe("applyZeffyPaymentToStore", () => {
  it("creates a booked seat for a matching member + campaign", () => {
    const store = makeStore();
    const result = applyZeffyPaymentToStore(payment(), store);
    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.created).toBe(true);
      expect(store.bookings[0]?.zeffyPaymentId).toBe("pay-1");
      expect(store.bookings[0]?.status).toBe("booked");
    }
  });

  it("marks an existing awaiting_payment booking paid", () => {
    const store = makeStore({
      bookings: [
        {
          id: "bk-open",
          classSessionId: "class-1",
          userId: "u-maya",
          status: "awaiting_payment",
          createdAt: "2026-08-01T00:00:00Z",
          updatedAt: "2026-08-01T00:00:00Z",
        },
      ],
    });
    const result = applyZeffyPaymentToStore(payment(), store);
    expect(result).toMatchObject({
      status: "applied",
      created: false,
      bookingId: "bk-open",
    });
    expect(store.bookings[0]?.zeffyPaymentId).toBe("pay-1");
  });

  it("is idempotent on payment id", () => {
    const store = makeStore();
    applyZeffyPaymentToStore(payment(), store);
    const second = applyZeffyPaymentToStore(payment(), store);
    expect(second.status).toBe("duplicate");
    expect(store.bookings).toHaveLength(1);
  });

  it("ignores unknown campaigns", () => {
    const store = makeStore();
    const result = applyZeffyPaymentToStore(
      payment({ campaign_id: "other" }),
      store,
    );
    expect(result).toEqual({
      status: "ignored",
      reason: "no_campaign_match",
      detail: "other",
    });
  });
});

describe("syncClassUrlsFromCampaigns", () => {
  it("updates urls when campaign id matches", () => {
    const updates = syncClassUrlsFromCampaigns({
      classes: [
        {
          id: "class-1",
          zeffyCampaignId: "camp-1",
          zeffyUrl: null,
        },
      ],
      campaigns: [
        { id: "camp-1", url: "https://www.zeffy.com/en-US/event/intro" },
      ],
    });
    expect(updates).toEqual([
      {
        classId: "class-1",
        campaignId: "camp-1",
        zeffyUrl: "https://www.zeffy.com/en-US/event/intro",
      },
    ]);
  });
});
