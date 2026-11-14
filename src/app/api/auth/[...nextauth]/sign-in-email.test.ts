import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rate-limit";

/**
 * The sign-in email limits with the real Auth.js behind the route, so these
 * follow what Auth.js does with a request (which address it mails, when it
 * turns a request away) instead of a copy of its rules. Only the database
 * and the mail service are stand-ins.
 */

type TokenRow = { identifier: string; token: string; expires: Date };

const db = vi.hoisted(() => ({ tokens: new Map<string, TokenRow>() }));
const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "user-1", ...data }),
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: args.where.id,
        ...args.data,
      }),
    },
    verificationToken: {
      create: async ({ data }: { data: TokenRow }) => {
        db.tokens.set(data.token, data);
        return { ...data };
      },
      delete: async (args: { where: { identifier_token: { token: string } } }) => {
        const row = db.tokens.get(args.where.identifier_token.token);
        if (!row) throw Object.assign(new Error("not found"), { code: "P2025" });
        db.tokens.delete(row.token);
        return { ...row };
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data }),
    },
  },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

/** Every mail handed to the mail service: who it is for and the link in it. */
let mails: { to: string; link: string }[] = [];

async function route() {
  return import("./route");
}

/** A CSRF token and its cookie, the way the login page gets them. */
async function csrfPair() {
  const { GET } = await route();
  const res = await GET(new NextRequest("http://localhost/api/auth/csrf"));
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  const cookie = res.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
  return { csrfToken, cookie };
}

type Csrf = { csrfToken: string; cookie: string };

async function askForLink(email: string, ip: string, csrf: Csrf | null, body?: string) {
  const { POST } = await route();
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    "x-auth-return-redirect": "1",
    "cf-connecting-ip": ip,
  };
  if (csrf) headers.cookie = csrf.cookie;
  const fields = new URLSearchParams({ email, callbackUrl: "/" });
  if (csrf) fields.set("csrfToken", csrf.csrfToken);
  const res = await POST(
    new NextRequest("http://localhost/api/auth/signin/email", {
      method: "POST",
      headers,
      body: body ?? fields.toString(),
    }),
  );
  const payload = (await res.json()) as { url?: string; error?: string };
  const errorCode = payload.url ? new URL(payload.url).searchParams.get("error") : null;
  return { status: res.status, errorCode, retryAfter: res.headers.get("retry-after") };
}

