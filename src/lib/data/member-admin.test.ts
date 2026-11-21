import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

async function people() {
  const provider = createMockDataProvider();
  const all = await provider.adminListMembers();
  const admin = all.find((u) => u.role === "admin" && u.status === "active")!;
  const staff = all.find((u) => u.role === "staff")!;
  const member = all.find((u) => u.role === "member" && u.status === "active")!;
  return { provider, admin, staff, member, all };
}

describe("adminUpdateMember", () => {
  it("lets an admin make a member staff, and records who did it", async () => {
    const { admin, member } = await people();
    const provider = createMockDataProvider(admin.id);
    const updated = await provider.adminUpdateMember(member.id, { role: "staff" });
    expect(updated.role).toBe("staff");
    const audit = await provider.adminListAuditEvents(member.id);
    expect(audit[0]).toMatchObject({
      action: "member_role_changed",
      actorId: admin.id,
      metadata: { from: "member", to: "staff" },
    });
  });

  it("refuses a role change from staff, whoever the request claims to be", async () => {
    const { staff, member } = await people();
    const provider = createMockDataProvider(staff.id);
    await expect(provider.adminUpdateMember(member.id, { role: "admin" })).rejects.toThrow(
      "Only an admin can change roles.",
    );
    expect((await provider.getMember(member.id)).role).toBe("member");
  });

  it("refuses an admin changing their own role", async () => {
    const { admin } = await people();
    const provider = createMockDataProvider(admin.id);
    await expect(provider.adminUpdateMember(admin.id, { role: "member" })).rejects.toThrow(
      "You cannot change your own role.",
    );
  });

  it("refuses to demote the last active admin", async () => {
    const { admin, member } = await people();
    const provider = createMockDataProvider(admin.id);
    // A second admin whose membership has lapsed: an admin, but not an active one.
    await provider.adminUpdateMember(member.id, { role: "admin" });
    await provider.adminUpdateMemberStatus(member.id, "lapsed", admin.id);
    await provider.setCurrentUserId(member.id);
    await expect(provider.adminUpdateMember(admin.id, { role: "staff" })).rejects.toThrow(
      "This is the last active admin. Make someone else an admin first.",
    );
    expect((await provider.getMember(admin.id)).role).toBe("admin");
  });

  it("lets staff set the tier, shop access and a staff note", async () => {
    const { staff, member } = await people();
    const provider = createMockDataProvider(staff.id);
    const updated = await provider.adminUpdateMember(member.id, {
      tier: "maker",
      shopAccess: false,
      notes: "Comped through December.",
    });
    expect(updated.tier).toBe("maker");
    expect(updated.shopAccess).toBe(false);
    expect(updated._notes).toBe("Comped through December.");
  });

  it("refuses a tier or role that does not exist", async () => {
    const { admin, member } = await people();
    const provider = createMockDataProvider(admin.id);
    await expect(
      provider.adminUpdateMember(member.id, { tier: "platinum" as never }),
    ).rejects.toThrow(/membership/i);
    await expect(
      provider.adminUpdateMember(member.id, { role: "owner" as never }),
    ).rejects.toThrow(/role/i);
  });
});
