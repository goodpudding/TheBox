import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const runClassSync = vi.fn();
const lastClassSyncAt = vi.fn();
const archiveCsvClasses = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => auth(),
}));

vi.mock("@/lib/sync/run", () => ({
  runClassSync: () => runClassSync(),
  lastClassSyncAt: () => lastClassSyncAt(),
  archiveCsvClasses: () => archiveCsvClasses(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});

function request(init?: { authorization?: string; method?: string }) {
  return new Request("https://discoverburienmakerspace.com/api/sync/zeffy", {
    method: init?.method ?? "POST",
    headers: init?.authorization
      ? { Authorization: init.authorization }
      : undefined,
  });
}

describe("POST /api/sync/zeffy", () => {
  beforeEach(() => {
    auth.mockReset();
    runClassSync.mockReset();
    process.env.SYNC_SECRET = "sync-secret";
    runClassSync.mockResolvedValue({
      created: 1,
      updated: 0,
      cancelled: 0,
      calendar: { created: 1, updated: 0, deleted: 0, errors: [] },
      lastSyncedAt: "2026-11-01T00:00:00.000Z",
    });
  });

  it("rejects callers with no secret and no staff session", async () => {
    auth.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(runClassSync).not.toHaveBeenCalled();
  });

  it("runs for a signed-in staff user", async () => {
    auth.mockResolvedValue({ user: { id: "u-staff", role: "staff" } });
    const { POST } = await import("./route");
    const res = await POST(request());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { created: number };
    expect(body.created).toBe(1);
  });

  it("runs for the sync secret", async () => {
    auth.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(request({ authorization: "Bearer sync-secret" }));
    expect(res.status).toBe(200);
  });
});
