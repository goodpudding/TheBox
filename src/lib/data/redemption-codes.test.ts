import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCode } from "@/lib/redemption-code";
import { createMockDataProvider, MockDataProvider } from "./mock-provider";
import { RPC_RULES, handleDataRpc } from "./rpc-policy";

const ADMIN = "u-admin";
const MAYA = "u-maya"; // active, paying Maker
const JORDAN = "u-jordan";
const ALEX = "u-alex"; // lapsed

const NOW = new Date("2026-11-21T18:00:00Z");
const day = (n: number, hour = 18) =>
  new Date(NOW.getTime() + n * 86_400_000 + (hour - 18) * 3_600_000).toISOString();

const INVALID = "That code is not valid. Check it and try again, or ask staff.";
const USED = "That code has already been used.";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function shop(): MockDataProvider {
  return createMockDataProvider(ADMIN) as MockDataProvider;
}

async function balance(provider: MockDataProvider, userId: string) {
  return (await provider.getCreditWallet(userId)).balanceCents;
}

async function paidClass(provider: MockDataProvider, over: Record<string, unknown> = {}) {
  return provider.adminUpsertClass({
    title: "Cutting Board Workshop",
    startsAt: day(7),
    endsAt: day(7, 20),
    capacity: 2,
    instructorId: "u-staff",
    priceCents: 4000,
    published: true,
    ...over,
  });
}

describe("creating codes", () => {
  it("makes a batch of different codes with the same value, and records who and how many", async () => {
    const provider = shop();
    const codes = await provider.adminCreateCodes({
      kind: "credit",
      amountCents: 2500,
      quantity: 5,
      note: "Small Business Saturday",
    });
    expect(codes).toHaveLength(5);
    expect(new Set(codes.map((c) => c.code)).size).toBe(5);
    expect(codes.every((c) => c.amountCents === 2500 && c.createdById === ADMIN)).toBe(true);
    const audit = (await provider.adminListAuditEvents()).find((e) => e.action === "codes_created")!;
    expect(audit.actorId).toBe(ADMIN);
    expect(audit.metadata).toMatchObject({ count: 5, kind: "credit", amountCents: 2500 });
    // The codes themselves stay out of the audit trail.
    expect(JSON.stringify(audit)).not.toContain(codes[0]!.code);
  });

  it("refuses values that make no sense, in plain words", async () => {
    const provider = shop();
    await expect(
      provider.adminCreateCodes({ kind: "credit", amountCents: 0, quantity: 1 }),
    ).rejects.toThrow(/amount/i);
    await expect(
      provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 51 }),
    ).rejects.toThrow(/50/);
    await expect(
      provider.adminCreateCodes({ kind: "membership", tier: "maker", months: 0, quantity: 1 }),
    ).rejects.toThrow(/months/i);
    await expect(
      provider.adminCreateCodes({ kind: "membership", tier: "platinum" as never, months: 3, quantity: 1 }),
    ).rejects.toThrow(/membership/i);
    await expect(
      provider.adminCreateCodes({ kind: "class", quantity: 1 }),
    ).rejects.toThrow(/class/i);
    await expect(
      provider.adminCreateCodes({ kind: "class", classSessionId: "nope", quantity: 1 }),
    ).rejects.toThrow(/class/i);
    await expect(
      provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1, expiresAt: day(-1) }),
    ).rejects.toThrow(/past/i);
  });

  it("is for staff only, and so are the list and voiding", () => {
    expect(RPC_RULES.adminCreateCodes.access).toBe("staff");
    expect(RPC_RULES.adminListCodes.access).toBe("staff");
    expect(RPC_RULES.adminVoidCode.access).toBe("staff");
  });

  it("turns a member away from the list at the door", async () => {
    const provider = shop();
    await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    const member = (await provider.adminListMembers()).find((u) => u.id === MAYA)!;
    const reply = await handleDataRpc({
      method: "adminListCodes",
      args: [],
      sessionUser: member,
      provider,
    });
    expect(reply.status).toBe(403);
    expect(JSON.stringify(reply.body)).not.toMatch(/[A-Z2-9]{15}/);
  });
});

