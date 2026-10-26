import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Prisma client.
 *
 * - On Cloudflare Workers (and in `next dev`, via initOpenNextCloudflareForDev),
 *   queries go to the D1 database bound as `DB` in wrangler.jsonc.
 * - In plain Node (scripts, seed, tests) there is no Cloudflare context, so the
 *   client falls back to the engine and DATABASE_URL (SQLite file in dev).
 *
 * The client is created lazily on first use because bindings are only
 * available inside a request, not at module load.
 */

type D1Binding = ConstructorParameters<typeof PrismaD1>[0];

const log: ("error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

let scheduledD1: D1Binding | null = null;

function resolveD1(): D1Binding | null {
  if (scheduledD1) return scheduledD1;
  try {
    const { env } = getCloudflareContext();
    const db = (env as { DB?: D1Binding }).DB;
    return db ?? null;
  } catch {
    return null;
  }
}

let cached: { client: PrismaClient; d1: D1Binding | null } | undefined;

/** Cron handlers have no request context. Pass the Worker env binding in. */
export function useScheduledD1(db: D1Binding | null): void {
  scheduledD1 = db;
  cached = undefined;
}

/**
 * Dev only: after `prisma generate` under HMR the cached client can predate the
 * schema. The `in` check is false on the real proxied client in production, so
 * it must not run there or every access would rebuild the client.
 */
function isStaleClient(client: PrismaClient): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return !("equipmentJob" in (client as unknown as Record<string, unknown>));
}

function getClient(): PrismaClient {
  const d1 = resolveD1();
  if (cached && cached.d1 === d1 && !isStaleClient(cached.client)) {
    return cached.client;
  }
  const client = d1
    ? new PrismaClient({ adapter: new PrismaD1(d1), log })
    : new PrismaClient({ log });
  cached = { client, d1 };
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop) as unknown;
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});
