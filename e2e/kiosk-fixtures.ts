import { DEMO_KIOSK_PIN } from "../src/lib/workstation/pin";

/**
 * The desk and members that `npm run e2e:db` (scripts/e2e-db.ts) puts in the
 * local database. The kiosk tests sign in with the same values, so the two
 * cannot drift apart.
 */
export const KIOSK_DEVICE_ID = "BOX-PC-1";

/** Fixture members only. The database stores its scrypt hash, never the PIN. */
export const KIOSK_PIN = DEMO_KIOSK_PIN;

export const KIOSK_MEMBER = {
  id: "u-maya",
  email: "maya.chen@example.com",
  firstName: "Maya",
  lastName: "Chen",
};

/**
 * Signs in after a wrong PIN. A second member, so a failed attempt never
 * counts against the member the plain sign-in test uses.
 */
export const KIOSK_TYPO_MEMBER = {
  id: "u-jordan",
  email: "jordan.lee@example.com",
  firstName: "Jordan",
  lastName: "Lee",
};
