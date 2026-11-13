import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { handleDataRpc } from "./rpc-policy";
import type { InventoryItemView } from "./provider";

/** Keys shaped like the ones the upload route hands back. */
const FRONT = "local:temp/3f2b1c1e-8a4d-4c57-9b1e-0d6a5c7e9f10.jpg";
const SIDE = "local:temp/7d9e4a22-51c3-4f0b-a6d8-2b1f3e4c5d6a.jpg";
const SERIAL = "local:temp/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.jpg";
const DRIVE = "drive:1AbC_dEfGhIjKlMnOpQrStUvWxYz-012345";

const PRIVATE_FIELDS = [
  "donorName",
  "estimatedValue",
  "notes",
  "serialNumber",
] as const;

function expectStripped(item: InventoryItemView | null | undefined) {
  expect(item).toBeTruthy();
  for (const field of PRIVATE_FIELDS) {
    expect(item, `${field} should be absent`).not.toHaveProperty(field);
  }
}

describe("inventory fields a plain member does not get", () => {
  it("leaves donor, value, notes and serial off every listed item", async () => {
    const provider = createMockDataProvider("u-drew");
    const items = await provider.listInventoryItems("u-drew", {
      includeRetired: true,
    });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expectStripped(item);
    // The fields a member browses by are still there.
    const laser = items.find((i) => i.id === "inv-laser")!;
    expect(laser.name).toBe("CO2 laser cutter");
    expect(laser.assetTag).toBe("BX-00003");
    expect(laser.location).toBe("Laser room");
    expect(laser.frontPhoto).toBeTruthy();
  });

  it("leaves them off the item page too, along with the serial plate photo", async () => {
    const provider = createMockDataProvider("u-drew");
    const laser = await provider.getInventoryItem("u-drew", "BX-00003");
    expectStripped(laser);
    const sander = await provider.getInventoryItem("u-drew", "BX-00001");
    expectStripped(sander);
    expect(sander!.photos.map((p) => p.kind)).toEqual(["FRONT", "SIDE"]);
    expect(sander!.events.length).toBeGreaterThan(0);
  });

  it("does not let a member find an item by guessing at its serial", async () => {
    const provider = createMockDataProvider("u-drew");
    const byPrefix = await provider.listInventoryItems("u-drew", {
      search: "TL-NOVA",
    });
    expect(byPrefix).toEqual([]);
    const byName = await provider.listInventoryItems("u-drew", {
      search: "laser",
    });
    expect(byName.map((i) => i.id)).toContain("inv-laser");
  });

  it("keeps edits to private fields out of the history a member reads", async () => {
    const staff = createMockDataProvider("u-staff");
    await staff.updateInventoryItem("u-staff", "inv-laser", {
      notes: "Insured under the equipment rider.",
      serialNumber: "TL-NOVA-9999",
      location: "Laser room · north wall",
    });
    await staff.setCurrentUserId("u-drew");
    const seen = await staff.getInventoryItem("u-drew", "BX-00003");
    const text = JSON.stringify(seen);
    expect(text).not.toContain("equipment rider");
    expect(text).not.toContain("TL-NOVA");
    const update = seen!.events.find((e) => e.type === "UPDATED")!;
    expect(Object.keys(update.changes ?? {})).toEqual(["location"]);
  });

  it("applies over the data API as well", async () => {
    const provider = createMockDataProvider("u-drew");
    const drew = await provider.getCurrentUser();
    const res = await handleDataRpc({
      method: "listInventoryItems",
      // A member cannot ask as someone else; the id is replaced.
      args: ["u-staff", { includeRetired: true }],
      sessionUser: drew,
      provider,
      productionLocked: true,
    });
    expect(res.body.ok).toBe(true);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain("Burien Rotary");
    expect(text).not.toContain("Estate gift");
    expect(text).not.toContain("estimatedValue");
    expect(text).not.toContain("TL-NOVA-1044");
  });
});

