import type {
  AccessDenyReason,
  Badge,
  ISODateTime,
  Machine,
  User,
  UserCertification,
  WaiverSignature,
} from "./types";

export interface MachineAccessInput {
  user: User | null;
  badge: Badge | null;
  machine: Machine | null;
  userCertifications: UserCertification[];
  waiverSignatures: WaiverSignature[];
  currentWaiverVersion: string;
  /**
   * When the machine requires a reservation, callers pass whether the user
   * has an overlapping booked reservation at `now`.
   */
  hasOverlappingReservation?: boolean;
  /** Defaults to Date.now() */
  now?: Date | ISODateTime;
}

export interface MachineAccessResult {
  allow: boolean;
  reason: AccessDenyReason | "ok";
}

function toMs(now?: Date | ISODateTime): number {
  if (now == null) return Date.now();
  return typeof now === "string" ? new Date(now).getTime() : now.getTime();
}

/**
 * Pure access gate for a badge → machine attempt.
 * When `machine.reservationRequired`, callers must supply
 * `hasOverlappingReservation`.
 */
export function evaluateMachineAccess(
  input: MachineAccessInput,
): MachineAccessResult {
  const {
    user,
    badge,
    machine,
    userCertifications,
    waiverSignatures,
    currentWaiverVersion,
    hasOverlappingReservation,
  } = input;
  const nowMs = toMs(input.now);

  if (!machine) {
    return { allow: false, reason: "unknown_reader" };
  }
  if (!machine.active) {
    return { allow: false, reason: "machine_inactive" };
  }

  if (!badge) {
    return { allow: false, reason: "unknown_badge" };
  }
  if (!badge.active) {
    return { allow: false, reason: "badge_inactive" };
  }
  if (!badge.userId) {
    return { allow: false, reason: "badge_unlinked" };
  }

  if (!user || user.id !== badge.userId) {
    return { allow: false, reason: "user_inactive" };
  }
  if (user.status !== "active") {
    return { allow: false, reason: "user_inactive" };
  }
  if (!user.shopAccess) {
    return { allow: false, reason: "no_shop_access" };
  }

  const userWaivers = waiverSignatures.filter((w) => w.userId === user.id);
  if (userWaivers.length === 0) {
    return { allow: false, reason: "waiver_unsigned" };
  }
  const hasCurrent = userWaivers.some(
    (w) => w.version === currentWaiverVersion,
  );
  if (!hasCurrent) {
    return { allow: false, reason: "waiver_outdated" };
  }

  for (const certId of machine.requiredCertificationIds) {
    const uc = userCertifications.find(
      (c) => c.userId === user.id && c.certificationId === certId,
    );
    if (!uc) {
      return { allow: false, reason: "cert_missing" };
    }
    if (uc.status === "revoked" || uc.revokedAt) {
      return { allow: false, reason: "cert_revoked" };
    }
    if (uc.status === "expired") {
      return { allow: false, reason: "cert_expired" };
    }
    if (uc.expiresAt && new Date(uc.expiresAt).getTime() < nowMs) {
      return { allow: false, reason: "cert_expired" };
    }
    if (uc.status !== "certified") {
      return { allow: false, reason: "cert_missing" };
    }
  }

  if (machine.reservationRequired && !hasOverlappingReservation) {
    return { allow: false, reason: "reservation_required" };
  }

  return { allow: true, reason: "ok" };
}

/** How many completed tool championships unlock the Shop lead track. */
export const SHOP_LEAD_COMPLETED_TOOLS = 3;

/** Default tool champion term length in months. */
export const TOOL_CHAMPION_TERM_MONTHS = 2;

export function isStaffRole(user: User | null | undefined): boolean {
  return user?.role === "staff" || user?.role === "admin";
}

/**
 * Who may block machines for maintenance:
 * staff/admin, Shop Steward membership, or an active Tool Champion.
 */
export function canScheduleMaintenance(
  user: User | null | undefined,
  activeChampionMachineIds: string[] = [],
): boolean {
  if (!user || user.status !== "active") return false;
  if (isStaffRole(user)) return true;
  if (user.tier === "shop_steward") return true;
  return activeChampionMachineIds.length > 0;
}

/** Machine IDs this user may put into maintenance (null = any active machine). */
export function maintenanceMachineScope(
  user: User | null | undefined,
  activeChampionMachineIds: string[],
): "all" | string[] {
  if (!user) return [];
  if (isStaffRole(user) || user.tier === "shop_steward") return "all";
  return activeChampionMachineIds;
}

export function shopLeadProgress(completedToolCount: number): {
  completed: number;
  needed: number;
  eligible: boolean;
} {
  return {
    completed: completedToolCount,
    needed: SHOP_LEAD_COMPLETED_TOOLS,
    eligible: completedToolCount >= SHOP_LEAD_COMPLETED_TOOLS,
  };
}
