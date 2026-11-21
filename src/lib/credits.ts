import type { Machine, MembershipProduct, MembershipTier } from "@/lib/data/types";
import { isMakerProUpgradeName } from "@/lib/zeffy/upgrade";
import { DEFAULT_RATE_CARD, type RateCard } from "@/lib/rate-card";

/** Membership Plus ($75 Lamplab rate) grants this on each succeeded payment. */
export const PLUS_CREDIT_GRANT_CENTS = 5000;

/**
 * The rate card as it stood in October 2026, under its old names. Prices are
 * worked out from a `RateCard` (src/lib/rate-card.ts), which staff edit; every
 * pricing function below takes one and falls back to the default card. These
 * constants are that default card and nothing prices from them.
 */
export const FILAMENT_MARKUP = DEFAULT_RATE_CARD.filamentMarkup;
/** Default Bambu PLA. */
export const DEFAULT_FILAMENT_CENTS_PER_KG = DEFAULT_RATE_CARD.filamentCentsPerKg;

export const TREY_MACHINE_RATES = {
  woodshopHourlyCents: 0,
  vinylSheetCents: 0,
  laserMemberHourlyCents: DEFAULT_RATE_CARD.laserMemberHourlyCents,
  laserNonmemberHourlyCents: DEFAULT_RATE_CARD.laserNonmemberHourlyCents,
  laserMinimumCents: DEFAULT_RATE_CARD.laserMinimumCents,
  cncMemberHourlyCents: DEFAULT_RATE_CARD.cncMemberHourlyCents,
  cncNonmemberHourlyCents: DEFAULT_RATE_CARD.cncNonmemberHourlyCents,
  cncMinimumCents: DEFAULT_RATE_CARD.cncMinimumCents,
  plasmaMemberHourlyCents: DEFAULT_RATE_CARD.plasmaMemberHourlyCents,
  plasmaNonmemberHourlyCents: DEFAULT_RATE_CARD.plasmaNonmemberHourlyCents,
  plasmaSetupCents: DEFAULT_RATE_CARD.plasmaSetupCents,
  printerMemberMinimumCents: DEFAULT_RATE_CARD.printerMemberMinimumCents,
  printerNonmemberMinimumCents: DEFAULT_RATE_CARD.printerNonmemberMinimumCents,
  sublimationMemberCents: DEFAULT_RATE_CARD.sublimationMemberCents,
  sublimationNonmemberCents: DEFAULT_RATE_CARD.sublimationNonmemberCents,
  /** Member aliases used by older call sites. */
  laserHourlyCents: DEFAULT_RATE_CARD.laserMemberHourlyCents,
  regularCncHourlyCents: DEFAULT_RATE_CARD.cncMemberHourlyCents,
  plasmaHourlyCents: DEFAULT_RATE_CARD.plasmaMemberHourlyCents,
  sublimationSheetCents: DEFAULT_RATE_CARD.sublimationMemberCents,
} as const;

export type MachineBilling = {
  hourlyRateCents: number;
  nonmemberHourlyCents: number;
  setupFeeCents: number;
  sessionRateCents: number;
  nonmemberSessionRateCents: number;
  sessionUnit: "print" | "gram" | null;
  gramRateCents: number;
  minimumCents: number;
  nonmemberMinimumCents: number;
};

type BillingMachine = Pick<
  Machine,
  "id" | "name" | "area" | "hourlyRateCents"
> & {
  setupFeeCents?: number | null;
  sessionRateCents?: number | null;
};

/**
 * These functions take the card as a second argument, and several are handed
 * straight to `.map()`, which passes an index there. Anything that is not a
 * card means the default card, so a price can never be read off a number.
 */
function cardOrDefault(rates: RateCard | undefined): RateCard {
  return rates && typeof rates === "object" ? rates : DEFAULT_RATE_CARD;
}

/** ~1.56¢/g at $12/kg Bambu PLA with 30% markup, on the default card. */
export function centsPerGramFromFilament(
  filamentCentsPerKg = DEFAULT_RATE_CARD.filamentCentsPerKg,
  markup = DEFAULT_RATE_CARD.filamentMarkup,
): number {
  return (filamentCentsPerKg * markup) / 1000;
}

/**
 * How a machine is billed, from the rate card. Which machines bill at all,
 * and by what, is decided here from the area and the name; the numbers come
 * from the card.
 */