describe("redeeming shop credit", () => {
  it("adds the amount to the wallet once, and says who redeemed it", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    const before = await balance(provider, JORDAN);

    const offer = await provider.getCodeOffer(JORDAN, formatCode(code!.code).toLowerCase());
    expect(offer).toMatchObject({ kind: "credit", amountCents: 2500 });
    expect(await balance(provider, JORDAN)).toBe(before);

    const done = await provider.redeemCode(JORDAN, ` ${formatCode(code!.code)} `);
    expect(done.kind).toBe("credit");
    expect(await balance(provider, JORDAN)).toBe(before + 2500);

    const wallet = await provider.getCreditWallet(JORDAN);
    const entry = wallet.entries.find((e) => e.sourcePaymentId === `code:${code!.id}`)!;
    expect(entry).toMatchObject({ kind: "gift_code", amountCents: 2500, id: `cl-code-${code!.id}` });

    const listed = (await provider.adminListCodes()).find((c) => c.id === code!.id)!;
    expect(listed.redeemedByUserId).toBe(JORDAN);
    expect(listed.redeemedByName).toBeTruthy();
    expect(listed.redeemedAt).toBe(NOW.toISOString());

    const audit = (await provider.adminListAuditEvents(JORDAN)).find((e) => e.action === "code_redeemed")!;
    expect(audit.metadata).toMatchObject({ codeId: code!.id, kind: "credit", amountCents: 2500 });
    expect(JSON.stringify(audit)).not.toContain(code!.code);
  });

  it("refuses a second use, by the same person or anyone else, and grants nothing", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    await provider.redeemCode(JORDAN, code!.code);
    const jordan = await balance(provider, JORDAN);
    const maya = await balance(provider, MAYA);
    await expect(provider.redeemCode(JORDAN, code!.code)).rejects.toThrow(USED);
    await expect(provider.redeemCode(MAYA, code!.code)).rejects.toThrow(USED);
    await expect(provider.getCodeOffer(MAYA, code!.code)).rejects.toThrow(USED);
    expect(await balance(provider, JORDAN)).toBe(jordan);
    expect(await balance(provider, MAYA)).toBe(maya);
  });

  it("gives the same answer for a code that never existed and one staff voided", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    await provider.adminVoidCode(code!.id);
    await expect(provider.redeemCode(JORDAN, code!.code)).rejects.toThrow(INVALID);
    await expect(provider.redeemCode(JORDAN, "AAAAA-BBBBB-CCCCC")).rejects.toThrow(INVALID);
    await expect(provider.getCodeOffer(JORDAN, "")).rejects.toThrow(INVALID);
    const voided = (await provider.adminListCodes()).find((c) => c.id === code!.id)!;
    expect(voided.voidedAt).toBe(NOW.toISOString());
    expect(voided.voidedById).toBe(ADMIN);
    expect((await provider.adminListAuditEvents()).some((e) => e.action === "code_voided")).toBe(true);
  });

  it("will not void a code that has been redeemed", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    await provider.redeemCode(JORDAN, code!.code);
    await expect(provider.adminVoidCode(code!.id)).rejects.toThrow(/already been redeemed/i);
  });

  it("refuses an expired code and leaves it unused", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({
      kind: "credit",
      amountCents: 1000,
      quantity: 1,
      expiresAt: day(2),
    });
    vi.setSystemTime(new Date(day(3)));
    const before = await balance(provider, JORDAN);
    await expect(provider.redeemCode(JORDAN, code!.code)).rejects.toThrow(/expired/i);
    expect(await balance(provider, JORDAN)).toBe(before);
    expect((await provider.adminListCodes()).find((c) => c.id === code!.id)!.redeemedAt ?? null).toBeNull();
  });

  it("tells the database which code it is claiming, before anything is saved", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    expect(provider.takeCodeClaims()).toEqual([]);
    await provider.redeemCode(JORDAN, code!.code);
    expect(provider.takeCodeClaims()).toEqual([
      { codeId: code!.id, action: "redeem", userId: JORDAN, at: NOW.toISOString() },
    ]);
    // Taken once: the next call starts clean.
    expect(provider.takeCodeClaims()).toEqual([]);
  });
});

