import type { MembershipProduct, MembershipTier } from "@/lib/data/types";

/** Maker ($40) to Maker Pro ($75) is the upgrade this portal knows how to price. */
export function isMakerProUpgradeName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    n.includes("upgrade") &&
    (n.includes("pro") || n.includes("plus") || n.includes("maker+"))
  );
}

export function upgradeDifferenceCents(
  current: Pick<MembershipProduct, "priceCents" | "billingInterval" | "tier"> | null,
  target: Pick<MembershipProduct, "priceCents" | "billingInterval" | "tier">,
): number | null {
  if (!current) return null;
  if (current.tier === target.tier) return null;
  if (
    current.billingInterval &&
    target.billingInterval &&
    current.billingInterval !== target.billingInterval
  ) {
    return null;
  }
  const diff = target.priceCents - current.priceCents;
  return diff > 0 ? diff : null;
}

export function findMakerProProduct(
  products: MembershipProduct[],
): MembershipProduct | null {
  return (
    products.find(
      (product) =>
        product.tier === "maker_pro" && !isMakerProUpgradeName(product.name),
    ) ?? null
  );
}

export function findUpgradeProduct(
  products: MembershipProduct[],
  differenceCents: number,
): MembershipProduct | null {
  return (
    products.find(
      (product) =>
        isMakerProUpgradeName(product.name) &&
        product.priceCents === differenceCents &&
        product.joinable,
    ) ?? null
  );
}

export function currentProductForTier(
  products: MembershipProduct[],
  tier: MembershipTier | null | undefined,
): MembershipProduct | null {
  if (!tier) return null;
  return (
    products.find(
      (product) =>
        product.tier === tier &&
        !isMakerProUpgradeName(product.name) &&
        product.billingInterval === "monthly",
    ) ??
    products.find(
      (product) => product.tier === tier && !isMakerProUpgradeName(product.name),
    ) ??
    null
  );
}
