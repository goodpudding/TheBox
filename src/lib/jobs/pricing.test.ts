import { describe, expect, it } from "vitest";
import {
  DRAFT_RATES,
  effectiveRateCents,
  priceJob,
  roundQuantity,
} from "./pricing";

describe("roundQuantity", () => {
  it("rounds minutes up to the next 5", () => {
    expect(roundQuantity(23, "minute")).toBe(25);
    expect(roundQuantity(25, "minute")).toBe(25);
    expect(roundQuantity(1, "minute")).toBe(5);
  });
  it("rounds grams up to whole grams", () => {
    expect(roundQuantity(667.2, "gram")).toBe(668);
  });
  it("treats zero/negative as zero", () => {
    expect(roundQuantity(0, "gram")).toBe(0);
    expect(roundQuantity(-3, "minute")).toBe(0);
  });
});

describe("priceJob — FDM per gram", () => {
  it("charges a Maker $10.42 for 668 g at 1.56¢/g", () => {
    const r = priceJob({ rate: DRAFT_RATES.fdm, quantity: 668, isMember: true });
    expect(r.listCents).toBe(1042); // 668 × 1.56 = 1042.08 → $10.42
    expect(r.chargedCents).toBe(1042);
  });
  it("applies member credit first", () => {
    const r = priceJob({
      rate: DRAFT_RATES.fdm,
      quantity: 668,
      isMember: true,
      creditAvailableCents: 1000,
    });
    expect(r.creditAppliedCents).toBe(1000);
    expect(r.chargedCents).toBe(42);
  });
  it("nonmember pays 1.5× and never uses credit", () => {
    const r = priceJob({
      rate: DRAFT_RATES.fdm,
      quantity: 668,
      isMember: false,
      creditAvailableCents: 1000,
    });
    expect(effectiveRateCents(DRAFT_RATES.fdm, false)).toBeCloseTo(2.34);
    expect(r.creditAppliedCents).toBe(0);
    expect(r.chargedCents).toBe(1563); // 668 × 2.34 = 1563.12
  });
  it("enforces the nonmember $10 minimum on tiny prints", () => {
    const r = priceJob({ rate: DRAFT_RATES.fdm, quantity: 12, isMember: false });
    expect(r.chargedCents).toBe(1000);
  });
});

describe("priceJob — laser per hour", () => {
  it("bills a 23-minute job as 25 min at $15/hr", () => {
    const r = priceJob({ rate: DRAFT_RATES.laser, quantity: 23, isMember: true });
    expect(r.billableQuantity).toBe(25);
    expect(r.listCents).toBe(625);
  });
  it("applies the $5 member minimum", () => {
    const r = priceJob({ rate: DRAFT_RATES.laser, quantity: 4, isMember: true });
    expect(r.listCents).toBe(500);
  });
});

describe("priceJob — unlimited", () => {
  it("is $0 but still reports billable quantity", () => {
    const r = priceJob({
      rate: DRAFT_RATES.laser,
      quantity: 90,
      isMember: true,
      unlimited: true,
    });
    expect(r.billableQuantity).toBe(90);
    expect(r.listCents).toBe(0);
    expect(r.chargedCents).toBe(0);
  });
});
