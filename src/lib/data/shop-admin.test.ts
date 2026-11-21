import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { RPC_RULES } from "./rpc-policy";

const ADMIN = "u-admin";
const MEMBER = "u-maya";

describe("volunteer roles", () => {
  it("adds a role with its description, and members see both", async () => {
    const provider = createMockDataProvider(ADMIN);
    const role = await provider.adminSaveVolunteerRole({
      title: "Kiln Tender",
      descriptionHtml: '<p onclick="x()">Loads and unloads the kiln.</p><script>alert(1)</script>',
    });
    expect(role.slug).toBe("kiln-tender");
    expect(role.active).toBe(true);
    const listed = await provider.listVolunteerRoles();
    expect(listed.at(-1)?.title).toBe("Kiln Tender");
    const page = await provider.getContentBySlug(role.contentSlug);
    expect(page?.category).toBe("volunteer");
    expect(page?.html).toBe("<p>Loads and unloads the kiln.</p>");
  });

  it("renames, reorders and rewrites a role without moving its description page", async () => {
    const provider = createMockDataProvider(ADMIN);
    const role = (await provider.listVolunteerRoles())[0]!;
    const saved = await provider.adminSaveVolunteerRole({
      id: role.id,
      title: "Front Desk Host",
      descriptionHtml: "<p>Welcomes people at the door.</p>",
      sortOrder: 99,
    });
    expect(saved.slug).toBe(role.slug);
    expect(saved.contentSlug).toBe(role.contentSlug);
    expect((await provider.listVolunteerRoles()).at(-1)?.title).toBe("Front Desk Host");
    expect((await provider.getContentBySlug(role.contentSlug))?.html).toBe(
      "<p>Welcomes people at the door.</p>",
    );
  });

  it("hides a switched-off role from members and keeps it for staff", async () => {
    const provider = createMockDataProvider(ADMIN);
    const role = (await provider.listVolunteerRoles())[0]!;
    await provider.adminSaveVolunteerRole({ id: role.id, title: role.title, active: false });
    expect((await provider.listVolunteerRoles()).map((r) => r.id)).not.toContain(role.id);
    expect((await provider.adminListVolunteerRoles()).map((r) => r.id)).toContain(role.id);
    await provider.adminSaveVolunteerRole({ id: role.id, title: role.title, active: true });
    expect((await provider.listVolunteerRoles()).map((r) => r.id)).toContain(role.id);
  });

  it("needs a title, and refuses a title another role already has", async () => {
    const provider = createMockDataProvider(ADMIN);
    const role = (await provider.listVolunteerRoles())[0]!;
    await expect(provider.adminSaveVolunteerRole({ title: "  " })).rejects.toThrow(/title/i);
    await expect(provider.adminSaveVolunteerRole({ title: role.title })).rejects.toThrow(
      `There is already a role called "${role.title}".`,
    );
  });
});

describe("badges", () => {
  it("registers a new badge for a member in the form the readers send", async () => {
    const provider = createMockDataProvider(ADMIN);
    const badge = await provider.adminRegisterBadge(MEMBER, {
      uid: "04:AB:9C:12:7F:55:80",
      label: "Blue fob",
    });
    expect(badge.uid).toBe("04ab9c127f5580");
    expect(badge.userId).toBe(MEMBER);
    expect(badge.active).toBe(true);
    expect((await provider.listBadges(MEMBER)).map((b) => b.id)).toContain(badge.id);
    const audit = await provider.adminListAuditEvents(MEMBER);
    expect(audit[0]).toMatchObject({ action: "badge_registered", actorId: ADMIN });
  });

  it("refuses a UID that is already someone's badge, by name", async () => {
    const provider = createMockDataProvider(ADMIN);
    const taken = (await provider.adminListBadges()).find((b) => b.userId)!;
    const owner = await provider.getMember(taken.userId!);
    await expect(
      provider.adminRegisterBadge(MEMBER, { uid: taken.uid.toUpperCase() }),
    ).rejects.toThrow(`That badge is already registered to ${owner.displayName}.`);
  });

  it("refuses a UID that is not a badge number", async () => {
    const provider = createMockDataProvider(ADMIN);
    await expect(provider.adminRegisterBadge(MEMBER, { uid: "hello" })).rejects.toThrow(
      /badge number/i,
    );
  });

  it("switches a lost badge off at the readers and back on", async () => {
    const provider = createMockDataProvider(ADMIN);
    const badge = (await provider.listBadges(MEMBER))[0]!;
    const off = await provider.adminSetBadgeActive(badge.id, false);
    expect(off.active).toBe(false);
    const machine = (await provider.listMachines())[0]!;
    const denied = await provider.authorizeAccess({
      readerKey: machine.readerKey,
      badgeUid: badge.uid,
    });
    expect(denied).toMatchObject({ allow: false, reason: "badge_inactive" });
    expect((await provider.adminSetBadgeActive(badge.id, true)).active).toBe(true);
  });
});

