import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadFixtures } from "./load-fixtures";
import { MockDataProvider } from "./mock-provider";
import type { DataProvider } from "./provider";
import {
  changedColumns,
  cloneBundle,
  shouldPersistAfter,
  sliceChangedBundle,
  type ArrayKey,
} from "./persist-delta";
import {
  PERSIST_TABLES,
  USERS_TABLE,
  settingsRow,
  type PersistTable,
} from "./persist-rows";
import type {
  AccessLog,
  AuditEvent,
  Badge,
  BillingInterval,
  Booking,
  Certification,
  ClassSession,
  ClassInterestBoard,
  ClassInterestSignup,
  ContentPage,
  EquipmentStatus,
  LearningModule,
  Lesson,
  LessonProgress,
  LessonVideo,
  Machine,
  MachineArea,
  MaintenanceBlock,
  MembershipPhase,
  MembershipProduct,
  MembershipStatus,
  MembershipTier,
  MockFixtureBundle,
  OrgSettings,
  PolicyAcknowledgement,
  Question,
  QuestionSource,
  QuizAttempt,
  Reservation,
  Role,
  UsageSession,
  User,
  UserCertification,
  VideoProvider,
  VideoRole,
  VideoWatch,
  VolunteerInterest,
  VolunteerRole,
  WaiverSignature,
  Bounty,
  BountyStatus,
  CreditLedgerEntry,
  InventoryArea,
  InventoryItem,
  AreaSteward,
  ItemPhoto,
  ItemEvent,
  ItemCondition,
  ItemStatus,
  ReviewStatus,
  PhotoKind,
  ItemEventType,
  AcquisitionSource,
} from "./types";

