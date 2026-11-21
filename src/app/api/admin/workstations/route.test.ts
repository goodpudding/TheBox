import { beforeEach, describe, expect, it, vi } from "vitest";

const isStaffRequest = vi.fn();
const upsert = vi.fn();

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));
vi.mock("@/lib/workstation/server", () => ({
  isStaffRequest: (request: unknown) => isStaffRequest(request),
  billingPayload: () => ({ mode: "included", hourlyRateCents: 0, setupFeeCents: 0 }),
}));
vi.mock("@/lib/db", () => ({
  prisma: { workstation: { upsert: (args: unknown) => upsert(args) } },
}));

function post(body: unknown) {
  return new Request("https://discoverburienmakerspace.com/api/admin/workstations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function send(body: unknown) {
  const { POST } = await import("./route");
  return POST(post(body) as never);
}

const desk = { name: "Design PC 1", deviceId: "BOX-PC-1", billedMachineId: "m-1" };

describe("POST /api/admin/workstations", () => {
  beforeEach(() => {
    isStaffRequest.mockReset();
    upsert.mockReset();
    upsert.mockImplementation(async (args: { create: unknown }) => args.create);
    isStaffRequest.mockResolvedValue({ id: "u-admin", role: "admin" });
  });

  it("refuses someone who is not staff", async () => {
    isStaffRequest.mockResolvedValue(null);
    expect((await send(desk)).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("switches a desk off when staff untick Active", async () => {
    await send({ ...desk, id: "ws-pc-1", active: false });
    const args = upsert.mock.calls[0]![0] as { update: { active?: boolean } };
    expect(args.update.active).toBe(false);
  });

  it("leaves a desk's on/off state alone when the save does not mention it", async () => {
    await send({ ...desk, id: "ws-pc-1" });
    const args = upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect("active" in args.update).toBe(false);
  });

  it("says in plain words that a device id is already used", async () => {
    upsert.mockRejectedValue(
      Object.assign(
        new Error(
          "\nInvalid `prisma.workstation.upsert()` invocation:\n\n\nUnique constraint failed on the fields: (`deviceId`)",
        ),
        { name: "PrismaClientKnownRequestError", code: "P2002" },
      ),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await send(desk);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("That device ID is already in use. Choose a different one.");
    expect(body.error).not.toMatch(/prisma/i);
    logged.mockRestore();
  });
});
