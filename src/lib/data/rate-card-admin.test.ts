import { describe, expect, it } from "vitest";
import { DEFAULT_RATE_CARD } from "@/lib/rate-card";
import { createMockDataProvider } from "./mock-provider";
import { RPC_RULES, handleDataRpc } from "./rpc-policy";

async function actors() {
  const all = await createMockDataProvider().adminListMembers();
  return {
    staff: all.find((u) => u.role === "staff")!,
    member: all.find((u) => u.role === "member" && u.status === "active")!,
  };
}

describe("the rate card", () => {
  it("starts as the default card, and anyone can read it", async () => {
    const provider = createMockDataProvider();
    expect(await provider.getRateCard()).toEqual(DEFAULT_RATE_CARD);
    expect(RPC_RULES.getRateCard.access).toBe("public");
  });

  it("keeps a change, leaves the rest alone, and records who made it", async () => {
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    const saved = await provider.adminSaveRateCard({ laserMemberHourlyCents: 1800 });
    expect(saved).toEqual({ ...DEFAULT_RATE_CARD, laserMemberHourlyCents: 1800 });
    expect(await provider.getRateCard()).toEqual(saved);
    const audit = (await provider.adminListAuditEvents()).find(
      (e) => e.action === "rate_card_changed",
    );
    expect(audit).toMatchObject({
      actorId: staff.id,
      entityType: "rate_card",
      metadata: { laserMemberHourlyCents: { from: 1500, to: 1800 } },
    });
  });

  it("writes no audit row when nothing changed", async () => {
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    await provider.adminSaveRateCard({ laserMemberHourlyCents: 1500 });
    expect(
      (await provider.adminListAuditEvents()).filter((e) => e.action === "rate_card_changed"),
    ).toHaveLength(0);
  });

  it("refuses a bad value and keeps the card as it was", async () => {
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    await expect(provider.adminSaveRateCard({ laserMemberHourlyCents: -100 })).rejects.toThrow(
      "Laser, member, per hour cannot be negative.",
    );
    await expect(
      provider.adminSaveRateCard({ cncMemberHourlyCents: 1200, filamentMarkup: 0.5 }),
    ).rejects.toThrow("Filament markup cannot be below cost (0%).");
    expect(await provider.getRateCard()).toEqual(DEFAULT_RATE_CARD);
  });

  it("is staff only to change", async () => {
    const { member, staff } = await actors();
    const provider = createMockDataProvider(member.id);
    const refused = await handleDataRpc({
      method: "adminSaveRateCard",
      args: [{ laserMemberHourlyCents: 1 }],
      sessionUser: member,
      provider,
    });
    expect(refused).toMatchObject({ status: 403, body: { ok: false, error: "Staff only" } });
    const anonymous = await handleDataRpc({
      method: "adminSaveRateCard",
      args: [{ laserMemberHourlyCents: 1 }],
      sessionUser: null,
      provider,
    });
    expect(anonymous.status).toBe(401);
    expect(await provider.getRateCard()).toEqual(DEFAULT_RATE_CARD);

    const allowed = await handleDataRpc({
      method: "adminSaveRateCard",
      args: [{ laserMemberHourlyCents: 1600 }],
      sessionUser: staff,
      provider: createMockDataProvider(staff.id),
    });
    expect(allowed.body).toMatchObject({ ok: true });
  });

  it("prices a new machine's stored rate from the card", async () => {
    const { staff } = await actors();
    const provider = createMockDataProvider(staff.id);
    await provider.adminSaveRateCard({ laserMemberHourlyCents: 1800 });
    const machine = await provider.adminUpsertMachine({
      name: "Second Laser",
      area: "laser",
      requiredCertificationIds: [],
      readerKey: "",
    });
    expect(machine.hourlyRateCents).toBe(1800);
  });
});
