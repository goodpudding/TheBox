import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";
import { RPC_RULES, handleDataRpc } from "./rpc-policy";
import type { MaintenanceBlock, User } from "./types";

const STAFF = "u-staff";
const STEWARD = "u-reed";

const window = {
  startsAt: "2026-12-01T18:00:00.000Z",
  endsAt: "2026-12-01T20:00:00.000Z",
  reason: "Blade change",
};

async function setup(actorId: string | null) {
  const provider = createMockDataProvider(actorId);
  const all = await createMockDataProvider().adminListMembers();
  const machine = (await provider.listMachines())[0]!;
  const user = (id: string) => all.find((u) => u.id === id)!;
  const member = all.find(
    (u) => u.role === "member" && u.status === "active" && u.tier !== "shop_steward",
  )!;
  return { provider, machine, user, member };
}

/** The call as the live site makes it: through the data API, as a signed-in person. */
async function call(
  sessionUser: User | null,
  method: string,
  args: unknown[],
) {
  const provider = createMockDataProvider(sessionUser?.id ?? null);
  const response = await handleDataRpc({ method, args, sessionUser, provider, productionLocked: true });
  return { response, provider };
}

describe("scheduling maintenance", () => {
  it("is open to signed-in people at the door and decided by the provider", () => {
    expect(RPC_RULES.scheduleMaintenance.access).toBe("user");
    expect(RPC_RULES.listMaintenanceSchedule.access).toBe("user");
  });

  it("lets a Shop Steward who is not staff schedule a block, under their own name", async () => {
    const { machine, user } = await setup(null);
    const { response, provider } = await call(user(STEWARD), "scheduleMaintenance", [
      // A request cannot name someone else as the person who scheduled it.
      { machineId: machine.id, ...window, createdById: STAFF },
    ]);
    expect(response.body.ok).toBe(true);
    const block = (response.body as { result: MaintenanceBlock }).result;
    expect(block.createdById).toBe(STEWARD);
    const listed = await handleDataRpc({
      method: "listMaintenanceSchedule",
      args: [],
      sessionUser: user(STEWARD),
      provider,
      productionLocked: true,
    });
    expect((listed.body as { result: MaintenanceBlock[] }).result.map((b) => b.id)).toContain(block.id);
  });

  it("lets staff schedule a block", async () => {
    const { machine, user } = await setup(null);
    const { response } = await call(user(STAFF), "scheduleMaintenance", [
      { machineId: machine.id, ...window },
    ]);
    expect(response.body).toMatchObject({ ok: true, result: { createdById: STAFF } });
  });

  it("refuses an ordinary member, to schedule or to read the schedule", async () => {
    const { machine, member } = await setup(null);
    const { response, provider } = await call(member, "scheduleMaintenance", [
      { machineId: machine.id, ...window, createdById: STAFF },
    ]);
    expect(response.body).toEqual({
      ok: false,
      error: "Only staff or Shop Stewards can schedule maintenance",
    });
    const listed = await handleDataRpc({
      method: "listMaintenanceSchedule",
      args: [],
      sessionUser: member,
      provider,
      productionLocked: true,
    });
    expect(listed.body.ok).toBe(false);
    expect(
      (await createMockDataProvider(STAFF).adminListMaintenanceBlocks()).length,
    ).toBe((await provider.adminListMaintenanceBlocks()).length);
  });

  it("refuses a steward whose membership has lapsed, and a visitor", async () => {
    const { machine, user } = await setup(null);
    const lapsed = { ...user(STEWARD), status: "lapsed" as const };
    const provider = createMockDataProvider(STEWARD);
    await provider.adminUpdateMemberStatus(STEWARD, "lapsed", STAFF);
    const refused = await handleDataRpc({
      method: "scheduleMaintenance",
      args: [{ machineId: machine.id, ...window }],
      sessionUser: lapsed,
      provider,
      productionLocked: true,
    });
    expect(refused.body.ok).toBe(false);

    const { response } = await call(null, "scheduleMaintenance", [
      { machineId: machine.id, ...window },
    ]);
    expect(response.status).toBe(401);
  });

  it("keeps the admin methods staff only", async () => {
    const { machine, user } = await setup(null);
    const { response } = await call(user(STEWARD), "adminUpsertMaintenanceBlock", [
      { machineId: machine.id, ...window, createdById: STEWARD },
    ]);
    expect(response).toMatchObject({ status: 403 });
    const removed = await call(user(STEWARD), "adminDeleteMaintenanceBlock", ["mb-anything"]);
    expect(removed.response).toMatchObject({ status: 403 });
  });

  it("lets a steward change the time on a block and keeps who first scheduled it", async () => {
    const { machine } = await setup(null);
    const provider = createMockDataProvider(STAFF);
    const block = await provider.scheduleMaintenance({ machineId: machine.id, ...window });
    await provider.setCurrentUserId(STEWARD);
    const edited = await provider.scheduleMaintenance({
      id: block.id,
      machineId: machine.id,
      ...window,
      endsAt: "2026-12-01T21:00:00.000Z",
    });
    expect(edited.endsAt).toBe("2026-12-01T21:00:00.000Z");
    expect(edited.createdById).toBe(STAFF);
  });
});
