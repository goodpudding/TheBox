import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCardNumber, parseCardNumber } from "@/lib/redemption-code";
import { createMockDataProvider, MockDataProvider } from "./mock-provider";
import { RPC_RULES, handleDataRpc } from "./rpc-policy";

const ADMIN = "u-admin";
const STAFF = "u-staff";
const MAYA = "u-maya"; // active, paying Maker
const JORDAN = "u-jordan";
const ALEX = "u-alex"; // lapsed

const NOW = new Date("2026-11-21T18:00:00Z");
const day = (n: number, hour = 18) =>
  new Date(NOW.getTime() + n * 86_400_000 + (hour - 18) * 3_600_000).toISOString();

const INVALID = "That code is not valid. Check it and try again, or ask staff.";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function shop(actor = STAFF): MockDataProvider {
  return createMockDataProvider(actor) as MockDataProvider;
}

async function balance(provider: MockDataProvider, userId: string) {
  return (await provider.getCreditWallet(userId)).balanceCents;
}

async function creditCards(provider: MockDataProvider, quantity = 1, firstCardNumber?: number) {
  return provider.adminCreateCodes({
    kind: "credit",
    amountCents: 2500,
    quantity,
    numberAsCards: true,
    firstCardNumber,
  });
}

describe("card numbers as text", () => {
  it("shows a number padded to three digits, and longer ones whole", () => {
    expect(formatCardNumber(7)).toBe("007");
    expect(formatCardNumber(14)).toBe("014");
    expect(formatCardNumber(1234)).toBe("1234");
  });

  it("reads what staff type: digits, with or without a # or leading zeros", () => {
    expect(parseCardNumber("014")).toBe(14);
    expect(parseCardNumber(" #14 ")).toBe(14);
    expect(parseCardNumber("card 14")).toBe(14);
    expect(parseCardNumber("0")).toBeNull();
    expect(parseCardNumber("")).toBeNull();
    expect(parseCardNumber("1234567")).toBeNull();
    // A full code is not a card number, even one that happens to hold digits.
    expect(parseCardNumber("ABCDE-23456-FGHJK")).toBeNull();
    expect(parseCardNumber(14 as never)).toBeNull();
  });
});

describe("numbering a batch as gift cards", () => {
  it("starts at 1 and counts up when no card has a number yet", async () => {
    const provider = shop();
    const cards = await creditCards(provider, 3);
    expect(cards.map((c) => c.cardNumber)).toEqual([1, 2, 3]);
  });

  it("carries on from the highest number in use", async () => {
    const provider = shop();
    await creditCards(provider, 2, 40);
    const more = await creditCards(provider, 2);
    expect(more.map((c) => c.cardNumber)).toEqual([42, 43]);
  });

  it("starts where staff say", async () => {
    const provider = shop();
    const cards = await creditCards(provider, 3, 100);
    expect(cards.map((c) => c.cardNumber)).toEqual([100, 101, 102]);
  });

  it("refuses a batch that would reuse a number, names it, and makes nothing", async () => {
    const provider = shop();
    await creditCards(provider, 3, 10); // 10, 11, 12
    const before = (await provider.adminListCodes()).length;
    await expect(creditCards(provider, 4, 9)).rejects.toThrow(
      "Card number 010 is already in use. Start at 013 or later.",
    );
    expect((await provider.adminListCodes()).length).toBe(before);
  });

  it("refuses a starting number that makes no sense", async () => {
    const provider = shop();
    await expect(creditCards(provider, 1, 0)).rejects.toThrow(/card number/i);
    await expect(creditCards(provider, 1, 1.5)).rejects.toThrow(/card number/i);
    await expect(creditCards(provider, 2, 999_999)).rejects.toThrow(/card number/i);
  });

  it("leaves a code without a number exactly as before", async () => {
    const provider = shop();
    const [plain] = await provider.adminCreateCodes({
      kind: "credit",
      amountCents: 2500,
      quantity: 1,
    });
    expect(plain!.cardNumber ?? null).toBeNull();
    await provider.redeemCode(JORDAN, plain!.code);
    expect(await balance(provider, JORDAN)).toBe(2500);
  });

  it("keeps the card numbers out of the audit trail's code list but counts them", async () => {
    const provider = shop();
    const cards = await creditCards(provider, 2, 5);
    const audit = (await provider.adminListAuditEvents()).find((e) => e.action === "codes_created")!;
    expect(audit.metadata).toMatchObject({ count: 2, firstCardNumber: 5, lastCardNumber: 6 });
    expect(JSON.stringify(audit)).not.toContain(cards[0]!.code);
  });
});