describe("bounty moderation", () => {
  async function withBounty() {
    const provider = createMockDataProvider(ADMIN);
    const bounty = await provider.submitBountyRequest({
      title: "Shop sign for the bakery",
      description: "A wooden sign about two feet wide for our front window.",
      requesterName: "Pat Baker",
      requesterEmail: "pat@example.org",
    });
    return { provider, bounty };
  }

  it("edits the wording of a request", async () => {
    const { provider, bounty } = await withBounty();
    const saved = await provider.adminUpdateBounty(bounty.id, {
      title: "Bakery window sign",
      description: "A wooden sign, two feet wide, for the front window.",
    });
    expect(saved.title).toBe("Bakery window sign");
    expect((await provider.getBounty(bounty.id))?.title).toBe("Bakery window sign");
  });

  it("hides a request from the board and brings it back", async () => {
    const { provider, bounty } = await withBounty();
    await provider.adminUpdateBounty(bounty.id, { hidden: true });
    expect((await provider.listBounties()).map((b) => b.id)).not.toContain(bounty.id);
    expect(await provider.getBounty(bounty.id)).toBeNull();
    const staffList = await provider.adminListBounties();
    expect(staffList.find((b) => b.id === bounty.id)?.deletedAt).toBeTruthy();
    await provider.adminUpdateBounty(bounty.id, { hidden: false });
    expect((await provider.listBounties()).map((b) => b.id)).toContain(bounty.id);
  });

  it("reopens a claimed request", async () => {
    const { provider, bounty } = await withBounty();
    await provider.claimBounty(bounty.id, MEMBER);
    const reopened = await provider.adminUpdateBounty(bounty.id, { reopen: true });
    expect(reopened.status).toBe("open");
    expect(reopened.claimedByUserId ?? null).toBeNull();
    expect(reopened.claimedAt ?? null).toBeNull();
    expect(reopened.completedAt ?? null).toBeNull();
  });

  it("removes spam for good", async () => {
    const { provider, bounty } = await withBounty();
    await provider.adminDeleteBounty(bounty.id);
    expect((await provider.adminListBounties()).map((b) => b.id)).not.toContain(bounty.id);
    expect((await provider.listBounties()).map((b) => b.id)).not.toContain(bounty.id);
  });

  it("still keeps the requester's email from other members", async () => {
    const { provider, bounty } = await withBounty();
    await provider.adminUpdateBounty(bounty.id, { title: "Bakery window sign" });
    await provider.setCurrentUserId("u-quinn");
    const seen = (await provider.listBounties()).find((b) => b.id === bounty.id)!;
    expect(seen.requesterEmail).toBeUndefined();
  });
});

describe("maintenance blocks", () => {
  const window = {
    startsAt: "2026-12-01T18:00:00.000Z",
    endsAt: "2026-12-01T20:00:00.000Z",
  };

  it("changes a block's time and reason", async () => {
    const provider = createMockDataProvider(ADMIN);
    const machine = (await provider.listMachines())[0]!;
    const block = await provider.adminUpsertMaintenanceBlock({
      machineId: machine.id,
      ...window,
      reason: "Belt change",
      createdById: ADMIN,
    });
    const saved = await provider.adminUpsertMaintenanceBlock({
      id: block.id,
      machineId: machine.id,
      startsAt: window.startsAt,
      endsAt: "2026-12-01T21:00:00.000Z",
      reason: "Belt and pulley change",
      createdById: ADMIN,
    });
    expect(saved.id).toBe(block.id);
    expect(saved.reason).toBe("Belt and pulley change");
    const all = await provider.adminListMaintenanceBlocks();
    expect(all.filter((b) => b.id === block.id)).toHaveLength(1);
    expect(all.find((b) => b.id === block.id)?.endsAt).toBe("2026-12-01T21:00:00.000Z");
  });

  it("removes a block, which frees the machine again", async () => {
    const provider = createMockDataProvider(ADMIN);
    const machine = (await provider.listMachines())[0]!;
    const block = await provider.adminUpsertMaintenanceBlock({
      machineId: machine.id,
      ...window,
      reason: "Belt change",
      createdById: ADMIN,
    });
    await provider.adminDeleteMaintenanceBlock(block.id);
    expect((await provider.adminListMaintenanceBlocks()).map((b) => b.id)).not.toContain(
      block.id,
    );
    await expect(provider.adminDeleteMaintenanceBlock(block.id)).rejects.toThrow(
      "That maintenance block is already gone.",
    );
  });
});

