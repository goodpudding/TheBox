import { describe, expect, it } from "vitest";
import { quoteMachineJob, deskChargeHint, billingFor } from "./credits";
import {
  DEFAULT_RATE_CARD,
  applyRateCardPatch,
  normalizeRateCard,
  rateCardChanges,
} from "./rate-card";

const laser = { id: "m-laser", name: "Glowforge Laser", area: "laser" as const };
const plasma = { id: "m-plasma", name: "Langmuir CNC Plasma", area: "cnc_plasma" as const };
const printer = { id: "m-printer", name: "Bambu A1", area: "3d_printing" as const };
const member = { tier: "maker" as const, shopAccess: true, status: "active" };
const dayPass = { tier: "day" as const, shopAccess: true, status: "active" };
const ORDINARY = new Date(2026, 9, 15);
const LAST_SATURDAY = new Date(2026, 9, 31);

describe("a changed card", () => {
  it("changes the charge, the minimum and the desk hint together", () => {
    const rates = applyRateCardPatch(DEFAULT_RATE_CARD, {
      laserMemberHourlyCents: 1800,
      laserMinimumCents: 600,
    });
    expect(
      quoteMachineJob({ machine: laser, payer: member, runtimeSeconds: 3600, at: ORDINARY, rates })
        .billedCents,
    ).toBe(1800);
    expect(
      quoteMachineJob({ machine: laser, payer: member, runtimeSeconds: 60, at: ORDINARY, rates })
        .billedCents,
    ).toBe(600);
    // The non-member rate was not touched.
    expect(
      quoteMachineJob({ machine: laser, payer: dayPass, runtimeSeconds: 3600, at: ORDINARY, rates })
        .billedCents,
    ).toBe(2500);
    expect(deskChargeHint({ ...laser, hourlyRateCents: null }, rates)).toBe(
      "Glowforge Laser is $18.00/hr members / $25.00/hr nonmembers of estimated run time (round up 5 min, $6.00 minimum). Sitting here does not start a clock.",
    );
    expect(billingFor({ ...laser, hourlyRateCents: null }, rates).hourlyRateCents).toBe(1800);
  });

  it("prices filament from the cost and markup on the card", () => {
    const rates = applyRateCardPatch(DEFAULT_RATE_CARD, {
      filamentCentsPerKg: 2000,
      filamentMarkup: 1.5,
      printerMemberMinimumCents: 150,
    });
    // 2000 × 1.5 / 1000 = 3¢ a gram.
    expect(
      quoteMachineJob({ machine: printer, payer: member, filamentGrams: 100, rates }).billedCents,
    ).toBe(300);
    expect(
      quoteMachineJob({ machine: printer, payer: member, filamentGrams: 10, rates }).billedCents,
    ).toBe(150);
    expect(deskChargeHint({ ...printer, hourlyRateCents: null }, rates)).toContain(
      "(cost + 50%, about 3.00¢/g; $1.50 member / $5 nonmember min)",
    );
  });

  it("rounds run time up to the card's increment", () => {
    const rates = applyRateCardPatch(DEFAULT_RATE_CARD, { roundUpMinutes: 15 });
    const quote = quoteMachineJob({
      machine: laser,
      payer: member,
      runtimeSeconds: 16 * 60,
      at: ORDINARY,
      rates,
    });
    expect(quote.minutesBilled).toBe(30);
    expect(quote.billedCents).toBe(750);
  });

  it("charges the plasma setup every day once the waiver is switched off", () => {
    const rates = applyRateCardPatch(DEFAULT_RATE_CARD, { plasmaSetupWaivedLastWeekend: false });
    const quote = quoteMachineJob({
      machine: plasma,
      payer: member,
      runtimeSeconds: 15 * 60,
      at: LAST_SATURDAY,
      rates,
    });
    expect(quote).toMatchObject({ billedCents: 5375, setupWaived: false, setupCents: 5000 });
    expect(deskChargeHint({ ...plasma, hourlyRateCents: null }, rates)).not.toContain("waived");
  });
});

describe("normalizeRateCard", () => {
  it("is the default card when nothing is stored", () => {
    expect(normalizeRateCard(null)).toEqual(DEFAULT_RATE_CARD);
    expect(normalizeRateCard("nonsense")).toEqual(DEFAULT_RATE_CARD);
    expect(normalizeRateCard({})).toEqual(DEFAULT_RATE_CARD);
  });

  it("keeps good fields and replaces each bad one with its default", () => {
    const card = normalizeRateCard({
      laserMemberHourlyCents: 1800,
      laserNonmemberHourlyCents: "2500",
      laserMinimumCents: -5,
      cncMemberHourlyCents: null,
      plasmaSetupCents: 12.5,
      filamentMarkup: 0,
      roundUpMinutes: 0,
      plasmaSetupWaivedLastWeekend: "no",
      somethingElse: 1,
    });
    expect(card).toEqual({ ...DEFAULT_RATE_CARD, laserMemberHourlyCents: 1800 });
    expect(card).not.toHaveProperty("somethingElse");
  });

  it("lets a price be zero when staff set it to zero", () => {
    expect(normalizeRateCard({ laserMinimumCents: 0 }).laserMinimumCents).toBe(0);
  });
});

describe("applyRateCardPatch", () => {
  it.each([
    [{ laserMemberHourlyCents: -1 }, "Laser, member, per hour cannot be negative."],
    [{ laserMemberHourlyCents: 15.5 }, "Laser, member, per hour must be a whole number of cents."],
    [{ laserMemberHourlyCents: 10_000_000 }, "Laser, member, per hour is too high."],
    [{ cncMinimumCents: Number.NaN }, "CNC, minimum charge must be a number."],
    [{ sublimationMemberCents: "100" }, "Sublimation, member, per print must be a number."],
    [{ filamentMarkup: 0.9 }, "Filament markup cannot be below cost (0%)."],
    [{ filamentMarkup: 11 }, "Filament markup is too high."],
    [{ roundUpMinutes: 0 }, "Round run time up to (minutes) must be between 1 and 60."],
    [{ roundUpMinutes: 2.5 }, "Round run time up to (minutes) must be a whole number of minutes."],
    [
      { plasmaSetupWaivedLastWeekend: 1 },
      "No plasma setup fee on the last weekend of the month must be on or off.",
    ],
  ])("refuses %j", (patch, message) => {
    expect(() => applyRateCardPatch(DEFAULT_RATE_CARD, patch)).toThrow(message);
  });

  it("changes only what was sent and ignores fields it does not know", () => {
    const next = applyRateCardPatch(DEFAULT_RATE_CARD, {
      cncMemberHourlyCents: 1200,
      notARate: 5,
    } as never);
    expect(next).toEqual({ ...DEFAULT_RATE_CARD, cncMemberHourlyCents: 1200 });
    expect(rateCardChanges(DEFAULT_RATE_CARD, next)).toEqual({
      cncMemberHourlyCents: { from: 1000, to: 1200 },
    });
  });
});