describe("staff redeem a card for a member", () => {
  it("shows staff what the card gives before anything is applied", async () => {
    const provider = shop();
    const [card] = await creditCards(provider, 1, 14);
    const offer = await provider.adminGetCodeOfferFor(JORDAN, "014");
    expect(offer).toMatchObject({ kind: "credit", amountCents: 2500, cardNumber: 14 });
    expect(JSON.stringify(offer)).not.toContain(card!.code);
    expect(await balance(provider, JORDAN)).toBe(0);
    expect((await provider.adminListCodes())[0]!.redeemedAt ?? null).toBeNull();
  });

  it("puts shop credit on the member's wallet, and records which staff member did it", async () => {
    const provider = shop(STAFF);
    const [card] = await creditCards(provider, 1, 14);
    const done = await provider.adminRedeemCodeFor(JORDAN, "14");
    expect(done).toMatchObject({ kind: "credit", amountCents: 2500, balanceCents: 2500 });
    expect(await balance(provider, JORDAN)).toBe(2500);
    expect(await balance(provider, STAFF)).toBe(0);

    const row = (await provider.adminListCodes()).find((c) => c.id === card!.id)!;
    expect(row.redeemedByUserId).toBe(JORDAN);
    expect(row.redeemedByStaffId).toBe(STAFF);
    expect(row.redeemedAt).toBe(NOW.toISOString());

    const audit = (await provider.adminListAuditEvents(JORDAN)).find(
      (e) => e.action === "code_redeemed",
    )!;
    expect(audit.actorId).toBe(STAFF);
    expect(audit.subjectUserId).toBe(JORDAN);
    expect(audit.metadata).toMatchObject({ kind: "credit", amountCents: 2500, atDesk: true });
    expect(JSON.stringify(audit)).not.toContain(card!.code);
  });

  it("takes the full code as well as the card number", async () => {
    const provider = shop();
    const [card] = await creditCards(provider, 1, 14);
    await provider.adminRedeemCodeFor(JORDAN, card!.code.toLowerCase());
    expect(await balance(provider, JORDAN)).toBe(2500);
  });

  it("tells the database which code it is claiming and for whom", async () => {
    const provider = shop(STAFF);
    const [card] = await creditCards(provider, 1, 14);
    provider.takeCodeClaims();
    await provider.adminRedeemCodeFor(JORDAN, "014");
    expect(provider.takeCodeClaims()).toEqual([
      { codeId: card!.id, action: "redeem", userId: JORDAN, staffId: STAFF, at: NOW.toISOString() },
    ]);
  });

  it("refuses a card that was already redeemed, and says by whom", async () => {
    const provider = shop();
    await creditCards(provider, 1, 14);
    await provider.adminRedeemCodeFor(JORDAN, "014");
    await expect(provider.adminRedeemCodeFor(ALEX, "014")).rejects.toThrow(
      /Card 014 has already been redeemed/,
    );
    expect(await balance(provider, ALEX)).toBe(0);
    expect(await balance(provider, JORDAN)).toBe(2500);
  });

  it("refuses a number no card has, a voided card and an expired one", async () => {
    const provider = shop();
    await expect(provider.adminRedeemCodeFor(JORDAN, "099")).rejects.toThrow(
      "No gift card has the number 099.",
    );
    const [voided] = await creditCards(provider, 1, 20);
    await provider.adminVoidCode(voided!.id);
    await expect(provider.adminRedeemCodeFor(JORDAN, "020")).rejects.toThrow(/voided/i);
    await provider.adminCreateCodes({
      kind: "credit",
      amountCents: 2500,
      quantity: 1,
      numberAsCards: true,
      firstCardNumber: 21,
      expiresAt: day(1),
    });
    vi.setSystemTime(new Date(day(3)));
    await expect(provider.adminRedeemCodeFor(JORDAN, "021")).rejects.toThrow(/expired/i);
    expect(await balance(provider, JORDAN)).toBe(0);
  });

  it("refuses a member who does not exist, and leaves the card unused", async () => {
    const provider = shop();
    const [card] = await creditCards(provider, 1, 14);
    await expect(provider.adminRedeemCodeFor("u-nobody", "014")).rejects.toThrow();
    const row = (await provider.adminListCodes()).find((c) => c.id === card!.id)!;
    expect(row.redeemedAt ?? null).toBeNull();
  });

  it("gives a lapsed member the membership, to its end date", async () => {
    const provider = shop();
    await provider.adminCreateCodes({
      kind: "membership",
      tier: "maker",
      months: 3,
      quantity: 1,
      numberAsCards: true,
      firstCardNumber: 30,
    });
    const done = await provider.adminRedeemCodeFor(ALEX, "030");
    expect(done.tier).toBe("maker");
    const alex = await provider.getMember(ALEX);
    expect(alex).toMatchObject({ status: "active", tier: "maker" });
    expect(alex.membershipEndsAt).toBe(done.membershipEndsAt);
  });

  it("will not add a membership card to a paid membership, says so about the member, and keeps the card", async () => {
    const provider = shop();
    const [card] = await provider.adminCreateCodes({
      kind: "membership",
      tier: "maker",
      months: 3,
      quantity: 1,
      numberAsCards: true,
      firstCardNumber: 31,
    });
    const attempt = provider.adminRedeemCodeFor(MAYA, "031");
    await expect(attempt).rejects.toThrow(/already pays for a membership/);
    await expect(attempt).rejects.toThrow(/has not been used/);
    await expect(attempt).rejects.not.toThrow(/^You /);
    const row = (await provider.adminListCodes()).find((c) => c.id === card!.id)!;
    expect(row.redeemedAt ?? null).toBeNull();
    expect(provider.takeCodeClaims()).toEqual([]);
  });

  it("books and pays a class for the member, and keeps the card when the class is full", async () => {
    const provider = shop(ADMIN);
    const session = await provider.adminUpsertClass({
      title: "Cutting Board Workshop",
      startsAt: day(7),
      endsAt: day(7, 20),
      capacity: 1,
      instructorId: "u-staff",
      priceCents: 4000,
      published: true,
    });
    await provider.adminCreateCodes({
      kind: "class",
      maxPriceCents: 5000,
      quantity: 2,
      numberAsCards: true,
      firstCardNumber: 50,
    });
    const offer = await provider.adminGetCodeOfferFor(JORDAN, "050");
    expect(offer.classes?.map((c) => c.id)).toContain(session.id);

    await expect(provider.adminRedeemCodeFor(JORDAN, "050")).rejects.toThrow(/choose a class/i);
    const done = await provider.adminRedeemCodeFor(JORDAN, "050", { classSessionId: session.id });
    expect(done.classSessionId).toBe(session.id);
    const booking = (await provider.adminListRoster(session.id)).find(
      (b) => b.userId === JORDAN,
    )!;
    expect(booking.paidAt).toBeTruthy();
    expect(await balance(provider, JORDAN)).toBe(0);

    // The one seat is gone: the second card stays unused.
    await expect(
      provider.adminRedeemCodeFor(ALEX, "051", { classSessionId: session.id }),
    ).rejects.toThrow(/full/i);
    const second = (await provider.adminListCodes()).find((c) => c.cardNumber === 51)!;
    expect(second.redeemedAt ?? null).toBeNull();
    expect(await balance(provider, ALEX)).toBe(0);
  });
});

