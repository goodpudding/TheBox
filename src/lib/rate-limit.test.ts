import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const cloudflareEnv = vi.fn<() => Record<string, unknown>>();

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({ env: cloudflareEnv() }),
}));

const NOW = 1_800_000_000_000;
const SEC = 1000;

async function load() {
  return import("./rate-limit");
}

function noBindings() {
  cloudflareEnv.mockImplementation(() => {
    throw new Error("no Cloudflare context in plain Node");
  });
}

describe("rateLimitDecision", () => {
  it("allows up to the limit inside the period, then refuses", async () => {
    const { rateLimitDecision } = await load();
    let hits: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const step = rateLimitDecision({ hits, limit: 5, periodMs: 60 * SEC, now: NOW + i });
      expect(step.allowed, `call ${i + 1}`).toBe(true);
      hits = step.hits;
    }
    const sixth = rateLimitDecision({ hits, limit: 5, periodMs: 60 * SEC, now: NOW + 10 });
    expect(sixth.allowed).toBe(false);
  });

  it("allows again once the oldest hit is a full period old", async () => {
    const { rateLimitDecision } = await load();
    const hits = [NOW, NOW + 1, NOW + 2];
    const early = rateLimitDecision({ hits, limit: 3, periodMs: 60 * SEC, now: NOW + 59 * SEC });
    expect(early.allowed).toBe(false);
    const later = rateLimitDecision({ hits, limit: 3, periodMs: 60 * SEC, now: NOW + 60 * SEC });
    expect(later.allowed).toBe(true);
  });

  it("does not let refused calls push the wait further out", async () => {
    const { rateLimitDecision } = await load();
    let hits = [NOW];
    for (let i = 1; i <= 30; i += 1) {
      hits = rateLimitDecision({ hits, limit: 1, periodMs: 60 * SEC, now: NOW + i * SEC }).hits;
    }
    const after = rateLimitDecision({ hits, limit: 1, periodMs: 60 * SEC, now: NOW + 60 * SEC });
    expect(after.allowed).toBe(true);
  });
});

describe("clientIp and limit keys", () => {
  it("prefers cf-connecting-ip, then the first forwarded address", async () => {
    const { clientIp } = await load();
    const both = new Request("http://localhost/", {
      headers: { "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
    });
    expect(clientIp(both)).toBe("203.0.113.7");
    const forwarded = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
    });
    expect(clientIp(forwarded)).toBe("198.51.100.1");
    expect(clientIp(new Request("http://localhost/"))).toBe("");
  });

  it("hashes the address so the key never holds it", async () => {
    const { ipLimitKey } = await load();
    const key = ipLimitKey("203.0.113.7");
    expect(key).not.toContain("203.0.113.7");
    expect(key).toBe(ipLimitKey("203.0.113.7"));
    expect(key).not.toBe(ipLimitKey("203.0.113.8"));
  });

  it("counts a whole IPv6 /64 as one caller", async () => {
    const { ipLimitKey } = await load();
    expect(ipLimitKey("2001:db8:1:2::1")).toBe(ipLimitKey("2001:db8:1:2:ffff:ffff:ffff:ffff"));
    expect(ipLimitKey("2001:0db8:0001:0002:0000:0000:0000:0001")).toBe(
      ipLimitKey("2001:db8:1:2::1"),
    );
    expect(ipLimitKey("2001:db8:1:3::1")).not.toBe(ipLimitKey("2001:db8:1:2::1"));
    expect(ipLimitKey("::ffff:203.0.113.7")).toBe(ipLimitKey("203.0.113.7"));
  });

  it("treats case, spaces and a +tag as the same mailbox", async () => {
    const { emailLimitKey } = await load();
    const key = emailLimitKey("pat@example.com");
    expect(key).not.toContain("pat");
    expect(emailLimitKey("  Pat@Example.COM ")).toBe(key);
    expect(emailLimitKey("pat+one@example.com")).toBe(key);
    expect(emailLimitKey("sam@example.com")).not.toBe(key);
  });
});

