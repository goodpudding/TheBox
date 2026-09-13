import type { DataProvider } from "@/lib/data/provider";
import { createMockDataProvider } from "@/lib/data/mock-provider";
import {
  createServerDataProvider,
  getDataProviderMode,
} from "@/lib/data/factory";

const globalForAccess = globalThis as unknown as {
  __boxAccessProvider?: DataProvider;
};

/**
 * Long-lived provider for machine readers.
 * Mock mode keeps one in-memory instance so authorize/end sessions survive
 * across requests during `next dev`. Prisma mode creates a fresh bridge each call.
 */
export async function getAccessDataProvider(): Promise<DataProvider> {
  if (getDataProviderMode() === "prisma") {
    return createServerDataProvider(null);
  }
  if (!globalForAccess.__boxAccessProvider) {
    globalForAccess.__boxAccessProvider = createMockDataProvider(null);
  }
  return globalForAccess.__boxAccessProvider;
}

export function readerSecretIsValid(secret: string | null | undefined): boolean {
  const expected =
    process.env.READER_SHARED_SECRET?.trim() ||
    (process.env.NODE_ENV !== "production"
      ? "dev-reader-secret-change-me"
      : "");
  if (!expected || !secret) return false;
  return secret === expected;
}

export function normalizeBadgeUid(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}
