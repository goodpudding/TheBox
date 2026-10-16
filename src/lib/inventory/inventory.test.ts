import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "@/lib/data/mock-provider";
import { canInventory } from "./permissions";
import { formatAssetTag, parseAssetTag } from "./tags";
import { defaultColumnMapping, parseCsvText } from "./csv";

describe("asset tags", () => {
  it("formats sequential numbers as BX-00042", () => {
    expect(formatAssetTag(42)).toBe("BX-00042");
    expect(parseAssetTag("BX-00042")).toBe(42);
    expect(parseAssetTag("bx-7")).toBe(7);
  });
});

describe("canInventory", () => {
  it("maps portal roles onto inventory actions", async () => {
    const provider = createMockDataProvider("u-maya");
    const maya = await provider.getMember("u-maya");
    const jordan = await provider.getMember("u-jordan");
    const staff = await provider.getMember("u-staff");
    const stewards = await provider.listAreaStewards();

    expect(canInventory(maya, "submit")).toBe(true);
    expect(canInventory(maya, "reportIssue")).toBe(true);
    expect(
      canInventory(maya, "approve", { areaId: "ia-woodshop", stewards }),
    ).toBe(true);
    expect(
      canInventory(maya, "approve", { areaId: "ia-laser", stewards }),
    ).toBe(false);
    expect(
      canInventory(jordan, "approve", { areaId: "ia-woodshop", stewards }),
    ).toBe(false);
    expect(canInventory(staff, "retire", { stewards })).toBe(true);
    expect(canInventory(maya, "retire", { stewards })).toBe(false);
  });
});

describe("inventory provider", () => {
  it("keeps pending items out of the member catalog", async () => {
    const member = createMockDataProvider("u-quinn");
    const listed = await member.listInventoryItems("u-quinn");
    const tags = listed.map((i) => i.assetTag);
    expect(tags).toContain("BX-00001");
    expect(tags).not.toContain("BX-00005");
    expect(tags).not.toContain("BX-00006");
    expect(listed.every((i) => i.reviewStatus === "APPROVED")).toBe(true);
    expect(listed.some((i) => i.status === "RETIRED")).toBe(false);
  });

  it("lets a woodshop steward review only their area", async () => {
    const maya = createMockDataProvider("u-maya");
    const pending = await maya.listInventoryItems("u-maya", {
      includePending: true,
      reviewStatus: "PENDING",
    });
    expect(pending.map((i) => i.name)).toContain("Jigsaw");
    expect(pending.every((i) => !i.areaId || i.areaId === "ia-woodshop")).toBe(
      true,
    );
    const approved = await maya.reviewInventoryItem(
      "u-maya",
      "inv-jigsaw",
      "approve",
    );
    expect(approved.reviewStatus).toBe("APPROVED");
    const detail = await maya.getInventoryItem("u-maya", "BX-00006");
    expect(detail?.events.some((e) => e.type === "APPROVED")).toBe(true);
  });

  it("creates pending items with a CREATED event and never deletes on retire", async () => {
    const provider = createMockDataProvider("u-jordan");
    const created = await provider.createInventoryItem("u-jordan", {
      name: "Shop vac",
      condition: "GOOD",
      noSerial: true,
      photoKeys: [
        { storageKey: "fixture:vac-front", kind: "FRONT", mimeType: "image/svg+xml" },
        { storageKey: "fixture:vac-side", kind: "SIDE", mimeType: "image/svg+xml" },
      ],
    });
    expect(created.reviewStatus).toBe("PENDING");
    const catalog = await provider.listInventoryItems("u-jordan");
    expect(catalog.find((i) => i.id === created.id)).toBeUndefined();

    await provider.setCurrentUserId("u-admin");
    await provider.reviewInventoryItem("u-admin", created.id, "approve");
    const retired = await provider.retireInventoryItem(
      "u-admin",
      created.id,
      "scrapped",
    );
    expect(retired.status).toBe("RETIRED");
    const still = await provider.getInventoryItem("u-admin", created.assetTag);
    expect(still?.id).toBe(created.id);
    expect(still?.events.some((e) => e.type === "RETIRED")).toBe(true);
  });

  it("warns on duplicate serials", async () => {
    const maya = createMockDataProvider("u-maya");
    const hits = await maya.findInventoryBySerial("DW6423-88421");
    expect(hits[0]?.assetTag).toBe("BX-00001");
    await expect(
      maya.createInventoryItem("u-maya", {
        name: "Copy sander",
        condition: "GOOD",
        serialNumber: "DW6423-88421",
        photoKeys: [
          { storageKey: "fixture:a", kind: "FRONT", mimeType: "image/svg+xml" },
          { storageKey: "fixture:b", kind: "SIDE", mimeType: "image/svg+xml" },
          { storageKey: "fixture:c", kind: "SERIAL", mimeType: "image/svg+xml" },
        ],
      }),
    ).rejects.toThrow(/already be in inventory/i);
  });
});

describe("csv mapping", () => {
  it("guesses Google Form column titles", () => {
    const { headers, rows } = parseCsvText(
      "Item name,Condition,Area,Front photo\nShop vac,Good,Woodshop,https://drive.google.com/file/d/abc123abcdefghijk/view\n",
    );
    const mapping = defaultColumnMapping(headers);
    expect(mapping.name).toBe(0);
    expect(mapping.condition).toBe(1);
    expect(rows[0]?.[0]).toBe("Shop vac");
  });
});
