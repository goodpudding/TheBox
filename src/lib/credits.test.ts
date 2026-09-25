import { describe, expect, it } from "vitest";
import {
  AREA_HOURLY_RATE_CENTS,
  PLUS_CREDIT_GRANT_CENTS,
  balanceFromEntries,
  classCreditsShortfallMessage,
  hourlyRateCentsFor,
  inferCreditGrantCents,
  machineDebitCents,
} from "./credits";
import { createMockDataProvider, MockDataProvider } from "@/lib/data/mock-provider";
import { cloneFixtures, loadFixtures } from "@/lib/data/load-fixtures";
import type { ZeffyPayment } from "@/lib/zeffy/types";

describe("credit math", () => {
  it("grants $50 for Plus / machine-credit copy, not other tiers", () => {
    expect(
      inferCreditGrantCents({ name: "Membership Plus", priceCents: 7500 }),
    ).toBe(PLUS_CREDIT_GRANT_CENTS);
    expect(
      inferCreditGrantCents({
        name: "Maker",
        summary: "Plus $50 worth of machine credit",
        priceCents: 7500,
      }),
    ).toBe(5000);
    expect(inferCreditGrantCents({ name: "Membership", priceCents: 4000 })).toBe(
      0,
    );
    expect(inferCreditGrantCents({ name: "Student", priceCents: 2000 })).toBe(0);
    expect(
      inferCreditGrantCents({ name: "Unlimited", tier: "unlimited" }),
    ).toBe(0);
    expect(
      inferCreditGrantCents({ name: "Maker Pro", tier: "maker_pro" }),
    ).toBe(5000);
  });

  it("bills fractional hours and allows a $0 machine", () => {
    expect(hourlyRateCentsFor({ area: "laser", hourlyRateCents: null })).toBe(
      AREA_HOURLY_RATE_CENTS.laser,
    );
    expect(
      machineDebitCents(1500, "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z"),
    ).toBe(1500);
    expect(
      machineDebitCents(1500, "2026-09-01T10:00:00Z", "2026-09-01T10:06:00Z"),
    ).toBe(150);
    expect(
      machineDebitCents(0, "2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z"),
    ).toBe(0);
  });

  it("settles overage by addition — next grant pays debt first", () => {
    expect(
      balanceFromEntries([
        { amountCents: -1200 },
        { amountCents: 5000 },
      ]),
    ).toBe(3800);
  });
});

function plusPayment(id = "pay-plus-1"): ZeffyPayment {
  return {
    id,
    object: "payment",
    created: 1_700_000_000,
    amount: 7500,
    currency: "usd",
    status: "succeeded",
    campaign_id: "camp-plus",
    campaign_type: "ticketing",
    campaign_category: "MembershipV2",
    buyer: {
      email: "maya.chen@example.com",
      first_name: "Maya",
      last_name: "Chen",
    },
    items: [
      {
        id: "i-plus",
        type: "ticket",
        amount: 7500,
        currency: "usd",
        rate_id: "rate-plus",
        rate_title: "Membership Plus",
      },
    ],
  };
}

function makerPayment(id = "pay-maker-1"): ZeffyPayment {
  return {
    ...plusPayment(id),
    amount: 4000,
    campaign_id: "camp-maker",
    items: [
      {
        id: "i-maker",
        type: "ticket",
        amount: 4000,
        currency: "usd",
        rate_id: "rate-maker",
        rate_title: "Membership",
      },
    ],
  };
}