describe("inventory fields stewards and staff still get", () => {
  it("staff see donor, value, notes and serial", async () => {
    const provider = createMockDataProvider("u-staff");
    const laser = await provider.getInventoryItem("u-staff", "BX-00003");
    expect(laser?.donorName).toBe("Burien Rotary");
    expect(laser?.estimatedValue).toBe(4500);
    expect(laser?.notes).toMatch(/Lens last cleaned/);
    expect(laser?.serialNumber).toBe("TL-NOVA-1044");
    const listed = await provider.listInventoryItems("u-staff", {
      search: "tl-nova",
    });
    expect(listed.map((i) => i.id)).toEqual(["inv-laser"]);
    expect(listed[0]?.donorName).toBe("Burien Rotary");
  });

  it("a steward sees them for items in their own area", async () => {
    // Maya stewards the woodshop, where the sander and the table saw live.
    const provider = createMockDataProvider("u-maya");
    const sander = await provider.getInventoryItem("u-maya", "BX-00001");
    expect(sander?.estimatedValue).toBe(79);
    expect(sander?.notes).toMatch(/Hook-and-loop/);
    expect(sander?.serialNumber).toBe("DW6423-88421");
    expect(sander?.photos.map((p) => p.kind)).toContain("SERIAL");
    const listed = await provider.listInventoryItems("u-maya", {
      includeRetired: true,
    });
    const saw = listed.find((i) => i.id === "inv-tablesaw")!;
    expect(saw.donorName).toBe("Estate gift");
    expect(saw.estimatedValue).toBe(0);
  });

  it("a steward is a plain member for another area's items", async () => {
    const provider = createMockDataProvider("u-maya");
    expectStripped(await provider.getInventoryItem("u-maya", "BX-00003"));
    const listed = await provider.listInventoryItems("u-maya");
    expectStripped(listed.find((i) => i.id === "inv-laser"));
    expect(listed.find((i) => i.id === "inv-sander")?.serialNumber).toBe(
      "DW6423-88421",
    );
  });
});

describe("findInventoryBySerial", () => {
  // inv-heatpress (sublimation) and inv-jigsaw (woodshop) are both PENDING.
  it("hides items awaiting review from a plain member", async () => {
    const provider = createMockDataProvider("u-drew");
    expect(await provider.findInventoryBySerial("GK-15-2219")).toEqual([]);
    expect(await provider.findInventoryBySerial("BOS-JS-01992")).toEqual([]);
  });

  it("hides rejected items from a plain member", async () => {
    const provider = createMockDataProvider("u-staff");
    await provider.reviewInventoryItem(
      "u-staff",
      "inv-jigsaw",
      "reject",
      "Personal tool, not the shop's.",
    );
    expect(
      (await provider.findInventoryBySerial("BOS-JS-01992")).map((h) => h.id),
    ).toEqual(["inv-jigsaw"]);
    await provider.setCurrentUserId("u-drew");
    expect(await provider.findInventoryBySerial("BOS-JS-01992")).toEqual([]);
  });

  it("still finds approved items for any member", async () => {
    const provider = createMockDataProvider("u-drew");
    const hits = await provider.findInventoryBySerial(" dw6423-88421 ");
    expect(hits).toEqual([
      { id: "inv-sander", assetTag: "BX-00001", name: "Orbital sander" },
    ]);
  });

  it("shows a steward pending items in their own area only", async () => {
    const provider = createMockDataProvider("u-maya");
    expect(
      (await provider.findInventoryBySerial("BOS-JS-01992")).map((h) => h.id),
    ).toEqual(["inv-jigsaw"]);
    expect(await provider.findInventoryBySerial("GK-15-2219")).toEqual([]);
  });

  it("shows staff everything", async () => {
    const provider = createMockDataProvider("u-staff");
    expect(
      (await provider.findInventoryBySerial("GK-15-2219")).map((h) => h.id),
    ).toEqual(["inv-heatpress"]);
  });

  it("returns nothing to a caller who is not signed in", async () => {
    const provider = createMockDataProvider(null);
    expect(await provider.findInventoryBySerial("GK-15-2219")).toEqual([]);
  });

  it("does not name a hidden item in the duplicate warning on submit", async () => {
    // Drew is a volunteer, not a steward. The heat press is awaiting review.
    const provider = createMockDataProvider("u-drew");
    const created = await provider.createInventoryItem("u-drew", {
      name: "Heat press",
      condition: "GOOD",
      serialNumber: "GK-15-2219",
      photoKeys: [
        { storageKey: FRONT, kind: "FRONT", mimeType: "image/jpeg" },
        { storageKey: SIDE, kind: "SIDE", mimeType: "image/jpeg" },
      ],
    });
    expect(created.reviewStatus).toBe("PENDING");
  });
});