describe("redeeming a membership", () => {
  it("makes a lapsed member active on that tier until the end date", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "membership", tier: "community", months: 3, quantity: 1 });
    const offer = await provider.getCodeOffer(ALEX, code!.code);
    expect(offer).toMatchObject({ kind: "membership", tier: "community", months: 3 });

    const done = await provider.redeemCode(ALEX, code!.code);
    const alex = (await provider.getMember(ALEX))!;
    expect(alex.status).toBe("active");
    expect(alex.tier).toBe("community");
    expect(alex.shopAccess).toBe(true);
    expect(alex.membershipEndsAt).toBe("2027-02-21T18:00:00.000Z");
    expect(done.membershipEndsAt).toBe(alex.membershipEndsAt);
  });

  it("adds the months to a gifted membership of the same tier that is still running", async () => {
    const provider = shop();
    const codes = await provider.adminCreateCodes({ kind: "membership", tier: "community", months: 3, quantity: 2 });
    await provider.redeemCode(ALEX, codes[0]!.code);
    vi.setSystemTime(new Date(day(10)));
    await provider.redeemCode(ALEX, codes[1]!.code);
    expect((await provider.getMember(ALEX))!.membershipEndsAt).toBe("2027-05-21T18:00:00.000Z");
  });

  it("starts again from today when the earlier gift has already ended", async () => {
    const provider = shop();
    const codes = await provider.adminCreateCodes({ kind: "membership", tier: "community", months: 1, quantity: 2 });
    await provider.redeemCode(ALEX, codes[0]!.code);
    vi.setSystemTime(new Date("2027-03-01T18:00:00Z"));
    await provider.redeemCode(ALEX, codes[1]!.code);
    expect((await provider.getMember(ALEX))!.membershipEndsAt).toBe("2027-04-01T18:00:00.000Z");
  });

  it("sends a paying member to staff and leaves the code unused", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "membership", tier: "maker", months: 3, quantity: 1 });
    await expect(provider.redeemCode(MAYA, code!.code)).rejects.toThrow(/already have a membership/i);
    await expect(provider.getCodeOffer(MAYA, code!.code)).rejects.toThrow(/already have a membership/i);
    expect((await provider.adminListCodes()).find((c) => c.id === code!.id)!.redeemedAt ?? null).toBeNull();
    expect((await provider.getMember(MAYA))!.membershipEndsAt ?? null).toBeNull();
    expect(provider.takeCodeClaims()).toEqual([]);
  });

  it("will not swap a running gifted membership for a different one", async () => {
    const provider = shop();
    const [first] = await provider.adminCreateCodes({ kind: "membership", tier: "community", months: 3, quantity: 1 });
    const [second] = await provider.adminCreateCodes({ kind: "membership", tier: "maker", months: 3, quantity: 1 });
    await provider.redeemCode(ALEX, first!.code);
    await expect(provider.redeemCode(ALEX, second!.code)).rejects.toThrow(/see staff/i);
    expect((await provider.getMember(ALEX))!.tier).toBe("community");
    expect((await provider.adminListCodes()).find((c) => c.id === second!.id)!.redeemedAt ?? null).toBeNull();
  });

  it("drops the end date when a Zeffy payment makes them a paying member", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "membership", tier: "community", months: 3, quantity: 1 });
    await provider.redeemCode(ALEX, code!.code);
    const products = await provider.listMembershipProducts();
    const product = products.find((p) => p.zeffyCampaignId) ?? products[0]!;
    const campaignId = product.zeffyCampaignId ?? "camp-gift-test";
    const rateId = product.zeffyRateId ?? "rate-gift-test";
    // Make sure the payment matches a product whatever the fixtures hold.
    product.zeffyCampaignId = campaignId;
    product.zeffyRateId = rateId;
    provider.getState().membershipProducts.find((p) => p.id === product.id)!.zeffyCampaignId = campaignId;
    provider.getState().membershipProducts.find((p) => p.id === product.id)!.zeffyRateId = rateId;
    const alex = (await provider.getMember(ALEX))!;
    const result = await provider.applyZeffyMembershipPayment(
      {
        id: "zp-gift-then-paid",
        object: "payment",
        created: 1_795_000_000,
        amount: product.priceCents,
        currency: "usd",
        status: "succeeded",
        campaign_id: campaignId,
        campaign_type: "ticketing",
        campaign_category: "MembershipV2",
        buyer: { email: alex.email, first_name: alex.firstName, last_name: alex.lastName },
        items: [
          {
            id: "i-gift",
            type: "ticket",
            amount: product.priceCents,
            currency: "usd",
            rate_id: rateId,
            rate_title: product.name,
          },
        ],
      },
      NOW.toISOString(),
    );
    expect(result.status).toBe("applied");
    expect((await provider.getMember(ALEX))!.membershipEndsAt ?? null).toBeNull();
  });

  it("lets staff set or clear the end date by hand", async () => {
    const provider = shop();
    const updated = await provider.adminUpdateMember(ALEX, { membershipEndsAt: "2027-01-31" });
    expect(updated.membershipEndsAt).toBe("2027-02-01T07:59:59.000Z");
    const cleared = await provider.adminUpdateMember(ALEX, { membershipEndsAt: null });
    expect(cleared.membershipEndsAt ?? null).toBeNull();
    await expect(
      provider.adminUpdateMember(ALEX, { membershipEndsAt: "soon" }),
    ).rejects.toThrow(/date/i);
  });
});

