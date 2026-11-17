import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { resetRateLimitStore } from "@/lib/rate-limit";

/**
 * Password sign-in with the real Auth.js behind the route: the request the
 * login page sends, the cookie that comes back, and whether Auth.js then
 * treats that cookie as a signed-in member. Only the database is a stand-in.
 */

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  deletedAt: Date | null;
};
type PasswordRow = { userId: string; hash: string; failedCount: number; windowStartedAt: Date | null };
type SessionRow = { sessionToken: string; userId: string; expires: Date };

const db = vi.hoisted(() => ({
  users: [] as UserRow[],
  passwords: new Map<string, PasswordRow>(),
  sessions: new Map<string, SessionRow>(),
}));
const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: async ({ where }: { where: { email: string } }) => {
        const user = db.users.find((u) => u.email === where.email && !u.deletedAt);
        if (!user) return null;
        const password = db.passwords.get(user.id);
        return { ...user, password: password ? { hash: password.hash } : null };
      },
      findUnique: async ({ where }: { where: { id?: string; email?: string } }) =>
        db.users.find((u) => u.id === where.id || u.email === where.email) ?? null,
    },
    userPassword: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string; failedCount?: { lt?: number; gt?: number }; OR?: unknown };
        data: { failedCount?: number | { increment?: number; decrement?: number } };
      }) => {
        const row = db.passwords.get(where.userId);
        if (!row) return { count: 0 };
        if (where.OR) {
          // The window is new in every test here.
          if (row.windowStartedAt) return { count: 0 };
          row.windowStartedAt = new Date();
          return { count: 1 };
        }
        const { lt, gt } = where.failedCount ?? {};
        if (lt !== undefined && !(row.failedCount < lt)) return { count: 0 };
        if (gt !== undefined && !(row.failedCount > gt)) return { count: 0 };
        const step = data.failedCount;
        if (step && typeof step === "object") {
          row.failedCount += (step.increment ?? 0) - (step.decrement ?? 0);
        }
        return { count: 1 };
      },
    },
    session: {
      create: async ({ data }: { data: SessionRow }) => {
        db.sessions.set(data.sessionToken, { ...data });
        return { ...data };
      },
      // What the adapter asks for when Auth.js looks a session cookie up.
      findUnique: async ({ where }: { where: { sessionToken: string } }) => {
        const session = db.sessions.get(where.sessionToken);
        const user = session && db.users.find((u) => u.id === session.userId);
        return session && user ? { ...session, user } : null;
      },
      update: async ({ where, data }: { where: { sessionToken: string }; data: Partial<SessionRow> }) => {
        const session = db.sessions.get(where.sessionToken);
        if (session) Object.assign(session, data);
        return session;
      },
      delete: async ({ where }: { where: { sessionToken: string } }) => {
        const session = db.sessions.get(where.sessionToken);
        db.sessions.delete(where.sessionToken);
        return session;
      },
    },
  },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

const MAYA: UserRow = {
  id: "u-maya",
  email: "maya@example.com",
  displayName: "Maya Chen",
  role: "member",
  status: "active",
  deletedAt: null,
};
const PASSWORD = "plywood-otter-42";

async function route() {
  return import("./route");
}

function cookiePairs(res: Response): Map<string, string> {
  const pairs = new Map<string, string>();
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const at = pair.indexOf("=");
    pairs.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return pairs;
}

function cookieHeader(pairs: Map<string, string>): string {
  return [...pairs].map(([name, value]) => `${name}=${value}`).join("; ");
}

/** A CSRF token and its cookie, the way the login page gets them. */
async function csrfPair(origin: string) {
  const { GET } = await route();
  const res = await GET(new NextRequest(`${origin}/api/auth/csrf`));
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  return { csrfToken, cookies: cookiePairs(res) };
}

