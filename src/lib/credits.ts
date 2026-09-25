import type { Machine, MachineArea, MembershipProduct, MembershipTier } from "@/lib/data/types";

/** Membership Plus ($75 Lamplab rate) grants this on each succeeded payment. */
export const PLUS_CREDIT_GRANT_CENTS = 5000;

/**
 * Fixture hourly rates — not an admin pricing UI.
 * Textiles / hand tools are $0 (included with membership).
 */
export const AREA_HOURLY_RATE_CENTS: Record<MachineArea, number> = {
  laser: 1500,
  cnc_plasma: 2000,
  "3d_printing": 500,
  woodshop: 1000,
  textiles_vinyl: 0,
  sublimation: 500,
  hand_tools: 0,
};

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
  product: Pick<MembershipProduct, "name" | "summary" | "priceCents" | "tier" | "creditGrantCents">,
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
  machine: Pick<Machine, "area" | "hourlyRateCents">,
): number {
  if (typeof machine.hourlyRateCents === "number") return machine.hourlyRateCents;
  return AREA_HOURLY_RATE_CENTS[machine.area] ?? 0;
}

/** Bill actual duration. Zero-rate machines are free. */
export function machineDebitCents(
  hourlyRateCents: number,
  startedAt: string,
  endedAt: string,
): number {
  if (hourlyRateCents <= 0) return 0;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * hourlyRateCents);
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
