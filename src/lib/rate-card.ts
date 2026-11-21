/**
 * The shop's machine prices: every number that is the shop's decision.
 *
 * Staff edit these under Admin → Settings → Machine rates. They are kept as
 * one SiteRecord row (`rateCard:default`). `DEFAULT_RATE_CARD` is the card as
 * it stood when it was a table of constants (Trey, October 2026), and is what
 * applies until staff save their own.
 *
 * Not on the card:
 * - Which machines are included with membership (woodshop, hand tools,
 *   sewing, vinyl). Charging for one of those is a change to how the shop
 *   works, not a new number.
 * - The machine credit a membership grants. That belongs to each membership
 *   product, which comes from Zeffy.
 */

export type RateCard = {
  laserMemberHourlyCents: number;
  laserNonmemberHourlyCents: number;
  laserMinimumCents: number;
  cncMemberHourlyCents: number;
  cncNonmemberHourlyCents: number;
  cncMinimumCents: number;
  plasmaMemberHourlyCents: number;
  plasmaNonmemberHourlyCents: number;
  plasmaSetupCents: number;
  /** The setup fee is not charged on the last Saturday of a month or the Sunday after it. */
  plasmaSetupWaivedLastWeekend: boolean;
  printerMemberMinimumCents: number;
  printerNonmemberMinimumCents: number;
  /** What the shop pays for a kilogram of filament. */
  filamentCentsPerKg: number;
  /** 1.3 means cost plus 30%. */
  filamentMarkup: number;
  sublimationMemberCents: number;
  sublimationNonmemberCents: number;
  /** Run time is rounded up to this many minutes. */
  roundUpMinutes: number;
};

export const DEFAULT_RATE_CARD: RateCard = {
  laserMemberHourlyCents: 1500,
  laserNonmemberHourlyCents: 2500,
  laserMinimumCents: 500,
  cncMemberHourlyCents: 1000,
  cncNonmemberHourlyCents: 2000,
  cncMinimumCents: 1000,
  plasmaMemberHourlyCents: 1500,
  plasmaNonmemberHourlyCents: 2500,
  plasmaSetupCents: 5000,
  plasmaSetupWaivedLastWeekend: true,
  printerMemberMinimumCents: 100,
  printerNonmemberMinimumCents: 500,
  filamentCentsPerKg: 1200,
  filamentMarkup: 1.3,
  sublimationMemberCents: 100,
  sublimationNonmemberCents: 200,
  roundUpMinutes: 5,
};

/** The SiteRecord row the card is kept in. */
export const RATE_CARD_RECORD_ID = "rateCard:default";

type Rule =
  | { kind: "cents"; max: number; label: string }
  | { kind: "minutes"; label: string }
  | { kind: "markup"; label: string }
  | { kind: "flag"; label: string };

const HOURLY_MAX = 100_000; // $1,000 an hour
const FEE_MAX = 100_000; // $1,000

/** What each field is called on the form, and what a sane value looks like. */
export const RATE_CARD_RULES: Record<keyof RateCard, Rule> = {
  laserMemberHourlyCents: { kind: "cents", max: HOURLY_MAX, label: "Laser, member, per hour" },
  laserNonmemberHourlyCents: { kind: "cents", max: HOURLY_MAX, label: "Laser, non-member, per hour" },
  laserMinimumCents: { kind: "cents", max: FEE_MAX, label: "Laser, minimum charge" },
  cncMemberHourlyCents: { kind: "cents", max: HOURLY_MAX, label: "CNC, member, per hour" },
  cncNonmemberHourlyCents: { kind: "cents", max: HOURLY_MAX, label: "CNC, non-member, per hour" },
  cncMinimumCents: { kind: "cents", max: FEE_MAX, label: "CNC, minimum charge" },
  plasmaMemberHourlyCents: { kind: "cents", max: HOURLY_MAX, label: "Plasma, member, per hour" },
  plasmaNonmemberHourlyCents: { kind: "cents", max: HOURLY_MAX, label: "Plasma, non-member, per hour" },
  plasmaSetupCents: { kind: "cents", max: FEE_MAX, label: "Plasma, setup fee" },
  plasmaSetupWaivedLastWeekend: {
    kind: "flag",
    label: "No plasma setup fee on the last weekend of the month",
  },
  printerMemberMinimumCents: { kind: "cents", max: FEE_MAX, label: "3D print, member, minimum charge" },
  printerNonmemberMinimumCents: {
    kind: "cents",
    max: FEE_MAX,
    label: "3D print, non-member, minimum charge",
  },
  filamentCentsPerKg: { kind: "cents", max: 1_000_000, label: "Filament, what the shop pays per kg" },
  filamentMarkup: { kind: "markup", label: "Filament markup" },
  sublimationMemberCents: { kind: "cents", max: FEE_MAX, label: "Sublimation, member, per print" },
  sublimationNonmemberCents: { kind: "cents", max: FEE_MAX, label: "Sublimation, non-member, per print" },
  roundUpMinutes: { kind: "minutes", label: "Round run time up to (minutes)" },
};