describe("sign-in email limit with the real Auth.js", () => {
  beforeAll(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret-for-sign-in-email");
    vi.stubEnv("AUTH_RESEND_KEY", "re_test");
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mails = [];
    db.tokens.clear();
    resetRateLimitStore();
    cloudflareEnv.mockReset();
    cloudflareEnv.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });
    vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.resend.com/emails");
      const mail = JSON.parse(String(init?.body)) as { to: string; text: string };
      mails.push({ to: mail.to, link: mail.text.match(/https?:\/\/\S+/)?.[0] ?? "" });
      return Response.json({ id: "mail-1" });
    });
    // Auth.js logs every request it turns away; the limiter logs each refusal.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("sends one link to a plain address", async () => {
    const csrf = await csrfPair();
    const res = await askForLink("pat@example.com", "203.0.113.7", csrf);
    expect(res).toMatchObject({ status: 200, errorCode: null });
    expect(mails.map((mail) => mail.to)).toEqual(["pat@example.com"]);
  });

  it("refuses the 4th link to one mailbox even when each request comes from somewhere new", async () => {
    const csrf = await csrfPair();
    const variants = ["pat@example.com", "Pat@Example.com", " pat+news@example.com"];
    for (const [i, email] of variants.entries()) {
      const res = await askForLink(email, `198.51.100.${i}`, csrf);
      expect(res, email).toMatchObject({ status: 200, errorCode: null });
    }
    const res = await askForLink("pat@example.com", "198.51.100.200", csrf);
    expect(res).toMatchObject({ status: 429, errorCode: "RateLimit", retryAfter: "60" });
    expect(mails).toHaveLength(3);

    const other = await askForLink("sam@example.com", "198.51.100.200", csrf);
    expect(other).toMatchObject({ status: 200, errorCode: null });
  });

  it("limits the mailbox the same way behind the site's own https address", async () => {
    // Production sets AUTH_URL, so Auth.js redirects to that origin and uses
    // its secure cookie names.
    vi.stubEnv("AUTH_URL", "https://portal.example");
    try {
      const csrf = await csrfPair();
      expect(csrf.cookie).toContain("__Host-authjs.csrf-token=");
      for (let i = 0; i < 3; i += 1) {
        const res = await askForLink("pat@example.com", `198.51.100.${i}`, csrf);
        expect(res, `call ${i + 1}`).toMatchObject({ status: 200, errorCode: null });
      }
      const res = await askForLink("pat@example.com", "198.51.100.200", csrf);
      expect(res).toMatchObject({ status: 429, errorCode: "RateLimit" });
      expect(mails).toHaveLength(3);
    } finally {
      vi.stubEnv("AUTH_URL", "");
    }
  });

  it("never mails an address written with a name, a comment or a list around it", async () => {
    // Each of these would reach pat's inbox through a mail service while
    // looking like a different mailbox to the limiter.
    const csrf = await csrfPair();
    const dressedUp = [
      "a1 <pat@example.com>",
      "a2 <pat@example.com>",
      "a3 <pat@example.com>",
      "a4 <pat@example.com>",
      "<pat@example.com>",
      "x1,pat@example.com",
      "x2;pat@example.com",
      "(c1)pat@example.com",
      "pat(c2)@example.com",
      "pat@example.com,x",
      "pat@example.com ,x",
      "pat@example.com (c3)",
      "pat @example.com",
      "pat@example.com.",
      "pat@[203.0.113.9]",
    ];
    for (const [i, email] of dressedUp.entries()) {
      const res = await askForLink(email, `198.51.100.${i}`, csrf);
      expect(res.errorCode, email).not.toBeNull();
    }
    expect(mails).toEqual([]);

    // Nothing was sent, so none of them used up the mailbox's count.
    for (let i = 0; i < 3; i += 1) {
      const res = await askForLink("pat@example.com", `203.0.113.${i}`, csrf);
      expect(res, `plain ${i + 1}`).toMatchObject({ status: 200, errorCode: null });
    }
    const res = await askForLink("pat@example.com", "203.0.113.200", csrf);
    expect(res.status).toBe(429);
    expect(mails.map((mail) => mail.to)).toEqual(Array(3).fill("pat@example.com"));
  });

  it("counts the mailbox Auth.js writes to when the form names two", async () => {
    const csrf = await csrfPair();
    const twice = (i: number) =>
      `email=decoy${i}%40example.com&csrfToken=${csrf.csrfToken}&email=pat%40example.com`;
    for (let i = 0; i < 3; i += 1) {
      const res = await askForLink("", `198.51.100.${i}`, csrf, twice(i));
      expect(res, `call ${i + 1}`).toMatchObject({ status: 200, errorCode: null });
    }
    const res = await askForLink("", "198.51.100.200", csrf, twice(200));
    expect(res.status).toBe(429);
    expect(mails.map((mail) => mail.to)).toEqual(Array(3).fill("pat@example.com"));
  });

  it("counts the mailbox in a JSON body too", async () => {
    const csrf = await csrfPair();
    const { POST } = await route();
    const json = (ip: string) =>
      POST(
        new NextRequest("http://localhost/api/auth/signin/email", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "cf-connecting-ip": ip,
            cookie: csrf.cookie,
          },
          body: JSON.stringify({ email: "pat@example.com", csrfToken: csrf.csrfToken }),
        }),
      );
    for (let i = 0; i < 3; i += 1) {
      // Without the header next-auth's client sends, Auth.js answers with a redirect.
      const res = await json(`198.51.100.${i}`);
      expect(res.status, `call ${i + 1}`).toBe(302);
    }
    expect((await json("198.51.100.200")).status).toBe(429);
    expect(mails).toHaveLength(3);
  });

  it("does not count a request Auth.js turns away for its CSRF token", async () => {
    // Otherwise three tiny requests a minute would keep someone from getting
    // a link without a single email telling them so.
    for (let i = 0; i < 5; i += 1) {
      const res = await askForLink("vic@example.com", `203.0.113.${i}`, null);
      expect(res, `call ${i + 1}`).toMatchObject({ status: 200, errorCode: "MissingCSRF" });
    }
    const csrf = await csrfPair();
    const forged = await askForLink("vic@example.com", "203.0.113.9", {
      cookie: csrf.cookie,
      csrfToken: "not-the-token",
    });
    expect(forged.errorCode).toBe("MissingCSRF");
    expect(mails).toEqual([]);

    const owner = await askForLink("vic@example.com", "198.51.100.77", csrf);
    expect(owner).toMatchObject({ status: 200, errorCode: null });
    expect(mails.map((mail) => mail.to)).toEqual(["vic@example.com"]);
  });

  it("lets a link that was sent sign in while the mailbox is at its limit", async () => {
    const csrf = await csrfPair();
    for (let i = 0; i < 3; i += 1) {
      await askForLink("pat@example.com", `198.51.100.${i}`, csrf);
    }
    expect((await askForLink("pat@example.com", "198.51.100.200", csrf)).status).toBe(429);

    const { GET } = await route();
    const res = await GET(new NextRequest(mails[0].link, { headers: { cookie: csrf.cookie } }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://localhost/");
    expect(res.headers.getSetCookie().join("\n")).toContain("authjs.session-token=");
  });

  it("keeps sending links when the limiter itself fails", async () => {
    const limit = vi.fn(async () => {
      throw new Error("rate limiter unavailable");
    });
    cloudflareEnv.mockReturnValue({ RL_SIGNIN_IP: { limit }, RL_SIGNIN_ADDRESS: { limit } });
    const csrf = await csrfPair();
    for (let i = 0; i < 8; i += 1) {
      const res = await askForLink("pat@example.com", "203.0.113.7", csrf);
      expect(res, `call ${i + 1}`).toMatchObject({ status: 200, errorCode: null });
    }
    expect(mails).toHaveLength(8);
    expect(limit).toHaveBeenCalledTimes(16);
  });
});