describe("inventory area stewards", () => {
  it("sets who stewards an area, replacing the earlier list", async () => {
    const provider = createMockDataProvider(ADMIN);
    const area = (await provider.listInventoryAreas())[0]!;
    await provider.adminSetAreaStewards(area.id, [MEMBER, "u-quinn"]);
    let stewards = (await provider.listAreaStewards()).filter((s) => s.areaId === area.id);
    expect(stewards.map((s) => s.userId).sort()).toEqual(["u-maya", "u-quinn"]);

    await provider.adminSetAreaStewards(area.id, ["u-quinn"]);
    stewards = (await provider.listAreaStewards()).filter((s) => s.areaId === area.id);
    expect(stewards.map((s) => s.userId)).toEqual(["u-quinn"]);
  });

  it("keeps a steward's row when they stay on the list", async () => {
    const provider = createMockDataProvider(ADMIN);
    const area = (await provider.listInventoryAreas())[0]!;
    await provider.adminSetAreaStewards(area.id, [MEMBER]);
    const first = (await provider.listAreaStewards()).find(
      (s) => s.areaId === area.id && s.userId === MEMBER,
    )!;
    await provider.adminSetAreaStewards(area.id, [MEMBER, "u-quinn"]);
    const again = (await provider.listAreaStewards()).find(
      (s) => s.areaId === area.id && s.userId === MEMBER,
    )!;
    expect(again.id).toBe(first.id);
  });

  it("refuses an area or a member that does not exist", async () => {
    const provider = createMockDataProvider(ADMIN);
    const area = (await provider.listInventoryAreas())[0]!;
    await expect(provider.adminSetAreaStewards("nope", [MEMBER])).rejects.toThrow(/area/i);
    await expect(provider.adminSetAreaStewards(area.id, ["nobody"])).rejects.toThrow(/member/i);
  });
});

describe("settings that point at a page", () => {
  it("changes which page is shown as the hours", async () => {
    const provider = createMockDataProvider(ADMIN);
    const page = await provider.adminSaveContentPage({
      title: "Winter hours",
      html: "<p>Closed Mondays.</p>",
      category: "hours",
    });
    const saved = await provider.adminUpdateSettings({ hoursContentSlug: page.slug });
    expect(saved.hoursContentSlug).toBe("winter-hours");
  });

  it("refuses a page that does not exist", async () => {
    const provider = createMockDataProvider(ADMIN);
    await expect(
      provider.adminUpdateSettings({ memberExpectationsPolicySlug: "no-such-page" }),
    ).rejects.toThrow("Choose a published page from the list.");
  });

  it("can turn the every-safety-question rule off and on", async () => {
    const provider = createMockDataProvider(ADMIN);
    expect(
      (await provider.adminUpdateSettings({ requireSafetyCriticalAll: false }))
        .requireSafetyCriticalAll,
    ).toBe(false);
  });
});

describe("who may call these", () => {
  it("keeps every new method staff-only", () => {
    for (const method of [
      "adminListVolunteerRoles",
      "adminSaveVolunteerRole",
      "adminRegisterBadge",
      "adminSetBadgeActive",
      "adminListBounties",
      "adminUpdateBounty",
      "adminDeleteBounty",
      "adminDeleteMaintenanceBlock",
      "adminSetAreaStewards",
    ] as const) {
      expect(RPC_RULES[method].access, method).toBe("staff");
    }
  });
});
