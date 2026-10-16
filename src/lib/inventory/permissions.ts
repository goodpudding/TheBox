import { isStaffRole } from "@/lib/data/access";
import type {
  AreaSteward,
  InventoryAction,
  User,
} from "@/lib/data/types";

export function isInventoryVolunteer(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isStaffRole(user)) return true;
  return user.status === "active" && user.shopAccess;
}

export function stewardAreaIds(
  user: User | null | undefined,
  stewards: AreaSteward[],
): string[] {
  if (!user) return [];
  return stewards.filter((s) => s.userId === user.id).map((s) => s.areaId);
}

export function isAreaSteward(
  user: User | null | undefined,
  stewards: AreaSteward[],
  areaId?: string | null,
): boolean {
  if (!user) return false;
  const ids = stewardAreaIds(user, stewards);
  if (ids.length === 0) return false;
  if (!areaId) return true;
  return ids.includes(areaId);
}

/**
 * Single permission helper used by every inventory write/list path.
 * Roles map onto the portal's existing User.role + AreaSteward rows.
 */
export function canInventory(
  user: User | null | undefined,
  action: InventoryAction,
  opts?: { areaId?: string | null; stewards?: AreaSteward[] },
): boolean {
  if (!user) return false;
  const stewards = opts?.stewards ?? [];
  const areaId = opts?.areaId;
  const staff = isStaffRole(user);
  const stewardHere =
    staff ||
    (areaId
      ? isAreaSteward(user, stewards, areaId)
      : isAreaSteward(user, stewards));
  const volunteer = isInventoryVolunteer(user);

  switch (action) {
    case "viewApproved":
    case "reportIssue":
      return true;
    case "viewPending":
    case "approve":
    case "reject":
    case "edit":
    case "changeStatus":
    case "move":
      return stewardHere;
    case "submit":
    case "addPhoto":
      return volunteer;
    case "retire":
    case "importCsv":
    case "printLabels":
    case "manageAreas":
      return staff;
    default:
      return false;
  }
}