/** What next-auth's signIn("password", { redirect: false }) posts. */
async function signIn(
  input: { email: string; password: string; ip?: string; csrf?: boolean },
  origin = "http://localhost",
) {
  const csrf = await csrfPair(origin);
  const fields = new URLSearchParams({
    email: input.email,
    password: input.password,
    callbackUrl: "/account",
  });
  if (input.csrf !== false) fields.set("csrfToken", csrf.csrfToken);
  const { POST } = await route();
  const res = await POST(
    new NextRequest(`${origin}/api/auth/callback/password`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-auth-return-redirect": "1",
        "cf-connecting-ip": input.ip ?? "203.0.113.7",
        cookie: cookieHeader(csrf.cookies),
      },
      body: fields.toString(),
    }),
  );
  const payload = (await res.json()) as { url?: string };
  const url = payload.url ? new URL(payload.url) : null;
  return {
    status: res.status,
    errorCode: url?.searchParams.get("error") ?? null,
    path: url?.pathname ?? null,
    cookies: cookiePairs(res),
    setCookie: res.headers.getSetCookie(),
  };
}

/** Who Auth.js says is signed in, given these cookies. */
async function whoAmI(cookies: Map<string, string>, origin = "http://localhost") {
  const { GET } = await route();
  const res = await GET(
    new NextRequest(`${origin}/api/auth/session`, { headers: { cookie: cookieHeader(cookies) } }),
  );
  return (await res.json()) as { user?: { id: string; email: string; role: string } } | null;
}