function parseJsonArray<T = string>(str: string | null | undefined): T[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(
  str: string | null | undefined,
): Record<string, unknown> | undefined {
  if (!str) return undefined;
  try {
    const parsed = JSON.parse(str) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Read optional columns before `prisma generate` catches up to schema. */
function col<T>(row: object, key: string, fallback: T): T {
  const value = (row as Record<string, unknown>)[key];
  return (value === undefined || value === null ? fallback : value) as T;
}

/**
 * Prisma client may lag the schema until `npx prisma generate` succeeds.
 * Access optional delegates safely.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prismaTx(tx: Prisma.TransactionClient): any {
  return tx;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaLoose = prisma as any;

function toIso(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}

function toIsoRequired(date: Date): string {
  return date.toISOString();
}

function mapOrgSettings(row: {
  orgName: string;
  paymentUrl: string;
  donationUrl: string;
  scholarshipDonationUrl: string;
  contactEmail: string;
  hoursContentSlug: string;
  currentWaiverVersion: string;
  memberExpectationsPolicySlug: string;
  quizPassThresholdPercent: number;
  quizAttemptLimit: number;
  quizQuestionCount: number;
  requireSafetyCriticalAll?: boolean;
  classCancellationCutoffHours: number;
  paymentHoldHours: number;
  reservationHorizonDays: number;
  maxHoursPerDay: number;
  maxOpenReservations: number;
  reservationSlotMinutes: number;
  communitySeatCap: number;
  makerMonthlyCents: number;
  patronScholarshipSurchargeCents: number;
  scholarshipFundBalanceCents: number;
  scholarshipSeatsAwarded: number;
  showPhase3Tiers: boolean;
  defaultInstructorId?: string | null;
  defaultClassCapacity?: number | null;
  updatedAt: Date;
}): OrgSettings {
  return {
    orgName: row.orgName,
    paymentUrl: row.paymentUrl,
    donationUrl: row.donationUrl,
    scholarshipDonationUrl: row.scholarshipDonationUrl,
    contactEmail: row.contactEmail,
    hoursContentSlug: row.hoursContentSlug,
    currentWaiverVersion: row.currentWaiverVersion,
    memberExpectationsPolicySlug: row.memberExpectationsPolicySlug,
    quizPassThresholdPercent: row.quizPassThresholdPercent,
    quizAttemptLimit: row.quizAttemptLimit,
    quizQuestionCount: row.quizQuestionCount,
    requireSafetyCriticalAll: row.requireSafetyCriticalAll ?? true,
    classCancellationCutoffHours: row.classCancellationCutoffHours,
    paymentHoldHours: row.paymentHoldHours,
    reservationHorizonDays: row.reservationHorizonDays,
    maxHoursPerDay: row.maxHoursPerDay,
    maxOpenReservations: row.maxOpenReservations,
    reservationSlotMinutes: row.reservationSlotMinutes,
    communitySeatCap: row.communitySeatCap,
    makerMonthlyCents: row.makerMonthlyCents,
    patronScholarshipSurchargeCents: row.patronScholarshipSurchargeCents,
    scholarshipFundBalanceCents: row.scholarshipFundBalanceCents,
    scholarshipSeatsAwarded: row.scholarshipSeatsAwarded,
    showPhase3Tiers: row.showPhase3Tiers,
    defaultInstructorId: row.defaultInstructorId ?? null,
    defaultClassCapacity: row.defaultClassCapacity ?? 8,
    updatedAt: toIsoRequired(row.updatedAt),
  };
}

function mapUser(row: {
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
    isTeacher: Boolean(
      (row as { isTeacher?: boolean }).isTeacher,
    ),
    profileComplete: row.profileComplete,
    createdAt: toIsoRequired(row.createdAt),
    updatedAt: toIsoRequired(row.updatedAt),
    deletedAt: toIso(row.deletedAt),
  };
  if (row.phone) user.phone = row.phone;
  if (row.billingInterval != null) {
    user.billingInterval = row.billingInterval as BillingInterval;
  }
  if (row.householdPrimaryUserId != null) {
    user.householdPrimaryUserId = row.householdPrimaryUserId;
  }
  if (row.dayPassCreditExpiresAt) {
    user.dayPassCreditExpiresAt = toIsoRequired(row.dayPassCreditExpiresAt);
  }
  if (row.scholarshipExpiresAt) {
    user.scholarshipExpiresAt = toIsoRequired(row.scholarshipExpiresAt);
  }
  if (row.emergencyContactName) {
    user.emergencyContactName = row.emergencyContactName;
  }
  if (row.emergencyContactPhone) {
    user.emergencyContactPhone = row.emergencyContactPhone;
  }
  if (row.emergencyContactRelation) {
    user.emergencyContactRelation = row.emergencyContactRelation;
  }
  if (row.notes) user._notes = row.notes;
  return user;
}

/**
 * Load all domain tables into a MockFixtureBundle.
 * Auth Account/Session/VerificationToken are intentionally ignored.
 */
export async function loadBundleFromPrisma(): Promise<MockFixtureBundle> {
  // Split Promise.all batches so TS keeps tuple inference (large arrays widen to any[]).
  const [users, badges, certifications, userCertifications, machines] =
    await Promise.all([
      prisma.user.findMany(),
      prisma.badge.findMany(),
      prisma.certification.findMany(),
      prisma.userCertification.findMany(),
      prisma.machine.findMany(),
    ]);
  const [
    reservations,
    maintenanceBlocks,
    usageSessions,
    accessLogs,
    classSessions,
  ] = await Promise.all([
    prisma.reservation.findMany(),
    prisma.maintenanceBlock.findMany(),
    prisma.usageSession.findMany(),
    prisma.accessLog.findMany(),
    prisma.classSession.findMany(),
  ]);
  const [bookings, learningModules, lessons, questions, lessonProgress] =
    await Promise.all([
      prisma.booking.findMany(),
      prisma.learningModule.findMany(),
      prisma.lesson.findMany(),
      prisma.question.findMany(),
      prisma.lessonProgress.findMany(),
    ]);
  const [
    lessonVideos,
    videoWatches,
    classInterestBoards,
    classInterestSignups,
    bountyRows,
  ] =
    await Promise.all([
      prismaLoose.lessonVideo?.findMany?.() ?? Promise.resolve([]),
      prismaLoose.videoWatch?.findMany?.() ?? Promise.resolve([]),
      prismaLoose.classInterestBoard?.findMany?.() ?? Promise.resolve([]),
      prismaLoose.classInterestSignup?.findMany?.() ?? Promise.resolve([]),
      prismaLoose.bounty?.findMany?.() ?? Promise.resolve([]),
    ]);
  const [
    quizAttempts,
    volunteerRoles,
    volunteerInterests,
    contentPages,
    waiverSignatures,
  ] = await Promise.all([
    prisma.quizAttempt.findMany(),
    prisma.volunteerRole.findMany(),
    prisma.volunteerInterest.findMany(),
    prisma.contentPage.findMany(),
    prisma.waiverSignature.findMany(),
  ]);
  const [policyAcknowledgements, auditEvents, membershipProducts, settingsRow] =
    await Promise.all([
      prisma.policyAcknowledgement.findMany(),
      prisma.auditEvent.findMany(),
      prisma.membershipProduct.findMany(),
      prisma.orgSettings.findUnique({ where: { id: "default" } }),
    ]);
  const creditLedgerRows =
    (await prismaLoose.creditLedgerEntry?.findMany?.()) ?? [];
  const [
    inventoryAreaRows,
    areaStewardRows,
    inventoryItemRows,
    itemPhotoRows,
    itemEventRows,
  ] = await Promise.all([
    prismaLoose.inventoryArea?.findMany?.() ?? Promise.resolve([]),
    prismaLoose.areaSteward?.findMany?.() ?? Promise.resolve([]),
    prismaLoose.inventoryItem?.findMany?.() ?? Promise.resolve([]),
    prismaLoose.itemPhoto?.findMany?.() ?? Promise.resolve([]),
    prismaLoose.itemEvent?.findMany?.() ?? Promise.resolve([]),
  ]);

  if (!settingsRow) {
    throw new Error(
      'OrgSettings row id="default" is missing. Run `npx prisma db seed` first.',
    );
  }

  return {
    users: users.map(mapUser),
    badges: badges.map(
      (b): Badge => ({
        id: b.id,
        uid: b.uid,
        label: b.label ?? undefined,
        userId: b.userId,
        active: b.active,
        createdAt: toIsoRequired(b.createdAt),
        updatedAt: toIsoRequired(b.updatedAt),
        deletedAt: toIso(b.deletedAt),
      }),
    ),
    certifications: certifications.map(
      (c): Certification => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        knowledgeOnly: c.knowledgeOnly,
        requiresCertificationIds: parseJsonArray(c.requiresCertificationIds),
        expiryMonths: c.expiryMonths,
        sortOrder: c.sortOrder,
        active: c.active,
        createdAt: toIsoRequired(c.createdAt),
        updatedAt: toIsoRequired(c.updatedAt),
        deletedAt: toIso(c.deletedAt),
      }),
    ),
    userCertifications: userCertifications.map(
      (uc): UserCertification => ({
        id: uc.id,
        userId: uc.userId,
        certificationId: uc.certificationId,
        status: uc.status as UserCertification["status"],
        knowledgePassedAt: toIso(uc.knowledgePassedAt),
        checkedOffAt: toIso(uc.checkedOffAt),
        checkedOffById: uc.checkedOffById,
        expiresAt: toIso(uc.expiresAt),
        revokedAt: toIso(uc.revokedAt),
        revokedById: uc.revokedById,
        revokeReason: uc.revokeReason,
        createdAt: toIsoRequired(uc.createdAt),
        updatedAt: toIsoRequired(uc.updatedAt),
        deletedAt: toIso(uc.deletedAt),
      }),
    ),
    machines: machines.map(
      (m): Machine => ({
        id: m.id,
        name: m.name,
        area: m.area as MachineArea,
        requiredCertificationIds: parseJsonArray(m.requiredCertificationIds),
        readerKey: m.readerKey,
        active: m.active,
        reservationRecommended: m.reservationRecommended,
        reservationRequired: m.reservationRequired,
        attendedOperationRequired: col(m, "attendedOperationRequired", false),
        locationLabel: m.locationLabel,
        gettingStartedVideoUrl: m.gettingStartedVideoUrl,
        maxReservationHours: col(m, "maxReservationHours", null) as
          | number
          | null,
        hourlyRateCents: col(m, "hourlyRateCents", null) as number | null,
        sortOrder: m.sortOrder,
        createdAt: toIsoRequired(m.createdAt),
        updatedAt: toIsoRequired(m.updatedAt),
        deletedAt: toIso(m.deletedAt),
      }),
    ),
    reservations: reservations.map(
      (r): Reservation => ({
        id: r.id,
        userId: r.userId,
        machineId: r.machineId,
        startsAt: toIsoRequired(r.startsAt),
        endsAt: toIsoRequired(r.endsAt),
        status: r.status as Reservation["status"],
        createdById: r.createdById,
        cancelledAt: toIso(r.cancelledAt),
        cancelReason: r.cancelReason,
        createdAt: toIsoRequired(r.createdAt),
        updatedAt: toIsoRequired(r.updatedAt),
        deletedAt: toIso(r.deletedAt),
      }),
    ),
    maintenanceBlocks: maintenanceBlocks.map(
      (m): MaintenanceBlock => ({
        id: m.id,
        machineId: m.machineId,
        startsAt: toIsoRequired(m.startsAt),
        endsAt: toIsoRequired(m.endsAt),
        reason: m.reason,
        createdById: m.createdById,
        createdAt: toIsoRequired(m.createdAt),
        updatedAt: toIsoRequired(m.updatedAt),
        deletedAt: toIso(m.deletedAt),
      }),
    ),
    // Tool champion terms live in mock fixtures for now; Prisma table is a follow-up.
    toolChampionTerms: [],
    usageSessions: usageSessions.map(
      (s): UsageSession => ({
        id: s.id,
        userId: s.userId,
        machineId: s.machineId,
        badgeId: s.badgeId,
        startedAt: toIsoRequired(s.startedAt),
        endedAt: toIso(s.endedAt),
        reservationId: s.reservationId,
        endedBy: s.endedBy as UsageSession["endedBy"],
        createdAt: toIsoRequired(s.createdAt),
        updatedAt: toIsoRequired(s.updatedAt),
        deletedAt: toIso(s.deletedAt),
      }),
    ),
    accessLogs: accessLogs.map(
      (l): AccessLog => ({
        id: l.id,
        readerKey: l.readerKey,
        machineId: l.machineId,
        badgeUid: l.badgeUid,
        userId: l.userId,
        allow: l.allow,
        reason: l.reason as AccessLog["reason"],
        reservationNotice: l.reservationNotice,
        sessionId: l.sessionId,
        requestedAt: toIsoRequired(l.requestedAt),
        createdAt: toIsoRequired(l.createdAt),
        updatedAt: toIsoRequired(l.updatedAt),
        deletedAt: toIso(l.deletedAt),
      }),
    ),
    classSessions: classSessions.map(
      (c): ClassSession => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        descriptionSlug: c.descriptionSlug,
        category: c.category as ClassSession["category"],
        instructorId: c.instructorId,
        startsAt: toIsoRequired(c.startsAt),
        endsAt: toIsoRequired(c.endsAt),
        capacity: c.capacity,
        priceCents: c.priceCents,
        zeffyUrl: c.zeffyUrl,
        zeffyCampaignId: c.zeffyCampaignId,
        zeffyOccurrenceId: c.zeffyOccurrenceId,
        source: (c.source as ClassSession["source"]) ?? "admin",
        googleEventId: c.googleEventId,
        googleCalendarId: c.googleCalendarId,
        syncedAt: toIso(c.syncedAt),
        cancelledAt: toIso(c.cancelledAt),
        staffEditedFields: parseJsonArray(c.staffEditedFields),
        prerequisiteCertificationIds: parseJsonArray(
          c.prerequisiteCertificationIds,
        ),
        location: c.location,
        cancellationCutoffHours: c.cancellationCutoffHours,
        published: c.published,
        createdAt: toIsoRequired(c.createdAt),
        updatedAt: toIsoRequired(c.updatedAt),
        deletedAt: toIso(c.deletedAt),
      }),
    ),
    bookings: bookings.map(
      (b): Booking => ({
        id: b.id,
        classSessionId: b.classSessionId,
        userId: b.userId,
        status: b.status as Booking["status"],
        waitlistPosition: b.waitlistPosition,
        paidAt: toIso(b.paidAt),
        paidMarkedById: b.paidMarkedById,
        zeffyPaymentId: b.zeffyPaymentId,
        paymentHoldExpiresAt: toIso(b.paymentHoldExpiresAt),
        cancelledAt: toIso(b.cancelledAt),
        attendedAt: toIso(b.attendedAt),
        createdAt: toIsoRequired(b.createdAt),
        updatedAt: toIsoRequired(b.updatedAt),
        deletedAt: toIso(b.deletedAt),
      }),
    ),
    classInterestBoards: (
      classInterestBoards as Array<Record<string, unknown>>
    ).map(
      (b): ClassInterestBoard => ({
        id: String(b.id),
        title: String(b.title),
        summary: String(b.summary),
        category: b.category as ClassInterestBoard["category"],
        status: b.status as ClassInterestBoard["status"],
        threshold: Number(b.threshold ?? 8),
        proposedByUserId: (b.proposedByUserId as string) ?? null,
        contactName: String(b.contactName),
        contactEmail: String(b.contactEmail),
        instructorHintUserId: (b.instructorHintUserId as string) ?? null,
        opensAt: toIso(b.opensAt as Date | null),
        closesAt: toIso(b.closesAt as Date | null),
        scheduledClassSessionId: (b.scheduledClassSessionId as string) ?? null,
        priorityBookingEndsAt: toIso(b.priorityBookingEndsAt as Date | null),
        resuggestedFromId: (b.resuggestedFromId as string) ?? null,
        reviewedById: (b.reviewedById as string) ?? null,
        reviewedAt: toIso(b.reviewedAt as Date | null),
        staffNotes: (b.staffNotes as string) ?? null,
        createdAt: toIsoRequired(b.createdAt as Date),
        updatedAt: toIsoRequired(b.updatedAt as Date),
        deletedAt: toIso(b.deletedAt as Date | null),
      }),
    ),
    classInterestSignups: (
      classInterestSignups as Array<Record<string, unknown>>
    ).map(
      (s): ClassInterestSignup => ({
        id: String(s.id),
        boardId: String(s.boardId),
        userId: (s.userId as string) ?? null,
        email: String(s.email),
        displayName: String(s.displayName),
        createdAt: toIsoRequired(s.createdAt as Date),
        updatedAt: toIsoRequired(s.updatedAt as Date),
        deletedAt: toIso(s.deletedAt as Date | null),
      }),
    ),
    learningModules: learningModules.map(
      (m): LearningModule => ({
        id: m.id,
        slug: m.slug,
        title: m.title,
        summary: m.summary,
        certificationId: m.certificationId,
        knowledgeOnly: m.knowledgeOnly,
        published: m.published,
        equipmentStatus: col(
          m,
          "equipmentStatus",
          "confirmed",
        ) as EquipmentStatus,
        passThresholdPercent: m.passThresholdPercent,
        attemptLimit: m.attemptLimit,
        sortOrder: m.sortOrder,
        createdAt: toIsoRequired(m.createdAt),
        updatedAt: toIsoRequired(m.updatedAt),
        deletedAt: toIso(m.deletedAt),
      }),
    ),
    lessons: lessons.map(
      (l): Lesson => ({
        id: l.id,
        moduleId: l.moduleId,
        slug: l.slug,
        title: l.title,
        contentSlug: l.contentSlug,
        sortOrder: l.sortOrder,
        estimatedMinutes: l.estimatedMinutes,
        gap: col(l, "gap", false),
        createdAt: toIsoRequired(l.createdAt),
        updatedAt: toIsoRequired(l.updatedAt),
        deletedAt: toIso(l.deletedAt),
      }),
    ),
    lessonVideos: (
      lessonVideos as Array<Record<string, unknown>>
    ).map((v): LessonVideo => {
      return {
        id: String(v.id),
        lessonId: String(v.lessonId),
        order: Number(v.order ?? 0),
        provider: (v.provider as VideoProvider) ?? "youtube",
        youtubeId: String(v.youtubeId ?? ""),
        url: String(v.url ?? ""),
        title: String(v.title ?? ""),
        channel: String(v.channel ?? ""),
        role: (v.role as VideoRole) ?? "primary",
        condition: (v.condition as string | null | undefined) ?? null,
        durationSeconds:
          (v.durationSeconds as number | null | undefined) ?? null,
        verifiedAt: toIso(v.verifiedAt as Date | null | undefined),
        staffReviewed: Boolean(v.staffReviewed),
        notes: (v.notes as string | null | undefined) ?? null,
        createdAt: toIsoRequired(v.createdAt as Date),
        updatedAt: toIsoRequired(v.updatedAt as Date),
        deletedAt: toIso(v.deletedAt as Date | null | undefined),
      };
    }),
    questions: questions.map((q): Question => {
      const correctIndexes = parseJsonArray<number>(
        col(q, "correctIndexes", null as string | null),
      );
      return {
        id: q.id,
        moduleId: q.moduleId,
        prompt: q.prompt,
        choices: parseJsonArray(q.choices),
        correctIndex: q.correctIndex,
        correctIndexes:
          correctIndexes.length > 0 ? correctIndexes : [q.correctIndex],
        explanation: q.explanation ?? undefined,
        active: q.active,
        safetyCritical: col(q, "safetyCritical", false),
        source: col(q, "source", "video") as QuestionSource,
        sourceVideoId: col(q, "sourceVideoId", null as string | null),
        verifyAgainstVideo: col(q, "verifyAgainstVideo", true),
        answerPending: col(q, "answerPending", false),
        createdAt: toIsoRequired(q.createdAt),
        updatedAt: toIsoRequired(q.updatedAt),
        deletedAt: toIso(q.deletedAt),
      };
    }),
    lessonProgress: lessonProgress.map(
      (p): LessonProgress => ({
        id: p.id,
        userId: p.userId,
        lessonId: p.lessonId,
        completedAt: toIsoRequired(p.completedAt),
        createdAt: toIsoRequired(p.createdAt),
        updatedAt: toIsoRequired(p.updatedAt),
        deletedAt: toIso(p.deletedAt),
      }),
    ),
    videoWatches: (
      videoWatches as Array<Record<string, unknown>>
    ).map((w): VideoWatch => {
      return {
        id: String(w.id),
        userId: String(w.userId),
        videoId: String(w.videoId),
        watchedAt: toIsoRequired(w.watchedAt as Date),
        createdAt: toIsoRequired(w.createdAt as Date),
        updatedAt: toIsoRequired(w.updatedAt as Date),
        deletedAt: toIso(w.deletedAt as Date | null | undefined),
      };
    }),
    quizAttempts: quizAttempts.map(
      (a): QuizAttempt => ({
        id: a.id,
        userId: a.userId,
        moduleId: a.moduleId,
        questionIds: parseJsonArray(a.questionIds),
        answers: parseJsonArray<number | number[] | null>(a.answers),
        scorePercent: a.scorePercent,
        passed: a.passed,
        thresholdMet: col(a, "thresholdMet", false),
        safetyCriticalMissedIds: parseJsonArray(
          col(a, "safetyCriticalMissedIds", null as string | null),
        ),
        startedAt: toIsoRequired(a.startedAt),
        submittedAt: toIsoRequired(a.submittedAt),
        createdAt: toIsoRequired(a.createdAt),
        updatedAt: toIsoRequired(a.updatedAt),
        deletedAt: toIso(a.deletedAt),
      }),
    ),
    volunteerRoles: volunteerRoles.map(
      (r): VolunteerRole => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        contentSlug: r.contentSlug,
        active: r.active,
        sortOrder: r.sortOrder,
        createdAt: toIsoRequired(r.createdAt),
        updatedAt: toIsoRequired(r.updatedAt),
        deletedAt: toIso(r.deletedAt),
      }),
    ),
    volunteerInterests: volunteerInterests.map(
      (v): VolunteerInterest => ({
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone ?? undefined,
        roleId: v.roleId,
        message: v.message,
        status: v.status as VolunteerInterest["status"],
        userId: v.userId,
        reviewedById: v.reviewedById,
        reviewedAt: toIso(v.reviewedAt),
        notes: v.notes,
        createdAt: toIsoRequired(v.createdAt),
        updatedAt: toIsoRequired(v.updatedAt),
        deletedAt: toIso(v.deletedAt),
      }),
    ),
    bounties: (bountyRows as Array<Record<string, unknown>>).map(
      (b): Bounty => ({
        id: String(b.id),
        title: String(b.title),
        description: String(b.description),
        requesterName: String(b.requesterName),
        requesterEmail: String(b.requesterEmail),
        businessName: (b.businessName as string | null) ?? null,
        userId: (b.userId as string | null) ?? null,
        status: b.status as BountyStatus,
        claimedByUserId: (b.claimedByUserId as string | null) ?? null,
        claimedAt: toIso(b.claimedAt as Date | null),
        completedAt: toIso(b.completedAt as Date | null),
        createdAt: toIsoRequired(b.createdAt as Date),
        updatedAt: toIsoRequired(b.updatedAt as Date),
        deletedAt: toIso(b.deletedAt as Date | null),
      }),
    ),
    contentPages: contentPages.map(
      (p): ContentPage => ({
        id: p.id,
        notionId: p.notionId ?? undefined,
        googleFileId: p.googleFileId ?? undefined,
        slug: p.slug,
        title: p.title,
        html: p.html,
        markdownPath: p.markdownPath ?? undefined,
        category: p.category as ContentPage["category"],
        version: p.version,
        syncedAt: toIso(p.syncedAt) ?? undefined,
        published: p.published,
        createdAt: toIsoRequired(p.createdAt),
        updatedAt: toIsoRequired(p.updatedAt),
        deletedAt: toIso(p.deletedAt),
      }),
    ),
    waiverSignatures: waiverSignatures.map(
      (w): WaiverSignature => ({
        id: w.id,
        userId: w.userId,
        version: w.version,
        signedAt: toIsoRequired(w.signedAt),
        fullNameTyped: w.fullNameTyped,
        ip: w.ip,
        userAgent: w.userAgent ?? undefined,
        createdAt: toIsoRequired(w.createdAt),
        updatedAt: toIsoRequired(w.updatedAt),
        deletedAt: toIso(w.deletedAt),
      }),
    ),
    policyAcknowledgements: policyAcknowledgements.map(
      (a): PolicyAcknowledgement => ({
        id: a.id,
        userId: a.userId,
        policySlug: a.policySlug,
        version: a.version,
        acknowledgedAt: toIsoRequired(a.acknowledgedAt),
        createdAt: toIsoRequired(a.createdAt),
        updatedAt: toIsoRequired(a.updatedAt),
        deletedAt: toIso(a.deletedAt),
      }),
    ),
    auditEvents: auditEvents.map(
      (e): AuditEvent => ({
        id: e.id,
        action: e.action as AuditEvent["action"],
        actorId: e.actorId,
        subjectUserId: e.subjectUserId,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: parseJsonObject(e.metadata),
        occurredAt: toIsoRequired(e.occurredAt),
        createdAt: toIsoRequired(e.createdAt),
        updatedAt: toIsoRequired(e.updatedAt),
        deletedAt: toIso(e.deletedAt),
      }),
    ),
    membershipProducts: membershipProducts.map(
      (p): MembershipProduct => ({
        id: p.id,
        tier: p.tier as MembershipTier,
        name: p.name,
        summary: p.summary,
        priceCents: p.priceCents,
        billingInterval: p.billingInterval as BillingInterval,
        annualPriceCents: p.annualPriceCents,
        shopAccess: p.shopAccess,
        phase: p.phase as MembershipPhase,
        visibleOnJoin: p.visibleOnJoin,
        joinable: p.joinable,
        highlight: p.highlight,
        sortOrder: p.sortOrder,
        isAddOn: p.isAddOn,
        cappedSeats: p.cappedSeats,
        zeffyCampaignId: p.zeffyCampaignId ?? null,
        zeffyRateId: p.zeffyRateId ?? null,
        zeffyUrl: p.zeffyUrl ?? null,
        creditGrantCents: col(p, "creditGrantCents", 0) as number,
        createdAt: toIsoRequired(p.createdAt),
        updatedAt: toIsoRequired(p.updatedAt),
        deletedAt: toIso(p.deletedAt),
      }),
    ),
    settings: mapOrgSettings(settingsRow),
    promoSlides: loadFixtures().promoSlides,
    displayConfig: loadFixtures().displayConfig,
    // Public staff/instructor directory is fixture-backed (same as promos).
    people: loadFixtures().people,
    creditLedgerEntries: (
      creditLedgerRows as Array<Record<string, unknown>>
    ).map(
      (e): CreditLedgerEntry => ({
        id: String(e.id),
        userId: String(e.userId),
        kind: e.kind as CreditLedgerEntry["kind"],
        amountCents: Number(e.amountCents),
        sourcePaymentId: (e.sourcePaymentId as string | null) ?? null,
        usageSessionId: (e.usageSessionId as string | null) ?? null,
        workstationSessionId:
          (e.workstationSessionId as string | null) ?? null,
        equipmentJobId: (e.equipmentJobId as string | null) ?? null,
        bookingId: (e.bookingId as string | null) ?? null,
        actorId: (e.actorId as string | null) ?? null,
        note: (e.note as string | null) ?? null,
        occurredAt: toIsoRequired(e.occurredAt as Date),
        createdAt: toIsoRequired(e.createdAt as Date),
        updatedAt: toIsoRequired(e.updatedAt as Date),
        deletedAt: toIso(e.deletedAt as Date | null),
      }),
    ),
    inventoryAreas: (inventoryAreaRows as Array<Record<string, unknown>>).map(
      (a): InventoryArea => ({
        id: String(a.id),
        slug: String(a.slug),
        name: String(a.name),
        sortOrder: Number(a.sortOrder ?? 0),
        active: Boolean(a.active ?? true),
        createdAt: toIsoRequired(a.createdAt as Date),
        updatedAt: toIsoRequired(a.updatedAt as Date),
      }),
    ),
    areaStewards: (areaStewardRows as Array<Record<string, unknown>>).map(
      (s): AreaSteward => ({
        id: String(s.id),
        areaId: String(s.areaId),
        userId: String(s.userId),
        createdAt: toIsoRequired(s.createdAt as Date),
      }),
    ),
    inventoryItems: (inventoryItemRows as Array<Record<string, unknown>>).map(
      (i): InventoryItem => ({
        id: String(i.id),
        tagNumber: Number(i.tagNumber),
        name: String(i.name),
        model: (i.model as string | null) ?? null,
        manufacturer: (i.manufacturer as string | null) ?? null,
        serialNumber: (i.serialNumber as string | null) ?? null,
        noSerial: Boolean(i.noSerial),
        quantity: Number(i.quantity ?? 1),
        isMachine: Boolean(i.isMachine),
        areaId: (i.areaId as string | null) ?? null,
        location: (i.location as string | null) ?? null,
        condition: i.condition as ItemCondition,
        status: i.status as ItemStatus,
        notes: (i.notes as string | null) ?? null,
        reviewStatus: i.reviewStatus as ReviewStatus,
        reviewedById: (i.reviewedById as string | null) ?? null,
        reviewedAt: toIso(i.reviewedAt as Date | null),
        rejectReason: (i.rejectReason as string | null) ?? null,
        acquisitionSource: (i.acquisitionSource as AcquisitionSource | null) ?? null,
        acquiredAt: toIso(i.acquiredAt as Date | null),
        donorName: (i.donorName as string | null) ?? null,
        estimatedValue:
          i.estimatedValue == null ? null : Number(i.estimatedValue),
        labelPrintedAt: toIso(i.labelPrintedAt as Date | null),
        retiredAt: toIso(i.retiredAt as Date | null),
        retiredReason: (i.retiredReason as string | null) ?? null,
        createdById: String(i.createdById),
        createdAt: toIsoRequired(i.createdAt as Date),
        updatedAt: toIsoRequired(i.updatedAt as Date),
      }),
    ),
    itemPhotos: (itemPhotoRows as Array<Record<string, unknown>>).map(
      (p): ItemPhoto => ({
        id: String(p.id),
        itemId: (p.itemId as string | null) ?? null,
        kind: p.kind as PhotoKind,
        storageKey: String(p.storageKey),
        thumbKey: (p.thumbKey as string | null) ?? null,
        mimeType: String(p.mimeType),
        width: (p.width as number | null) ?? null,
        height: (p.height as number | null) ?? null,
        uploadedById: String(p.uploadedById),
        createdAt: toIsoRequired(p.createdAt as Date),
      }),
    ),
    itemEvents: (itemEventRows as Array<Record<string, unknown>>).map(
      (e): ItemEvent => ({
        id: String(e.id),
        itemId: String(e.itemId),
        type: e.type as ItemEventType,
        actorId: String(e.actorId),
        changes: parseJsonObject(e.changes as string | null) as ItemEvent["changes"],
        note: (e.note as string | null) ?? null,
        photoId: (e.photoId as string | null) ?? null,
        createdAt: toIsoRequired(e.createdAt as Date),
      }),
    ),
    // Wishlist catalog + purchase reports stay fixture/mock-backed (no Prisma table).
    wishlistZones: loadFixtures().wishlistZones,
    wishlistItems: loadFixtures().wishlistItems,
    wishlistPurchaseReports: loadFixtures().wishlistPurchaseReports,
  };
}

