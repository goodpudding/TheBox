/** Shared domain types for The Box Portal. Fixtures and Prisma mirror these. */

export type ISODateTime = string;
export type ISODate = string;

export type Role = "member" | "staff" | "admin";
export type MembershipStatus = "active" | "lapsed" | "suspended" | "pending";

/** Product ladder — base Maker rates unchanged; new tiers sit beside them. */
export type MembershipTier =
  | "day"
  | "community"
  | "maker"
  | "household_addon"
  | "patron"
  | "friend"
  | "scholarship"
  | "maker_pro"
  | "unlimited"
  | "team"
  | "shop_steward";

export type BillingInterval = "daily" | "monthly" | "annual" | "none";

/** When a catalog product becomes joinable / visible. */
export type MembershipPhase = 1 | 2 | 3;

export type CertificationStatus =
  | "not_started"
  | "knowledge_passed"
  | "certified"
  | "expired"
  | "revoked";

export type ReservationStatus = "booked" | "cancelled" | "completed" | "no_show";

export type BookingStatus =
  | "awaiting_payment"
  | "booked"
  | "waitlisted"
  | "cancelled"
  | "expired"
  | "attended"
  | "no_show";

export type ClassCategory =
  | "orientation"
  | "certification_checkoff"
  | "workshop"
  | "open_studio";

export type MachineArea =
  | "3d_printing"
  | "laser"
  | "woodshop"
  | "textiles_vinyl"
  | "sublimation";

export type VolunteerInterestStatus =
  | "new"
  | "contacted"
  | "accepted"
  | "declined"
  | "archived";

export type AccessDenyReason =
  | "user_inactive"
  | "waiver_unsigned"
  | "waiver_outdated"
  | "badge_inactive"
  | "badge_unlinked"
  | "cert_missing"
  | "cert_expired"
  | "cert_revoked"
  | "machine_inactive"
  | "unknown_badge"
  | "unknown_reader"
  | "no_shop_access"
  | "reservation_required";

export type AuditAction =
  | "member_registered"
  | "waiver_signed"
  | "policy_acknowledged"
  | "cert_knowledge_passed"
  | "cert_checked_off"
  | "cert_revoked"
  | "cert_expired"
  | "status_changed"
  | "badge_linked"
  | "badge_unlinked"
  | "booking_marked_paid"
  | "reservation_overridden"
  | "maintenance_created"
  | "tool_champion_requested"
  | "tool_champion_activated"
  | "tool_champion_completed";

/** 2-month machine maintain + train commitment. */
export type ToolChampionStatus =
  | "pending"
  | "active"
  | "completed"
  | "withdrawn"
  | "declined";

export interface Timestamps {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt?: ISODateTime | null;
}

export interface User extends Timestamps {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  phone?: string;
  role: Role;
  status: MembershipStatus;
  tier: MembershipTier | null;
  billingInterval?: BillingInterval | null;
  /** Set on household add-on members — shares primary’s plan / address. */
  householdPrimaryUserId?: string | null;
  /** Friend (and similar) have no machine access even when status is active. */
  shopAccess: boolean;
  /** Day-pass credit toward first month if joining within this window. */
  dayPassCreditExpiresAt?: ISODateTime | null;
  scholarshipExpiresAt?: ISODateTime | null;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  newsletterOptIn: boolean;
  profileComplete: boolean;
  /** Fixture annotation only; ignored by runtime */
  _notes?: string;
}

export interface MembershipProduct extends Timestamps {
  id: string;
  tier: MembershipTier;
  name: string;
  summary: string;
  priceCents: number;
  billingInterval: BillingInterval;
  /** Alternate annual price shown on the same card when applicable */
  annualPriceCents?: number | null;
  shopAccess: boolean;
  phase: MembershipPhase;
  /** Shown on /join now (Phase 3 products may be coming-soon). */
  visibleOnJoin: boolean;
  joinable: boolean;
  highlight?: boolean;
  sortOrder: number;
  /** e.g. household is an add-on, not a standalone primary */
  isAddOn?: boolean;
  cappedSeats?: number | null;
}

export interface Badge extends Timestamps {
  id: string;
  uid: string;
  label?: string;
  userId: string | null;
  active: boolean;
}

export interface WaiverSignature extends Timestamps {
  id: string;
  userId: string;
  version: string;
  signedAt: ISODateTime;
  fullNameTyped: string;
  ip: string;
  userAgent?: string;
}

export interface PolicyAcknowledgement extends Timestamps {
  id: string;
  userId: string;
  policySlug: string;
  version: string;
  acknowledgedAt: ISODateTime;
}

