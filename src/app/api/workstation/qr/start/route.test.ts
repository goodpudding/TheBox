import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rate-limit";

const startQrChallenge = vi.fn();
const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@/lib/workstation/server", () => ({
  startQrChallenge: (id: string) => startQrChallenge(id),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});

async function post(ip: string) {
  const { POST } = await import("./route");
  return POST(
    new NextRequest("http://localhost/api/workstation/qr/start", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify({ workstationId: "BOX-PC-1" }),
    }),
  );
}

describe("/api/workstation/qr/start", () => {
  beforeEach(() => {
    startQrChallenge.mockReset();
    startQrChallenge.mockImplementation(async () => ({
      challenge: {
        id: "wqc_1",
        userCode: "123456",
        expiresAt: new Date("2026-01-01T00:05:00.000Z"),
      },
      workstation: { name: "Desk 1" },
    }));
    cloudflareEnv.mockReset();
    cloudflareEnv.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });
    resetRateLimitStore();
  });

  it("starts a QR sign-in", async () => {
    const res = await post("203.0.113.7");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ challengeId: "wqc_1", userCode: "123456" });
  });

  it("refuses the 11th start from one address in a minute without writing a row", async () => {
    for (let i = 0; i < 10; i += 1) {
      expect((await post("203.0.113.7")).status, `call ${i + 1}`).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post("203.0.113.7");
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({
      error: "Too many requests. Wait a minute and try again.",
    });
    expect(startQrChallenge).toHaveBeenCalledTimes(10);
    expect((await post("203.0.113.8")).status).toBe(200);
  });

  it("keeps the desks working when the limiter itself fails", async () => {
    const limit = vi.fn(async () => {
      throw new Error("rate limiter unavailable");
    });
    cloudflareEnv.mockReturnValue({ RL_QR_START: { limit } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 12; i += 1) {
      expect((await post("203.0.113.7")).status, `call ${i + 1}`).toBe(200);
    }
    spy.mockRestore();
    expect(startQrChallenge).toHaveBeenCalledTimes(12);
  });
});