describe("redeeming a class", () => {
  it("books and pays the one class the code is for", async () => {
    const provider = shop();
    const session = await paidClass(provider);
    const [code] = await provider.adminCreateCodes({ kind: "class", classSessionId: session.id, quantity: 1 });
    const before = await balance(provider, MAYA);

    const offer = await provider.getCodeOffer(MAYA, code!.code);
    expect(offer.kind).toBe("class");
    expect(offer.classes?.map((c) => c.id)).toEqual([session.id]);

    const done = await provider.redeemCode(MAYA, code!.code, { classSessionId: session.id });
    expect(done.bookingId).toBeTruthy();
    const booking = (await provider.listBookingsForUser(MAYA)).find((b) => b.id === done.bookingId)!;
    expect(booking.status).toBe("booked");
    expect(booking.paidAt).toBe(NOW.toISOString());
    // In with the code, out for the class: the wallet ends where it began.
    expect(await balance(provider, MAYA)).toBe(before);
    const wallet = await provider.getCreditWallet(MAYA);
    expect(wallet.entries.find((e) => e.id === `cl-code-${code!.id}`)?.amountCents).toBe(4000);
  });

  it("offers every class under the price limit, and only those", async () => {
    const provider = shop();
    const cheap = await paidClass(provider, { title: "Laser Basics", priceCents: 3000 });
    const dear = await paidClass(provider, { title: "Cutting Board (2 sessions)", priceCents: 12000 });
    const draft = await paidClass(provider, { title: "Draft class", priceCents: 2000, published: false });
    const past = await paidClass(provider, { title: "Last week", priceCents: 2000, startsAt: day(-7), endsAt: day(-7, 20) });
    const [code] = await provider.adminCreateCodes({ kind: "class", maxPriceCents: 5000, quantity: 1 });
    const ids = (await provider.getCodeOffer(MAYA, code!.code)).classes!.map((c) => c.id);
    expect(ids).toContain(cheap.id);
    expect(ids).not.toContain(dear.id);
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(past.id);
    await expect(
      provider.redeemCode(MAYA, code!.code, { classSessionId: dear.id }),
    ).rejects.toThrow(/does not cover/i);
    await expect(provider.redeemCode(MAYA, code!.code)).rejects.toThrow(/choose a class/i);
  });

  it("leaves the code unused and the wallet alone when the class is full", async () => {
    const provider = shop();
    const session = await paidClass(provider, { capacity: 1 });
    await provider.adminAddBooking(session.id, JORDAN);
    const [code] = await provider.adminCreateCodes({ kind: "class", classSessionId: session.id, quantity: 1 });
    const before = await balance(provider, MAYA);
    const bookings = (await provider.listBookingsForUser(MAYA)).length;

    expect((await provider.getCodeOffer(MAYA, code!.code)).classes).toEqual([]);
    await expect(
      provider.redeemCode(MAYA, code!.code, { classSessionId: session.id }),
    ).rejects.toThrow(/full/i);

    expect(await balance(provider, MAYA)).toBe(before);
    expect((await provider.listBookingsForUser(MAYA)).length).toBe(bookings);
    expect((await provider.adminListCodes()).find((c) => c.id === code!.id)!.redeemedAt ?? null).toBeNull();
    expect(provider.takeCodeClaims()).toEqual([]);
  });

  it("leaves the code unused when the booking itself is refused", async () => {
    const provider = shop();
    const session = await paidClass(provider);
    const [code] = await provider.adminCreateCodes({ kind: "class", classSessionId: session.id, quantity: 1 });
    // u-avery has not finished signing up, so cannot book anything yet.
    await expect(
      provider.redeemCode("u-avery", code!.code, { classSessionId: session.id }),
    ).rejects.toThrow(/profile/i);
    expect(await balance(provider, "u-avery")).toBe(0);
    expect((await provider.adminListCodes()).find((c) => c.id === code!.id)!.redeemedAt ?? null).toBeNull();
    expect(
      (await provider.adminListAuditEvents("u-avery")).some((e) => e.action === "code_redeemed"),
    ).toBe(false);
  });

  it("gives the money back as shop credit when the member cancels in time", async () => {
    const provider = shop();
    const session = await paidClass(provider);
    const [code] = await provider.adminCreateCodes({ kind: "class", classSessionId: session.id, quantity: 1 });
    const before = await balance(provider, MAYA);
    const done = await provider.redeemCode(MAYA, code!.code, { classSessionId: session.id });
    await provider.cancel(done.bookingId!, MAYA);
    expect(await balance(provider, MAYA)).toBe(before + 4000);
  });
});

