import { beforeEach, describe, expect, it, vi } from "vitest";

const payload = vi.fn();

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => undefined,
}));
vi.mock("@/lib/workstation/payload", () => ({
  workstationConfigPayload: (id: string) => payload(id),
}));

async function get(id: string) {
  const { GET } = await import("./route");
  return GET(new Request(`https://discoverburienmakerspace.com/api/workstations/${id}/config`) as never, {
    params: Promise.resolve({ id }),
  });
}

describe("GET /api/workstations/[id]/config", () => {
  beforeEach(() => {
    payload.mockReset();
  });

  it("answers 404 for a desk nobody has registered", async () => {
    payload.mockResolvedValue(null);
    const res = await get("BOX-PC-9");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toMatch(/not set up/i);
  });

  it("refuses a desk staff have switched off, and says so", async () => {
    payload.mockResolvedValue({ workstation: { id: "ws-1", active: false }, equipment: [] });
    const res = await get("BOX-PC-1");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(/switched off/i);
  });

  it("gives an active desk its settings", async () => {
    payload.mockResolvedValue({ workstation: { id: "ws-1", active: true }, equipment: [] });
    const res = await get("BOX-PC-1");
    expect(res.status).toBe(200);
  });
});
