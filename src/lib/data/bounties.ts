import type { Bounty, User } from "./types";
import { isStaffRole } from "./access";

export { isStaffRole };

/** Active shop members and staff may claim open bounties. */
export function canClaimBounty(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isStaffRole(user)) return true;
  return user.status === "active" && user.shopAccess;
}

/** Claimer or staff may mark a claimed bounty completed. */
export function canCompleteBounty(
  user: User | null | undefined,
  bounty: Pick<Bounty, "claimedByUserId">,
): boolean {
  if (!user) return false;
  if (isStaffRole(user)) return true;
  return bounty.claimedByUserId === user.id;
}

export function isValidBountyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Claimed bounties older than this stay off the lobby TV. */
export const DISPLAY_CLAIMED_BOUNTY_DAYS = 14;
export const DISPLAY_BOUNTY_LIMIT = 6;

/** Open requests, plus claims from the last two weeks — for the shop display. */
export function isDisplayBounty(
  bounty: Pick<Bounty, "status" | "claimedAt" | "deletedAt">,
  nowMs = Date.now(),
): boolean {
  if (bounty.deletedAt) return false;
  if (bounty.status === "open") return true;
  if (bounty.status !== "claimed") return false;
  if (!bounty.claimedAt) return true;
  const claimedMs = new Date(bounty.claimedAt).getTime();
  if (Number.isNaN(claimedMs)) return true;
  return nowMs - claimedMs <= DISPLAY_CLAIMED_BOUNTY_DAYS * 24 * 3600_000;
}
