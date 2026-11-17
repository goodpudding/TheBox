import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyPassword } from "@/lib/auth/password";

type PasswordRow = {
  userId: string;
  hash: string;
  failedCount: number;
  windowStartedAt: Date | null;
  setAt: Date;
};

const db = vi.hoisted(() => ({
  passwords: new Map<string, PasswordRow>(),
  sessions: [] as { userId: string; sessionToken: string }[],
}));
const auth = vi.hoisted(() => vi.fn());
const findUser = vi.hoisted(() => vi.fn());

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: async () => {} };
});
vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: (args: unknown) => findUser(args) },
    userPassword: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        db.passwords.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: {
        where: { userId: string };
        create: PasswordRow;
        update: Partial<PasswordRow>;
      }) => {
        const row = db.passwords.get(where.userId);
        if (row) Object.assign(row, update);
        else db.passwords.set(where.userId, { ...create });
      },
      deleteMany: async ({ where }: { where: { userId: string } }) => ({
        count: db.passwords.delete(where.userId) ? 1 : 0,
      }),
    },
    session: {
      deleteMany: async ({ where }: { where: { userId: string; sessionToken: { notIn: string[] } } }) => {
        const before = db.sessions.length;
        db.sessions = db.sessions.filter(
          (s) => s.userId !== where.userId || where.sessionToken.notIn.includes(s.sessionToken),
        );
        return { count: before - db.sessions.length };
      },
    },
  },
}));

const MAYA = { id: "u-maya", email: "maya@example.com" };
const GOOD = "plywood-otter-42";

function request(method: "POST" | "DELETE", body?: unknown, cookie = "authjs.session-token=here") {
  return new NextRequest("http://localhost/api/account/password", {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function route() {
  return import("./route");
}

describe("/api/account/password", () => {
  beforeEach(() => {
    db.passwords.clear();
    db.sessions = [
      { userId: MAYA.id, sessionToken: "here" },
      { userId: MAYA.id, sessionToken: "shop-pc" },
      { userId: "u-sam", sessionToken: "sam" },
    ];
    auth.mockReset();
    auth.mockResolvedValue({ user: { id: MAYA.id } });
    findUser.mockReset();
    findUser.mockResolvedValue(MAYA);
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("needs a real session for every method", async () => {
    auth.mockResolvedValue(null);
    const { GET, POST, DELETE } = await route();
    // The dev toolbar's header stands in for a member elsewhere. Not here.
    const spoofed = new NextRequest("http://localhost/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json", "x-box-user-id": MAYA.id },
      body: JSON.stringify({ password: GOOD }),
    });
    expect((await GET()).status).toBe(401);
    expect((await POST(spoofed)).status).toBe(401);
    expect((await DELETE(request("DELETE"))).status).toBe(401);
    expect(db.passwords.size).toBe(0);
    expect(db.sessions).toHaveLength(3);
  });

  it("turns away a session whose member has been removed", async () => {
    findUser.mockResolvedValue(null);
    const { POST } = await route();
    expect((await POST(request("POST", { password: GOOD }))).status).toBe(401);
    expect(db.passwords.size).toBe(0);
  });

  it("says whether a password is set, and never sends the hash", async () => {
    const { GET, POST } = await route();
    expect(await (await GET()).json()).toEqual({ passwordSet: false, setAt: null });
    await POST(request("POST", { password: GOOD }));
    const res = await GET();
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ passwordSet: true });
    expect(text).not.toContain("scrypt");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("saves a hash of the password and signs the member out everywhere else", async () => {
    const { POST } = await route();
    const res = await POST(request("POST", { password: GOOD }));
    expect(res.status).toBe(200);
    const row = db.passwords.get(MAYA.id);
    expect(row?.hash).not.toContain(GOOD);
    expect(await verifyPassword(GOOD, row?.hash)).toBe(true);
    // This browser stays signed in; the shop PC does not; Sam is not touched.
    expect(db.sessions.map((s) => s.sessionToken)).toEqual(["here", "sam"]);
  });

  it("keeps this browser signed in under the https cookie name too", async () => {
    const { POST } = await route();
    await POST(request("POST", { password: GOOD }, "__Secure-authjs.session-token=here"));
    expect(db.sessions.map((s) => s.sessionToken)).toEqual(["here", "sam"]);
  });

  it("refuses a password that breaks the rules, with the reason", async () => {
    const { POST } = await route();
    const bad: [unknown, RegExp][] = [
      [{ password: "short" }, /at least 10/],
      [{ password: "1234567890" }, /too easy/],
      [{ password: "maya-in-the-shop" }, /does not contain your email/],
      [{ password: 1234567890123 }, /Enter a password/],
      [{}, /Enter a password/],
      ["not json at all", /Enter a password/],
    ];
    for (const [body, reason] of bad) {
      const res = await POST(request("POST", body));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(((await res.json()) as { error: string }).error).toMatch(reason);
    }
    expect(db.passwords.size).toBe(0);
    expect(db.sessions).toHaveLength(3);
  });

  it("replaces the old password and clears a lock when a new one is chosen", async () => {
    const { POST } = await route();
    await POST(request("POST", { password: GOOD }));
    const row = db.passwords.get(MAYA.id)!;
    row.failedCount = 5;
    row.windowStartedAt = new Date();
    await POST(request("POST", { password: "a-second-passphrase" }));
    expect(await verifyPassword(GOOD, row.hash)).toBe(false);
    expect(await verifyPassword("a-second-passphrase", row.hash)).toBe(true);
    expect(row.failedCount).toBe(0);
  });

  it("removes the password and signs out everywhere else", async () => {
    const { POST, DELETE } = await route();
    await POST(request("POST", { password: GOOD }));
    db.sessions.push({ userId: MAYA.id, sessionToken: "phone" });
    const res = await DELETE(request("DELETE"));
    expect(await res.json()).toEqual({ ok: true, passwordSet: false });
    expect(db.passwords.has(MAYA.id)).toBe(false);
    expect(db.sessions.map((s) => s.sessionToken)).toEqual(["here", "sam"]);
  });

  it("answers with a plain message, not the database error, when saving fails", async () => {
    findUser.mockRejectedValue(new Error("D1_ERROR: no such table: UserPassword"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await route();
    const res = await POST(request("POST", { password: GOOD }));
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("D1_ERROR");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