describe("who may redeem by card number", () => {
  it("staff only, at the door", () => {
    expect(RPC_RULES.adminRedeemCodeFor.access).toBe("staff");
    expect(RPC_RULES.adminGetCodeOfferFor.access).toBe("staff");
    expect(RPC_RULES.adminCreateMember.access).toBe("staff");
  });

  it("turns a member away from the staff method and grants nothing", async () => {
    const provider = shop(ADMIN);
    await creditCards(provider, 1, 14);
    const maya = await provider.getMember(MAYA);
    const before = await balance(provider, MAYA);
    const asMember = await handleDataRpc({
      method: "adminRedeemCodeFor",
      args: [MAYA, "014"],
      sessionUser: maya,
      provider,
    });
    expect(asMember.body).toEqual({ ok: false, error: "Staff only" });
    expect(await balance(provider, MAYA)).toBe(before);
  });

  it("refuses the method itself when whoever is acting is not staff", async () => {
    const provider = shop(ADMIN);
    await creditCards(provider, 1, 14);
    const before = await balance(provider, MAYA);
    await provider.setCurrentUserId(MAYA);
    await expect(provider.adminRedeemCodeFor(MAYA, "014")).rejects.toThrow("Staff only");
    await expect(provider.adminGetCodeOfferFor(MAYA, "014")).rejects.toThrow("Staff only");
    await expect(
      provider.adminCreateMember({ firstName: "Pat", email: "pat@example.com" }),
    ).rejects.toThrow("Staff only");
    expect(await balance(provider, MAYA)).toBe(before);
  });

  it("a card number typed on the member's redeem page redeems nothing", async () => {
    const provider = shop(ADMIN);
    const [card] = await creditCards(provider, 1, 14);
    for (const typed of ["014", "14", "#014", "card 014"]) {
      await expect(provider.getCodeOffer(JORDAN, typed)).rejects.toThrow(INVALID);
      await expect(provider.redeemCode(JORDAN, typed)).rejects.toThrow(INVALID);
    }
    expect(await balance(provider, JORDAN)).toBe(0);
    const row = (await provider.adminListCodes()).find((c) => c.id === card!.id)!;
    expect(row.redeemedAt ?? null).toBeNull();
    // The full code still works on the member's page.
    await provider.redeemCode(JORDAN, card!.code);
    expect(await balance(provider, JORDAN)).toBe(2500);
    const after = (await provider.adminListCodes()).find((c) => c.id === card!.id)!;
    expect(after.redeemedByStaffId ?? null).toBeNull();
  });
});

