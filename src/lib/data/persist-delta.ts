import type { MockFixtureBundle } from "./types";

export function changedRows<T extends { id: string }>(
  prev: T[] | undefined,
  next: T[],
): T[] {
  const map = new Map((prev ?? []).map((row) => [row.id, JSON.stringify(row)]));
  return next.filter((row) => map.get(row.id) !== JSON.stringify(row));
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/**
 * Columns of `next` whose value differs from `prev`, never the id.
 * Both rows come from the same table mapping, so values are scalars or Dates.
 */
export function changedColumns(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(next)) {
    if (column === "id") continue;
    if (!sameValue(prev[column], value)) changed[column] = value;
  }
  return changed;
}

const READ_ONLY_METHODS = new Set([
  "setCurrentUserId",
  "pendingInventoryCount",
  "findInventoryBySerial",
  "findBookingByZeffyPaymentId",
]);

/**
 * True when a DataProvider method can change stored rows. The kiosk PIN
 * methods write their own columns directly and never go through the bundle.
 */
export function shouldPersistAfter(methodName: string): boolean {
  if (READ_ONLY_METHODS.has(methodName)) return false;
  if (methodName === "setMyKioskPin") return false;
  if (methodName === "adminResetMemberKioskPin") return false;
  if (methodName.startsWith("get")) return false;
  if (methodName.startsWith("list")) return false;
  if (methodName.startsWith("adminList")) return false;
  return true;
}

const ARRAY_KEYS = [
  "users",
  "badges",
  "certifications",
  "userCertifications",
  "machines",
  "reservations",
  "maintenanceBlocks",
  "usageSessions",
  "accessLogs",
  "classSessions",
  "bookings",
  "classInterestBoards",
  "classInterestSignups",
  "learningModules",
  "lessons",
  "lessonVideos",
  "questions",
  "lessonProgress",
  "videoWatches",
  "quizAttempts",
  "volunteerRoles",
  "volunteerInterests",
  "bounties",
  "contentPages",
  "waiverSignatures",
  "policyAcknowledgements",
  "auditEvents",
  "membershipProducts",
  "creditLedgerEntries",
  "inventoryAreas",
  "areaStewards",
  "inventoryItems",
  "itemPhotos",
  "itemEvents",
] as const;

export type ArrayKey = (typeof ARRAY_KEYS)[number];

/**
 * Lists kept as SiteRecord rows, one JSON row each. They have no table of
 * their own, and nothing else in the database points at their rows.
 */
export const RECORD_KEYS = [
  "people",
  "wishlistZones",
  "wishlistItems",
  "wishlistPurchaseReports",
  "toolChampionTerms",
  "promoSlides",
] as const;

export type RecordKey = (typeof RECORD_KEYS)[number];

/** Single objects kept the same way, under the row id "default". */
export const RECORD_SINGLETONS = ["displayConfig"] as const;

export type RecordSingleton = (typeof RECORD_SINGLETONS)[number];

export function siteRecordId(collection: string, rowId: string): string {
  return `${collection}:${rowId}`;
}

export type SiteRecordWrite = { id: string; collection: string; data: string };

/** Every SiteRecord row a bundle holds. Used when there is nothing to compare with. */
export function allSiteRecords(bundle: MockFixtureBundle): SiteRecordWrite[] {
  const out: SiteRecordWrite[] = [];
  for (const key of RECORD_KEYS) {
    for (const row of (bundle[key] ?? []) as { id: string }[]) {
      out.push({ id: siteRecordId(key, row.id), collection: key, data: JSON.stringify(row) });
    }
  }
  for (const key of RECORD_SINGLETONS) {
    if (bundle[key]) {
      out.push({ id: siteRecordId(key, "default"), collection: key, data: JSON.stringify(bundle[key]) });
    }
  }
  return out;
}

/** The SiteRecord rows a request changed, and the ids of the ones it removed. */
export function changedSiteRecords(
  previous: MockFixtureBundle,
  next: MockFixtureBundle,
): { writes: SiteRecordWrite[]; removed: string[] } {
  const before = new Map(allSiteRecords(previous).map((r) => [r.id, r.data]));
  const after = allSiteRecords(next);
  const kept = new Set(after.map((r) => r.id));
  return {
    writes: after.filter((r) => before.get(r.id) !== r.data),
    removed: [...before.keys()].filter((id) => !kept.has(id)),
  };
}

export function removedIds(
  prev: { id: string }[] | undefined,
  next: { id: string }[],
): string[] {
  const kept = new Set(next.map((row) => row.id));
  return (prev ?? []).filter((row) => !kept.has(row.id)).map((row) => row.id);
}

export function sliceChangedBundle(
  previous: MockFixtureBundle,
  next: MockFixtureBundle,
): {
  bundle: MockFixtureBundle;
  removed: Partial<Record<ArrayKey, string[]>>;
  settingsChanged: boolean;
  siteRecords: { writes: SiteRecordWrite[]; removed: string[] };
  empty: boolean;
} {
  const sliced = { ...next };
  const removed: Partial<Record<ArrayKey, string[]>> = {};
  let any = false;
  for (const key of ARRAY_KEYS) {
    const prevRows = previous[key] as { id: string }[] | undefined;
    const nextRows = (next[key] ?? []) as { id: string }[];
    const rows = changedRows(prevRows, nextRows);
    (sliced[key] as unknown) = rows;
    if (rows.length > 0) any = true;
    const gone = removedIds(prevRows, nextRows);
    if (gone.length > 0) {
      removed[key] = gone;
      any = true;
    }
  }
  const settingsChanged =
    JSON.stringify(previous.settings) !== JSON.stringify(next.settings);
  const siteRecords = changedSiteRecords(previous, next);
  const recordsChanged =
    siteRecords.writes.length > 0 || siteRecords.removed.length > 0;
  return {
    bundle: sliced,
    removed,
    settingsChanged,
    siteRecords,
    empty: !any && !settingsChanged && !recordsChanged,
  };
}

export function cloneBundle(bundle: MockFixtureBundle): MockFixtureBundle {
  return structuredClone(bundle);
}