/**
 * Incremental save of an in-memory fixture bundle.
 * Does not wipe tables. Does not touch Workstation* rows, EquipmentJob,
 * or User.kioskPinHash.
 *
 * When `previous` is passed, only mutated rows are written, and a row that was
 * already in `previous` gets only the columns this request changed. Another
 * request may have changed the rest since `previous` was loaded.
 * Without `previous`, every row is written with every column.
 */
export async function persistBundleToPrisma(
  bundle: MockFixtureBundle,
  previous?: MockFixtureBundle | null,
): Promise<void> {
  let settingsChanged = true;
  let toWrite = bundle;
  let removed: ReturnType<typeof sliceChangedBundle>["removed"] = {};
  // The delta below only carries changed users, so validate against all of them.
  const knownUserIds = new Set(bundle.users.map((u) => u.id));
  if (previous) {
    const sliced = sliceChangedBundle(previous, bundle);
    if (sliced.empty) return;
    toWrite = sliced.bundle;
    removed = sliced.removed;
    settingsChanged = sliced.settingsChanged;
  }
  const instructorOf = (settings: OrgSettings): string | null =>
    settings.defaultInstructorId && knownUserIds.has(settings.defaultInstructorId)
      ? settings.defaultInstructorId
      : null;

  // D1 rejects interactive prisma.$transaction(async () => ...).
  // These upserts run one after another on the root client.
  const db = prismaTx(prisma as unknown as Prisma.TransactionClient);
  const now = new Date();

  const loadedRows = (key: ArrayKey): Map<string, { id: string }> =>
    new Map(
      ((previous?.[key] ?? []) as { id: string }[]).map((row) => [row.id, row]),
    );

  const saveTable = async (spec: PersistTable): Promise<void> => {
    const rows = (toWrite[spec.key] ?? []) as { id: string }[];
    if (rows.length === 0) return;
    if (spec.onlyIf && !db[spec.onlyIf]) return;
    const loaded = loadedRows(spec.key);
    for (const row of rows) {
      const create = spec.toRow(row as never, now);
      const { id, ...columns } = create;
      const before = loaded.get(id);
      const update = before
        ? changedColumns(spec.toRow(before as never, now), create)
        : columns;
      if (Object.keys(update).length === 0) continue;
      await db[spec.model].upsert({ where: { id }, create, update });
    }
  };

  // Parents first — users without household links
  await saveTable(USERS_TABLE);

    await upsertManyIfAny(
      (args) => tx.contentPage.upsert(args),
      bundle.contentPages.map((p) => ({
        id: p.id,
        notionId: p.notionId ?? null,
        googleFileId: p.googleFileId ?? null,
        slug: p.slug,
        title: p.title,
        html: p.html,
        markdownPath: p.markdownPath ?? null,
        category: p.category,
        version: p.version,
        syncedAt: asDate(p.syncedAt),
        published: p.published,
        createdAt: asDate(p.createdAt) ?? new Date(),
        updatedAt: asDate(p.updatedAt) ?? new Date(),
        deletedAt: asDate(p.deletedAt),
      })),
    );

    if (settingsChanged) await tx.orgSettings.upsert({
      where: { id: "default" },
      // Cast: client may lag schema until `prisma generate`.
      create: {
        id: "default",
        orgName: bundle.settings.orgName,
        paymentUrl: bundle.settings.paymentUrl,
        donationUrl: bundle.settings.donationUrl,
        scholarshipDonationUrl: bundle.settings.scholarshipDonationUrl,
        contactEmail: bundle.settings.contactEmail,
        hoursContentSlug: bundle.settings.hoursContentSlug,
        currentWaiverVersion: bundle.settings.currentWaiverVersion,
        memberExpectationsPolicySlug:
          bundle.settings.memberExpectationsPolicySlug,
        quizPassThresholdPercent: bundle.settings.quizPassThresholdPercent,
        quizAttemptLimit: bundle.settings.quizAttemptLimit,
        quizQuestionCount: bundle.settings.quizQuestionCount,
        requireSafetyCriticalAll:
          bundle.settings.requireSafetyCriticalAll ?? true,
        classCancellationCutoffHours:
          bundle.settings.classCancellationCutoffHours,
        paymentHoldHours: bundle.settings.paymentHoldHours,
        reservationHorizonDays: bundle.settings.reservationHorizonDays,
        maxHoursPerDay: bundle.settings.maxHoursPerDay,
        maxOpenReservations: bundle.settings.maxOpenReservations,
        reservationSlotMinutes: bundle.settings.reservationSlotMinutes,
        communitySeatCap: bundle.settings.communitySeatCap,
        makerMonthlyCents: bundle.settings.makerMonthlyCents,
        patronScholarshipSurchargeCents:
          bundle.settings.patronScholarshipSurchargeCents,
        scholarshipFundBalanceCents:
          bundle.settings.scholarshipFundBalanceCents,
        scholarshipSeatsAwarded: bundle.settings.scholarshipSeatsAwarded,
        showPhase3Tiers: bundle.settings.showPhase3Tiers,
        defaultInstructorId,
        defaultClassCapacity: bundle.settings.defaultClassCapacity ?? 8,
        updatedAt: asDate(bundle.settings.updatedAt) ?? new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      update: {
        orgName: bundle.settings.orgName,
        paymentUrl: bundle.settings.paymentUrl,
        donationUrl: bundle.settings.donationUrl,
        scholarshipDonationUrl: bundle.settings.scholarshipDonationUrl,
        contactEmail: bundle.settings.contactEmail,
        hoursContentSlug: bundle.settings.hoursContentSlug,
        currentWaiverVersion: bundle.settings.currentWaiverVersion,
        memberExpectationsPolicySlug:
          bundle.settings.memberExpectationsPolicySlug,
        quizPassThresholdPercent: bundle.settings.quizPassThresholdPercent,
        quizAttemptLimit: bundle.settings.quizAttemptLimit,
        quizQuestionCount: bundle.settings.quizQuestionCount,
        requireSafetyCriticalAll:
          bundle.settings.requireSafetyCriticalAll ?? true,
        classCancellationCutoffHours:
          bundle.settings.classCancellationCutoffHours,
        paymentHoldHours: bundle.settings.paymentHoldHours,
        reservationHorizonDays: bundle.settings.reservationHorizonDays,
        maxHoursPerDay: bundle.settings.maxHoursPerDay,
        maxOpenReservations: bundle.settings.maxOpenReservations,
        reservationSlotMinutes: bundle.settings.reservationSlotMinutes,
        communitySeatCap: bundle.settings.communitySeatCap,
        makerMonthlyCents: bundle.settings.makerMonthlyCents,
        patronScholarshipSurchargeCents:
          bundle.settings.patronScholarshipSurchargeCents,
        scholarshipFundBalanceCents:
          bundle.settings.scholarshipFundBalanceCents,
        scholarshipSeatsAwarded: bundle.settings.scholarshipSeatsAwarded,
        showPhase3Tiers: bundle.settings.showPhase3Tiers,
        defaultInstructorId,
        defaultClassCapacity: bundle.settings.defaultClassCapacity ?? 8,
        updatedAt: asDate(bundle.settings.updatedAt) ?? new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  }

  if (settingsChanged) {
    const create = settingsRow(bundle.settings, instructorOf(bundle.settings), now);
    const update = previous
      ? changedColumns(
          settingsRow(previous.settings, instructorOf(previous.settings), now),
          create,
        )
      : create;
    if (Object.keys(update).length > 0) {
      await db.orgSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...create },
        update,
      });
    }
  }

  for (const spec of PERSIST_TABLES) {
    await saveTable(spec);
  }

  // Only these collections are hard-deleted by the mock; everything else
  // uses deletedAt. Children before parents (VideoWatch -> LessonVideo).
  const hardDeletes: Array<[keyof typeof removed, string]> = [
    ["videoWatches", "videoWatch"],
    ["lessonVideos", "lessonVideo"],
    ["questions", "question"],
    ["itemPhotos", "itemPhoto"],
  ];
  for (const [key, model] of hardDeletes) {
    const ids = removed[key];
    if (ids && ids.length > 0 && db[model]) {
      await db[model].deleteMany({ where: { id: { in: ids } } });
    }
  }
}

