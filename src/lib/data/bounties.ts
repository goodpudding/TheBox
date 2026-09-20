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
