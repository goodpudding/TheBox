import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitStore } from "@/lib/rate-limit";

const auth = vi.fn();
const syncZeffyPurchasesForEmail = vi.fn();
const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@/auth", () => ({
  auth: () => auth(),
}));

vi.mock("@/lib/zeffy/sync-purchases", () => ({
  syncZeffyPurchasesForEmail: (email: string) => syncZeffyPurchasesForEmail(email),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});

async function post() {
  const { POST } = await import("./route");
  return POST();
}

function signedIn(id: string) {
  auth.mockResolvedValue({ user: { id, email: `${id}@example.com` } });
}

describe("/api/account/sync-membership", () => {
  beforeEach(() => {
    auth.mockReset();
    syncZeffyPurchasesForEmail.mockReset();
    syncZeffyPurchasesForEmail.mockResolvedValue({ applied: 0 });
    cloudflareEnv.mockReset();
    cloudflareEnv.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });
    resetRateLimitStore();
  });

  it("requires sign-in", async () => {
    auth.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(401);
    expect(syncZeffyPurchasesForEmail).not.toHaveBeenCalled();
  });

  it("syncs the signed-in member's purchases", async () => {
    signedIn("member-1");
    const res = await post();
    expect(res.status).toBe(200);
    expect(syncZeffyPurchasesForEmail).toHaveBeenCalledWith("member-1@example.com");
  });

  it("refuses a member's 4th sync in a minute without calling Zeffy", async () => {
    signedIn("member-1");
    for (let i = 0; i < 3; i += 1) {
      expect((await post()).status, `call ${i + 1}`).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post();
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({
      error: "Too many requests. Wait a minute and try again.",
    });
    expect(syncZeffyPurchasesForEmail).toHaveBeenCalledTimes(3);

    signedIn("member-2");
    expect((await post()).status).toBe(200);
  });

  it("keeps syncing when the limiter itself fails", async () => {
    const limit = vi.fn(async () => {
      throw new Error("rate limiter unavailable");
    });
    cloudflareEnv.mockReturnValue({ RL_SYNC_MEMBERSHIP: { limit } });
    signedIn("member-1");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) {
      expect((await post()).status, `call ${i + 1}`).toBe(200);
    }
    spy.mockRestore();
    expect(syncZeffyPurchasesForEmail).toHaveBeenCalledTimes(5);
  });
});
