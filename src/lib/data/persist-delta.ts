import type { MockFixtureBundle } from "./types";

export function changedRows<T extends { id: string }>(
  prev: T[] | undefined,
  next: T[],
): T[] {
  const map = new Map((prev ?? []).map((row) => [row.id, JSON.stringify(row)]));
  return next.filter((row) => map.get(row.id) !== JSON.stringify(row));
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
] as const;

export function sliceChangedBundle(
  previous: MockFixtureBundle,
  next: MockFixtureBundle,
): { bundle: MockFixtureBundle; settingsChanged: boolean; empty: boolean } {
  const sliced = { ...next };
  let any = false;
  for (const key of ARRAY_KEYS) {
    const rows = changedRows(
      previous[key] as { id: string }[] | undefined,
      (next[key] ?? []) as { id: string }[],
    );
    (sliced[key] as unknown) = rows;
    if (rows.length > 0) any = true;
  }
  const settingsChanged =
    JSON.stringify(previous.settings) !== JSON.stringify(next.settings);
  return {
    bundle: sliced,
    settingsChanged,
    empty: !any && !settingsChanged,
  };
}

export function cloneBundle(bundle: MockFixtureBundle): MockFixtureBundle {
  return structuredClone(bundle);
}

