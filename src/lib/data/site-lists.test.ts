import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

describe("staff directory", () => {
  it("adds, changes, hides and removes a person", async () => {
    const provider = createMockDataProvider();
    const added = await provider.adminSavePerson({
      name: "  Rosa Diaz ",
      roleTitle: "Shop Steward",
      kind: "staff",
      bio: "Runs Thursday open shop.",
    });
    expect(added.name).toBe("Rosa Diaz");
    expect(added.slug).toBe("rosa-diaz");
    expect((await provider.listPeople("staff")).at(-1)?.name).toBe("Rosa Diaz");

    await provider.adminSavePerson({ ...added, roleTitle: "Shop Lead" });
    expect((await provider.listPeople()).find((p) => p.id === added.id)?.roleTitle).toBe("Shop Lead");

    await provider.adminSavePerson({ ...added, roleTitle: "Shop Lead", published: false });
    expect((await provider.listPeople()).map((p) => p.id)).not.toContain(added.id);
    expect((await provider.adminListPeople()).map((p) => p.id)).toContain(added.id);

    await provider.adminDeletePerson(added.id);
    expect((await provider.adminListPeople()).map((p) => p.id)).not.toContain(added.id);
  });

  it("needs a name", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminSavePerson({ name: " ", roleTitle: "x", kind: "staff", bio: "" }),
    ).rejects.toThrow(/name/i);
  });
});

describe("made-here gallery", () => {
  it("lists published projects in order and lets staff add and remove one", async () => {
    const provider = createMockDataProvider();
    const before = await provider.listProjects();
    expect(before.length).toBeGreaterThan(0);
    const added = await provider.adminSaveProject({
      title: "Cedar planter",
      maker: "Rosa",
      area: "Woodshop",
      caption: "First project off the new planer.",
      imageSrc: "/api/inventory/photos/db%3A11111111-2222-3333-4444-555555555555",
    });
    expect(added.imageAlt).toBe("Cedar planter");
    expect((await provider.listProjects()).at(-1)?.title).toBe("Cedar planter");
    await provider.adminSaveProject({ ...added, published: false });
    expect((await provider.listProjects()).map((p) => p.id)).not.toContain(added.id);
    expect((await provider.adminListProjects()).map((p) => p.id)).toContain(added.id);
    await provider.adminDeleteProject(added.id);
    expect((await provider.adminListProjects()).map((p) => p.id)).not.toContain(added.id);
  });

  it("refuses a picture address that is not a picture on the web", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminSaveProject({
        title: "x",
        maker: "y",
        area: "z",
        caption: "",
        imageSrc: "javascript:alert(1)",
      }),
    ).rejects.toThrow(/picture/i);
  });
});

describe("wishlist items", () => {
  it("adds an item to a zone, changes its price and removes it", async () => {
    const provider = createMockDataProvider();
    const zone = (await provider.getWishlistCatalog()).zones[0]!;
    const added = await provider.adminSaveWishlistItem({
      zoneId: zone.id,
      name: "Shop vac",
      model: "Ridgid 12 gal",
      qty: 1,
      priceCents: 12900,
      url: "https://www.homedepot.com/p/123",
    });
    expect(added.status).toBe("needed");
    let catalog = await provider.getWishlistCatalog();
    expect(catalog.items.find((i) => i.id === added.id)?.priceCents).toBe(12900);

    await provider.adminSaveWishlistItem({ ...added, priceCents: 9900 });
    catalog = await provider.getWishlistCatalog();
    expect(catalog.items.find((i) => i.id === added.id)?.priceCents).toBe(9900);

    await provider.adminDeleteWishlistItem(added.id);
    catalog = await provider.getWishlistCatalog();
    expect(catalog.items.map((i) => i.id)).not.toContain(added.id);
  });

  it("refuses an unknown zone, a negative price and a link that is not a web address", async () => {
    const provider = createMockDataProvider();
    const zone = (await provider.getWishlistCatalog()).zones[0]!;
    const ok = { zoneId: zone.id, name: "Clamp", qty: 1, priceCents: 500 };
    await expect(provider.adminSaveWishlistItem({ ...ok, zoneId: "nope" })).rejects.toThrow(/zone/i);
    await expect(provider.adminSaveWishlistItem({ ...ok, priceCents: -1 })).rejects.toThrow(/price/i);
    await expect(
      provider.adminSaveWishlistItem({ ...ok, url: "javascript:alert(1)" }),
    ).rejects.toThrow(/link/i);
  });
});

describe("site details", () => {
  it("starts from the built-in details and keeps what staff change", async () => {
    const provider = createMockDataProvider();
    const info = await provider.getSiteInfo();
    expect(info.addressLine).toContain("611 SW 152nd St");
    const saved = await provider.adminSaveSiteInfo({
      addressLine: "123 New St · Burien, WA",
      instagramUrl: "https://www.instagram.com/thebox/",
    });
    expect(saved.addressLine).toBe("123 New St · Burien, WA");
    expect(saved.facebookUrl).toBe(info.facebookUrl);
    expect((await provider.getSiteInfo()).instagramUrl).toBe("https://www.instagram.com/thebox/");
  });

  it("refuses a social link that is not a web address", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminSaveSiteInfo({ facebookUrl: "javascript:alert(1)" }),
    ).rejects.toThrow(/web address/i);
  });
});