const BUNDLE_TTL_MS = 5_000;
let bundleCache: { at: number; seq: number; bundle: MockFixtureBundle } | null =
  null;
let bundleInflight: Promise<MockFixtureBundle> | null = null;
/** Bumped by every save. A load that began before the bump may predate it. */
let cacheEpoch = 0;
let loadSeq = 0;

/**
 * What the last createPrismaDataProvider call cost. "fresh" is a load a write
 * forced although a cached or in-flight bundle would have served a read.
 */
export type BundleLoad = "bundle" | "cache" | "fresh";
let lastBundleLoad: BundleLoad = "bundle";

export function takeBundleLoad(): BundleLoad {
  return lastBundleLoad;
}

/** Forget the cached bundle and any load that started before this call. */
export function invalidateBundleCache(): void {
  cacheEpoch += 1;
  bundleCache = null;
  bundleInflight = null;
}

function createPersistingProxy(mock: MockDataProvider): DataProvider {
  let snapshot = cloneBundle(mock.getState());
  return new Proxy(mock, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      const name = String(prop);
      return async (...args: unknown[]) => {
        const result = await (
          value as (...a: unknown[]) => Promise<unknown>
        ).apply(target, args);
        if (name === "setMyKioskPin" || name === "adminResetMemberKioskPin") {
          const memberId = String(args[0]);
          const pin =
            name === "setMyKioskPin"
              ? String(args[1])
              : (result as { temporaryPin: string }).temporaryPin;
          const { hashKioskPin } = await import("@/lib/workstation/pin");
          await prisma.user.update({
            where: { id: memberId },
            data: {
              kioskPinHash: await hashKioskPin(pin),
              kioskPinMustChange: name === "adminResetMemberKioskPin",
            },
          });
          if (name === "adminResetMemberKioskPin") {
            await prisma.auditEvent.create({
              data: {
                id: `audit_${crypto.randomUUID().slice(0, 8)}`,
                action: "member.pin_reset",
                actorId: String(args[1]),
                subjectUserId: memberId,
                entityType: "user",
                entityId: memberId,
                metadata: JSON.stringify({ mustChange: true }),
                occurredAt: new Date(),
              },
            });
          }
          return result;
        }
        if (shouldPersistAfter(name)) {
          const next = target.getState();
          try {
            await persistBundleToPrisma(next, snapshot);
          } finally {
            // Also after a failure: some rows may already be written.
            invalidateBundleCache();
          }
          snapshot = cloneBundle(next);
        }
        return result;
      };
    },
  }) as unknown as DataProvider;
}

