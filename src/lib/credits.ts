import type { Machine, MembershipProduct, MembershipTier } from "@/lib/data/types";

/** Membership Plus ($75 Lamplab rate) grants this on each succeeded payment. */
export const PLUS_CREDIT_GRANT_CENTS = 5000;

/** Oct 2026 rate card (Trey). Single table — workstation code must not fork this. */
export const FILAMENT_MARKUP = 1.3;
/** Default Bambu PLA. */
export const DEFAULT_FILAMENT_CENTS_PER_KG = 1200;

export const TREY_MACHINE_RATES = {
  woodshopHourlyCents: 0,
  vinylSheetCents: 0,
  laserMemberHourlyCents: 1500,
  laserNonmemberHourlyCents: 2500,
  laserMinimumCents: 500,
  cncMemberHourlyCents: 1000,
  cncNonmemberHourlyCents: 2000,
  cncMinimumCents: 1000,
  plasmaMemberHourlyCents: 1500,
  plasmaNonmemberHourlyCents: 2500,
  plasmaSetupCents: 5000,
  printerMemberMinimumCents: 100,
  printerNonmemberMinimumCents: 500,
  sublimationMemberCents: 100,
  sublimationNonmemberCents: 200,
  /** Member aliases used by occupancy helpers / older call sites. */
  laserHourlyCents: 1500,
  regularCncHourlyCents: 1000,
  plasmaHourlyCents: 1500,
  sublimationSheetCents: 100,
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

/** ~1.56¢/g at $12/kg Bambu PLA with 30% markup. */
export function centsPerGramFromFilament(
  filamentCentsPerKg = DEFAULT_FILAMENT_CENTS_PER_KG,
): number {
  return (filamentCentsPerKg * FILAMENT_MARKUP) / 1000;
}

export function defaultBillingFor(
  machine: Pick<Machine, "id" | "name" | "area">,
): MachineBilling {
  const name = (machine.name ?? "").toLowerCase();
  const vinyl =
    machine.id === "m-vinyl-cutter" ||
    (machine.area === "textiles_vinyl" && /vinyl/.test(name));

  if (machine.area === "cnc_plasma") {
    return {
      hourlyRateCents: TREY_MACHINE_RATES.plasmaMemberHourlyCents,
      nonmemberHourlyCents: TREY_MACHINE_RATES.plasmaNonmemberHourlyCents,
      setupFeeCents: TREY_MACHINE_RATES.plasmaSetupCents,
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
      hourlyRateCents: TREY_MACHINE_RATES.cncMemberHourlyCents,
      nonmemberHourlyCents: TREY_MACHINE_RATES.cncNonmemberHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      nonmemberSessionRateCents: 0,
      sessionUnit: null,
      gramRateCents: 0,
      minimumCents: TREY_MACHINE_RATES.cncMinimumCents,
      nonmemberMinimumCents: TREY_MACHINE_RATES.cncMinimumCents,
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
      gramRateCents: centsPerGramFromFilament(),
      minimumCents: TREY_MACHINE_RATES.printerMemberMinimumCents,
      nonmemberMinimumCents: TREY_MACHINE_RATES.printerNonmemberMinimumCents,
    };
  }
  if (machine.area === "sublimation") {
    return {
      hourlyRateCents: 0,
      nonmemberHourlyCents: 0,
      setupFeeCents: 0,
      sessionRateCents: TREY_MACHINE_RATES.sublimationMemberCents,
      nonmemberSessionRateCents: TREY_MACHINE_RATES.sublimationNonmemberCents,
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
      hourlyRateCents: TREY_MACHINE_RATES.laserMemberHourlyCents,
      nonmemberHourlyCents: TREY_MACHINE_RATES.laserNonmemberHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      nonmemberSessionRateCents: 0,
      sessionUnit: null,
      gramRateCents: 0,
      minimumCents: TREY_MACHINE_RATES.laserMinimumCents,
      nonmemberMinimumCents: TREY_MACHINE_RATES.laserMinimumCents,
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

export function billingFor(machine: BillingMachine): MachineBilling {
  return defaultBillingFor(machine);
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

export function hourlyRateCentsFor(machine: BillingMachine): number {
  return billingFor(machine).hourlyRateCents;
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

export function machineBillingMode(machine: BillingMachine): MachineBillingMode {
  const b = billingFor(machine);
  if (b.sessionUnit === "gram") return "per_gram";
  if (b.sessionUnit === "print") return "per_print";
  if (b.hourlyRateCents <= 0 && b.setupFeeCents <= 0) return "free";
  return "hourly_job";
}

export function workstationBillingMode(
  machine: BillingMachine,
): MachineBillingMode {
  return machineBillingMode(machine);
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

/** Round estimated run time up to 5 minutes. */
export function billedMinutesFromSeconds(runtimeSeconds: number): number {
  if (!Number.isFinite(runtimeSeconds) || runtimeSeconds <= 0) return 0;
  return Math.ceil(runtimeSeconds / 60 / 5) * 5;
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

/** Plasma $50 setup waived the last weekend of each month (last Saturday + following Sunday). */
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
 */
export function quoteMachineJob(input: {
  machine: Pick<Machine, "id" | "name" | "area">;
  payer: JobPayer;
  filamentGrams?: number | null;
  filamentCentsPerKg?: number;
  runtimeSeconds?: number | null;
  prints?: number | null;
  at?: Date;
}): MachineJobQuote {
  const machine = input.machine;
  const b = billingFor(machine);
  const mode = machineBillingMode(machine);
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
    const centsPerGram = centsPerGramFromFilament(input.filamentCentsPerKg);
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

  const minutesBilled = billedMinutesFromSeconds(input.runtimeSeconds ?? 0);
  if (minutesBilled <= 0) return empty;
  const hourly = memberRate ? b.hourlyRateCents : b.nonmemberHourlyCents;
  const timeCents = Math.round((minutesBilled / 60) * hourly);
  const at = input.at ?? new Date();
  const setupWaived =
    b.setupFeeCents > 0 && plasmaSetupWaived(at);
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

/** Copy for the kiosk: sitting here is not a charge. */
export function deskChargeHint(
  machine: Pick<Machine, "name"> & BillingMachine,
): string {
  const b = billingFor(machine);
  const mode = machineBillingMode(machine);
  switch (mode) {
    case "per_gram":
      return `${machine.name} bills by grams of filament (cost + 30%, about ${centsPerGramFromFilament().toFixed(2)}¢/g; $1 member / $5 nonmember min). Sitting at this PC does not charge you — you’ll see the estimate before you send the job.`;
    case "per_print":
      return `${machine.name} is ${dollars(b.sessionRateCents)}/print members, ${dollars(b.nonmemberSessionRateCents)} nonmembers. Sitting here does not charge you.`;
    case "hourly_job": {
      const setup = b.setupFeeCents
        ? ` plus ${dollars(b.setupFeeCents)} setup (waived last weekend of the month)`
        : "";
      const min = b.minimumCents
        ? `, ${dollars(b.minimumCents)} minimum`
        : "";
      return `${machine.name} is ${dollars(b.hourlyRateCents)}/hr members / ${dollars(b.nonmemberHourlyCents)}/hr nonmembers of estimated run time (round up 5 min${min})${setup}. Sitting here does not start a clock.`;
    }
    case "free":
      return `${machine.name} is included — no machine charge. Sitting here does not charge you.`;
  }
}

export function printJobDebitCents(
  machine: BillingMachine,
  filamentGrams: number,
  payer: JobPayer = { shopAccess: true, status: "active" },
): number {
  return quoteMachineJob({ machine, payer, filamentGrams }).billedCents;
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
): number {
  return quoteMachineJob({
    machine,
    payer,
    runtimeSeconds,
    at,
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
