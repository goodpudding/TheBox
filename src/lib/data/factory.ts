import type { DataProvider } from "./provider";
import { createMockDataProvider } from "./mock-provider";

export type DataProviderMode = "mock" | "prisma";

export function getDataProviderMode(): DataProviderMode {
  const mode = (process.env.DATA_PROVIDER ?? "").toLowerCase();
  if (mode === "prisma") return "prisma";
  if (mode === "mock") return "mock";
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  ) {
    return "prisma";
  }
  return "mock";
}

type ProviderLoad = "bundle" | "cache" | "fresh" | "mock";

let lastLoad: ProviderLoad = "mock";

/**
 * What the most recent createServerDataProvider call did. For RPC logs.
 * "bundle" is a full database load, "fresh" a full load a write forced while a
 * cached bundle was available, "cache" no load at all.
 */
export function lastProviderLoad(): ProviderLoad {
  return lastLoad;
}

/**
 * Server-side factory. Client UI uses this only through `/api/data` in live mode.
 * PrismaDataProvider is constructed only when DATA_PROVIDER=prisma.
 * Pass `fresh` when the caller is going to write: the provider then starts from
 * the database as it is now instead of a bundle cached up to 5 seconds ago.
 */
export async function createServerDataProvider(
  initialUserId?: string | null,
  options: { fresh?: boolean } = {},
): Promise<DataProvider> {
  if (getDataProviderMode() === "prisma") {
    const { createPrismaDataProvider, takeBundleLoad } = await import(
      "./prisma-provider"
    );
    const provider = await createPrismaDataProvider(initialUserId, options);
    lastLoad = takeBundleLoad();
    return provider;
  }
  lastLoad = "mock";
  return createMockDataProvider(initialUserId);
}