export function defaultBillingFor(
  machine: Pick<Machine, "id" | "name" | "area">,
  given: RateCard = DEFAULT_RATE_CARD,
): MachineBilling {
  const rates = cardOrDefault(given);
  const name = (machine.name ?? "").toLowerCase();
  const vinyl =
    machine.id === "m-vinyl-cutter" ||
    (machine.area === "textiles_vinyl" && /vinyl/.test(name));

  if (machine.area === "cnc_plasma") {
    return {
      hourlyRateCents: rates.plasmaMemberHourlyCents,
      nonmemberHourlyCents: rates.plasmaNonmemberHourlyCents,
      setupFeeCents: rates.plasmaSetupCents,
      sessionRateCents: 0,
      nonmemberSessionRateCents: 0,
      sessionUnit: null,
      gramRateCents: 0,
      minimumCents: 0,
      nonmemberMinimumCents: 0,
    };
  }
  if (/\bcnc\b/.test(name) && !/plasma/.test(name)) {
    return {
      hourlyRateCents: rates.cncMemberHourlyCents,
      nonmemberHourlyCents: rates.cncNonmemberHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      nonmemberSessionRateCents: 0,
      sessionUnit: null,
      gramRateCents: 0,
      minimumCents: rates.cncMinimumCents,
      nonmemberMinimumCents: rates.cncMinimumCents,
    };
  }
  if (machine.area === "woodshop" || machine.area === "hand_tools") {
    return emptyBilling();
  }
  if (machine.area === "3d_printing") {
    return {
      hourlyRateCents: 0,
      nonmemberHourlyCents: 0,
      setupFeeCents: 0,
      sessionRateCents: 0,
      nonmemberSessionRateCents: 0,
      sessionUnit: "gram",
      gramRateCents: centsPerGramFromFilament(
        rates.filamentCentsPerKg,
        rates.filamentMarkup,
      ),
      minimumCents: rates.printerMemberMinimumCents,
      nonmemberMinimumCents: rates.printerNonmemberMinimumCents,
    };
  }
  if (machine.area === "sublimation") {
    return {
      hourlyRateCents: 0,
      nonmemberHourlyCents: 0,
      setupFeeCents: 0,
      sessionRateCents: rates.sublimationMemberCents,
      nonmemberSessionRateCents: rates.sublimationNonmemberCents,
      sessionUnit: "print",
      gramRateCents: 0,
      minimumCents: 0,
      nonmemberMinimumCents: 0,
    };
  }
  if (vinyl) {
    return emptyBilling();
  }
  if (machine.area === "textiles_vinyl") {
    return emptyBilling();
  }
  if (machine.area === "laser") {
    return {
      hourlyRateCents: rates.laserMemberHourlyCents,
      nonmemberHourlyCents: rates.laserNonmemberHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      nonmemberSessionRateCents: 0,
      sessionUnit: null,
      gramRateCents: 0,
      minimumCents: rates.laserMinimumCents,
      nonmemberMinimumCents: rates.laserMinimumCents,
    };
  }
  return emptyBilling();
}

function emptyBilling(): MachineBilling {
  return {
    hourlyRateCents: 0,
    nonmemberHourlyCents: 0,
    setupFeeCents: 0,
    sessionRateCents: 0,
    nonmemberSessionRateCents: 0,
    sessionUnit: null,
    gramRateCents: 0,
    minimumCents: 0,
    nonmemberMinimumCents: 0,
  };
}

/**
 * `Machine.hourlyRateCents` is not read. It is a copy of the area rate taken
 * when the machine row was made, so honouring it would freeze each machine at
 * the price of the day it was added. The card is the only price.
 */
export function billingFor(
  machine: BillingMachine,
  rates: RateCard = DEFAULT_RATE_CARD,
): MachineBilling {
  return defaultBillingFor(machine, rates);
}

export type CreditLedgerKind =
  | "membership_grant"
  | "staff_grant"
  | "zeffy_payment"
  | "machine"
  | "machine_refund"
  | "class"
  | "class_refund";

export function inferCreditGrantCents(input: {
  name: string;
  summary?: string | null;
  priceCents?: number;
  tier?: MembershipTier | null;
}): number {
  const name = (input.name ?? "").toLowerCase();
  const summary = (input.summary ?? "").toLowerCase();
  const blob = `${name} ${summary}`;

  if (isMakerProUpgradeName(input.name)) return PLUS_CREDIT_GRANT_CENTS;
  if (/\bunlimited\b/.test(name)) return 0;
  if (/machine credit/.test(blob) || /\$50 of machine/.test(blob)) {
    return PLUS_CREDIT_GRANT_CENTS;
  }
  if (/\bplus\b/.test(name)) return PLUS_CREDIT_GRANT_CENTS;
  if (input.tier === "maker_pro") return PLUS_CREDIT_GRANT_CENTS;
  return 0;
}

