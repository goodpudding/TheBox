import type { DataProvider } from "./provider";
import { createMockDataProvider } from "./mock-provider";

export type DataProviderMode = "mock" | "prisma";

export function getDataProviderMode(): DataProviderMode {
  const mode = (process.env.DATA_PROVIDER ?? "mock").toLowerCase();
  return mode === "prisma" ? "prisma" : "mock";
}

/**
 * Server-side factory. Client UI defaults to mock via AppProviders.
 * PrismaDataProvider is constructed only when DATA_PROVIDER=prisma.
 */
export async function createServerDataProvider(
  initialUserId?: string | null,
): Promise<DataProvider> {
  if (getDataProviderMode() === "prisma") {
    const { createPrismaDataProvider } = await import("./prisma-provider");
    return createPrismaDataProvider(initialUserId);
  }
  return createMockDataProvider(initialUserId);
}