describe("credit ledger in the mock provider", () => {
  it("starts Maya at the fixture Plus grant minus machine time", async () => {
    const provider = createMockDataProvider("u-maya");
    const wallet = await provider.getCreditWallet("u-maya");
    expect(wallet.balanceCents).toBe(3250);
  });

  it("grants $50 once per succeeded Plus payment and $0 for Maker", async () => {
    const bundle = cloneFixtures(loadFixtures());
    bundle.creditLedgerEntries = [];
    const provider = new MockDataProvider(bundle, "u-maya");

    const first = await provider.applyZeffyMembershipPayment(plusPayment());
    expect(first.status).toBe("applied");
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(5000);

    const dup = await provider.applyZeffyMembershipPayment(plusPayment());
    expect(dup.status).toBe("duplicate");
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(5000);

    await provider.applyZeffyMembershipPayment(makerPayment());
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(5000);
  });

  it("debits machine time on endAccess and will not block a negative balance", async () => {
    const bundle = cloneFixtures(loadFixtures());
    bundle.creditLedgerEntries = [];
    const provider = new MockDataProvider(bundle, "u-maya");

    const open = (await provider.getUsage("u-maya")).find((s) => !s.endedAt);
    expect(open).toBeTruthy();
    const machine = (await provider.listMachines()).find(
      (m) => m.id === open!.machineId,
    );
    expect(machine).toBeTruthy();

    const ended = await provider.endAccess({
      readerKey: machine!.readerKey,
      sessionId: open!.id,
    });
    expect(ended.endedAt).toBeTruthy();

    const wallet = await provider.getCreditWallet("u-maya");
    const machineLine = wallet.entries.find(
      (e) => e.kind === "machine" && e.usageSessionId === ended.id,
    );
    expect(machineLine).toBeTruthy();
    expect(machineLine!.amountCents).toBeLessThan(0);

    await provider
      .endAccess({
        readerKey: machine!.readerKey,
        sessionId: open!.id,
      })
      .catch(() => undefined);

    const after = await provider.getCreditWallet("u-maya");
    expect(
      after.entries.filter((e) => e.usageSessionId === ended.id),
    ).toHaveLength(1);
  });

  it("lets a job finish past zero, then next Plus grant pays the debt first", async () => {
    const bundle = cloneFixtures(loadFixtures());
    bundle.creditLedgerEntries = [
      {
        id: "cl-debt",
        userId: "u-maya",
        kind: "machine",
        amountCents: -6200,
        occurredAt: "2026-09-01T12:00:00.000Z",
        createdAt: "2026-09-01T12:00:00.000Z",
        updatedAt: "2026-09-01T12:00:00.000Z",
        note: "Laser overage",
      },
    ];
    const provider = new MockDataProvider(bundle, "u-maya");
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(-6200);

    await provider.applyZeffyMembershipPayment(plusPayment("pay-plus-next"));
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(-1200);
  });

  it("pays a class with credits or explains that Zeffy is the full amount", async () => {
    const bundle = cloneFixtures(loadFixtures());
    bundle.creditLedgerEntries = [
      {
        id: "cl-grant",
        userId: "u-maya",
        kind: "membership_grant",
        amountCents: 5000,
        occurredAt: "2026-09-01T10:00:00.000Z",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
        note: "Plus",
      },
    ];
    const provider = new MockDataProvider(bundle, "u-maya");

    const cheap = await provider.book("class-live-workshop-3d", "u-maya");
    expect(cheap.status).toBe("awaiting_payment");
    const paid = await provider.payBookingWithCredits(cheap.id, "u-maya");
    expect(paid.status).toBe("booked");
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(1500);

    const cancelled = await provider.cancel(paid.id, "u-maya");
    expect(cancelled.status).toBe("cancelled");
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(5000);

    const shortBundle = cloneFixtures(loadFixtures());
    shortBundle.creditLedgerEntries = [
      {
        id: "cl-grant-2",
        userId: "u-maya",
        kind: "membership_grant",
        amountCents: 1200,
        occurredAt: "2026-09-01T10:00:00.000Z",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
    ];
    const short = new MockDataProvider(shortBundle, "u-maya");
    const pricey = await short.book("class-live-workshop-3d", "u-maya");
    await expect(
      short.payBookingWithCredits(pricey.id, "u-maya"),
    ).rejects.toThrow(classCreditsShortfallMessage(1200, 3500));
  });

  it("records staff grants and idempotent Zeffy paybacks", async () => {
    const bundle = cloneFixtures(loadFixtures());
    bundle.creditLedgerEntries = [];
    const provider = new MockDataProvider(bundle, "u-admin");
    await provider.adminGrantCredits({
      userId: "u-maya",
      amountCents: 2500,
      actorId: "u-admin",
      note: "Payback at desk",
    });
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(2500);

    await provider.adminGrantCredits({
      userId: "u-maya",
      amountCents: 1000,
      actorId: "u-admin",
      sourcePaymentId: "pay-back-1",
      note: "Zeffy payback",
    });
    const again = await provider.adminGrantCredits({
      userId: "u-maya",
      amountCents: 1000,
      actorId: "u-admin",
      sourcePaymentId: "pay-back-1",
    });
    expect(again.sourcePaymentId).toBe("pay-back-1");
    expect((await provider.getCreditWallet("u-maya")).balanceCents).toBe(3500);
  });
});
