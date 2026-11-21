/**
 * A badge UID the way it is stored and compared: hex digits only, lower case.
 * Readers send it with or without colons and in either case, and staff type
 * it as it is printed on the fob. Both ends go through this.
 */
export function normalizeBadgeUid(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

/** NFC UIDs are 4, 7 or 10 bytes. Anything far outside that is a typo. */
export function isBadgeUid(uid: string): boolean {
  return /^[0-9a-f]{8,20}$/.test(uid);
}