export const RATE_CARD_FIELDS = Object.keys(RATE_CARD_RULES) as (keyof RateCard)[];

const MARKUP_MAX = 10;
const ROUND_UP_MAX = 60;

/** Why a value cannot go on the card, or null when it can. */
function problem(field: keyof RateCard, value: unknown): string | null {
  const rule = RATE_CARD_RULES[field];
  if (rule.kind === "flag") {
    return typeof value === "boolean" ? null : `${rule.label} must be on or off.`;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return `${rule.label} must be a number.`;
  }
  if (rule.kind === "markup") {
    if (value < 1) return `${rule.label} cannot be below cost (0%).`;
    if (value > MARKUP_MAX) return `${rule.label} is too high.`;
    return null;
  }
  if (!Number.isInteger(value)) {
    return rule.kind === "minutes"
      ? `${rule.label} must be a whole number of minutes.`
      : `${rule.label} must be a whole number of cents.`;
  }
  if (rule.kind === "minutes") {
    return value >= 1 && value <= ROUND_UP_MAX
      ? null
      : `${rule.label} must be between 1 and ${ROUND_UP_MAX}.`;
  }
  if (value < 0) return `${rule.label} cannot be negative.`;
  if (value > rule.max) return `${rule.label} is too high.`;
  return null;
}

/**
 * A stored card made safe to price with. A field that is missing or is not a
 * value the form would accept takes the default, one field at a time, so a
 * damaged row can never turn a price into zero or into nonsense.
 */
export function normalizeRateCard(raw: unknown): RateCard {
  const stored = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const card: Record<string, number | boolean> = { ...DEFAULT_RATE_CARD };
  for (const field of RATE_CARD_FIELDS) {
    if (field in stored && problem(field, stored[field]) === null) {
      card[field] = stored[field] as number | boolean;
    }
  }
  return card as RateCard;
}

/**
 * The card with staff's changes applied. Throws a sentence staff can act on
 * for the first value that will not do. Unknown fields are ignored.
 */
export function applyRateCardPatch(current: RateCard, patch: unknown): RateCard {
  if (!patch || typeof patch !== "object") throw new Error("Nothing to save.");
  const input = patch as Record<string, unknown>;
  const next: Record<string, number | boolean> = { ...current };
  for (const field of RATE_CARD_FIELDS) {
    if (!(field in input) || input[field] === undefined) continue;
    const why = problem(field, input[field]);
    if (why) throw new Error(why);
    next[field] = input[field] as number | boolean;
  }
  return next as RateCard;
}

/** The fields that differ, as { field: { from, to } }, for the audit trail. */
export function rateCardChanges(
  before: RateCard,
  after: RateCard,
): Partial<Record<keyof RateCard, { from: number | boolean; to: number | boolean }>> {
  const changes: Partial<Record<keyof RateCard, { from: number | boolean; to: number | boolean }>> = {};
  for (const field of RATE_CARD_FIELDS) {
    if (before[field] !== after[field]) {
      changes[field] = { from: before[field], to: after[field] };
    }
  }
  return changes;
}
