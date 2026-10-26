import { describe, expect, it } from "vitest";
import { MockDataProvider, createMockDataProvider } from "./mock-provider";
import { cloneFixtures, loadFixtures } from "./load-fixtures";
import {
  canMarkWishlistPurchased,
  formatWishlistPrice,
  matchZeffyPaymentToWishlistItem,
  wishlistStats,
} from "./wishlist";

describe("wishlist catalog", () => {
  it("loads zones and needed items from fixtures", async () => {
    const provider = createMockDataProvider(null);
    const catalog = await provider.getWishlistCatalog();
    expect(catalog.zones.map((z) => z.id)).toEqual([
      "build",
      "wood",
      "laser",
      "print3d",
      "press",
      "commons",
      "craft",
      "textiles",
    ]);
    expect(catalog.items.length).toBeGreaterThan(60);
    expect(catalog.items.every((i) => i.status === "needed")).toBe(true);
    expect(catalog.recentlyFunded).toEqual([]);
    expect(catalog.stats.neededCount).toBe(catalog.items.length);
    expect(catalog.stats.receivedCount).toBe(0);
    expect(catalog.stats.coreCents).toBeGreaterThan(0);
    expect(catalog.stats.totalCents).toBeGreaterThan(catalog.stats.coreCents);
  });

  it("keeps SawStop, filament, and UV printer facts", async () => {
    const provider = createMockDataProvider(null);
    const { items } = await provider.getWishlistCatalog();
    const saw = items.find((i) => i.name.includes("SawStop 10"));
    const filament = items.find((i) => i.name.includes("PLA Basic"));
    const uv = items.find((i) => i.name.includes("eufyMake E1 UV"));
    expect(saw?.priceCents).toBe(89900);
    expect(saw?.tier).toBe("core");
    expect(filament?.qty).toBe(40);
    expect(filament?.priceCents).toBe(1481);
    expect(uv?.note).toMatch(/most-requested/i);
  });
});

describe("wishlist purchase reports", () => {
  it("lets a guest report a buy without hiding the item", async () => {
    const provider = createMockDataProvider(null);
    const catalog = await provider.getWishlistCatalog();
    const item = catalog.items.find((i) => i.url)?.id;
    expect(item).toBeTruthy();

    const report = await provider.reportWishlistPurchase({
      itemId: item!,
      name: "Casey Guest",
      email: "casey@example.com",
      note: "Ordered from Amazon today",
    });
    expect(report.status).toBe("pending");

    const after = await provider.getWishlistCatalog();
    const row = after.items.find((i) => i.id === item);
    expect(row?.status).toBe("needed");
    expect(row?.pendingReportCount).toBe(1);
    expect(after.recentlyFunded).toEqual([]);
  });

  it("rejects an anonymous report that would skip staff", async () => {
    const provider = createMockDataProvider(null);
    const { items } = await provider.getWishlistCatalog();
    await expect(
      provider.reportWishlistPurchase({
        itemId: items[0].id,
        name: "Nope",
        email: "not-an-email",
      }),
    ).rejects.toThrow(/valid email/i);
  });

  it("does not let a member mark an item purchased", async () => {
    const provider = createMockDataProvider("u-maya");
    const maya = await provider.getMember("u-maya");
    expect(canMarkWishlistPurchased(maya)).toBe(false);
    const { items } = await provider.getWishlistCatalog();
    await expect(
      provider.adminMarkWishlistPurchased(items[0].id, "u-maya"),
    ).rejects.toThrow(/staff/i);
  });

  it("lets staff confirm a report and takes the item off the ask list", async () => {
    const provider = createMockDataProvider("u-staff");
    const { items } = await provider.getWishlistCatalog();
    const target = items.find((i) => i.name.includes("PLA Basic"))!;
    const report = await provider.reportWishlistPurchase({
      itemId: target.id,
      name: "Jordan",
      email: "jordan.lee@example.com",
    });

    const fulfilled = await provider.adminConfirmWishlistPurchase(
      report.id,
      "u-staff",
    );
    expect(fulfilled.status).toBe("fulfilled");
    expect(fulfilled.fulfilledBy).toBe("staff");

    const after = await provider.getWishlistCatalog();
    expect(after.items.find((i) => i.id === target.id)?.status).toBe(
      "fulfilled",
    );
    expect(after.recentlyFunded.some((i) => i.id === target.id)).toBe(true);
    expect(after.stats.receivedCount).toBe(1);
    expect(after.items.filter((i) => i.status === "needed").length).toBe(
      after.stats.neededCount,
    );

    const reports = await provider.adminListWishlistPurchaseReports({
      status: "confirmed",
    });
    expect(reports.some((r) => r.id === report.id)).toBe(true);
  });

  it("lets staff mark purchased directly and dismiss a false report", async () => {
    const provider = createMockDataProvider("u-admin");
    const { items } = await provider.getWishlistCatalog();
    const a = items[0];
    const b = items[1];

    await provider.adminMarkWishlistPurchased(a.id, "u-admin");
    const report = await provider.reportWishlistPurchase({
      itemId: b.id,
      name: "Sam",
      email: "sam.okonkwo@example.com",
    });
    await provider.adminDismissWishlistPurchase(report.id, "u-admin");

    const after = await provider.getWishlistCatalog();
    expect(after.items.find((i) => i.id === a.id)?.status).toBe("fulfilled");
    expect(after.items.find((i) => i.id === b.id)?.status).toBe("needed");
    const dismissed = await provider.adminListWishlistPurchaseReports({
      status: "dismissed",
    });
    expect(dismissed[0]?.id).toBe(report.id);
  });
});