describe("what a member can learn", () => {
  it("only what their own code gives", async () => {
    const provider = shop();
    const [mine] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1, note: "Bought by Pat" });
    const [other] = await provider.adminCreateCodes({ kind: "credit", amountCents: 9900, quantity: 1 });
    const member = (await provider.adminListMembers()).find((u) => u.id === JORDAN)!;
    const reply = await handleDataRpc({
      method: "getCodeOffer",
      args: [JORDAN, mine!.code],
      sessionUser: member,
      provider,
    });
    const text = JSON.stringify(reply.body);
    expect(reply.body.ok).toBe(true);
    expect(text).not.toContain(other!.code);
    expect(text).not.toContain(mine!.code);
    expect(text).not.toContain("Bought by Pat");
    expect(text).not.toContain("9900");
  });

  it("redeems for the signed-in member, whoever the request names", async () => {
    const provider = shop();
    const [code] = await provider.adminCreateCodes({ kind: "credit", amountCents: 2500, quantity: 1 });
    const member = (await provider.adminListMembers()).find((u) => u.id === JORDAN)!;
    const before = await balance(provider, JORDAN);
    const maya = await balance(provider, MAYA);
    await handleDataRpc({
      method: "redeemCode",
      args: [MAYA, code!.code],
      sessionUser: member,
      provider,
    });
    expect(await balance(provider, JORDAN)).toBe(before + 2500);
    expect(await balance(provider, MAYA)).toBe(maya);
  });
});