describe("adding a recipient who has no account", () => {
  it("makes an ordinary pending member with no shop access, under the email sign-in will use", async () => {
    const provider = shop(STAFF);
    const pat = await provider.adminCreateMember({
      firstName: " Pat ",
      lastName: "Rivera",
      email: "  Pat.Rivera@Example.COM ",
    });
    expect(pat).toMatchObject({
      email: "pat.rivera@example.com",
      firstName: "Pat",
      lastName: "Rivera",
      displayName: "Pat Rivera",
      role: "member",
      status: "pending",
      shopAccess: false,
      profileComplete: false,
    });
    expect(pat.tier ?? null).toBeNull();
    const audit = (await provider.adminListAuditEvents(pat.id)).find(
      (e) => e.action === "member_created",
    )!;
    expect(audit.actorId).toBe(STAFF);
  });

  it("refuses an email someone already has, and points staff at them", async () => {
    const provider = shop();
    const maya = await provider.getMember(MAYA);
    await expect(
      provider.adminCreateMember({ firstName: "M", lastName: "C", email: maya.email.toUpperCase() }),
    ).rejects.toThrow(`That email already belongs to ${maya.displayName}.`);
  });

  it("needs a first name and a real email address", async () => {
    const provider = shop();
    await expect(
      provider.adminCreateMember({ firstName: " ", lastName: "R", email: "pat@example.com" }),
    ).rejects.toThrow(/first name/i);
    await expect(
      provider.adminCreateMember({ firstName: "Pat", lastName: "R", email: "Pat <pat@example.com>" }),
    ).rejects.toThrow(/email/i);
    await expect(
      provider.adminCreateMember({ firstName: "Pat", lastName: "R", email: "" }),
    ).rejects.toThrow(/email/i);
  });

  it("lets staff redeem a card for the person they just added", async () => {
    const provider = shop();
    await creditCards(provider, 1, 14);
    const pat = await provider.adminCreateMember({
      firstName: "Pat",
      lastName: "Rivera",
      email: "pat@example.com",
    });
    await provider.adminRedeemCodeFor(pat.id, "014");
    expect(await balance(provider, pat.id)).toBe(2500);
    expect((await provider.adminListMembers("pat@example.com")).map((u) => u.id)).toEqual([pat.id]);
  });
});