describe("wishlist zeffy match", () => {
  it("fulfills an item when a succeeded payment matches a campaign id", async () => {
    const bundle = cloneFixtures(loadFixtures());
    const item = bundle.wishlistItems.find((i) => i.name.includes("PLA Basic"))!;
    item.zeffyCampaignId = "camp-filament";
    const provider = new MockDataProvider(bundle, null);

    const result = await provider.applyZeffyTicketPayment({
      id: "pay-wl-1",
      object: "payment",
      created: 1_700_000_000,
      amount: 1481,
      currency: "usd",
      status: "succeeded",
      campaign_id: "camp-filament",
      campaign_type: "donation_form",
      buyer: { email: null, first_name: null, last_name: null },
      items: [
        { id: "i1", type: "donation", amount: 1481, currency: "usd" },
      ],
    });
    expect(result).toEqual({
      status: "wishlist_applied",
      itemId: item.id,
    });

    const catalog = await provider.getWishlistCatalog();
    expect(catalog.items.find((i) => i.id === item.id)?.status).toBe(
      "fulfilled",
    );
    expect(catalog.items.find((i) => i.id === item.id)?.fulfilledBy).toBe(
      "zeffy",
    );

    const dup = await provider.applyZeffyTicketPayment({
      id: "pay-wl-1",
      object: "payment",
      created: 1_700_000_000,
      amount: 1481,
      currency: "usd",
      status: "succeeded",
      campaign_id: "camp-filament",
      campaign_type: "donation_form",
      buyer: { email: null, first_name: null, last_name: null },
    });
    expect(dup).toEqual({
      status: "wishlist_duplicate",
      itemId: item.id,
    });
  });

  it("does not fulfill on a failed payment", () => {
    const items = cloneFixtures(loadFixtures()).wishlistItems;
    items[0].zeffyCampaignId = "camp-x";
    expect(
      matchZeffyPaymentToWishlistItem(
        { id: "p", status: "failed", campaign_id: "camp-x" },
        items,
      ).status,
    ).toBe("ignored");
  });
});

describe("wishlist formatting", () => {
  it("formats whole-dollar and estimated prices", () => {
    expect(formatWishlistPrice(89900)).toBe("$899");
    expect(formatWishlistPrice(1481)).toBe("$14.81");
    expect(formatWishlistPrice(5500, true)).toBe("About $55");
  });

  it("counts core vs stretch in stats", () => {
    const items = loadFixtures().wishlistItems;
    const stats = wishlistStats(items);
    expect(stats.under100Count).toBeGreaterThan(0);
    expect(stats.neededCount).toBe(items.length);
  });
});