describe("password sign-in with the real Auth.js", () => {
  let hash = "";
  let logged: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret-for-password-sign-in");
    vi.stubEnv("AUTH_RESEND_KEY", "re_test");
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    hash = await hashPassword(PASSWORD);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    db.users = [{ ...MAYA }];
    db.passwords.clear();
    db.passwords.set(MAYA.id, { userId: MAYA.id, hash, failedCount: 0, windowStartedAt: null });
    db.sessions.clear();
    resetRateLimitStore();
    cloudflareEnv.mockReset();
    cloudflareEnv.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });
    logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("signs the member in with a session row, the same as an emailed link leaves", async () => {
    const res = await signIn({ email: MAYA.email, password: PASSWORD });
    expect(res).toMatchObject({ status: 200, errorCode: null, path: "/account" });

    const token = res.cookies.get("authjs.session-token");
    expect(token).toBeTruthy();
    // The cookie holds the row's key and nothing about the member.
    expect([...db.sessions.keys()]).toEqual([token]);
    expect(db.sessions.get(token!)?.userId).toBe(MAYA.id);
    const days = (db.sessions.get(token!)!.expires.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(31);
    const cookie = res.setCookie.find((line) => line.startsWith("authjs.session-token=")) ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const session = await whoAmI(res.cookies);
    expect(session?.user).toMatchObject({ id: MAYA.id, email: MAYA.email, role: "member" });
    expect(JSON.stringify(session)).not.toContain("scrypt");
  });

  it("tells the browser who is signed in and nothing else from their row", async () => {
    Object.assign(db.users[0], {
      notes: "Staff only: owes for a broken bit",
      kioskPinHash: "scrypt:aabb:ccdd",
      phone: "206-555-0100",
      emergencyContactName: "Lee Chen",
    });
    const res = await signIn({ email: MAYA.email, password: PASSWORD });
    const token = res.cookies.get("authjs.session-token") ?? "";
    const session = (await whoAmI(res.cookies)) as Record<string, unknown> | null;
    expect(Object.keys(session ?? {}).sort()).toEqual(["expires", "user"]);
    expect(session?.user).toEqual({
      id: MAYA.id,
      name: "Maya Chen",
      email: MAYA.email,
      image: null,
      role: "member",
      status: "active",
    });
    const sent = JSON.stringify(session);
    // The cookie is HttpOnly so scripts cannot read the key. Not here either.
    expect(token.length).toBeGreaterThan(10);
    expect(sent).not.toContain(token);
    for (const secret of ["Staff only", "scrypt", "206-555-0100", "Lee Chen"]) {
      expect(sent, secret).not.toContain(secret);
    }
    expect(new Date(String(session?.expires)).getTime()).toBeGreaterThan(Date.now());
  });

  it("uses the secure cookie behind the site's own https address", async () => {
    vi.stubEnv("AUTH_URL", "https://portal.example");
    const res = await signIn({ email: MAYA.email, password: PASSWORD }, "https://portal.example");
    vi.stubEnv("AUTH_URL", "");
    expect(res).toMatchObject({ status: 200, errorCode: null });
    const token = res.cookies.get("__Secure-authjs.session-token");
    expect(db.sessions.has(token ?? "")).toBe(true);
    expect(res.setCookie.find((line) => line.startsWith("__Secure-authjs.session-token="))).toMatch(
      /Secure/,
    );
  });

  it("signing out ends that session", async () => {
    const signedIn = await signIn({ email: MAYA.email, password: PASSWORD });
    const csrf = await csrfPair("http://localhost");
    const { POST } = await route();
    await POST(
      new NextRequest("http://localhost/api/auth/signout", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-auth-return-redirect": "1",
          cookie: cookieHeader(new Map([...signedIn.cookies, ...csrf.cookies])),
        },
        body: new URLSearchParams({ csrfToken: csrf.csrfToken }).toString(),
      }),
    );
    expect(db.sessions.size).toBe(0);
    expect((await whoAmI(signedIn.cookies))?.user).toBeUndefined();
  });

  it("gives a wrong password, an unknown address and a member with no password one answer", async () => {
    db.users.push({ ...MAYA, id: "u-sam", email: "sam@example.com", displayName: "Sam" });
    const tries = [
      { email: MAYA.email, password: "not-the-password" },
      { email: "nobody@example.com", password: PASSWORD },
      { email: "sam@example.com", password: PASSWORD },
    ];
    const answers = [];
    for (const [i, attempt] of tries.entries()) {
      const res = await signIn({ ...attempt, ip: `198.51.100.${i}` });
      expect(res.cookies.has("authjs.session-token"), attempt.email).toBe(false);
      answers.push({ status: res.status, errorCode: res.errorCode, path: res.path });
    }
    expect(answers[0]).toEqual({ status: 200, errorCode: "CredentialsSignin", path: "/login" });
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(db.sessions.size).toBe(0);
    // A wrong password is not an error: no stack trace per guess in the log.
    expect(logged).not.toHaveBeenCalled();
  });

  it("stops after five wrong passwords, and the right one no longer works either", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await signIn({ email: MAYA.email, password: `wrong-guess-${i}`, ip: `198.51.100.${i}` });
      expect(res.errorCode).toBe("CredentialsSignin");
    }
    const res = await signIn({ email: MAYA.email, password: PASSWORD, ip: "198.51.100.99" });
    expect(res.errorCode).toBe("CredentialsSignin");
    expect(db.sessions.size).toBe(0);
  });

  it("refuses the 11th try from one address in a minute, before any password is checked", async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await signIn({ email: `person${i}@example.com`, password: PASSWORD });
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    const res = await signIn({ email: MAYA.email, password: PASSWORD });
    expect(res).toMatchObject({ status: 429, errorCode: "RateLimit", path: "/login" });
    expect(db.sessions.size).toBe(0);

    const elsewhere = await signIn({ email: MAYA.email, password: PASSWORD, ip: "203.0.113.8" });
    expect(elsewhere).toMatchObject({ status: 200, errorCode: null });
  });

  it("turns away a post without the login page's CSRF token", async () => {
    const res = await signIn({ email: MAYA.email, password: PASSWORD, csrf: false });
    expect(res.errorCode).toBe("MissingCSRF");
    expect(db.sessions.size).toBe(0);
  });
});
