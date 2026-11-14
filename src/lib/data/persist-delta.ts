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
  return {
    bundle: sliced,
    removed,
    settingsChanged,
    empty: !any && !settingsChanged,
  };
}

export function cloneBundle(bundle: MockFixtureBundle): MockFixtureBundle {
  return structuredClone(bundle);
}

