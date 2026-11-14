import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { RATE_LIMITS, resetRateLimitStore } from "@/lib/rate-limit";

const loginWithPin = vi.fn();
const memberMePayload = vi.fn();

vi.mock("@/lib/workstation/server", () => ({
  loginWithPin: (input: unknown) => loginWithPin(input),
}));
vi.mock("@/lib/workstation/payload", () => ({
  memberMePayload: (input: unknown) => memberMePayload(input),
}));
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    throw new Error("no Cloudflare context");
  },
}));
vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});

async function post(ip: string) {
  const { POST } = await import("./route");
  return POST(
    new NextRequest("http://localhost/api/workstation/login", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify({
        workstationId: "BOX-PC-1",
        email: "maya@example.com",
        pin: "0001",
      }),
    }),
  );
}

describe("POST /api/workstation/login", () => {
  beforeEach(() => {
    loginWithPin.mockReset();
    loginWithPin.mockImplementation(async () => {
      throw Object.assign(new Error("Email or PIN didn't match"), { status: 401 });
    });
    memberMePayload.mockReset();
    resetRateLimitStore();
  });

  it("passes a PIN attempt through to the sign-in check", async () => {
    const res = await post("203.0.113.7");
    expect(res.status).toBe(401);
    expect(loginWithPin).toHaveBeenCalledTimes(1);
  });

  it("stops taking PINs from one address after a minute's allowance, before any is checked", async () => {
    const allowance = RATE_LIMITS.pinAttempt.limit;
    for (let i = 0; i < allowance; i += 1) {
      expect((await post("203.0.113.7")).status, `call ${i + 1}`).toBe(401);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post("203.0.113.7");
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(((await res.json()) as { error: string }).error).toMatch(/too many/i);
    expect(loginWithPin).toHaveBeenCalledTimes(allowance);
  });

  it("counts each address separately", async () => {
    const allowance = RATE_LIMITS.pinAttempt.limit;
    for (let i = 0; i < allowance; i += 1) await post("203.0.113.7");
    expect((await post("198.51.100.9")).status).toBe(401);
  });
});
