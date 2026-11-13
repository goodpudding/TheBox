import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rate-limit";

const authGet = vi.fn();
const authPost = vi.fn();
const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@/auth", () => ({
  handlers: {
    GET: (request: NextRequest) => authGet(request),
    POST: (request: NextRequest) => authPost(request),
  },
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

function signInRequest(email: string, ip: string, path = "/api/auth/signin/email") {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-auth-return-redirect": "1",
      "cf-connecting-ip": ip,
    },
    body: new URLSearchParams({ email, csrfToken: "t", callbackUrl: "/" }).toString(),
  });
}

async function post(request: NextRequest) {
  const { POST } = await import("./route");
  return POST(request);
}

describe("/api/auth sign-in email limit", () => {
  beforeEach(() => {
    authGet.mockReset();
    authPost.mockReset();
    // Auth.js reads the body itself, so it must still be there.
    authPost.mockImplementation(async (request: NextRequest) =>
      Response.json({ url: "http://localhost/login/check-email", got: await request.text() }),
    );
    cloudflareEnv.mockReset();
    cloudflareEnv.mockImplementation(() => {
      throw new Error("no Cloudflare context");
    });
    resetRateLimitStore();
  });

  it("hands a sign-in under the limit to Auth.js with its body unread", async () => {
    const res = await post(signInRequest("pat@example.com", "203.0.113.7"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { got: string };
    expect(new URLSearchParams(body.got).get("email")).toBe("pat@example.com");
    expect(authPost).toHaveBeenCalledTimes(1);
  });

  it("refuses the 6th sign-in email from one address in a minute", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await post(signInRequest(`person${i}@example.com`, "203.0.113.7"));
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(signInRequest("person5@example.com", "203.0.113.7"));
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(authPost).toHaveBeenCalledTimes(5);
    const body = (await res.json()) as { error: string; url: string };
    expect(body.error).toBe("Too many requests. Wait a minute and try again.");
    // next-auth's signIn() parses `url` and hands its error code to the login page.
    expect(new URL(body.url).pathname).toBe("/login");
    expect(new URL(body.url).searchParams.get("error")).toBe("RateLimit");

    const elsewhere = await post(signInRequest("person5@example.com", "203.0.113.8"));
    expect(elsewhere.status).toBe(200);
  });

  it("refuses the 4th email to one mailbox even when each comes from somewhere new", async () => {
    const variants = ["pat@example.com", "Pat@Example.com", " pat+news@example.com"];
    for (const [i, email] of variants.entries()) {
      const res = await post(signInRequest(email, `198.51.100.${i}`));
      expect(res.status, email).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(signInRequest("pat@example.com", "198.51.100.200"));
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(authPost).toHaveBeenCalledTimes(3);
    const other = await post(signInRequest("sam@example.com", "198.51.100.200"));
    expect(other.status).toBe(200);
  });

  it("counts the mailbox Auth.js will write to when the form names two", async () => {
    // Auth.js keeps the last `email` field. Counting the first would let a
    // changing decoy in front hide the inbox that really gets the mail.
    const twice = (i: number) =>
      new NextRequest("http://localhost/api/auth/signin/email", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "cf-connecting-ip": `198.51.100.${i}`,
        },
        body: `email=decoy${i}%40example.com&csrfToken=t&email=pat%40example.com`,
      });
    for (let i = 0; i < 3; i += 1) {
      expect((await post(twice(i))).status, `call ${i + 1}`).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(twice(200));
    const tail = await post(signInRequest("pat@example.com,x", "198.51.100.201"));
    spy.mockRestore();
    expect(res.status).toBe(429);
    expect(tail.status).toBe(429);
    expect(authPost).toHaveBeenCalledTimes(3);
  });

  it("reads the mailbox from a JSON body too", async () => {
    const json = (ip: string) =>
      new NextRequest("http://localhost/api/auth/signin/email", {
        method: "POST",
        headers: { "content-type": "application/json", "cf-connecting-ip": ip },
        body: JSON.stringify({ email: "pat@example.com", csrfToken: "t" }),
      });
    for (let i = 0; i < 3; i += 1) {
      expect((await post(json(`198.51.100.${i}`))).status).toBe(200);
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(json("198.51.100.200"));
    spy.mockRestore();
    expect(res.status).toBe(429);
  });

  it("matches the sign-in path the way Auth.js does", async () => {
    for (let i = 0; i < 5; i += 1) {
      await post(signInRequest(`person${i}@example.com`, "203.0.113.7", "/api/auth/signin/email/"));
    }
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(
      signInRequest("person5@example.com", "203.0.113.7", "/api/auth//signin/email"),
    );
    spy.mockRestore();
    expect(res.status).toBe(429);
  });

  it("does not limit the other Auth.js posts", async () => {
    for (let i = 0; i < 12; i += 1) {
      const res = await post(signInRequest("pat@example.com", "203.0.113.7", "/api/auth/signout"));
      expect(res.status).toBe(200);
    }
    expect(authPost).toHaveBeenCalledTimes(12);
  });

  it("keeps sign-in working when the limiter itself fails", async () => {
    const limit = vi.fn(async () => {
      throw new Error("rate limiter unavailable");
    });
    cloudflareEnv.mockReturnValue({
      RL_SIGNIN_IP: { limit },
      RL_SIGNIN_ADDRESS: { limit },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 8; i += 1) {
      const res = await post(signInRequest("pat@example.com", "203.0.113.7"));
      expect(res.status, `call ${i + 1}`).toBe(200);
    }
    spy.mockRestore();
    expect(authPost).toHaveBeenCalledTimes(8);
  });

  it("leaves GET to Auth.js", async () => {
    authGet.mockResolvedValue(Response.json({ csrfToken: "t" }));
    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/auth/csrf"));
    expect(res.status).toBe(200);
    expect(authGet).toHaveBeenCalledTimes(1);
  });
});
