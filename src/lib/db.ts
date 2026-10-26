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

<<<<<<< HEAD
type D1Binding = ConstructorParameters<typeof PrismaD1>[0];
=======
function createPrisma() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/** PrismaClient always types `equipmentJob`; a pre-generate HMR client may not have it. */
function isStaleClient(client: PrismaClient): boolean {
  return !("equipmentJob" in (client as unknown as Record<string, unknown>));
}

/** Drop a HMR-stale client that was constructed before a schema generate. */
if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  isStaleClient(globalForPrisma.prisma)
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();
>>>>>>> 98ea5f6 (Fix PIN login crash from a stale Prisma client)

const log: ("error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

function resolveD1(): D1Binding | null {
  try {
    const { env } = getCloudflareContext();
    const db = (env as { DB?: D1Binding }).DB;
    return db ?? null;
  } catch {
    return null;
  }
}

let cached: { client: PrismaClient; d1: D1Binding | null } | undefined;

function getClient(): PrismaClient {
  const d1 = resolveD1();
  if (cached && cached.d1 === d1) return cached.client;
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
