import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { DataProvider } from "@/lib/data/provider";
import type { User } from "@/lib/data/types";
import {
  ACTOR_ARG_INDEX,
  PUBLIC_WRITE_METHODS,
  RPC_RULES,
} from "@/lib/data/rpc-policy";
import { resetRateLimitStore } from "@/lib/rate-limit";

const auth = vi.fn();
const createServerDataProvider = vi.fn();
const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

vi.mock("@/auth", () => ({
  auth: () => auth(),
}));

vi.mock("@/lib/data/factory", () => ({
  createServerDataProvider: (...args: unknown[]) =>
    createServerDataProvider(...args),
  lastProviderLoad: () => "mock",
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});

function user(id: string, role: User["role"]): User {
  return {
    id,
    email: `${id}@example.com`,
    firstName: "A",
    lastName: "B",
    displayName: "A B",
    role,
    status: "active",
    tier: "maker",
    shopAccess: true,
    isTeacher: false,
    profileComplete: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function provider(sessionUser: User | null, extra: Partial<DataProvider> = {}) {
  return {
    getCurrentUser: async () => sessionUser,
    ...extra,
  } as DataProvider;
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("./route");
  return POST(
    new Request("http://localhost/api/data", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

const BOUNTY = {
  method: "submitBountyRequest",
  args: [{ title: "Sign", description: "A sign", requesterName: "R", requesterEmail: "r@example.com" }],
};

describe("/api/data", () => {
  beforeEach(() => {
    auth.mockReset();
    createServerDataProvider.mockReset();
    vi.unstubAllEnvs();
    // Plain Node has no Cloudflare bindings, so the in-memory limiter runs.
    cloudflareEnv.mockReset();
    cloudflareEnv.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });
    resetRateLimitStore();
  });

  it("lists an actor decision for every DataProvider method", () => {
    const src = readFileSync(
      path.join(process.cwd(), "src/lib/data/provider.ts"),
      "utf8",
    );
    const start = src.indexOf("export interface DataProvider");
    const end = src.indexOf("\n}", start);
    const names = [...src.slice(start, end).matchAll(/^\s{2}([A-Za-z]\w*)\(/gm)].map(
      (match) => match[1],
    );
    expect(names.length).toBeGreaterThan(50);
    for (const name of names) {
      expect(ACTOR_ARG_INDEX, name).toHaveProperty(name);
    }
  });

  it("rejects an unknown method", async () => {
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null));
    const res = await post({ method: "dropDatabase", args: [] });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false });
  });

  it("rejects admin methods for a member", async () => {
    const member = user("member-1", "member");
    const adminUpdateMemberStatus = vi.fn();
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(
      provider(member, { adminUpdateMemberStatus }),
    );
    const res = await post({
      method: "adminUpdateMemberStatus",
      args: ["other", "active", "member-1"],
    });
    expect(res.status).toBe(403);
    expect(adminUpdateMemberStatus).not.toHaveBeenCalled();
  });

  it("rejects the display feed for a member", async () => {
    const member = user("member-1", "member");
    const getDisplayFeed = vi.fn();
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(provider(member, { getDisplayFeed }));
    const res = await post({ method: "getDisplayFeed", args: [] });
    expect(res.status).toBe(403);
    expect(getDisplayFeed).not.toHaveBeenCalled();
  });

  it("rejects machine status for an anonymous caller", async () => {
    const getMachineStatus = vi.fn();
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null, { getMachineStatus }));
    const res = await post({ method: "getMachineStatus", args: [] });
    expect(res.status).toBe(401);
    expect(getMachineStatus).not.toHaveBeenCalled();
  });

  it("rejects the question bank for a member", async () => {
    const member = user("member-1", "member");
    const getQuestionBank = vi.fn();
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(provider(member, { getQuestionBank }));
    const res = await post({ method: "getQuestionBank", args: ["module-1"] });
    expect(res.status).toBe(403);
    expect(getQuestionBank).not.toHaveBeenCalled();
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "rejects inherited property %s as an unknown method",
    async (method) => {
      auth.mockResolvedValue(null);
      createServerDataProvider.mockResolvedValue(provider(null));
      const res = await post({ method, args: [] });
      expect(res.status).toBe(400);
    },
  );

  it("leaveInterestBoard ignores a spoofed email from a member", async () => {
    const member = user("member-1", "member");
    const leaveInterestBoard = vi.fn(async () => {});
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(
      provider(member, { leaveInterestBoard }),
    );
    const res = await post({
      method: "leaveInterestBoard",
      args: ["board-1", { userId: "victim", email: "victim@example.com" }],
    });
    expect(res.status).toBe(200);
    expect(leaveInterestBoard).toHaveBeenCalledWith("board-1", {
      userId: "member-1",
      email: "member-1@example.com",
    });
  });

  it("leaveInterestBoard requires sign-in", async () => {
    const leaveInterestBoard = vi.fn(async () => {});
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(
      provider(null, { leaveInterestBoard }),
    );
    const res = await post({
      method: "leaveInterestBoard",
      args: ["board-1", { email: "victim@example.com" }],
    });
    expect(res.status).toBe(401);
    expect(leaveInterestBoard).not.toHaveBeenCalled();
  });

  it("rejects the dev toolbar switch in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    const setCurrentUserId = vi.fn();
    auth.mockResolvedValue({ user: { id: "member-1" } });
    createServerDataProvider.mockResolvedValue(
      provider(user("member-1", "member"), { setCurrentUserId }),
    );
    const res = await post({ method: "setCurrentUserId", args: ["u-admin"] });
    expect(res.status).toBe(403);
    expect(setCurrentUserId).not.toHaveBeenCalled();
  });

  it("overwrites a member actor id and keeps a staff actor id", async () => {
    const getUsage = vi.fn(async (id: string) => id);
    const member = user("member-1", "member");
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(provider(member, { getUsage }));
    const memberRes = await post({ method: "getUsage", args: ["other-user"] });
    expect(memberRes.status).toBe(200);
    expect(getUsage).toHaveBeenCalledWith("member-1");

    getUsage.mockClear();
    const staff = user("staff-1", "staff");
    auth.mockResolvedValue({ user: { id: staff.id } });
    createServerDataProvider.mockResolvedValue(provider(staff, { getUsage }));
    const staffRes = await post({ method: "getUsage", args: ["other-user"] });
    expect(staffRes.status).toBe(200);
    expect(getUsage).toHaveBeenCalledWith("other-user");
  });

  it("does not let an anonymous caller attribute a public submission to a member", async () => {
    const joinInterestBoard = vi.fn(async () => ({}));
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(
      provider(null, { joinInterestBoard }),
    );
    const res = await post({
      method: "joinInterestBoard",
      args: [{ boardId: "board-1", userId: "victim-user", email: "x@example.com" }],
    });
    expect(res.status).toBe(200);
    expect(joinInterestBoard).toHaveBeenCalledTimes(1);
    const sent = joinInterestBoard.mock.calls[0][0] as { userId?: string | null };
    expect(sent.userId).toBeNull();
  });

  it("returns domain errors as ok:false", async () => {
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(
      provider(null, {
        getSettings: async () => {
          throw new Error("rates missing");
        },
      }),
    );
    const res = await post({ method: "getSettings", args: [] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "rates missing" });
  });

  it("signs a member up to an interest board under their own email only", async () => {
    const member = user("member-1", "member");
    const joinInterestBoard = vi.fn(async () => ({}));
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(
      provider(member, { joinInterestBoard }),
    );
    const res = await post({
      method: "joinInterestBoard",
      args: [{ boardId: "board-1", email: "victim@example.com", displayName: "V" }],
    });
    expect(res.status).toBe(200);
    expect(joinInterestBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "member-1",
        email: "member-1@example.com",
      }),
    );
  });

  it("records the waiver IP and browser from the request, not the body", async () => {
    const member = user("member-1", "member");
    const signWaiver = vi.fn(async () => ({}));
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(provider(member, { signWaiver }));
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/data", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.7",
          "user-agent": "RealBrowser/1.0",
        },
        body: JSON.stringify({
          method: "signWaiver",
          args: [
            {
              userId: "someone-else",
              fullNameTyped: "A B",
              agreed: true,
              ip: "8.8.8.8",
              userAgent: "Forged",
            },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(signWaiver).toHaveBeenCalledWith({
      userId: "member-1",
      fullNameTyped: "A B",
      agreed: true,
      ip: "203.0.113.7",
      userAgent: "RealBrowser/1.0",
    });
  });

  it("does not send internal staff notes to the member they are about", async () => {
    const member = { ...user("member-1", "member"), _notes: "watch this one" };
    auth.mockResolvedValue({ user: { id: member.id } });
    createServerDataProvider.mockResolvedValue(
      provider(member, { getMember: async () => member }),
    );
    const me = await post({ method: "getCurrentUser", args: [] });
    expect(JSON.stringify(await me.json())).not.toContain("watch this one");
    const row = await post({ method: "getMember", args: ["member-1"] });
    expect(JSON.stringify(await row.json())).not.toContain("watch this one");
  });

  it("still sends staff notes to staff", async () => {
    const staff = user("staff-1", "staff");
    const member = { ...user("member-1", "member"), _notes: "watch this one" };
    auth.mockResolvedValue({ user: { id: staff.id } });
    createServerDataProvider.mockResolvedValue(
      provider(staff, { getMember: async () => member }),
    );
    const row = await post({ method: "getMember", args: ["member-1"] });
    expect(JSON.stringify(await row.json())).toContain("watch this one");
  });

  it("refuses an oversized request body before loading any data", async () => {
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null));
    const res = await post({
      method: "submitVolunteerInterest",
      args: [{ name: "a", email: "a@example.com", message: "x".repeat(1_100_000) }],
    });
    expect(res.status).toBe(413);
    expect(createServerDataProvider).not.toHaveBeenCalled();
  });

  it("answers malformed JSON with 400", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new Request("http://localhost/api/data", { method: "POST", body: "{nope" }),
    );
    expect(res.status).toBe(400);
  });

  it("does not echo internal error text when the request itself fails", async () => {
    auth.mockResolvedValue({ user: { id: "member-1" } });
    createServerDataProvider.mockRejectedValue(
      new Error("PrismaClientKnownRequestError: D1_ERROR no such column users.secret"),
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post({ method: "getSettings", args: [] });
    spy.mockRestore();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).not.toMatch(/Prisma|D1_ERROR|column/);
  });

  it("names every public method that writes as rate limited", () => {
    const publicWrites = (Object.keys(RPC_RULES) as (keyof typeof RPC_RULES)[])
      .filter((name) => RPC_RULES[name].access === "public")
      .filter((name) => !/^(get|list)[A-Z]/.test(name));
    expect([...PUBLIC_WRITE_METHODS].sort()).toEqual(publicWrites.sort());
    expect(publicWrites.length).toBeGreaterThan(0);
  });

  it("refuses the 6th anonymous public write in a minute before loading any data", async () => {
    const submitBountyRequest = vi.fn(async () => ({}));
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null, { submitBountyRequest }));
    const from = { "cf-connecting-ip": "203.0.113.7" };
    for (let i = 0; i < 5; i += 1) {
      const res = await post(BOUNTY, from);
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(BOUNTY, from);
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: false,
      error: "Too many requests. Wait a minute and try again.",
    });
    expect(createServerDataProvider).toHaveBeenCalledTimes(5);
    expect(submitBountyRequest).toHaveBeenCalledTimes(5);
  });

  it("counts the public forms together but each address on its own", async () => {
    const submitBountyRequest = vi.fn(async () => ({}));
    const submitVolunteerInterest = vi.fn(async () => ({}));
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(
      provider(null, { submitBountyRequest, submitVolunteerInterest }),
    );
    const from = { "cf-connecting-ip": "203.0.113.7" };
    for (let i = 0; i < 5; i += 1) await post(BOUNTY, from);
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sameAddress = await post({ method: "submitVolunteerInterest", args: [{}] }, from);
    spy.mockRestore();
    expect(sameAddress.status).toBe(429);
    expect(submitVolunteerInterest).not.toHaveBeenCalled();
    const neighbour = await post(BOUNTY, { "cf-connecting-ip": "203.0.113.8" });
    expect(neighbour.status).toBe(200);
  });

  it("does not limit public reads", async () => {
    const listBounties = vi.fn(async () => []);
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null, { listBounties }));
    for (let i = 0; i < 12; i += 1) {
      const res = await post({ method: "listBounties", args: [] }, { "cf-connecting-ip": "203.0.113.7" });
      expect(res.status).toBe(200);
    }
    expect(listBounties).toHaveBeenCalledTimes(12);
  });

  it("gives a signed-in member more room, counted per account", async () => {
    const member = user("member-1", "member");
    const submitBountyRequest = vi.fn(async () => ({}));
    auth.mockResolvedValue({ user: { id: member.id, role: "member" } });
    createServerDataProvider.mockResolvedValue(provider(member, { submitBountyRequest }));
    for (let i = 0; i < 20; i += 1) {
      // A new address every time: a member cannot dodge the count by moving.
      const res = await post(BOUNTY, { "cf-connecting-ip": `203.0.113.${i}` });
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(BOUNTY, { "cf-connecting-ip": "203.0.113.99" });
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(submitBountyRequest).toHaveBeenCalledTimes(20);
  });

  it("does not limit staff", async () => {
    const staff = user("staff-1", "staff");
    const submitBountyRequest = vi.fn(async () => ({}));
    auth.mockResolvedValue({ user: { id: staff.id, role: "staff" } });
    createServerDataProvider.mockResolvedValue(provider(staff, { submitBountyRequest }));
    for (let i = 0; i < 30; i += 1) {
      const res = await post(BOUNTY, { "cf-connecting-ip": "203.0.113.7" });
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    expect(submitBountyRequest).toHaveBeenCalledTimes(30);
  });

  it("refuses when the Cloudflare limiter says no", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    cloudflareEnv.mockReturnValue({ RL_PUBLIC_WRITE_ANON: { limit } });
    const submitBountyRequest = vi.fn(async () => ({}));
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null, { submitBountyRequest }));
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(BOUNTY, { "cf-connecting-ip": "203.0.113.7" });
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledTimes(1);
    const sent = (limit.mock.calls as unknown as [{ key: string }][])[0][0];
    expect(sent.key).not.toContain("203.0.113.7");
    expect(createServerDataProvider).not.toHaveBeenCalled();
  });

  it("keeps the forms working when the limiter itself fails", async () => {
    const limit = vi.fn(async () => {
      throw new Error("rate limiter unavailable");
    });
    cloudflareEnv.mockReturnValue({ RL_PUBLIC_WRITE_ANON: { limit } });
    const submitBountyRequest = vi.fn(async () => ({}));
    auth.mockResolvedValue(null);
    createServerDataProvider.mockResolvedValue(provider(null, { submitBountyRequest }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 8; i += 1) {
      const res = await post(BOUNTY, { "cf-connecting-ip": "203.0.113.7" });
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    spy.mockRestore();
    expect(limit).toHaveBeenCalledTimes(8);
    expect(submitBountyRequest).toHaveBeenCalledTimes(8);
  });
});
