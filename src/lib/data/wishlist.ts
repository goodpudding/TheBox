import type { User, WishlistItem, WishlistZone } from "./types";
import { isStaffRole } from "./access";
import type { ZeffyPayment } from "@/lib/zeffy/types";

export { isStaffRole };

export const RECENTLY_FUNDED_DAYS = 90;

export const WISHLIST_PRICE_BANDS = [
  { id: "all", label: "Any price" },
  { id: "u50", label: "Under $50" },
  { id: "u250", label: "Under $250" },
  { id: "u1000", label: "Under $1,000" },
  { id: "big", label: "$1,000+" },
] as const;

export type WishlistPriceBandId = (typeof WISHLIST_PRICE_BANDS)[number]["id"];

export function matchesWishlistPriceBand(
  priceCents: number,
  band: WishlistPriceBandId,
): boolean {
  if (band === "all") return true;
  if (band === "u50") return priceCents < 5_000;
  if (band === "u250") return priceCents < 25_000;
  if (band === "u1000") return priceCents < 100_000;
  return priceCents >= 100_000;
}

export function isNeededWishlistItem(
  item: Pick<WishlistItem, "status">,
): boolean {
  return item.status === "needed";
}

export function itemLineTotalCents(
  item: Pick<WishlistItem, "priceCents" | "qty">,
): number {
  return item.priceCents * item.qty;
}

export function formatWishlistPrice(
  cents: number,
  estimated = false,
): string {
  const dollars = cents / 100;
  const formatted = dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return estimated ? `About ${formatted}` : formatted;
}

export interface WishlistStats {
  neededCount: number;
  coreCents: number;
  totalCents: number;
  under100Count: number;
  receivedCount: number;
}

export function wishlistStats(items: WishlistItem[]): WishlistStats {
  const needed = items.filter(isNeededWishlistItem);
  return {
    neededCount: needed.length,
    coreCents: needed
      .filter((i) => i.tier === "core")
      .reduce((s, i) => s + itemLineTotalCents(i), 0),
    totalCents: needed.reduce((s, i) => s + itemLineTotalCents(i), 0),
    under100Count: needed.filter((i) => i.priceCents < 10_000).length,
    receivedCount: items.filter((i) => i.status === "fulfilled").length,
  };
}

/** Staff/admin may confirm a purchase and take the item off the public ask list. */
export function canMarkWishlistPurchased(
  user: User | null | undefined,
): boolean {
  return isStaffRole(user);
}

export function isValidWishlistEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isRecentlyFunded(
  item: Pick<WishlistItem, "status" | "fulfilledAt">,
  nowMs = Date.now(),
): boolean {
  if (item.status !== "fulfilled" || !item.fulfilledAt) return false;
  const at = new Date(item.fulfilledAt).getTime();
  if (Number.isNaN(at)) return false;
  return nowMs - at <= RECENTLY_FUNDED_DAYS * 24 * 3600_000;
}

export function sortWishlistItems<T extends WishlistItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "core" ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
}

export function groupNeededByZone<T extends WishlistItem>(
  zones: WishlistZone[],
  items: T[],
  opts: { zoneId?: string | "all"; priceBand?: WishlistPriceBandId } = {},
): Array<{ zone: WishlistZone; items: T[]; toGoCents: number }> {
  const zoneId = opts.zoneId ?? "all";
  const band = opts.priceBand ?? "all";
  return zones
    .filter((z) => zoneId === "all" || z.id === zoneId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((zone) => {
      const inZone = items.filter((i) => i.zoneId === zone.id);
      const needed = inZone.filter(isNeededWishlistItem);
      const shown = sortWishlistItems(
        needed.filter((i) => matchesWishlistPriceBand(i.priceCents, band)),
      );
      const toGoCents = needed.reduce((s, i) => s + itemLineTotalCents(i), 0);
      return { zone, items: shown, toGoCents };
    })
    .filter((g) => g.items.length > 0);
}

const SUCCEEDED = new Set(["succeeded", "completed", "paid", "success"]);

export type WishlistZeffyApplyResult =
  | { status: "applied"; itemId: string }
  | { status: "duplicate"; itemId: string }
  | {
      status: "ignored";
      reason: "not_succeeded" | "no_campaign_match" | "already_fulfilled";
      detail?: string;
    };

/**
 * Map a completed Zeffy payment onto a wishlist item by campaign id.
 * This app never charges cards — it only records a succeeded payment.
 */
export function matchZeffyPaymentToWishlistItem(
  payment: Pick<ZeffyPayment, "id" | "status" | "campaign_id">,
  items: WishlistItem[],
): WishlistZeffyApplyResult {
  const status = payment.status?.trim().toLowerCase() ?? "";
  if (status && !SUCCEEDED.has(status)) {
    return { status: "ignored", reason: "not_succeeded", detail: payment.status };
  }
  const campaignId = payment.campaign_id?.trim();
  if (!campaignId) {
    return { status: "ignored", reason: "no_campaign_match" };
  }
  const item = items.find((i) => i.zeffyCampaignId?.trim() === campaignId);
  if (!item) {
    return { status: "ignored", reason: "no_campaign_match", detail: campaignId };
  }
  if (item.zeffyPaymentId && item.zeffyPaymentId === payment.id) {
    return { status: "duplicate", itemId: item.id };
  }
  if (item.status === "fulfilled") {
    return {
      status: "ignored",
      reason: "already_fulfilled",
      detail: item.id,
    };
  }
  return { status: "applied", itemId: item.id };
}
