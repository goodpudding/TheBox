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

  // The per-mailbox count is in src/auth.ts and is tested with the real
  // Auth.js in sign-in-email.test.ts. Here: what the route does with its answer.
  it("answers 429 when Auth.js says the mailbox is over its limit", async () => {
    const limited = "http://localhost/login?error=RateLimit";
    const answers = [
      // To next-auth's client Auth.js sends the redirect as JSON, to a plain form as a 302.
      () => Response.json({ url: limited }, { headers: { location: limited } }),
      () => new Response(null, { status: 302, headers: { location: limited } }),
    ];
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const [i, answer] of answers.entries()) {
      authPost.mockImplementationOnce(async () => answer());
      const res = await post(signInRequest("pat@example.com", `198.51.100.${i}`));
      expect(res.status).toBe(429);
      expect(res.headers.get("retry-after")).toBe("60");
      const body = (await res.json()) as { error: string; url: string };
      expect(body.error).toBe("Too many requests. Wait a minute and try again.");
      expect(new URL(body.url).searchParams.get("error")).toBe("RateLimit");
    }
    spy.mockRestore();
  });

  it("passes on every other answer from Auth.js as it is", async () => {
    const answers = [
      "http://localhost/login?error=MissingCSRF",
      "http://localhost/api/auth/verify-request?provider=email&type=email",
      "http://localhost/other?error=RateLimit",
      "http://",
    ];
    for (const [i, url] of answers.entries()) {
      authPost.mockImplementationOnce(async () =>
        Response.json({ url }, { headers: { location: url } }),
      );
      const res = await post(signInRequest("pat@example.com", `198.51.100.${i}`));
      expect(res.status, url).toBe(200);
      expect(((await res.json()) as { url: string }).url).toBe(url);
    }
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
