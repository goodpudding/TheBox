import { beforeEach, describe, expect, it, vi } from "vitest";

const isStaffRequest = vi.fn();
const upsert = vi.fn();

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));
vi.mock("@/lib/workstation/server", () => ({
  isStaffRequest: (request: unknown) => isStaffRequest(request),
}));
vi.mock("@/lib/db", () => ({
  prisma: { machineSoftwareMap: { upsert: (args: unknown) => upsert(args) } },
}));

async function send(body: unknown) {
  const { POST } = await import("./route");
  return POST(
    new Request("https://discoverburienmakerspace.com/api/admin/software-maps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  );
}

const map = { displayName: "Bambu Studio", exeName: "bambu-studio.exe" };

describe("POST /api/admin/software-maps", () => {
  beforeEach(() => {
    isStaffRequest.mockReset();
    upsert.mockReset();
    upsert.mockImplementation(async (args: { create: unknown }) => args.create);
    isStaffRequest.mockResolvedValue({ id: "u-admin", role: "admin" });
  });

  it("refuses someone who is not staff", async () => {
    isStaffRequest.mockResolvedValue(null);
    expect((await send(map)).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps the order and on/off state of a map when a save leaves them out", async () => {
    await send({ ...map, id: "map-bambu" });
    const args = upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect("sortOrder" in args.update).toBe(false);
    expect("active" in args.update).toBe(false);
  });

  it("saves the order and switches a map off when asked", async () => {
    await send({ ...map, id: "map-bambu", sortOrder: 3, active: false });
    const args = upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect(args.update.sortOrder).toBe(3);
    expect(args.update.active).toBe(false);
  });
});
