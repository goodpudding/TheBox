import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { loadFixtures } from "./load-fixtures";
import { MockDataProvider } from "./mock-provider";
import type { DataProvider } from "./provider";
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

function jsonArr(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function asDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(iso);
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

async function createManyIfAny<T extends object>(
  createMany: (args: { data: T[] }) => Promise<unknown>,
  data: T[],
): Promise<void> {
  if (data.length === 0) return;
  await createMany({ data });
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
        bookingId: (e.bookingId as string | null) ?? null,
        actorId: (e.actorId as string | null) ?? null,
        note: (e.note as string | null) ?? null,
        occurredAt: toIsoRequired(e.occurredAt as Date),
        createdAt: toIsoRequired(e.createdAt as Date),
        updatedAt: toIsoRequired(e.updatedAt as Date),
        deletedAt: toIso(e.deletedAt as Date | null),
      }),
    ),
  };
}

/**
 * Full-replace domain tables from an in-memory fixture bundle.
 * Does not touch Auth Account / Session / VerificationToken rows directly
 * (deleting users may cascade Auth rows — acceptable for Phase 5 seed-sized data).
 */
export async function persistBundleToPrisma(
  bundle: MockFixtureBundle,
): Promise<void> {
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const db = prismaTx(tx);
    // Children first
    if (db.creditLedgerEntry) await db.creditLedgerEntry.deleteMany();
    await db.auditEvent.deleteMany();
    await db.accessLog.deleteMany();
    await db.usageSession.deleteMany();
    if (db.videoWatch) await db.videoWatch.deleteMany();
    await db.lessonProgress.deleteMany();
    await db.quizAttempt.deleteMany();
    await db.question.deleteMany();
    if (db.lessonVideo) await db.lessonVideo.deleteMany();
    await db.lesson.deleteMany();
    await db.booking.deleteMany();
    await db.reservation.deleteMany();
    await db.maintenanceBlock.deleteMany();
    await db.userCertification.deleteMany();
    await db.waiverSignature.deleteMany();
    await db.policyAcknowledgement.deleteMany();
    await db.volunteerInterest.deleteMany();
    if (db.bounty) await db.bounty.deleteMany();
    if (db.classInterestSignup) await db.classInterestSignup.deleteMany();
    if (db.classInterestBoard) await db.classInterestBoard.deleteMany();
    await db.badge.deleteMany();
    await db.classSession.deleteMany();
    await db.learningModule.deleteMany();
    await db.volunteerRole.deleteMany();
    await db.membershipProduct.deleteMany();
    await db.contentPage.deleteMany();
    await db.machine.deleteMany();
    await db.certification.deleteMany();
    await db.user.updateMany({ data: { householdPrimaryUserId: null } });
    await db.user.deleteMany();
    await db.orgSettings.deleteMany();

    // Parents first — users without household links
    await createManyIfAny(
      (args) => db.user.createMany(args),
      bundle.users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        displayName: u.displayName,
        phone: u.phone ?? null,
        role: u.role,
        status: u.status,
        tier: u.tier,
        billingInterval: u.billingInterval ?? null,
        shopAccess: u.shopAccess,
        isTeacher: u.isTeacher ?? false,
        dayPassCreditExpiresAt: asDate(u.dayPassCreditExpiresAt),
        scholarshipExpiresAt: asDate(u.scholarshipExpiresAt),
        emergencyContactName: u.emergencyContactName ?? null,
        emergencyContactPhone: u.emergencyContactPhone ?? null,
        emergencyContactRelation: u.emergencyContactRelation ?? null,
        profileComplete: u.profileComplete,
        notes: u._notes ?? null,
        createdAt: asDate(u.createdAt) ?? new Date(),
        updatedAt: asDate(u.updatedAt) ?? new Date(),
        deletedAt: asDate(u.deletedAt),
      })),
    );

    for (const u of bundle.users) {
      if (u.householdPrimaryUserId) {
        await tx.user.update({
          where: { id: u.id },
          data: { householdPrimaryUserId: u.householdPrimaryUserId },
        });
      }
    }

    await createManyIfAny(
      (args) => tx.certification.createMany(args),
      bundle.certifications.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        description: c.description,
        knowledgeOnly: c.knowledgeOnly,
        requiresCertificationIds: jsonArr(c.requiresCertificationIds),
        expiryMonths: c.expiryMonths,
        sortOrder: c.sortOrder,
        active: c.active,
        createdAt: asDate(c.createdAt) ?? new Date(),
        updatedAt: asDate(c.updatedAt) ?? new Date(),
        deletedAt: asDate(c.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.machine.createMany(args),
      bundle.machines.map((m) =>
        ({
          id: m.id,
          name: m.name,
          area: m.area,
          requiredCertificationIds: jsonArr(m.requiredCertificationIds),
          readerKey: m.readerKey,
          active: m.active,
          reservationRecommended: m.reservationRecommended,
          reservationRequired: m.reservationRequired,
          attendedOperationRequired: m.attendedOperationRequired ?? false,
          locationLabel: m.locationLabel,
          gettingStartedVideoUrl: m.gettingStartedVideoUrl,
          maxReservationHours: m.maxReservationHours ?? null,
          hourlyRateCents: m.hourlyRateCents ?? null,
          sortOrder: m.sortOrder,
          createdAt: asDate(m.createdAt) ?? new Date(),
          updatedAt: asDate(m.updatedAt) ?? new Date(),
          deletedAt: asDate(m.deletedAt),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      ),
    );

    await createManyIfAny(
      (args) => tx.contentPage.createMany(args),
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

    await tx.orgSettings.create({
      // Cast: client may lag schema until `prisma generate`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
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
        updatedAt: asDate(bundle.settings.updatedAt) ?? new Date(),
      } as any,
    });

    await createManyIfAny(
      (args) => tx.membershipProduct.createMany(args),
      bundle.membershipProducts.map((p) => ({
        id: p.id,
        tier: p.tier,
        name: p.name,
        summary: p.summary,
        priceCents: p.priceCents,
        billingInterval: p.billingInterval,
        annualPriceCents: p.annualPriceCents ?? null,
        shopAccess: p.shopAccess,
        phase: p.phase,
        visibleOnJoin: p.visibleOnJoin,
        joinable: p.joinable,
        highlight: Boolean(p.highlight),
        sortOrder: p.sortOrder,
        isAddOn: Boolean(p.isAddOn),
        cappedSeats: p.cappedSeats ?? null,
        zeffyCampaignId: p.zeffyCampaignId ?? null,
        zeffyRateId: p.zeffyRateId ?? null,
        zeffyUrl: p.zeffyUrl ?? null,
        creditGrantCents: p.creditGrantCents ?? 0,
        createdAt: asDate(p.createdAt) ?? new Date(),
        updatedAt: asDate(p.updatedAt) ?? new Date(),
        deletedAt: asDate(p.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.volunteerRole.createMany(args),
      bundle.volunteerRoles.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        contentSlug: r.contentSlug,
        active: r.active,
        sortOrder: r.sortOrder,
        createdAt: asDate(r.createdAt) ?? new Date(),
        updatedAt: asDate(r.updatedAt) ?? new Date(),
        deletedAt: asDate(r.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.learningModule.createMany(args),
      bundle.learningModules.map(
        (m) =>
          ({
            id: m.id,
            slug: m.slug,
            title: m.title,
            summary: m.summary,
            certificationId: m.certificationId,
            knowledgeOnly: m.knowledgeOnly,
            published: m.published,
            equipmentStatus: m.equipmentStatus ?? "confirmed",
            passThresholdPercent: m.passThresholdPercent,
            attemptLimit: m.attemptLimit,
            sortOrder: m.sortOrder,
            createdAt: asDate(m.createdAt) ?? new Date(),
            updatedAt: asDate(m.updatedAt) ?? new Date(),
            deletedAt: asDate(m.deletedAt),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    );

    await createManyIfAny(
      (args) => tx.classSession.createMany(args),
      bundle.classSessions.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        descriptionSlug: c.descriptionSlug,
        category: c.category,
        instructorId: c.instructorId,
        startsAt: asDate(c.startsAt)!,
        endsAt: asDate(c.endsAt)!,
        capacity: c.capacity,
        priceCents: c.priceCents,
        zeffyUrl: c.zeffyUrl ?? null,
        zeffyCampaignId: c.zeffyCampaignId ?? null,
        prerequisiteCertificationIds: jsonArr(c.prerequisiteCertificationIds),
        location: c.location,
        cancellationCutoffHours: c.cancellationCutoffHours,
        published: c.published,
        createdAt: asDate(c.createdAt) ?? new Date(),
        updatedAt: asDate(c.updatedAt) ?? new Date(),
        deletedAt: asDate(c.deletedAt),
      })),
    );

    if (db.classInterestBoard) {
      await createManyIfAny(
        (args) => db.classInterestBoard.createMany(args),
        (bundle.classInterestBoards ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          summary: b.summary,
          category: b.category,
          status: b.status,
          threshold: b.threshold,
          proposedByUserId: b.proposedByUserId ?? null,
          contactName: b.contactName,
          contactEmail: b.contactEmail,
          instructorHintUserId: b.instructorHintUserId ?? null,
          opensAt: asDate(b.opensAt),
          closesAt: asDate(b.closesAt),
          scheduledClassSessionId: b.scheduledClassSessionId ?? null,
          priorityBookingEndsAt: asDate(b.priorityBookingEndsAt),
          resuggestedFromId: b.resuggestedFromId ?? null,
          reviewedById: b.reviewedById ?? null,
          reviewedAt: asDate(b.reviewedAt),
          staffNotes: b.staffNotes ?? null,
          createdAt: asDate(b.createdAt) ?? new Date(),
          updatedAt: asDate(b.updatedAt) ?? new Date(),
          deletedAt: asDate(b.deletedAt),
        })),
      );
    }
    if (db.classInterestSignup) {
      await createManyIfAny(
        (args) => db.classInterestSignup.createMany(args),
        (bundle.classInterestSignups ?? []).map((s) => ({
          id: s.id,
          boardId: s.boardId,
          userId: s.userId ?? null,
          email: s.email,
          displayName: s.displayName,
          createdAt: asDate(s.createdAt) ?? new Date(),
          updatedAt: asDate(s.updatedAt) ?? new Date(),
          deletedAt: asDate(s.deletedAt),
        })),
      );
    }

    await createManyIfAny(
      (args) => tx.badge.createMany(args),
      bundle.badges.map((b) => ({
        id: b.id,
        uid: b.uid,
        label: b.label ?? null,
        userId: b.userId,
        active: b.active,
        createdAt: asDate(b.createdAt) ?? new Date(),
        updatedAt: asDate(b.updatedAt) ?? new Date(),
        deletedAt: asDate(b.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.waiverSignature.createMany(args),
      bundle.waiverSignatures.map((w) => ({
        id: w.id,
        userId: w.userId,
        version: w.version,
        signedAt: asDate(w.signedAt)!,
        fullNameTyped: w.fullNameTyped,
        ip: w.ip,
        userAgent: w.userAgent ?? null,
        createdAt: asDate(w.createdAt) ?? new Date(),
        updatedAt: asDate(w.updatedAt) ?? new Date(),
        deletedAt: asDate(w.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.policyAcknowledgement.createMany(args),
      bundle.policyAcknowledgements.map((a) => ({
        id: a.id,
        userId: a.userId,
        policySlug: a.policySlug,
        version: a.version,
        acknowledgedAt: asDate(a.acknowledgedAt)!,
        createdAt: asDate(a.createdAt) ?? new Date(),
        updatedAt: asDate(a.updatedAt) ?? new Date(),
        deletedAt: asDate(a.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.userCertification.createMany(args),
      bundle.userCertifications.map((uc) => ({
        id: uc.id,
        userId: uc.userId,
        certificationId: uc.certificationId,
        status: uc.status,
        knowledgePassedAt: asDate(uc.knowledgePassedAt),
        checkedOffAt: asDate(uc.checkedOffAt),
        checkedOffById: uc.checkedOffById ?? null,
        expiresAt: asDate(uc.expiresAt),
        revokedAt: asDate(uc.revokedAt),
        revokedById: uc.revokedById ?? null,
        revokeReason: uc.revokeReason ?? null,
        createdAt: asDate(uc.createdAt) ?? new Date(),
        updatedAt: asDate(uc.updatedAt) ?? new Date(),
        deletedAt: asDate(uc.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.maintenanceBlock.createMany(args),
      bundle.maintenanceBlocks.map((m) => ({
        id: m.id,
        machineId: m.machineId,
        startsAt: asDate(m.startsAt)!,
        endsAt: asDate(m.endsAt)!,
        reason: m.reason,
        createdById: m.createdById,
        createdAt: asDate(m.createdAt) ?? new Date(),
        updatedAt: asDate(m.updatedAt) ?? new Date(),
        deletedAt: asDate(m.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.reservation.createMany(args),
      bundle.reservations.map((r) => ({
        id: r.id,
        userId: r.userId,
        machineId: r.machineId,
        startsAt: asDate(r.startsAt)!,
        endsAt: asDate(r.endsAt)!,
        status: r.status,
        createdById: r.createdById,
        cancelledAt: asDate(r.cancelledAt),
        cancelReason: r.cancelReason ?? null,
        createdAt: asDate(r.createdAt) ?? new Date(),
        updatedAt: asDate(r.updatedAt) ?? new Date(),
        deletedAt: asDate(r.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.booking.createMany(args),
      bundle.bookings.map((b) => ({
        id: b.id,
        classSessionId: b.classSessionId,
        userId: b.userId,
        status: b.status,
        waitlistPosition: b.waitlistPosition ?? null,
        paidAt: asDate(b.paidAt),
        paidMarkedById: b.paidMarkedById ?? null,
        zeffyPaymentId: b.zeffyPaymentId ?? null,
        paymentHoldExpiresAt: asDate(b.paymentHoldExpiresAt),
        cancelledAt: asDate(b.cancelledAt),
        attendedAt: asDate(b.attendedAt),
        createdAt: asDate(b.createdAt) ?? new Date(),
        updatedAt: asDate(b.updatedAt) ?? new Date(),
        deletedAt: asDate(b.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.lesson.createMany(args),
      bundle.lessons.map(
        (l) =>
          ({
            id: l.id,
            moduleId: l.moduleId,
            slug: l.slug,
            title: l.title,
            contentSlug: l.contentSlug,
            sortOrder: l.sortOrder,
            estimatedMinutes: l.estimatedMinutes,
            gap: l.gap ?? false,
            createdAt: asDate(l.createdAt) ?? new Date(),
            updatedAt: asDate(l.updatedAt) ?? new Date(),
            deletedAt: asDate(l.deletedAt),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    );

    if (db.lessonVideo) {
      await createManyIfAny(
        (args) => db.lessonVideo.createMany(args),
        (bundle.lessonVideos ?? []).map((v) => ({
          id: v.id,
          lessonId: v.lessonId,
          order: v.order,
          provider: v.provider,
          youtubeId: v.youtubeId,
          url: v.url,
          title: v.title,
          channel: v.channel,
          role: v.role,
          condition: v.condition ?? null,
          durationSeconds: v.durationSeconds ?? null,
          verifiedAt: asDate(v.verifiedAt),
          staffReviewed: v.staffReviewed,
          notes: v.notes ?? null,
          createdAt: asDate(v.createdAt) ?? new Date(),
          updatedAt: asDate(v.updatedAt) ?? new Date(),
          deletedAt: asDate(v.deletedAt),
        })),
      );
    }

    await createManyIfAny(
      (args) => tx.question.createMany(args),
      bundle.questions.map(
        (q) =>
          ({
            id: q.id,
            moduleId: q.moduleId,
            prompt: q.prompt,
            choices: jsonArr(q.choices),
            correctIndex: q.correctIndex,
            correctIndexes: jsonArr(q.correctIndexes ?? [q.correctIndex]),
            explanation: q.explanation ?? null,
            active: q.active,
            safetyCritical: q.safetyCritical ?? false,
            source: q.source ?? "video",
            sourceVideoId: q.sourceVideoId ?? null,
            verifyAgainstVideo: q.verifyAgainstVideo ?? true,
            answerPending: q.answerPending ?? false,
            createdAt: asDate(q.createdAt) ?? new Date(),
            updatedAt: asDate(q.updatedAt) ?? new Date(),
            deletedAt: asDate(q.deletedAt),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    );

    await createManyIfAny(
      (args) => tx.quizAttempt.createMany(args),
      bundle.quizAttempts.map(
        (a) =>
          ({
            id: a.id,
            userId: a.userId,
            moduleId: a.moduleId,
            questionIds: jsonArr(a.questionIds),
            answers: jsonArr(a.answers),
            scorePercent: a.scorePercent,
            passed: a.passed,
            thresholdMet: a.thresholdMet ?? false,
            safetyCriticalMissedIds: a.safetyCriticalMissedIds
              ? jsonArr(a.safetyCriticalMissedIds)
              : null,
            startedAt: asDate(a.startedAt)!,
            submittedAt: asDate(a.submittedAt)!,
            createdAt: asDate(a.createdAt) ?? new Date(),
            updatedAt: asDate(a.updatedAt) ?? new Date(),
            deletedAt: asDate(a.deletedAt),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any,
      ),
    );

    await createManyIfAny(
      (args) => tx.lessonProgress.createMany(args),
      bundle.lessonProgress.map((p) => ({
        id: p.id,
        userId: p.userId,
        lessonId: p.lessonId,
        completedAt: asDate(p.completedAt)!,
        createdAt: asDate(p.createdAt) ?? new Date(),
        updatedAt: asDate(p.updatedAt) ?? new Date(),
        deletedAt: asDate(p.deletedAt),
      })),
    );

    if (db.videoWatch) {
      await createManyIfAny(
        (args) => db.videoWatch.createMany(args),
        (bundle.videoWatches ?? []).map((w) => ({
          id: w.id,
          userId: w.userId,
          videoId: w.videoId,
          watchedAt: asDate(w.watchedAt)!,
          createdAt: asDate(w.createdAt) ?? new Date(),
          updatedAt: asDate(w.updatedAt) ?? new Date(),
          deletedAt: asDate(w.deletedAt),
        })),
      );
    }

    await createManyIfAny(
      (args) => tx.usageSession.createMany(args),
      bundle.usageSessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        machineId: s.machineId,
        badgeId: s.badgeId,
        startedAt: asDate(s.startedAt)!,
        endedAt: asDate(s.endedAt),
        reservationId: s.reservationId ?? null,
        endedBy: s.endedBy,
        createdAt: asDate(s.createdAt) ?? new Date(),
        updatedAt: asDate(s.updatedAt) ?? new Date(),
        deletedAt: asDate(s.deletedAt),
      })),
    );

    if (db.creditLedgerEntry) {
      await createManyIfAny(
        (args) => db.creditLedgerEntry.createMany(args),
        (bundle.creditLedgerEntries ?? []).map((e) => ({
          id: e.id,
          userId: e.userId,
          kind: e.kind,
          amountCents: e.amountCents,
          sourcePaymentId: e.sourcePaymentId ?? null,
          usageSessionId: e.usageSessionId ?? null,
          bookingId: e.bookingId ?? null,
          actorId: e.actorId ?? null,
          note: e.note ?? null,
          occurredAt: asDate(e.occurredAt)!,
          createdAt: asDate(e.createdAt) ?? new Date(),
          updatedAt: asDate(e.updatedAt) ?? new Date(),
          deletedAt: asDate(e.deletedAt),
        })),
      );
    }

    await createManyIfAny(
      (args) => tx.accessLog.createMany(args),
      bundle.accessLogs.map((l) => ({
        id: l.id,
        readerKey: l.readerKey,
        machineId: l.machineId ?? null,
        badgeUid: l.badgeUid,
        userId: l.userId ?? null,
        allow: l.allow,
        reason: l.reason ?? null,
        reservationNotice: l.reservationNotice ?? null,
        sessionId: l.sessionId ?? null,
        requestedAt: asDate(l.requestedAt)!,
        createdAt: asDate(l.createdAt) ?? new Date(),
        updatedAt: asDate(l.updatedAt) ?? new Date(),
        deletedAt: asDate(l.deletedAt),
      })),
    );

    await createManyIfAny(
      (args) => tx.volunteerInterest.createMany(args),
      bundle.volunteerInterests.map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email,
        phone: v.phone ?? null,
        roleId: v.roleId ?? null,
        message: v.message,
        status: v.status,
        userId: v.userId ?? null,
        reviewedById: v.reviewedById ?? null,
        reviewedAt: asDate(v.reviewedAt),
        notes: v.notes ?? null,
        createdAt: asDate(v.createdAt) ?? new Date(),
        updatedAt: asDate(v.updatedAt) ?? new Date(),
        deletedAt: asDate(v.deletedAt),
      })),
    );

    if (db.bounty) {
      await createManyIfAny(
        (args) => db.bounty.createMany(args),
        (bundle.bounties ?? []).map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          requesterName: b.requesterName,
          requesterEmail: b.requesterEmail,
          businessName: b.businessName ?? null,
          userId: b.userId ?? null,
          status: b.status,
          claimedByUserId: b.claimedByUserId ?? null,
          claimedAt: asDate(b.claimedAt),
          completedAt: asDate(b.completedAt),
          createdAt: asDate(b.createdAt) ?? new Date(),
          updatedAt: asDate(b.updatedAt) ?? new Date(),
          deletedAt: asDate(b.deletedAt),
        })),
      );
    }

    await createManyIfAny(
      (args) => tx.auditEvent.createMany(args),
      bundle.auditEvents.map((e) => ({
        id: e.id,
        action: e.action,
        actorId: e.actorId,
        subjectUserId: e.subjectUserId ?? null,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: e.metadata ? JSON.stringify(e.metadata) : null,
        occurredAt: asDate(e.occurredAt)!,
        createdAt: asDate(e.createdAt) ?? new Date(),
        updatedAt: asDate(e.updatedAt) ?? new Date(),
        deletedAt: asDate(e.deletedAt),
      })),
    );
  });
}

function shouldPersistAfter(methodName: string): boolean {
  if (methodName === "setCurrentUserId") return false;
  if (methodName === "getState") return false;
  if (methodName.startsWith("get")) return false;
  if (methodName.startsWith("list")) return false;
  if (methodName.startsWith("adminList")) return false;
  return true;
}

function createPersistingProxy(mock: MockDataProvider): DataProvider {
  return new Proxy(mock, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      const name = String(prop);
      return async (...args: unknown[]) => {
        const result = await (
          value as (...a: unknown[]) => Promise<unknown>
        ).apply(target, args);
        if (shouldPersistAfter(name)) {
          await persistBundleToPrisma(target.getState());
        }
        return result;
      };
    },
  }) as unknown as DataProvider;
}

/**
 * Prisma-backed DataProvider: load DB → MockDataProvider, persist after writes.
 */
export async function createPrismaDataProvider(
  initialUserId?: string | null,
): Promise<DataProvider> {
  const bundle = await loadBundleFromPrisma();
  const mock = new MockDataProvider(bundle, initialUserId);
  return createPersistingProxy(mock);
}