/** One full read of the database. The newest finished load fills the cache. */
function startBundleLoad(): Promise<MockFixtureBundle> {
  const epoch = cacheEpoch;
  const seq = ++loadSeq;
  const load: Promise<MockFixtureBundle> = loadBundleFromPrisma()
    .then((bundle) => {
      if (epoch === cacheEpoch && (!bundleCache || bundleCache.seq < seq)) {
        bundleCache = { at: Date.now(), seq, bundle };
      }
      return bundle;
    })
    .finally(() => {
      if (bundleInflight === load) bundleInflight = null;
    });
  bundleInflight = load;
  return load;
}

/**
 * Reads reuse a bundle for 5 seconds and join a load already in flight.
 * `fresh` always reads the database again, so the caller sees every save that
 * finished before it asked. Saves drop the cache.
 * TODO(perf): replace this full-bundle load with per-method Prisma queries.
 */
async function loadSharedBundle(fresh: boolean): Promise<MockFixtureBundle> {
  const cached =
    bundleCache && Date.now() - bundleCache.at < BUNDLE_TTL_MS
      ? bundleCache.bundle
      : null;
  if (fresh) {
    lastBundleLoad = cached || bundleInflight ? "fresh" : "bundle";
    return startBundleLoad();
  }
  if (cached) {
    lastBundleLoad = "cache";
    return cached;
  }
  if (bundleInflight) {
    lastBundleLoad = "cache";
    return bundleInflight;
  }
  lastBundleLoad = "bundle";
  return startBundleLoad();
}

/**
 * Prisma-backed DataProvider: load DB → MockDataProvider, persist after writes.
 * Pass `fresh` for a request that is going to write, so its checks and its
 * saved rows start from the current database and not from a cached copy.
 */
export async function createPrismaDataProvider(
  initialUserId?: string | null,
  options: { fresh?: boolean } = {},
): Promise<DataProvider> {
  const bundle = await loadSharedBundle(options.fresh === true);
  const mock = new MockDataProvider(bundle, initialUserId);
  return createPersistingProxy(mock);
}