export interface Certification extends Timestamps {
  id: string;
  slug: string;
  name: string;
  description: string;
  knowledgeOnly: boolean;
  requiresCertificationIds: string[];
  expiryMonths: number | null;
  sortOrder: number;
  active: boolean;
}

export interface UserCertification extends Timestamps {
  id: string;
  userId: string;
  certificationId: string;
  status: CertificationStatus;
  knowledgePassedAt?: ISODateTime | null;
  checkedOffAt?: ISODateTime | null;
  checkedOffById?: string | null;
  expiresAt?: ISODateTime | null;
  revokedAt?: ISODateTime | null;
  revokedById?: string | null;
  revokeReason?: string | null;
}

export interface Machine extends Timestamps {
  id: string;
  name: string;
  area: MachineArea;
  requiredCertificationIds: string[];
  readerKey: string;
  active: boolean;
  /** Soft advisory — start still allowed without a reservation. */
  reservationRecommended: boolean;
  /** Hard gate — badge start denied without an overlapping booked reservation. */
  reservationRequired: boolean;
  /** Physical place in the shop, e.g. "Woodshop · Bay A". */
  locationLabel: string;
  /** External getting-started video (YouTube/Vimeo/etc.), if any. */
  gettingStartedVideoUrl: string | null;
  sortOrder: number;
}

export interface Reservation extends Timestamps {
  id: string;
  userId: string;
  machineId: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  status: ReservationStatus;
  createdById: string;
  cancelledAt?: ISODateTime | null;
  cancelReason?: string | null;
}

export interface MaintenanceBlock extends Timestamps {
  id: string;
  machineId: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  reason: string;
  createdById: string;
}

/**
 * Someone who maintains a machine and helps train others on it for a
 * fixed term (default two months). Completing three unlocks the Shop lead track.
 */
export interface ToolChampionTerm extends Timestamps {
  id: string;
  userId: string;
  machineId: string;
  status: ToolChampionStatus;
  startsAt: ISODateTime | null;
  endsAt: ISODateTime | null;
  notes?: string | null;
}

export interface UsageSession extends Timestamps {
  id: string;
  userId: string;
  machineId: string;
  badgeId: string;
  startedAt: ISODateTime;
  endedAt?: ISODateTime | null;
  reservationId?: string | null;
  endedBy: "reader" | "timeout" | "staff" | "system";
}

export interface AccessLog extends Timestamps {
  id: string;
  readerKey: string;
  machineId?: string | null;
  badgeUid: string;
  userId?: string | null;
  allow: boolean;
  reason?: AccessDenyReason | "ok" | null;
  reservationNotice?: string | null;
  sessionId?: string | null;
  requestedAt: ISODateTime;
}

export interface ClassSession extends Timestamps {
  id: string;
  title: string;
  slug: string;
  descriptionSlug: string;
  category: ClassCategory;
  instructorId: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  capacity: number;
  priceCents: number;
  zeffyUrl?: string | null;
  prerequisiteCertificationIds: string[];
  location: string;
  cancellationCutoffHours: number | null;
  published: boolean;
}

export interface Booking extends Timestamps {
  id: string;
  classSessionId: string;
  userId: string;
  status: BookingStatus;
  waitlistPosition?: number | null;
  paidAt?: ISODateTime | null;
  paidMarkedById?: string | null;
  paymentHoldExpiresAt?: ISODateTime | null;
  cancelledAt?: ISODateTime | null;
  attendedAt?: ISODateTime | null;
}

export interface LearningModule extends Timestamps {
  id: string;
  slug: string;
  title: string;
  summary: string;
  certificationId: string;
  knowledgeOnly: boolean;
  published: boolean;
  passThresholdPercent: number;
  attemptLimit: number;
  sortOrder: number;
}

export interface Lesson extends Timestamps {
  id: string;
  moduleId: string;
  slug: string;
  title: string;
  contentSlug: string;
  sortOrder: number;
  estimatedMinutes: number;
}

export interface Question extends Timestamps {
  id: string;
  moduleId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation?: string;
  active: boolean;
}

export interface LessonProgress extends Timestamps {
  id: string;
  userId: string;
  lessonId: string;
  completedAt: ISODateTime;
}

export interface QuizAttempt extends Timestamps {
  id: string;
  userId: string;
  moduleId: string;
  questionIds: string[];
  answers: (number | null)[];
  scorePercent: number;
  passed: boolean;
  startedAt: ISODateTime;
  submittedAt: ISODateTime;
}