describe("photo keys on inventory writes", () => {
  const photos = (front: string, mimeType = "image/jpeg") => [
    { storageKey: front, kind: "FRONT" as const, mimeType },
    { storageKey: SIDE, kind: "SIDE" as const, mimeType: "image/jpeg" },
    { storageKey: SERIAL, kind: "SERIAL" as const, mimeType: "image/jpeg" },
  ];
  const BAD_KEYS = [
    "drive:",
    "drive:abc/../../secret",
    "drive:1AbC dEf",
    "local:../../secret.png",
    "local:temp/../../../secret.png",
    "local:temp/photo.jpg",
    "local:temp/3f2b1c1e-8a4d-4c57-9b1e-0d6a5c7e9f10.svg",
    "local:temp/3f2b1c1e-8a4d-4c57-9b1e-0d6a5c7e9f10.jpg/extra",
    "fixture:orbital-sander-front",
    "https://example.com/cat.jpg",
    "",
  ];

  it("createInventoryItem accepts keys the upload route issues", async () => {
    const provider = createMockDataProvider("u-jordan");
    const created = await provider.createInventoryItem("u-jordan", {
      name: "Shop vac",
      condition: "GOOD",
      noSerial: true,
      photoKeys: [
        { storageKey: DRIVE, thumbKey: FRONT, kind: "FRONT", mimeType: "image/webp" },
        { storageKey: SIDE, kind: "SIDE", mimeType: "image/png" },
      ],
    });
    expect(created.frontPhoto?.storageKey).toBe(DRIVE);
    expect(created.frontPhoto?.thumbKey).toBe(FRONT);
  });

  it("createInventoryItem refuses any other key", async () => {
    const provider = createMockDataProvider("u-jordan");
    for (const key of BAD_KEYS) {
      await expect(
        provider.createInventoryItem("u-jordan", {
          name: "Shop vac",
          condition: "GOOD",
          noSerial: true,
          photoKeys: photos(key),
        }),
        `key ${JSON.stringify(key)}`,
      ).rejects.toThrow(/photo/i);
    }
    await expect(
      provider.createInventoryItem("u-jordan", {
        name: "Shop vac",
        condition: "GOOD",
        noSerial: true,
        photoKeys: [
          { storageKey: FRONT, thumbKey: "drive:../x", kind: "FRONT", mimeType: "image/jpeg" },
          { storageKey: SIDE, kind: "SIDE", mimeType: "image/jpeg" },
        ],
      }),
    ).rejects.toThrow(/photo/i);
    const after = await provider.listInventoryItems("u-jordan");
    expect(after.some((i) => i.name === "Shop vac")).toBe(false);
  });

  it("createInventoryItem refuses a type that is not JPEG, PNG or WebP", async () => {
    const provider = createMockDataProvider("u-jordan");
    for (const type of ["image/svg+xml", "text/html", "application/pdf", ""]) {
      await expect(
        provider.createInventoryItem("u-jordan", {
          name: "Shop vac",
          condition: "GOOD",
          noSerial: true,
          photoKeys: photos(FRONT, type),
        }),
        `type ${JSON.stringify(type)}`,
      ).rejects.toThrow(/JPEG, PNG, or WebP/i);
    }
  });

  it("createInventoryItem survives photo entries that are not objects", async () => {
    const provider = createMockDataProvider("u-jordan");
    await expect(
      provider.createInventoryItem("u-jordan", {
        name: "Shop vac",
        condition: "GOOD",
        noSerial: true,
        photoKeys: [null, 7, { storageKey: 42, kind: "FRONT" }] as never,
      }),
    ).rejects.toThrow(/photo/i);
    await expect(
      provider.createInventoryItem("u-jordan", {
        name: "Shop vac",
        condition: "GOOD",
        noSerial: true,
        photoKeys: "local:temp/x.jpg" as never,
      }),
    ).rejects.toThrow(/photo/i);
    await expect(
      provider.createInventoryItem("u-jordan", {
        name: "Shop vac",
        condition: "GOOD",
        noSerial: true,
        photoKeys: [
          { storageKey: FRONT, kind: "POSTER", mimeType: "image/jpeg" },
          { storageKey: SIDE, kind: "SIDE", mimeType: "image/jpeg" },
        ] as never,
      }),
    ).rejects.toThrow(/photo/i);
  });

  it("addInventoryPhoto checks the key, the thumbnail key and the type", async () => {
    const provider = createMockDataProvider("u-jordan");
    const ok = await provider.addInventoryPhoto("u-jordan", "inv-sander", {
      storageKey: DRIVE,
      thumbKey: FRONT,
      kind: "OTHER",
      mimeType: "image/png",
    });
    expect(ok.storageKey).toBe(DRIVE);
    for (const key of BAD_KEYS) {
      await expect(
        provider.addInventoryPhoto("u-jordan", "inv-sander", {
          storageKey: key,
          kind: "OTHER",
          mimeType: "image/jpeg",
        }),
        `key ${JSON.stringify(key)}`,
      ).rejects.toThrow(/photo/i);
    }
    await expect(
      provider.addInventoryPhoto("u-jordan", "inv-sander", {
        storageKey: FRONT,
        thumbKey: "fixture:anything",
        kind: "OTHER",
        mimeType: "image/jpeg",
      }),
    ).rejects.toThrow(/photo/i);
    await expect(
      provider.addInventoryPhoto("u-jordan", "inv-sander", {
        storageKey: FRONT,
        kind: "OTHER",
        mimeType: "image/svg+xml",
      }),
    ).rejects.toThrow(/JPEG, PNG, or WebP/i);
    const staff = createMockDataProvider("u-staff");
    const detail = await staff.getInventoryItem("u-staff", "BX-00001");
    expect(detail?.photos.length).toBe(3);
  });

  it("reportInventoryIssue checks the key and the type", async () => {
    const provider = createMockDataProvider("u-drew");
    for (const key of BAD_KEYS.filter(Boolean)) {
      await expect(
        provider.reportInventoryIssue("u-drew", "inv-sander", {
          type: "BROKEN",
          photoKey: key,
        }),
        `key ${JSON.stringify(key)}`,
      ).rejects.toThrow(/photo/i);
    }
    await expect(
      provider.reportInventoryIssue("u-drew", "inv-sander", {
        type: "BROKEN",
        photoKey: FRONT,
        photoMimeType: "text/html",
      }),
    ).rejects.toThrow(/JPEG, PNG, or WebP/i);
    await expect(
      provider.reportInventoryIssue("u-drew", "inv-sander", {
        type: "BROKEN",
        photoKey: { toString: () => FRONT } as never,
      }),
    ).rejects.toThrow(/photo/i);
    // Nothing was recorded for the refused reports.
    const before = await provider.getInventoryItem("u-drew", "BX-00001");
    expect(before?.events.some((e) => e.type === "ISSUE_REPORTED")).toBe(false);

    const withPhoto = await provider.reportInventoryIssue("u-drew", "inv-sander", {
      type: "BROKEN",
      note: "Pad is torn.",
      photoKey: FRONT,
    });
    expect(withPhoto.photoId).toBeTruthy();
    const noPhoto = await provider.reportInventoryIssue("u-drew", "inv-sander", {
      type: "OTHER",
    });
    expect(noPhoto.photoId).toBeNull();
  });

  it("staff CSV import still attaches its placeholder photos", async () => {
    const provider = createMockDataProvider("u-staff");
    const result = await provider.importInventoryCsv(
      "u-staff",
      [{ name: "Bench vise", condition: "GOOD" }],
      false,
    );
    expect(result.created).toBe(1);
    expect(result.failed).toEqual([]);
    const listed = await provider.listInventoryItems("u-staff", {
      includePending: true,
    });
    const vise = listed.find((i) => i.name === "Bench vise");
    expect(vise?.frontPhoto?.storageKey).toMatch(/^fixture:import-bench-vise/);
  });
});
