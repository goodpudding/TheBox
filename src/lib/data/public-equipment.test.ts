import { describe, expect, it } from "vitest";
import { cloneFixtures, loadFixtures } from "./load-fixtures";
import { MockDataProvider, createMockDataProvider } from "./mock-provider";
import { handleDataRpc } from "./rpc-policy";

/** Keys shaped like the ones the upload route hands back. */
const FRONT = "local:temp/3f2b1c1e-8a4d-4c57-9b1e-0d6a5c7e9f10.jpg";
const SIDE = "local:temp/7d9e4a22-51c3-4f0b-a6d8-2b1f3e4c5d6a.jpg";

/** Everything a visitor who is not signed in is told about one item. */
const ITEM_KEYS = ["area", "manufacturer", "model", "name", "photo", "quantity"];
const AREA_KEYS = ["id", "name"];
const PHOTO_KEYS = ["storageKey", "thumbKey"];

describe("the public equipment list", () => {
  it("shows approved items that are in service, grouped in the areas' own order", async () => {
    const provider = createMockDataProvider();
    const list = await provider.listPublicEquipment();
    expect(list.map((i) => i.name)).toEqual([
      "Prusa MK4",
      "CO2 laser cutter",
      "Bar clamps",
      "Orbital sander",
    ]);
    expect(list.map((i) => i.area?.name)).toEqual([
      "FDM 3D Printing",
      "Laser",
      "Woodshop (incl. hand tools & stained glass)",
      "Woodshop (incl. hand tools & stained glass)",
    ]);
  });

  it("gives each item exactly these fields and no others", async () => {
    const provider = createMockDataProvider();
    const list = await provider.listPublicEquipment();
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      // A field added to the stored item must be added here on purpose before
      // a visitor can see it.
      expect(Object.keys(item).sort()).toEqual(ITEM_KEYS);
      if (item.area) expect(Object.keys(item.area).sort()).toEqual(AREA_KEYS);
      if (item.photo) expect(Object.keys(item.photo).sort()).toEqual(PHOTO_KEYS);
    }
    const sander = list.find((i) => i.name === "Orbital sander")!;
    expect(sander).toEqual({
      name: "Orbital sander",
      manufacturer: "DeWalt",
      model: "DWE6423",
      quantity: null,
      area: { id: "ia-woodshop", name: "Woodshop (incl. hand tools & stained glass)" },
      photo: {
        storageKey: "fixture:orbital-sander-front",
        thumbKey: "fixture:orbital-sander-front",
      },
    });
  });

  it("gives a quantity only when there is more than one", async () => {
    const provider = createMockDataProvider();
    const list = await provider.listPublicEquipment();
    expect(list.find((i) => i.name === "Bar clamps")!.quantity).toBe(12);
    expect(list.find((i) => i.name === "Prusa MK4")!.quantity).toBeNull();
  });

  it("leaves out pending, rejected, retired, missing and broken items", async () => {
    const provider = createMockDataProvider("u-admin");
    const names = async () => (await provider.listPublicEquipment()).map((i) => i.name);
    // Pending in the fixtures: the heat press and the jigsaw. Retired: the table saw.
    expect(await names()).not.toContain("Swing-away heat press");
    expect(await names()).not.toContain("Jigsaw");
    expect(await names()).not.toContain("Contractor table saw");

    await provider.reviewInventoryItem("u-admin", "inv-jigsaw", "reject", "Duplicate");
    expect(await names()).not.toContain("Jigsaw");

    await provider.changeInventoryStatus("u-admin", "inv-sander", "MISSING");
    expect(await names()).not.toContain("Orbital sander");
    await provider.changeInventoryStatus("u-admin", "inv-sander", "IN_REPAIR");
    expect(await names()).toContain("Orbital sander");

    await provider.updateInventoryItem("u-admin", "inv-laser", { condition: "BROKEN" });
    expect(await names()).not.toContain("CO2 laser cutter");
    // Needs repair is still the shop's equipment, shown without a label.
    await provider.updateInventoryItem("u-admin", "inv-laser", { condition: "NEEDS_REPAIR" });
    expect(await names()).toContain("CO2 laser cutter");
  });

  it("shows an item once staff approve it", async () => {
    const provider = createMockDataProvider("u-admin");
    await provider.reviewInventoryItem("u-admin", "inv-heatpress", "approve");
    const list = await provider.listPublicEquipment();
    expect(list.map((i) => i.name)).toContain("Swing-away heat press");
  });

  it("never carries a serial number, the serial plate photo or anything else private", async () => {
    const provider = createMockDataProvider("u-admin");
    // Approve everything so every fixture item with private details is in play.
    await provider.reviewInventoryItem("u-admin", "inv-heatpress", "approve");
    await provider.reviewInventoryItem("u-admin", "inv-jigsaw", "approve");
    const text = JSON.stringify(await provider.listPublicEquipment());
    const bundle = loadFixtures();
    for (const item of bundle.inventoryItems) {
      for (const secret of [
        item.serialNumber,
        item.donorName,
        item.notes,
        item.location,
        item.id,
        item.createdById,
        item.reviewedById,
      ]) {
        if (secret) expect(text, `${item.name}: ${secret}`).not.toContain(secret);
      }
    }
    for (const photo of bundle.itemPhotos) {
      if (photo.kind !== "FRONT") {
        expect(text, `${photo.kind} photo ${photo.storageKey}`).not.toContain(photo.storageKey);
      }
    }
    expect(text).not.toMatch(/BX-\d{5}/);
    expect(text).not.toMatch(/serial|donor|estimatedValue|tagNumber|location|notes/i);
  });

  it("uses the front photo, and no photo at all when there is no front one", async () => {
    const bundle = cloneFixtures(loadFixtures());
    bundle.itemPhotos = bundle.itemPhotos.filter(
      (p) => !(p.itemId === "inv-sander" && p.kind === "FRONT"),
    );
    const provider = new MockDataProvider(bundle);
    const sander = (await provider.listPublicEquipment()).find(
      (i) => i.name === "Orbital sander",
    )!;
    // The sander still has a side and a serial photo. Neither stands in.
    expect(sander.photo).toBeNull();
  });

  it("answers a visitor who is not signed in", async () => {
    const provider = createMockDataProvider();
    const res = await handleDataRpc({
      method: "listPublicEquipment",
      args: [],
      sessionUser: null,
      provider,
      productionLocked: true,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    const result = (res.body as { result: unknown[] }).result;
    expect(result).toHaveLength(4);
  });
});

describe("hiding an item from the public page", () => {
  it("starts shown, and staff can hide it and show it again", async () => {
    const provider = createMockDataProvider("u-staff");
    const names = async () => (await provider.listPublicEquipment()).map((i) => i.name);
    expect(await names()).toContain("Prusa MK4");
    const hidden = await provider.updateInventoryItem("u-staff", "inv-prusa", {
      showPublicly: false,
    });
    expect(hidden.showPublicly).toBe(false);
    expect(await names()).not.toContain("Prusa MK4");
    // Members still browse it in the inventory.
    const member = await provider.listInventoryItems("u-drew");
    expect(member.map((i) => i.name)).toContain("Prusa MK4");
    await provider.updateInventoryItem("u-staff", "inv-prusa", { showPublicly: true });
    expect(await names()).toContain("Prusa MK4");
  });

  it("lets the area's steward hide an item, and nobody else who is not staff", async () => {
    const provider = createMockDataProvider("u-maya");
    // Maya stewards the woodshop. The Prusa is in FDM printing.
    await provider.updateInventoryItem("u-maya", "inv-sander", { showPublicly: false });
    expect((await provider.listPublicEquipment()).map((i) => i.name)).not.toContain(
      "Orbital sander",
    );
    await expect(
      provider.updateInventoryItem("u-maya", "inv-prusa", { showPublicly: false }),
    ).rejects.toThrow("Stewards can edit items in their areas");
    await expect(
      provider.updateInventoryItem("u-drew", "inv-sander", { showPublicly: true }),
    ).rejects.toThrow("Stewards can edit items in their areas");
    expect((await provider.listPublicEquipment()).map((i) => i.name)).toContain("Prusa MK4");
  });

  it("records who hid it on the item's history", async () => {
    const provider = createMockDataProvider("u-staff");
    await provider.updateInventoryItem("u-staff", "inv-prusa", { showPublicly: false });
    const detail = await provider.getInventoryItem("u-staff", "BX-00002");
    const last = detail!.events.at(-1)!;
    expect(last.actorId).toBe("u-staff");
    expect(last.changes).toMatchObject({ showPublicly: { from: true, to: false } });
  });

  it("is on for a new item", async () => {
    const provider = createMockDataProvider("u-staff");
    const made = await provider.createInventoryItem("u-staff", {
      name: "Bench vise",
      condition: "GOOD",
      areaId: "ia-woodshop",
      noSerial: true,
      photoKeys: [
        { storageKey: FRONT, kind: "FRONT", mimeType: "image/jpeg" },
        { storageKey: SIDE, kind: "SIDE", mimeType: "image/jpeg" },
      ],
    });
    expect(made.showPublicly).toBe(true);
    // Not public until it is approved.
    expect((await provider.listPublicEquipment()).map((i) => i.name)).not.toContain(
      "Bench vise",
    );
    await provider.reviewInventoryItem("u-staff", made.id, "approve");
    const vise = (await provider.listPublicEquipment()).find((i) => i.name === "Bench vise")!;
    expect(vise.photo?.storageKey).toBe(FRONT);
    expect(JSON.stringify(vise)).not.toContain(SIDE);
  });
});