export type ContentCategory =
  | "policy"
  | "waiver"
  | "lesson"
  | "class"
  | "volunteer"
  | "hours"
  | "faq"
  | "other";

export interface ContentPage extends Timestamps {
  id: string;
  notionId?: string | null;
  slug: string;
  title: string;
  html: string;
  markdownPath?: string;
  category: ContentCategory;
  version: string;
  syncedAt?: ISODateTime | null;
  published: boolean;
}

export interface VolunteerRole extends Timestamps {
  id: string;
  slug: string;
  title: string;
  contentSlug: string;
  active: boolean;
  sortOrder: number;
}

export interface VolunteerInterest extends Timestamps {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleId?: string | null;
  message: string;
  status: VolunteerInterestStatus;
  userId?: string | null;
  reviewedById?: string | null;
  reviewedAt?: ISODateTime | null;
  notes?: string | null;
}

export interface OrgSettings {
  orgName: string;
  paymentUrl: string;
  /** General / membership checkout (Zeffy). */
  donationUrl: string;
  scholarshipDonationUrl: string;
  contactEmail: string;
  hoursContentSlug: string;
  currentWaiverVersion: string;
  memberExpectationsPolicySlug: string;
  quizPassThresholdPercent: number;
  quizAttemptLimit: number;
  quizQuestionCount: number;
  classCancellationCutoffHours: number;
  paymentHoldHours: number;
  reservationHorizonDays: number;
  maxHoursPerDay: number;
  maxOpenReservations: number;
  reservationSlotMinutes: number;
  /** Self-selected Community rate seat cap (honor system). */
  communitySeatCap: number;
  /** Maker monthly dues — scholarship seats = fund ÷ this. */
  makerMonthlyCents: number;
  /** Portion of Patron dues that funds scholarships ($20 of $60). */
  patronScholarshipSurchargeCents: number;
  /** Ledger balance for scholarship funding (Patron surcharges + earmarked gifts). */
  scholarshipFundBalanceCents: number;
  /** Currently awarded scholarship seats (6-month awards). */
  scholarshipSeatsAwarded: number;
  /** Show Phase 3 tiers on Join as coming soon. */
  showPhase3Tiers: boolean;
  updatedAt: ISODateTime;
}

export interface ScholarshipFundSummary {
  fundBalanceCents: number;
  makerMonthlyCents: number;
  seatsFundable: number;
  seatsAwarded: number;
  seatsAvailable: number;
  patronSurchargeCents: number;
  communitySeatCap: number;
  communitySeatsUsed: number;
}

export interface AuditEvent extends Timestamps {
  id: string;
  action: AuditAction;
  actorId: string | null;
  subjectUserId?: string | null;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  occurredAt: ISODateTime;
}

export type DisplayPanelId =
  | "today"
  | "machines"
  | "upcoming"
  | "certs"
  | "promos"
  | "membership";

export type NameDisplayMode = "none" | "first" | "firstLast";

export type MachineFloorStatus =
  | "available"
  | "in_use"
  | "reserved"
  | "maintenance";

export interface PromoSlide extends Timestamps {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  qrUrl: string | null;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  active: boolean;
  sortOrder: number;
}

export interface DisplayConfig {
  panelOrder: DisplayPanelId[];
  cadenceSeconds: number;
  pinnedPanel: DisplayPanelId | null;
  nameDisplayMode: NameDisplayMode;
  membershipEveryNRotations: number;
  updatedAt: ISODateTime;
}

/** Aggregated fixture bundle loaded into MockDataProvider */
export interface MockFixtureBundle {
  users: User[];
  badges: Badge[];
  certifications: Certification[];
  userCertifications: UserCertification[];
  machines: Machine[];
  reservations: Reservation[];
  maintenanceBlocks: MaintenanceBlock[];
  toolChampionTerms: ToolChampionTerm[];
  usageSessions: UsageSession[];
  accessLogs: AccessLog[];
  classSessions: ClassSession[];
  bookings: Booking[];
  learningModules: LearningModule[];
  lessons: Lesson[];
  questions: Question[];
  lessonProgress: LessonProgress[];
  quizAttempts: QuizAttempt[];
  volunteerRoles: VolunteerRole[];
  volunteerInterests: VolunteerInterest[];
  contentPages: ContentPage[];
  waiverSignatures: WaiverSignature[];
  policyAcknowledgements: PolicyAcknowledgement[];
  auditEvents: AuditEvent[];
  membershipProducts: MembershipProduct[];
  settings: OrgSettings;
  promoSlides: PromoSlide[];
  displayConfig: DisplayConfig;
}
