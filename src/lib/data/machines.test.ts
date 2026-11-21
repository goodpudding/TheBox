import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

const base = {
  area: "woodshop" as const,
  requiredCertificationIds: [],
};

describe("adminUpsertMachine", () => {
  it("makes up a reader key when staff leave it blank", async () => {
    const provider = createMockDataProvider();
    const saw = await provider.adminUpsertMachine({ ...base, name: "SawStop Table Saw", readerKey: "" });
    const band = await provider.adminUpsertMachine({ ...base, name: "Bandsaw", readerKey: "   " });
    expect(saw.readerKey).toMatch(/^reader-sawstop-table-saw-[0-9a-f]{4}$/);
    expect(band.readerKey).toMatch(/^reader-bandsaw-[0-9a-f]{4}$/);
    expect(saw.readerKey).not.toBe(band.readerKey);
  });

  it("refuses a reader key another machine already has, in plain words", async () => {
    const provider = createMockDataProvider();
    await provider.adminUpsertMachine({ ...base, name: "Laser A", readerKey: "laser-1" });
    await expect(
      provider.adminUpsertMachine({ ...base, name: "Laser B", readerKey: "laser-1" }),
    ).rejects.toThrow('Reader key "laser-1" is already used by Laser A.');
  });

  it("lets a machine keep its own reader key when it is edited", async () => {
    const provider = createMockDataProvider();
    const laser = await provider.adminUpsertMachine({ ...base, name: "Laser A", readerKey: "laser-1" });
    const renamed = await provider.adminUpsertMachine({ ...laser, name: "Laser Alpha" });
    expect(renamed.name).toBe("Laser Alpha");
    expect(renamed.readerKey).toBe("laser-1");
  });

  it("keeps the old reader key when an edit sends a blank one", async () => {
    const provider = createMockDataProvider();
    const laser = await provider.adminUpsertMachine({ ...base, name: "Laser A", readerKey: "laser-1" });
    const edited = await provider.adminUpsertMachine({ ...laser, readerKey: "" });
    expect(edited.readerKey).toBe("laser-1");
  });

  it("needs a name", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminUpsertMachine({ ...base, name: "  ", readerKey: "x" }),
    ).rejects.toThrow("Give the machine a name.");
  });
});
