import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTier(tier: string | null | undefined): string {
  if (!tier) return "—";
  const labels: Record<string, string> = {
    day: "Day pass",
    community: "Community",
    maker: "Maker",
    household_addon: "Household add-on",
    patron: "Patron",
    friend: "Friend of The Box",
    scholarship: "Scholarship",
    maker_pro: "Maker Pro",
    unlimited: "Unlimited",
    team: "Team",
    shop_steward: "Shop Steward",
    monthly: "Maker",
    annual: "Maker (annual)",
    student: "Community",
    daily: "Day pass",
  };
  return labels[tier] ?? tier;
}

export function formatBillingInterval(
  interval: string | null | undefined,
): string {
  switch (interval) {
    case "daily":
      return "/ day";
    case "annual":
      return "/ year";
    case "monthly":
      return "/ month";
    case "none":
      return "";
    default:
      return "";
  }
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
