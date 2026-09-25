import type { Machine, MembershipProduct, MembershipTier } from "@/lib/data/types";

/** Membership Plus ($75 Lamplab rate) grants this on each succeeded payment. */
export const PLUS_CREDIT_GRANT_CENTS = 5000;

/** Trey’s shop rates — mapped onto fixtures, not an admin pricing UI. */
export const TREY_MACHINE_RATES = {
  woodshopHourlyCents: 0,
  plasmaSetupCents: 5000,
  plasmaHourlyCents: 2000,
  regularCncHourlyCents: 1000,
  printerHourlyCents: 100,
  sublimationSheetCents: 100,
  vinylSheetCents: 500,
  /** Not in Trey’s list; keep the prior fixture rate until he prices it. */
  laserHourlyCents: 1500,
} as const;

export type MachineBilling = {
  hourlyRateCents: number;
  setupFeeCents: number;
  /** One sheet/job per usage session — no sheet-count UI. */
  sessionRateCents: number;
  sessionUnit: "sheet" | null;
};

type BillingMachine = Pick<
  Machine,
  "id" | "name" | "area" | "hourlyRateCents"
> & {
  setupFeeCents?: number | null;
  sessionRateCents?: number | null;
};

export function defaultBillingFor(
  machine: Pick<Machine, "id" | "name" | "area">,
): MachineBilling {
  const name = (machine.name ?? "").toLowerCase();
  const vinyl =
    machine.id === "m-vinyl-cutter" ||
    (machine.area === "textiles_vinyl" && /vinyl/.test(name));

  if (machine.area === "woodshop" || machine.area === "hand_tools") {
    return emptyBilling();
  }
  if (machine.area === "cnc_plasma") {
    return {
      hourlyRateCents: TREY_MACHINE_RATES.plasmaHourlyCents,
      setupFeeCents: TREY_MACHINE_RATES.plasmaSetupCents,
      sessionRateCents: 0,
      sessionUnit: null,
    };
  }
  if (
    machine.area !== "cnc_plasma" &&
    /\bcnc\b/.test(name) &&
    !/plasma/.test(name)
  ) {
    return {
      hourlyRateCents: TREY_MACHINE_RATES.regularCncHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      sessionUnit: null,
    };
  }
  if (machine.area === "3d_printing") {
    return {
      hourlyRateCents: TREY_MACHINE_RATES.printerHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      sessionUnit: null,
    };
  }
  if (machine.area === "sublimation") {
    return {
      hourlyRateCents: 0,
      setupFeeCents: 0,
      sessionRateCents: TREY_MACHINE_RATES.sublimationSheetCents,
      sessionUnit: "sheet",
    };
  }
  if (vinyl) {
    return {
      hourlyRateCents: 0,
      setupFeeCents: 0,
      sessionRateCents: TREY_MACHINE_RATES.vinylSheetCents,
      sessionUnit: "sheet",
    };
  }
  if (machine.area === "textiles_vinyl") {
    return emptyBilling();
  }
  if (machine.area === "laser") {
    return {
      hourlyRateCents: TREY_MACHINE_RATES.laserHourlyCents,
      setupFeeCents: 0,
      sessionRateCents: 0,
      sessionUnit: null,
    };
  }
  return emptyBilling();
}

function emptyBilling(): MachineBilling {
  return {
    hourlyRateCents: 0,
    setupFeeCents: 0,
    sessionRateCents: 0,
    sessionUnit: null,
  };
}

export function billingFor(machine: BillingMachine): MachineBilling {
  const defaults = defaultBillingFor(machine);
  return {
    hourlyRateCents:
      typeof machine.hourlyRateCents === "number"
        ? machine.hourlyRateCents
        : defaults.hourlyRateCents,
    setupFeeCents:
      typeof machine.setupFeeCents === "number"
        ? machine.setupFeeCents
        : defaults.setupFeeCents,
    sessionRateCents:
      typeof machine.sessionRateCents === "number"
        ? machine.sessionRateCents
        : defaults.sessionRateCents,
    sessionUnit: defaults.sessionUnit,
  };
}

export type CreditLedgerKind =
  | "membership_grant"
  | "staff_grant"
  | "zeffy_payment"
  | "machine"
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

function durationHours(startedAt: string, endedAt: string): number {
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

/** Bill Trey’s rate for one ended session. Sheet machines = 1 sheet, no UI. */
export function machineDebitCents(
  machine: BillingMachine,
  startedAt: string,
  endedAt: string,
): number {
  const b = billingFor(machine);
  const time = Math.round(durationHours(startedAt, endedAt) * b.hourlyRateCents);
  return b.setupFeeCents + time + b.sessionRateCents;
}

export function machineDebitNote(
  machine: Pick<Machine, "name"> & BillingMachine,
  startedAt: string,
  endedAt: string,
): string {
  const b = billingFor(machine);
  const parts: string[] = [machine.name];
  if (b.setupFeeCents > 0) parts.push("setup");
  const minutes = Math.round(durationHours(startedAt, endedAt) * 60);
  if (b.hourlyRateCents > 0 && minutes > 0) parts.push(`${minutes} min`);
  if (b.sessionRateCents > 0 && b.sessionUnit === "sheet") parts.push("1 sheet");
  return parts.join(" · ");
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
      return "Machine time";
    case "class":
      return "Class";
    case "class_refund":
      return "Class refund";
    default:
      return kind;
  }
}
