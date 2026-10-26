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

let lastLoad: "bundle" | "cache" | "mock" = "mock";

/** What the most recent createServerDataProvider call did. For RPC logs. */
export function lastProviderLoad(): "bundle" | "cache" | "mock" {
  return lastLoad;
}

/**
 * Server-side factory. Client UI uses this only through `/api/data` in live mode.
 * PrismaDataProvider is constructed only when DATA_PROVIDER=prisma.
 */
export async function createServerDataProvider(
  initialUserId?: string | null,
): Promise<DataProvider> {
  if (getDataProviderMode() === "prisma") {
    const { createPrismaDataProvider, takeBundleLoad } = await import(
      "./prisma-provider"
    );
    const provider = await createPrismaDataProvider(initialUserId);
    lastLoad = takeBundleLoad();
    return provider;
  }
  lastLoad = "mock";
  return createMockDataProvider(initialUserId);
}
