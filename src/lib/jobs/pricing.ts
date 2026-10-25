/**
 * Pure pricing for machine jobs. See docs/machine-billing-spec.md §4.
 * All money is integer cents. No I/O here — keep it testable.
 */

export type RateUnit = "minute" | "gram" | "print";

export interface MachineRateInput {
  unit: RateUnit;
  memberCentsPerUnit: number;
  /** null/undefined => nonmemberMultiplier × member */
  nonmemberCentsPerUnit?: number | null;
  memberMinimumCents?: number;
  nonmemberMinimumCents?: number;
  /** time jobs round up to this many minutes (default 5) */
  roundingMinutes?: number;
}

export interface PriceJobInput {
  rate: MachineRateInput;
  /** minutes for "minute" rates, grams for "gram", count for "print" */
  quantity: number;
  /** true for shop-access members; false for day pass / nonmembers */
  isMember: boolean;
  /** Unlimited tier: everything prices to $0 */
  unlimited?: boolean;
  /** member's remaining credit this period, in cents */
  creditAvailableCents?: number;
  /** OrgSettings.nonmemberMultiplier, default 1.5 */
  nonmemberMultiplier?: number;
}

export interface PriceJobResult {
  /** quantity after rounding (e.g. 23 min -> 25) */
  billableQuantity: number;
  listCents: number;
  creditAppliedCents: number;
  chargedCents: number;
  rateCentsPerUnit: number;
}

export function roundQuantity(
  quantity: number,
  unit: RateUnit,
  roundingMinutes = 5,
): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (unit === "minute") {
    const step = Math.max(1, roundingMinutes);
    return Math.ceil(quantity / step) * step;
  }
  return Math.ceil(quantity); // whole grams / whole prints
}

export function effectiveRateCents(
  rate: MachineRateInput,
  isMember: boolean,
  nonmemberMultiplier = 1.5,
): number {
  if (isMember) return rate.memberCentsPerUnit;
  if (rate.nonmemberCentsPerUnit != null) return rate.nonmemberCentsPerUnit;
  return rate.memberCentsPerUnit * nonmemberMultiplier; // may be fractional; totals are rounded
}

export function priceJob(input: PriceJobInput): PriceJobResult {
  const { rate, isMember } = input;
  const billableQuantity = roundQuantity(
    input.quantity,
    rate.unit,
    rate.roundingMinutes,
  );

  if (input.unlimited) {
    return {
      billableQuantity,
      listCents: 0,
      creditAppliedCents: 0,
      chargedCents: 0,
      rateCentsPerUnit: 0,
    };
  }

  const rateCentsPerUnit = effectiveRateCents(
    rate,
    isMember,
    input.nonmemberMultiplier,
  );

  // Per-minute rates are stored per hour in admin for readability; callers
  // pass cents per unit already normalised (cents per minute for "minute").
  const raw = Math.round(billableQuantity * rateCentsPerUnit);
  const minimum = isMember
    ? (rate.memberMinimumCents ?? 0)
    : (rate.nonmemberMinimumCents ?? 0);
  const listCents = billableQuantity === 0 ? 0 : Math.max(raw, minimum);

  const credit = Math.max(0, Math.floor(input.creditAvailableCents ?? 0));
  const creditAppliedCents = isMember ? Math.min(credit, listCents) : 0;
  const chargedCents = listCents - creditAppliedCents;

  return {
    billableQuantity,
    listCents,
    creditAppliedCents,
    chargedCents,
    rateCentsPerUnit,
  };
}

/** Convenience: $15/hr -> 25 cents/min. Fractional cents are kept (use with ceil above). */
export function hourlyToPerMinuteCents(centsPerHour: number): number {
  return centsPerHour / 60;
}

/** Draft seed rates from the spec. Admin table overrides these. */
export const DRAFT_RATES: Record<string, MachineRateInput> = {
  laser: {
    unit: "minute",
    memberCentsPerUnit: hourlyToPerMinuteCents(1500), // $15/hr
    memberMinimumCents: 500, // $5 (20 min)
    nonmemberMinimumCents: 1125, // 30 min
    roundingMinutes: 5,
  },
  fdm: {
    unit: "gram",
    memberCentsPerUnit: 1.56, // 1.56¢/g
    memberMinimumCents: 100,
    nonmemberMinimumCents: 1000,
  },
  sublimation: {
    unit: "print",
    memberCentsPerUnit: 250,
    nonmemberCentsPerUnit: 400,
    memberMinimumCents: 250,
    nonmemberMinimumCents: 400,
  },
  resin: {
    unit: "gram",
    // ≈4.6¢/g (spec §4, DRAFT — James confirms). Nonmember = 1.5×.
    memberCentsPerUnit: 4.6,
    memberMinimumCents: 200,
    nonmemberMinimumCents: 1000,
  },
  // Hourly rate is TBD (spec §11). Seeded at 0 so admin can set it
  // without charging a made-up number. Minimums are 15 min / 30 min
  // once a rate exists; cent minimums can't be derived until then.
  plasma: {
    unit: "minute",
    memberCentsPerUnit: 0,
    memberMinimumCents: 0,
    nonmemberMinimumCents: 0,
    roundingMinutes: 5,
  },
  cnc: {
    unit: "minute",
    memberCentsPerUnit: 0,
    memberMinimumCents: 0,
    nonmemberMinimumCents: 0,
    roundingMinutes: 5,
  },
};
