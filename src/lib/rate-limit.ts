import { createHash } from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * How often the endpoints anyone can reach may be called.
 *
 * Each limit is a Workers Rate Limiting binding declared in wrangler.jsonc
 * (same name and numbers; rate-limit.test.ts fails if they drift). Cloudflare
 * keeps the count outside the Worker, so it holds across isolates. It counts
 * per Cloudflare location and is approximate, and the only windows on offer
 * are 10 and 60 seconds, so these stop floods, not a slow trickle.
 *
 * The numbers are meant to be out of reach for a person using the site:
 * - Public forms, signed out: 5 a minute per address. Nobody fills in a
 *   volunteer, bounty, wishlist or interest form faster than that, and every
 *   accepted one is a database write that the next request has to reload.
 * - Public forms, signed in: 20 a minute per member. A member can be banned,
 *   so the count is per account and a shared shop network does not matter.
 *   Staff are not limited.
 * - Sign-in email: 5 a minute per address the request came from and 3 a
 *   minute per mailbox, so one mailbox cannot be flooded from many places.
 * - Desk QR sign-in: 10 a minute per address. Every desk in the shop shares
 *   one address and each press writes a row that lives five minutes.
 * - Membership sync: 3 a minute per member. Each run pulls 90 days of Zeffy
 *   payments; the account page asks once per visit.
 */
export const RATE_LIMITS = {
  publicWriteAnonymous: { binding: "RL_PUBLIC_WRITE_ANON", limit: 5, periodSeconds: 60 },
  publicWriteMember: { binding: "RL_PUBLIC_WRITE_MEMBER", limit: 20, periodSeconds: 60 },
  signInEmailIp: { binding: "RL_SIGNIN_IP", limit: 5, periodSeconds: 60 },
  signInEmailAddress: { binding: "RL_SIGNIN_ADDRESS", limit: 3, periodSeconds: 60 },
  qrStart: { binding: "RL_QR_START", limit: 10, periodSeconds: 60 },
  syncMembership: { binding: "RL_SYNC_MEMBERSHIP", limit: 3, periodSeconds: 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export const RATE_LIMIT_MESSAGE = "Too many requests. Wait a minute and try again.";

/** Headers for a 429. The binding does not say how long is left, so send the whole window. */
export function rateLimitHeaders(name: RateLimitName): Record<string, string> {
  return {
    "Retry-After": String(RATE_LIMITS[name].periodSeconds),
    "Cache-Control": "no-store",
  };
}

/** The caller's address as Cloudflare saw it, else the first proxy hop, else "". */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (request.headers.get("cf-connecting-ip") ?? forwarded ?? "").trim();
}

function hashed(kind: string, value: string): string {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${kind}:${digest}`;
}

/**
 * One home or server usually holds a whole IPv6 /64 and can pick a new
 * address in it for every request, so the /64 is the caller.
 */
function ipBucket(ip: string): string {
  const text = ip.trim().toLowerCase();
  if (!text.includes(":")) return text;
  // IPv4 written as IPv6 (::ffff:203.0.113.7).
  if (text.includes(".")) return text.slice(text.lastIndexOf(":") + 1);
  const [head, tail] = text.split("::");
  const front = head ? head.split(":") : [];
  const back = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? front
      : [...front, ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back];
  return groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":");
}

/** Limiter key for a network address. Hashed, so the address is not kept. */
export function ipLimitKey(ip: string): string {
  return hashed("ip", ipBucket(ip) || "unknown");
}

/** Limiter key for a mailbox: case, spaces and a +tag all reach the same inbox. */
export function emailLimitKey(email: string): string {
  const text = email.normalize("NFKC").trim().toLowerCase();
  const at = text.lastIndexOf("@");
  if (at < 0) return hashed("email", text);
  const local = text.slice(0, at).split("+")[0];
  return hashed("email", `${local}@${text.slice(at + 1)}`);
}

export function userLimitKey(userId: string): string {
  return hashed("user", userId);
}

/**
 * The counting rule, on its own so it can be tested: at most `limit` calls in
 * any `periodMs`. A refused call is not counted, so hammering does not extend
 * the wait.
 */
export function rateLimitDecision(input: {
  hits: number[];
  limit: number;
  periodMs: number;
  now: number;
}): { allowed: boolean; hits: number[] } {
  const recent = input.hits.filter((at) => input.now - at < input.periodMs);
  if (recent.length >= input.limit) return { allowed: false, hits: recent };
  return { allowed: true, hits: [...recent, input.now] };
}

/** Enough for a busy minute; past this the least recently seen caller is forgotten. */
export const MAX_TRACKED_KEYS = 5000;

const store = new Map<string, number[]>();
const reportedFailures = new Set<string>();

/**
 * Stand-in when there is no binding: local dev on Node, tests, a preview
 * without the binding. It only sees this process.
 */
function allowInMemory(name: RateLimitName, key: string, now: number): boolean {
  const rule = RATE_LIMITS[name];
  const id = `${rule.binding}\n${key}`;
  const step = rateLimitDecision({
    hits: store.get(id) ?? [],
    limit: rule.limit,
    periodMs: rule.periodSeconds * 1000,
    now,
  });
  // Re-adding keeps the Map ordered by last use, oldest first.
  store.delete(id);
  store.set(id, step.hits);
  if (store.size > MAX_TRACKED_KEYS) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  return step.allowed;
}

type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

function resolveBinding(name: string): RateLimitBinding | null {
  try {
    const { env } = getCloudflareContext();
    const binding = (env as Record<string, unknown>)[name] as
      | RateLimitBinding
      | undefined;
    return binding && typeof binding.limit === "function" ? binding : null;
  } catch {
    return null;
  }
}

/**
 * True when this call is within the limit. Counts the call. Never throws: a
 * broken limiter must not take the forms or sign-in down with it, so a
 * binding error lets the request through and is logged once per limit.
 */
export async function allowRequest(
  name: RateLimitName,
  key: string,
  now = Date.now(),
): Promise<boolean> {
  const binding = resolveBinding(RATE_LIMITS[name].binding);
  if (!binding) return allowInMemory(name, key, now);
  try {
    const outcome = await binding.limit({ key });
    return outcome.success !== false;
  } catch (err) {
    if (!reportedFailures.has(name)) {
      reportedFailures.add(name);
      console.error(JSON.stringify({ rateLimit: name, error: String(err) }));
    }
    return true;
  }
}

export function rateLimitStoreSize(): number {
  return store.size;
}

export function resetRateLimitStore(): void {
  store.clear();
  reportedFailures.clear();
}
