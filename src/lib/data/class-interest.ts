import type { ClassInterestBoard, User } from "./types";
import { isStaffRole } from "./access";

export { isStaffRole };

export const CLASS_INTEREST_DEFAULT_THRESHOLD = 8;
export const CLASS_INTEREST_OPEN_DAYS = 30;
export const CLASS_INTEREST_PRIORITY_HOURS = 72;

/** Teachers, staff, and admins publish boards without a second approval. */
export function canPublishInterestBoard(user: User | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isTeacher) || isStaffRole(user);
}

/** Active members, teachers, or staff may propose in-app. */
export function canProposeInterestBoard(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isStaffRole(user) || user.isTeacher) return true;
  return user.role === "member" && user.status === "active";
}

export function interestSignupCount(
  boardId: string,
  signups: { boardId: string; deletedAt?: string | null }[],
): number {
  return signups.filter((s) => s.boardId === boardId && !s.deletedAt).length;
}

export function boardNeedsExpiry(
  board: Pick<ClassInterestBoard, "status" | "closesAt">,
  nowMs = Date.now(),
): boolean {
  if (board.status !== "open") return false;
  if (!board.closesAt) return false;
  return new Date(board.closesAt).getTime() < nowMs;
}
