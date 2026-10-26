import type {
  CertificationStatus,
  Machine,
  MachineArea,
  MembershipStatus,
  MembershipTier,
  Role,
  User,
  UserCertification,
  WaiverSignature,
} from "@/lib/data/types";

function toIso(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

function toIsoRequired(date: Date): string {
  return date.toISOString();
}

export function mapUserRow(row: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string | null;
  role: string;
  status: string;
  tier: string | null;
  billingInterval: string | null;
  householdPrimaryUserId: string | null;
  shopAccess: boolean;
  isTeacher?: boolean;
  dayPassCreditExpiresAt: Date | null;
  scholarshipExpiresAt: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  profileComplete: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): User {
  const user: User = {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    displayName: row.displayName,
    role: row.role as Role,
    status: row.status as MembershipStatus,
    tier: (row.tier as MembershipTier | null) ?? null,
    shopAccess: row.shopAccess,
    isTeacher: Boolean(row.isTeacher),
    profileComplete: row.profileComplete,
    createdAt: toIsoRequired(row.createdAt),
    updatedAt: toIsoRequired(row.updatedAt),
    deletedAt: toIso(row.deletedAt),
  };
  if (row.phone) user.phone = row.phone;
  if (row.billingInterval != null) {
    user.billingInterval = row.billingInterval as User["billingInterval"];
  }
  return user;
}

export function parseJsonArray(str: string | null | undefined): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function mapMachineRow(row: {
  id: string;
  name: string;
  area: string;
  requiredCertificationIds: string;
  readerKey: string;
  active: boolean;
  reservationRecommended: boolean;
  reservationRequired: boolean;
  attendedOperationRequired: boolean;
  locationLabel: string;
  gettingStartedVideoUrl: string | null;
  maxReservationHours: number | null;
  sortOrder: number;
  hourlyRateCents?: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Machine {
  return {
    id: row.id,
    name: row.name,
    area: row.area as MachineArea,
    requiredCertificationIds: parseJsonArray(row.requiredCertificationIds),
    readerKey: row.readerKey,
    active: row.active,
    reservationRecommended: row.reservationRecommended,
    reservationRequired: row.reservationRequired,
    attendedOperationRequired: row.attendedOperationRequired,
    locationLabel: row.locationLabel,
    gettingStartedVideoUrl: row.gettingStartedVideoUrl,
    maxReservationHours: row.maxReservationHours,
    sortOrder: row.sortOrder,
    hourlyRateCents: row.hourlyRateCents ?? null,
    createdAt: toIsoRequired(row.createdAt),
    updatedAt: toIsoRequired(row.updatedAt),
    deletedAt: toIso(row.deletedAt),
  };
}

export function mapUserCertRow(row: {
  id: string;
  userId: string;
  certificationId: string;
  status: string;
  knowledgePassedAt: Date | null;
  checkedOffAt: Date | null;
  checkedOffById: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedById: string | null;
  revokeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): UserCertification {
  return {
    id: row.id,
    userId: row.userId,
    certificationId: row.certificationId,
    status: row.status as CertificationStatus,
    knowledgePassedAt: toIso(row.knowledgePassedAt),
    checkedOffAt: toIso(row.checkedOffAt),
    checkedOffById: row.checkedOffById,
    expiresAt: toIso(row.expiresAt),
    revokedAt: toIso(row.revokedAt),
    revokedById: row.revokedById,
    revokeReason: row.revokeReason,
    createdAt: toIsoRequired(row.createdAt),
    updatedAt: toIsoRequired(row.updatedAt),
    deletedAt: toIso(row.deletedAt),
  };
}

export function mapWaiverRow(row: {
  id: string;
  userId: string;
  version: string;
  signedAt: Date;
  fullNameTyped: string;
  ip: string;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): WaiverSignature {
  return {
    id: row.id,
    userId: row.userId,
    version: row.version,
    signedAt: toIsoRequired(row.signedAt),
    fullNameTyped: row.fullNameTyped,
    ip: row.ip,
    userAgent: row.userAgent ?? undefined,
    createdAt: toIsoRequired(row.createdAt),
    updatedAt: toIsoRequired(row.updatedAt),
    deletedAt: toIso(row.deletedAt),
  };
}

export const AREA_LABEL: Record<MachineArea, string> = {
  "3d_printing": "3D printing",
  laser: "Laser",
  woodshop: "Woodshop",
  textiles_vinyl: "Textiles & vinyl",
  sublimation: "Sublimation",
  cnc_plasma: "CNC & plasma",
  hand_tools: "Hand tools",
};