describe("allowRequest", () => {
  beforeEach(async () => {
    cloudflareEnv.mockReset();
    (await load()).resetRateLimitStore();
  });

  it("limits in memory when there is no Cloudflare binding", async () => {
    noBindings();
    const { allowRequest } = await load();
    for (let i = 0; i < 5; i += 1) {
      expect(await allowRequest("publicWriteAnonymous", "ip:a", NOW + i)).toBe(true);
    }
    expect(await allowRequest("publicWriteAnonymous", "ip:a", NOW + 10)).toBe(false);
    // Another caller and another limit each have their own count.
    expect(await allowRequest("publicWriteAnonymous", "ip:b", NOW + 10)).toBe(true);
    expect(await allowRequest("qrStart", "ip:a", NOW + 10)).toBe(true);
    expect(await allowRequest("publicWriteAnonymous", "ip:a", NOW + 61 * SEC)).toBe(true);
  });

  it("also limits in memory when the context has no such binding", async () => {
    cloudflareEnv.mockReturnValue({ DB: {} });
    const { allowRequest } = await load();
    for (let i = 0; i < 3; i += 1) {
      expect(await allowRequest("signInEmailAddress", "email:a", NOW + i)).toBe(true);
    }
    expect(await allowRequest("signInEmailAddress", "email:a", NOW + 10)).toBe(false);
  });

  it("asks the Cloudflare binding when it is there", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    cloudflareEnv.mockReturnValue({ RL_PUBLIC_WRITE_ANON: { limit } });
    const { allowRequest } = await load();
    expect(await allowRequest("publicWriteAnonymous", "ip:a", NOW)).toBe(false);
    expect(limit).toHaveBeenCalledWith({ key: "ip:a" });
    limit.mockResolvedValue({ success: true });
    expect(await allowRequest("publicWriteAnonymous", "ip:a", NOW)).toBe(true);
  });

  it("lets the request through and logs once when the binding fails", async () => {
    const limit = vi.fn(async () => {
      throw new Error("rate limiter unavailable");
    });
    cloudflareEnv.mockReturnValue({ RL_PUBLIC_WRITE_ANON: { limit } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { allowRequest } = await load();
    for (let i = 0; i < 20; i += 1) {
      expect(await allowRequest("publicWriteAnonymous", "ip:a", NOW + i)).toBe(true);
    }
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("does not grow without bound when every call has a new key", async () => {
    noBindings();
    const { allowRequest, rateLimitStoreSize, MAX_TRACKED_KEYS } = await load();
    for (let i = 0; i < MAX_TRACKED_KEYS + 500; i += 1) {
      await allowRequest("qrStart", `ip:${i}`, NOW);
    }
    expect(rateLimitStoreSize()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });
});

/** wrangler.jsonc has comments. Strip them without touching "https://" in strings. */
function readWranglerConfig(): {
  ratelimits?: Binding[];
  previews?: { ratelimits?: Binding[] };
} {
  const text = readFileSync(path.join(process.cwd(), "wrangler.jsonc"), "utf8");
  const json = text.replace(
    /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    (_match, quoted: string | undefined) => quoted ?? "",
  );
  return JSON.parse(json);
}

type Binding = {
  name: string;
  namespace_id: string;
  simple: { limit: number; period: number };
};

describe("wrangler.jsonc rate limit bindings", () => {
  it("declares every limit with the same numbers, for production and previews", async () => {
    const { RATE_LIMITS } = await load();
    const config = readWranglerConfig();
    const expected = Object.values(RATE_LIMITS)
      .map((rule) => ({
        name: rule.binding,
        simple: { limit: rule.limit, period: rule.periodSeconds },
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const list of [config.ratelimits, config.previews?.ratelimits]) {
      const declared = (list ?? [])
        .map(({ name, simple }) => ({ name, simple }))
        .sort((a, b) => a.name.localeCompare(b.name));
      expect(declared).toEqual(expected);
      const ids = (list ?? []).map((entry) => entry.namespace_id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[1-9]\d*$/);
    }
    // Cloudflare only offers these two windows.
    for (const rule of Object.values(RATE_LIMITS)) {
      expect([10, 60]).toContain(rule.periodSeconds);
    }
  });
});
