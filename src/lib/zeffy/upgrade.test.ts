import { describe, expect, it } from "vitest";
import { inferCreditGrantCents } from "@/lib/credits";
import { inferMembershipTier } from "@/lib/zeffy/memberships";
import {
  findUpgradeProduct,
  upgradeDifferenceCents,
} from "@/lib/zeffy/upgrade";
import type { MembershipProduct } from "@/lib/data/types";

function product(
  partial: Partial<MembershipProduct> & Pick<MembershipProduct, "tier" | "priceCents" | "name">,
): MembershipProduct {
  return {
    id: partial.name,
    summary: "",
    billingInterval: "monthly",
    shopAccess: true,
    phase: 1,
    visibleOnJoin: true,
    joinable: true,
    highlight: false,
    sortOrder: 1,
    isAddOn: false,
    ...partial,
  };
}

describe("Maker Pro upgrade", () => {
  it("prices Maker to Maker Pro as the difference", () => {
    const diff = upgradeDifferenceCents(
      product({ tier: "maker", name: "Maker", priceCents: 4000 }),
      product({ tier: "maker_pro", name: "Maker Pro", priceCents: 7500 }),
    );
    expect(diff).toBe(3500);
  });

  it("treats an upgrade rate as Maker Pro with the $50 credit", () => {
    expect(inferMembershipTier("Upgrade to Maker Pro", 3500)).toBe("maker_pro");
    expect(
      inferCreditGrantCents({ name: "Upgrade to Maker Pro", priceCents: 3500 }),
    ).toBe(5000);
  });

  it("finds the matching Zeffy upgrade rate and ignores the full price", () => {
    const products = [
      product({ tier: "maker_pro", name: "Maker Pro", priceCents: 7500, zeffyUrl: "https://zeffy.example/full" }),
      product({
        tier: "maker_pro",
        name: "Upgrade to Maker Pro",
        priceCents: 3500,
        zeffyUrl: "https://zeffy.example/upgrade",
      }),
    ];
    expect(findUpgradeProduct(products, 3500)?.zeffyUrl).toBe(
      "https://zeffy.example/upgrade",
    );
  });
});