export function creditGrantCentsForProduct(
  product: Pick<
    MembershipProduct,
    "name" | "summary" | "priceCents" | "tier" | "creditGrantCents"
  >,
): number {
  if (typeof product.creditGrantCents === "number") return product.creditGrantCents;
  return inferCreditGrantCents({
    name: product.name,
    summary: product.summary,
    priceCents: product.priceCents,
    tier: product.tier,
  });
}

export function hourlyRateCentsFor(
  machine: BillingMachine,
  rates: RateCard = DEFAULT_RATE_CARD,
): number {
  return billingFor(machine, rates).hourlyRateCents;
}

export function durationHours(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

export type MachineBillingMode =
  | "hourly_job"
  | "per_gram"
  | "per_print"
  | "free";
/** @deprecated alias — desk login is not a billing mode. */
export type WorkstationBillingMode = MachineBillingMode;

export function machineBillingMode(
  machine: BillingMachine,
  rates: RateCard = DEFAULT_RATE_CARD,
): MachineBillingMode {
  const b = billingFor(machine, rates);
  if (b.sessionUnit === "gram") return "per_gram";
  if (b.sessionUnit === "print") return "per_print";
  if (b.hourlyRateCents <= 0 && b.setupFeeCents <= 0) return "free";
  return "hourly_job";
}

export function workstationBillingMode(
  machine: BillingMachine,
  rates: RateCard = DEFAULT_RATE_CARD,
): MachineBillingMode {
  return machineBillingMode(machine, rates);
}

export type JobPayer = {
  tier?: MembershipTier | null;
  shopAccess?: boolean;
  status?: string;
};

export function usesMemberMachineRates(payer: JobPayer): boolean {
  if (payer.tier === "day") return false;
  if (payer.shopAccess === false) return false;
  if (payer.status && payer.status !== "active") return false;
  return true;
}

export function unlimitedMachineTime(payer: JobPayer): boolean {
  return payer.tier === "unlimited";
}

/** Round estimated run time up to the card's increment. */
export function billedMinutes(runtimeSeconds: number, rates: RateCard): number {
  if (!Number.isFinite(runtimeSeconds) || runtimeSeconds <= 0) return 0;
  const step = rates.roundUpMinutes;
  return Math.ceil(runtimeSeconds / 60 / step) * step;
}

/**
 * Run time rounded up on the default card (5 minutes). One argument on
 * purpose: it is handed to `.map()`, which would pass an index as a second.
 */
export function billedMinutesFromSeconds(runtimeSeconds: number): number {
  return billedMinutes(runtimeSeconds, DEFAULT_RATE_CARD);
}

function lastSaturdayOfMonth(year: number, month: number): Date {
  const last = new Date(year, month + 1, 0);
  const lastSat = new Date(last);
  while (lastSat.getDay() !== 6) lastSat.setDate(lastSat.getDate() - 1);
  return lastSat;
}

function sameYmd(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * True on the last weekend of a month: the last Saturday and the Sunday after
 * it. The plasma setup fee is waived then, when the card says so.
 */
export function plasmaSetupWaived(at: Date): boolean {
  const lastSat = lastSaturdayOfMonth(at.getFullYear(), at.getMonth());
  const prev = new Date(at.getFullYear(), at.getMonth() - 1, 1);
  const lastSatPrev = lastSaturdayOfMonth(prev.getFullYear(), prev.getMonth());
  const sundayAfterPrev = new Date(lastSatPrev);
  sundayAfterPrev.setDate(lastSatPrev.getDate() + 1);
  return sameYmd(at, lastSat) || sameYmd(at, sundayAfterPrev);
}

export type MachineJobQuote = {
  billedCents: number;
  listCents: number;
  unlimited: boolean;
  memberRate: boolean;
  mode: MachineBillingMode;
  minutesBilled: number | null;
  grams: number | null;
  centsPerGram: number | null;
  prints: number | null;
  setupCents: number;
  setupWaived: boolean;
  minimumCents: number;
  minimumApplied: boolean;
  note: string;
};

/**
 * Charge for sending a job. Desk login must not call this.
 * Unlimited members: log the job, $0 machine time.
 *
 * The estimate a member sees and the amount the server charges both come
 * from this function with the same card. Pass `rates`: without it the
 * default card is used, which is only right where no card has been saved.
 */
export function quoteMachineJob(input: {
  machine: Pick<Machine, "id" | "name" | "area">;
  payer: JobPayer;
  filamentGrams?: number | null;
  runtimeSeconds?: number | null;
  prints?: number | null;
  at?: Date;
  rates?: RateCard;
}): MachineJobQuote {
  const machine = input.machine;
  const rates = input.rates ?? DEFAULT_RATE_CARD;
  const b = billingFor(machine, rates);
  const mode = machineBillingMode(machine, rates);
  const memberRate = usesMemberMachineRates(input.payer);
  const unlimited = unlimitedMachineTime(input.payer);
  const empty: MachineJobQuote = {
    billedCents: 0,
    listCents: 0,
    unlimited,
    memberRate,
    mode,
    minutesBilled: null,
    grams: null,
    centsPerGram: null,
    prints: null,
    setupCents: 0,
    setupWaived: false,
    minimumCents: memberRate ? b.minimumCents : b.nonmemberMinimumCents,
    minimumApplied: false,
    note: `${machine.name} · no job`,
  };

  if (mode === "free") {
    return { ...empty, note: `${machine.name} · included` };
  }

  if (mode === "per_gram") {
    const grams = input.filamentGrams ?? 0;
    if (!Number.isFinite(grams) || grams <= 0) return empty;
    const centsPerGram = centsPerGramFromFilament(
      rates.filamentCentsPerKg,
      rates.filamentMarkup,
    );
    const raw = Math.round(grams * centsPerGram);
    const minimumCents = memberRate
      ? b.minimumCents
      : b.nonmemberMinimumCents;
    const listCents = Math.max(minimumCents, raw);
    const billedCents = unlimited ? 0 : listCents;
    return {
      ...empty,
      billedCents,
      listCents,
      grams,
      centsPerGram,
      minimumCents,
      minimumApplied: raw < minimumCents,
      note: unlimited
        ? `${machine.name} · ${grams} g · Unlimited $0`
        : `${machine.name} · ${grams} g`,
    };
  }

  if (mode === "per_print") {
    const prints =
      input.prints && input.prints > 0 ? Math.round(input.prints) : 0;
    if (prints <= 0) return empty;
    const unit = memberRate ? b.sessionRateCents : b.nonmemberSessionRateCents;
    const listCents = unit * prints;
    const billedCents = unlimited ? 0 : listCents;
    return {
      ...empty,
      billedCents,
      listCents,
      prints,
      note: unlimited
        ? `${machine.name} · ${prints} print${prints === 1 ? "" : "s"} · Unlimited $0`
        : `${machine.name} · ${prints} print${prints === 1 ? "" : "s"}`,
    };
  }

  const minutesBilled = billedMinutes(input.runtimeSeconds ?? 0, rates);
  if (minutesBilled <= 0) return empty;
  const hourly = memberRate ? b.hourlyRateCents : b.nonmemberHourlyCents;
  const timeCents = Math.round((minutesBilled / 60) * hourly);
  const at = input.at ?? new Date();
  const setupWaived =
    b.setupFeeCents > 0 &&
    rates.plasmaSetupWaivedLastWeekend &&
    plasmaSetupWaived(at);
  const setupCents = setupWaived ? 0 : b.setupFeeCents;
  const minimumCents = memberRate ? b.minimumCents : b.nonmemberMinimumCents;
  const raw = setupCents + timeCents;
  const listCents = Math.max(minimumCents, raw);
  const billedCents = unlimited ? 0 : listCents;
  const parts = [`${machine.name}`, `${minutesBilled} min`];
  if (setupCents > 0) parts.push("setup");
  if (setupWaived) parts.push("setup waived");
  if (unlimited) parts.push("Unlimited $0");
  return {
    ...empty,
    billedCents,
    listCents,
    minutesBilled,
    setupCents,
    setupWaived,
    minimumCents,
    minimumApplied: raw < minimumCents,
    note: parts.join(" · "),
  };
}

/**
 * Desk login never bills. Presence at BOX-PC-* is identity + software access.
 */
export function workstationTimeDebitCents(
  _machine?: BillingMachine,
  _startedAt?: string,
  _endedAt?: string,
): number {
  return 0;
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "$1" for a round amount, "$1.50" otherwise. */
function shortDollars(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : dollars(cents);
}

/** Copy for the kiosk: sitting here is not a charge. The prices are the card's. */
export function deskChargeHint(
  machine: Pick<Machine, "name"> & BillingMachine,
  given: RateCard = DEFAULT_RATE_CARD,
): string {
  const rates = cardOrDefault(given);
  const b = billingFor(machine, rates);
  const mode = machineBillingMode(machine, rates);
  switch (mode) {
    case "per_gram": {
      const markupPercent = Math.round((rates.filamentMarkup - 1) * 100);
      return `${machine.name} bills by grams of filament (cost + ${markupPercent}%, about ${b.gramRateCents.toFixed(2)}¢/g; ${shortDollars(b.minimumCents)} member / ${shortDollars(b.nonmemberMinimumCents)} nonmember min). Sitting at this PC does not charge you — you’ll see the estimate before you send the job.`;
    }
    case "per_print":
      return `${machine.name} is ${dollars(b.sessionRateCents)}/print members, ${dollars(b.nonmemberSessionRateCents)} nonmembers. Sitting here does not charge you.`;
    case "hourly_job": {
      const waived = rates.plasmaSetupWaivedLastWeekend
        ? " (waived last weekend of the month)"
        : "";
      const setup = b.setupFeeCents
        ? ` plus ${dollars(b.setupFeeCents)} setup${waived}`
        : "";
      const min = b.minimumCents
        ? `, ${dollars(b.minimumCents)} minimum`
        : "";
      return `${machine.name} is ${dollars(b.hourlyRateCents)}/hr members / ${dollars(b.nonmemberHourlyCents)}/hr nonmembers of estimated run time (round up ${rates.roundUpMinutes} min${min})${setup}. Sitting here does not start a clock.`;
    }
    case "free":
      return `${machine.name} is included — no machine charge. Sitting here does not charge you.`;
  }
}

export function printJobDebitCents(
  machine: BillingMachine,
  filamentGrams: number,
  payer: JobPayer = { shopAccess: true, status: "active" },
  rates: RateCard = DEFAULT_RATE_CARD,
): number {
  return quoteMachineJob({ machine, payer, filamentGrams, rates }).billedCents;
}

export function printJobDebitNote(
  machine: Pick<Machine, "name">,
  filamentGrams: number,
  billedCents: number | null,
): string {
  const grams = Number.isFinite(filamentGrams)
    ? `${filamentGrams} g`
    : "grams unknown";
  if (billedCents == null) {
    return `${machine.name} · ${grams}`;
  }
  return `${machine.name} · ${grams}`;
}

export function jobRuntimeDebitCents(
  machine: BillingMachine,
  runtimeSeconds: number,
  payer: JobPayer = { shopAccess: true, status: "active" },
  at?: Date,
  rates: RateCard = DEFAULT_RATE_CARD,
): number {
  return quoteMachineJob({
    machine,
    payer,
    runtimeSeconds,
    at,
    rates,
  }).billedCents;
}

/** Occupancy / badge session is not the meter. Jobs are. */
export function machineDebitCents(
  _machine: BillingMachine,
  _startedAt: string,
  _endedAt: string,
): number {
  return 0;
}

export function machineDebitNote(
  machine: Pick<Machine, "name"> & BillingMachine,
  _startedAt: string,
  _endedAt: string,
): string {
  return `${machine.name} · not billed for session time`;
}

export function balanceFromEntries(
  entries: Array<{ amountCents: number }>,
): number {
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

export function classCreditsShortfallMessage(
  balanceCents: number,
  priceCents: number,
): string {
  const bal = (balanceCents / 100).toFixed(2);
  const price = (priceCents / 100).toFixed(2);
  return `Your credits ($${bal}) don’t cover this class ($${price}). Pay the full amount on Zeffy — this app doesn’t split a class between credits and Zeffy.`;
}

export function ledgerKindLabel(kind: CreditLedgerKind): string {
  switch (kind) {
    case "membership_grant":
      return "Membership Plus credit";
    case "staff_grant":
      return "Staff grant";
    case "zeffy_payment":
      return "Zeffy payment applied as credit";
    case "machine":
      return "Machine job";
    case "machine_refund":
      return "Job refund";
    case "class":
      return "Class";
    case "class_refund":
      return "Class refund";
    default:
      return kind;
  }
}
