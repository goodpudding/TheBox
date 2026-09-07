import {
  canScheduleMaintenance,
  evaluateMachineAccess,
  maintenanceMachineScope,
  shopLeadProgress,
  TOOL_CHAMPION_TERM_MONTHS,
} from "./access";
import { cloneFixtures, loadFixtures } from "./load-fixtures";
import type {
  AckPolicyInput,
  AllowlistResult,
  AuthorizeResult,
  AvailabilitySlot,
  BookingRosterRow,
  CheckoffInput,
  ClassFilters,
  ClassSessionInput,
  ClassSessionView,
  CertificationInput,
  DateRange,
  DataProvider,
  LearningModuleDetail,
  LearningModuleView,
  LessonInput,
  MachineInput,
  MaintenanceBlockInput,
  ModuleInput,
  OnboardingState,
  ProfileInput,
  PromoSlideInput,
  QuestionInput,
  QuizAttemptResult,
  QuizPayload,
  RegisterWithWaiverInput,
  RegisterWithWaiverResult,
  ReservationFilters,
  ReserveInput,
  RevokeInput,
  SignWaiverInput,
  SubmitQuizInput,
  ToolChampionProgress,
  ToolChampionRequestInput,
  UsageFilters,
  UsageTotal,
  UserCertificationView,
  VolunteerInterestAdminUpdate,
  VolunteerInterestInput,
} from "./provider";
import { buildDisplayFeed, buildMachineStatuses } from "./display-feed";
import type {
  AccessLog,
  AuditAction,
  AuditEvent,
  Badge,
  Booking,
  BookingStatus,
  Certification,
  ClassSession,
  ContentPage,
  DisplayConfig,
  DisplayPanelId,
  ISODate,
  ISODateTime,
  LearningModule,
  Lesson,
  LessonProgress,
  Machine,
  MaintenanceBlock,
  MembershipProduct,
  MembershipStatus,
  MembershipTier,
  NameDisplayMode,
  OrgSettings,
  PolicyAcknowledgement,
  PromoSlide,
  Question,
  QuizAttempt,
  Reservation,
  Role,
  UsageSession,
  User,
  UserCertification,
  VolunteerInterest,
  VolunteerRole,
  WaiverSignature,
  MockFixtureBundle,
  ScholarshipFundSummary,
  ToolChampionTerm,
} from "./types";

const TZ = "America/Los_Angeles";

/** Opening hours [openHour, closeHour) in America/Los_Angeles. 0 = Sunday. */
const OPENING_HOURS: Record<number, [number, number]> = {
  0: [11, 17],
  1: [16, 20],
  2: [16, 20],
  3: [15, 20],
  4: [11, 20],
  5: [11, 20],
  6: [11, 18],
};

const SEAT_STATUSES: BookingStatus[] = ["booked", "awaiting_payment", "attended"];

interface QuizTokenState {
  userId: string;
  moduleId: string;
  questionIds: string[];
  correctIndexes: number[];
  startedAt: ISODateTime;
  attemptNumber: number;
}

function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function laParts(iso: string | Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
  dateKey: string;
} {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: weekdayMap[parts.weekday!] ?? 0,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function isWithinOpeningHours(startsAt: string, endsAt: string): boolean {
  const start = laParts(startsAt);
  const end = laParts(endsAt);
  if (start.dateKey !== end.dateKey) return false;
  const window = OPENING_HOURS[start.weekday];
  if (!window) return false;
  const [open, close] = window;
  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  return startMin >= open * 60 && endMin <= close * 60 && endMin > startMin;
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400_000).toISOString();
}

function hoursBetween(startsAt: string, endsAt: string): number {
  return (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3600_000;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function simpleHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export class MockDataProvider implements DataProvider {
  private state: MockFixtureBundle;
  private currentUserId: string | null;
  private quizTokens = new Map<string, QuizTokenState>();

  constructor(bundle: MockFixtureBundle, initialUserId?: string | null) {
    this.state = cloneFixtures(bundle);
    this.currentUserId =
      initialUserId === undefined ? "u-maya" : initialUserId;
  }

  /** Snapshot of mutable fixture state (for Prisma persist). */
  getState(): MockFixtureBundle {
    return structuredClone(this.state);
  }

  private now(): ISODateTime {
    return new Date().toISOString();
  }

  private id(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }

  private touch<T extends { updatedAt: ISODateTime }>(entity: T): T {
    entity.updatedAt = this.now();
    return entity;
  }

  private pushAudit(input: {
    action: AuditAction;
    actorId: string | null;
    subjectUserId?: string | null;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  }): AuditEvent {
    const occurredAt = this.now();
    const event: AuditEvent = {
      id: this.id("audit"),
      action: input.action,
      actorId: input.actorId,
      subjectUserId: input.subjectUserId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
      occurredAt,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    this.state.auditEvents.push(event);
    return event;
  }

  private requireUser(id: string): User {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) throw new Error(`User not found: ${id}`);
    return user;
  }

  /** Waiver + expectations must be current before bookings/reservations. */
  private async assertMemberCanTransact(userId: string): Promise<void> {
    const state = await this.getOnboardingState(userId);
    if (!state.profileComplete) {
      throw new Error("Complete your profile before booking or reserving");
    }
    if (!state.waiverSignedCurrent) {
      throw new Error("Sign the current waiver before booking or reserving");
    }
    if (!state.expectationsAcknowledged) {
      throw new Error(
        "Acknowledge member expectations before booking or reserving",
      );
    }
  }

  private toClassView(
    session: ClassSession,
    currentUserId?: string | null,
  ): ClassSessionView {
    const instructor = this.state.users.find((u) => u.id === session.instructorId);
    const relevant = this.state.bookings.filter(
      (b) => b.classSessionId === session.id,
    );
    const bookedCount = relevant.filter((b) =>
      SEAT_STATUSES.includes(b.status),
    ).length;
    const waitlistCount = relevant.filter((b) => b.status === "waitlisted")
      .length;
    const currentUserBooking =
      currentUserId == null
        ? null
        : relevant.find(
            (b) =>
              b.userId === currentUserId &&
              !["cancelled", "expired"].includes(b.status),
          ) ?? null;

    return {
      ...session,
      instructor: {
        id: instructor?.id ?? session.instructorId,
        displayName: instructor?.displayName ?? "Unknown",
      },
      bookedCount,
      waitlistCount,
      spotsRemaining: Math.max(0, session.capacity - bookedCount),
      currentUserBooking,
    };
  }

  private moduleView(
    mod: LearningModule,
    userId: string | null,
  ): LearningModuleView {
    const certification = this.state.certifications.find(
      (c) => c.id === mod.certificationId,
    )!;
    const lessons = this.state.lessons.filter((l) => l.moduleId === mod.id);
    const completedLessonCount =
      userId == null
        ? 0
        : lessons.filter((l) =>
            this.state.lessonProgress.some(
              (p) => p.userId === userId && p.lessonId === l.id,
            ),
          ).length;
    const attemptCount =
      userId == null
        ? 0
        : this.state.quizAttempts.filter(
            (a) => a.userId === userId && a.moduleId === mod.id,
          ).length;
    const knowledgePassed =
      userId == null
        ? false
        : this.state.userCertifications.some(
            (uc) =>
              uc.userId === userId &&
              uc.certificationId === mod.certificationId &&
              (uc.status === "knowledge_passed" ||
                uc.status === "certified" ||
                !!uc.knowledgePassedAt),
          );

    return {
      ...mod,
      certification,
      lessonCount: lessons.length,
      completedLessonCount,
      attemptCount,
      knowledgePassed,
    };
  }

  // ── Identity ──────────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<User | null> {
    if (!this.currentUserId) return null;
    return this.state.users.find((u) => u.id === this.currentUserId) ?? null;
  }

  async setCurrentUserId(id: string | null): Promise<void> {
    this.currentUserId = id;
  }

  async listSwitchableUsers(): Promise<User[]> {
    return [...this.state.users].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    );
  }

  // ── Member profile / waiver / badges ─────────────────────────────────────

  async getMember(id: string): Promise<User | null> {
    return this.state.users.find((u) => u.id === id) ?? null;
  }

  async updateMemberProfile(id: string, data: ProfileInput): Promise<User> {
    const user = this.requireUser(id);
    user.firstName = data.firstName;
    user.lastName = data.lastName;
    user.displayName = `${data.firstName} ${data.lastName}`.trim();
    user.phone = data.phone;
    user.emergencyContactName = data.emergencyContactName;
    user.emergencyContactPhone = data.emergencyContactPhone;
    user.emergencyContactRelation = data.emergencyContactRelation;
    if (data.newsletterOptIn !== undefined) {
      user.newsletterOptIn = data.newsletterOptIn;
    }
    user.profileComplete = Boolean(
      user.firstName &&
        user.lastName &&
        user.phone &&
        user.emergencyContactName &&
        user.emergencyContactPhone,
    );
    return this.touch(user);
  }

  async getOnboardingState(userId: string): Promise<OnboardingState> {
    const user = this.requireUser(userId);
    const settings = this.state.settings;
    const waiverSignedCurrent = this.state.waiverSignatures.some(
      (w) =>
        w.userId === userId && w.version === settings.currentWaiverVersion,
    );
    const expectationsPage = this.state.contentPages.find(
      (p) => p.slug === settings.memberExpectationsPolicySlug && p.published,
    );
    const expectationsVersion =
      expectationsPage?.version ?? settings.currentWaiverVersion;
    const expectationsAcknowledged = this.state.policyAcknowledgements.some(
      (a) =>
        a.userId === userId &&
        a.policySlug === settings.memberExpectationsPolicySlug &&
        a.version === expectationsVersion,
    );
    const profileComplete = user.profileComplete;
    let nextStep: OnboardingState["nextStep"] = null;
    if (!profileComplete) nextStep = "profile";
    else if (!waiverSignedCurrent) nextStep = "waiver";
    else if (!expectationsAcknowledged) nextStep = "expectations";
    return {
      profileComplete,
      waiverSignedCurrent,
      expectationsAcknowledged,
      complete: nextStep === null,
      nextStep,
    };
  }

  async getWaiver(version?: string): Promise<ContentPage> {
    const v = version ?? this.state.settings.currentWaiverVersion;
    const page = this.state.contentPages.find(
      (p) => p.category === "waiver" && p.version === v && p.published,
    );
    if (!page) {
      const any = this.state.contentPages.find(
        (p) => p.category === "waiver" && p.published,
      );
      if (!any) throw new Error("Waiver content not found");
      return any;
    }
    return page;
  }

  async signWaiver(input: SignWaiverInput): Promise<WaiverSignature> {
    if (!input.agreed) {
      throw new Error("You must agree to the waiver to sign");
    }
    this.requireUser(input.userId);
    const fullNameTyped = input.fullNameTyped.trim();
    if (fullNameTyped.length < 3) {
      throw new Error("Type your full legal name as your signature");
    }
    const now = this.now();
    const sig: WaiverSignature = {
      id: this.id("ws"),
      userId: input.userId,
      version: this.state.settings.currentWaiverVersion,
      signedAt: now,
      fullNameTyped,
      ip: input.ip,
      userAgent: input.userAgent,
      createdAt: now,
      updatedAt: now,
    };
    this.state.waiverSignatures.push(sig);
    this.pushAudit({
      action: "waiver_signed",
      actorId: input.userId,
      subjectUserId: input.userId,
      entityType: "WaiverSignature",
      entityId: sig.id,
      metadata: { version: sig.version },
    });
    return sig;
  }

  async registerWithWaiver(
    input: RegisterWithWaiverInput,
  ): Promise<RegisterWithWaiverResult> {
    if (!input.agreed) {
      throw new Error("You must agree to the waiver to register");
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const email = input.email.trim().toLowerCase();
    const phone = input.phone?.trim() ?? "";
    const emergencyContactName = input.emergencyContactName?.trim() ?? "";
    const emergencyContactPhone = input.emergencyContactPhone?.trim() ?? "";
    const emergencyContactRelation =
      input.emergencyContactRelation?.trim() ?? "";
    const fullNameTyped = input.fullNameTyped.trim();

    if (!firstName || !lastName || !email || !phone) {
      throw new Error("Name, email, and phone are required");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address");
    }
    if (!emergencyContactName || !emergencyContactPhone) {
      throw new Error("Emergency contact name and phone are required");
    }
    if (fullNameTyped.length < 3) {
      throw new Error("Type your full legal name as your signature");
    }

    const now = this.now();
    let created = false;
    let user = this.state.users.find(
      (u) => u.email.toLowerCase() === email,
    );

    if (!user) {
      created = true;
      user = {
        id: this.id("u"),
        email,
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`.trim(),
        phone,
        role: "member",
        status: "pending",
        tier: null,
        billingInterval: null,
        shopAccess: false,
        emergencyContactName,
        emergencyContactPhone,
        emergencyContactRelation,
        newsletterOptIn: Boolean(input.newsletterOptIn),
        profileComplete: true,
        createdAt: now,
        updatedAt: now,
      };
      this.state.users.push(user);
      this.pushAudit({
        action: "member_registered",
        actorId: user.id,
        subjectUserId: user.id,
        entityType: "User",
        entityId: user.id,
        metadata: {
          source: "qr_registration",
          newsletterOptIn: user.newsletterOptIn,
        },
      });
    } else {
      user.firstName = firstName;
      user.lastName = lastName;
      user.displayName = `${firstName} ${lastName}`.trim();
      user.phone = phone;
      user.emergencyContactName = emergencyContactName;
      user.emergencyContactPhone = emergencyContactPhone;
      user.emergencyContactRelation = emergencyContactRelation;
      user.newsletterOptIn = Boolean(input.newsletterOptIn);
      user.profileComplete = true;
      this.touch(user);
    }

    const waiverSignature = await this.signWaiver({
      userId: user.id,
      fullNameTyped,
      agreed: true,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { user, waiverSignature, created };
  }

  async listWaiverHistory(userId: string): Promise<WaiverSignature[]> {
    return this.state.waiverSignatures
      .filter((w) => w.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime(),
      );
  }

  async acknowledgePolicy(
    input: AckPolicyInput,
  ): Promise<PolicyAcknowledgement> {
    this.requireUser(input.userId);
    const now = this.now();
    const ack: PolicyAcknowledgement = {
      id: this.id("pa"),
      userId: input.userId,
      policySlug: input.policySlug,
      version: input.version,
      acknowledgedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.policyAcknowledgements.push(ack);
    this.pushAudit({
      action: "policy_acknowledged",
      actorId: input.userId,
      subjectUserId: input.userId,
      entityType: "PolicyAcknowledgement",
      entityId: ack.id,
      metadata: { policySlug: input.policySlug, version: input.version },
    });
    return ack;
  }

  async listBadges(userId: string): Promise<Badge[]> {
    return this.state.badges.filter((b) => b.userId === userId);
  }

  // ── Certifications ────────────────────────────────────────────────────────

  async listCertifications(): Promise<Certification[]> {
    return [...this.state.certifications]
      .filter((c) => c.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCertifications(userId: string): Promise<UserCertificationView[]> {
    this.requireUser(userId);
    const now = this.now();
    return this.state.certifications
      .filter((c) => c.active)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((certification) => {
        const existing = this.state.userCertifications.find(
          (uc) =>
            uc.userId === userId && uc.certificationId === certification.id,
        );
        if (existing) {
          let status = existing.status;
          if (
            status === "certified" &&
            existing.expiresAt &&
            new Date(existing.expiresAt).getTime() < new Date(now).getTime()
          ) {
            status = "expired";
          }
          return { ...existing, status, certification };
        }
        const nowTs = now;
        return {
          id: `virtual-${userId}-${certification.id}`,
          userId,
          certificationId: certification.id,
          status: "not_started" as const,
          createdAt: nowTs,
          updatedAt: nowTs,
          certification,
        };
      });
  }

  async listBookingsForUser(userId: string): Promise<Booking[]> {
    return this.state.bookings
      .filter((b) => b.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  // ── Usage ─────────────────────────────────────────────────────────────────

  async getUsage(userId: string, range?: DateRange): Promise<UsageSession[]> {
    return this.state.usageSessions.filter((s) => {
      if (s.userId !== userId) return false;
      if (!range) return true;
      const t = new Date(s.startedAt).getTime();
      return (
        t >= new Date(range.from).getTime() && t <= new Date(range.to).getTime()
      );
    });
  }

  async getUsageTotals(userId: string, month: string): Promise<UsageTotal[]> {
    // month as YYYY-MM
    const sessions = this.state.usageSessions.filter((s) => {
      if (s.userId !== userId) return false;
      return s.startedAt.slice(0, 7) === month || laParts(s.startedAt).dateKey.startsWith(month);
    });
    const byMachine = new Map<string, UsageTotal>();
    for (const s of sessions) {
      const machine = this.state.machines.find((m) => m.id === s.machineId);
      const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
      const minutes = Math.max(
        0,
        Math.round((end - new Date(s.startedAt).getTime()) / 60_000),
      );
      const existing = byMachine.get(s.machineId) ?? {
        machineId: s.machineId,
        machineName: machine?.name ?? s.machineId,
        sessionCount: 0,
        totalMinutes: 0,
      };
      existing.sessionCount += 1;
      existing.totalMinutes += minutes;
      byMachine.set(s.machineId, existing);
    }
    return [...byMachine.values()];
  }

  // ── Classes / bookings ────────────────────────────────────────────────────

  async listClasses(filters?: ClassFilters): Promise<ClassSessionView[]> {
    const now = Date.now();
    const uid = this.currentUserId;
    return this.state.classSessions
      .filter((c) => c.published)
      .filter((c) => !filters?.category || c.category === filters.category)
      .filter(
        (c) =>
          !filters?.upcomingOnly || new Date(c.startsAt).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
      .map((c) => this.toClassView(c, uid));
  }

  async getClass(id: string): Promise<ClassSessionView | null> {
    const session = this.state.classSessions.find((c) => c.id === id);
    if (!session) return null;
    return this.toClassView(session, this.currentUserId);
  }

  async book(classSessionId: string, userId: string): Promise<Booking> {
    this.requireUser(userId);
    await this.assertMemberCanTransact(userId);
    const session = this.state.classSessions.find((c) => c.id === classSessionId);
    if (!session || !session.published) {
      throw new Error("Class session not found");
    }
    if (new Date(session.startsAt).getTime() < Date.now()) {
      throw new Error("Cannot book a class that has already started");
    }

    const existing = this.state.bookings.find(
      (b) =>
        b.classSessionId === classSessionId &&
        b.userId === userId &&
        !["cancelled", "expired", "no_show"].includes(b.status),
    );
    if (existing) {
      throw new Error("You already have a booking for this class");
    }

    for (const certId of session.prerequisiteCertificationIds) {
      const cert = this.state.certifications.find((c) => c.id === certId);
      const uc = this.state.userCertifications.find(
        (c) =>
          c.userId === userId &&
          c.certificationId === certId &&
          c.status === "certified",
      );
      if (!uc) {
        throw new Error(
          `Missing prerequisite certification: ${cert?.name ?? certId}`,
        );
      }
    }

    const seats = this.state.bookings.filter(
      (b) =>
        b.classSessionId === classSessionId &&
        SEAT_STATUSES.includes(b.status),
    );
    const now = this.now();
    let status: BookingStatus;
    let waitlistPosition: number | null = null;
    let paymentHoldExpiresAt: string | null = null;

    if (seats.length >= session.capacity) {
      status = "waitlisted";
      const waitlisted = this.state.bookings.filter(
        (b) =>
          b.classSessionId === classSessionId && b.status === "waitlisted",
      );
      waitlistPosition = waitlisted.length + 1;
    } else if (session.priceCents > 0) {
      status = "awaiting_payment";
      paymentHoldExpiresAt = addHours(
        now,
        this.state.settings.paymentHoldHours,
      );
    } else {
      status = "booked";
    }

    const booking: Booking = {
      id: this.id("bk"),
      classSessionId,
      userId,
      status,
      waitlistPosition,
      paymentHoldExpiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.state.bookings.push(booking);
    return booking;
  }

  async cancel(bookingId: string, userId: string): Promise<Booking> {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== userId) {
      throw new Error("You can only cancel your own booking");
    }
    if (["cancelled", "expired", "attended", "no_show"].includes(booking.status)) {
      throw new Error(`Cannot cancel booking in status ${booking.status}`);
    }

    const session = this.state.classSessions.find(
      (c) => c.id === booking.classSessionId,
    );
    if (!session) throw new Error("Class session not found");

    if (booking.status !== "waitlisted") {
      const cutoffHours =
        session.cancellationCutoffHours ??
        this.state.settings.classCancellationCutoffHours;
      const cutoffMs =
        new Date(session.startsAt).getTime() - cutoffHours * 3600_000;
      if (Date.now() > cutoffMs) {
        throw new Error(
          `Cancellation cutoff is ${cutoffHours} hours before class start`,
        );
      }
    }

    const wasSeat = SEAT_STATUSES.includes(booking.status);
    booking.status = "cancelled";
    booking.cancelledAt = this.now();
    this.touch(booking);

    if (wasSeat) {
      await this.adminPromoteFromWaitlist(session.id, userId);
    } else {
      // Re-number waitlist
      const waitlisted = this.state.bookings
        .filter(
          (b) =>
            b.classSessionId === session.id && b.status === "waitlisted",
        )
        .sort(
          (a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0),
        );
      waitlisted.forEach((b, i) => {
        b.waitlistPosition = i + 1;
        this.touch(b);
      });
    }

    return booking;
  }

  // ── Reservations ──────────────────────────────────────────────────────────

  async listReservations(filters: ReservationFilters): Promise<Reservation[]> {
    const statuses = filters.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;
    return this.state.reservations.filter((r) => {
      if (filters.userId && r.userId !== filters.userId) return false;
      if (filters.machineId && r.machineId !== filters.machineId) return false;
      if (statuses && !statuses.includes(r.status)) return false;
      if (filters.from && new Date(r.endsAt) < new Date(filters.from)) {
        return false;
      }
      if (filters.to && new Date(r.startsAt) > new Date(filters.to)) {
        return false;
      }
      return true;
    });
  }

  async reserve(input: ReserveInput): Promise<Reservation> {
    this.requireUser(input.userId);
    await this.assertMemberCanTransact(input.userId);
    const user = this.requireUser(input.userId);
    if (!user.shopAccess) {
      throw new Error("Your membership tier does not include shop access");
    }
    if (user.status !== "active") {
      throw new Error("Only active members can reserve machines");
    }
    const machine = this.state.machines.find((m) => m.id === input.machineId);
    if (!machine || !machine.active) {
      throw new Error("Machine not found or inactive");
    }
    for (const certId of machine.requiredCertificationIds) {
      const cert = this.state.certifications.find((c) => c.id === certId);
      const uc = this.state.userCertifications.find(
        (c) =>
          c.userId === input.userId &&
          c.certificationId === certId &&
          c.status === "certified",
      );
      if (!uc) {
        throw new Error(
          `You need a current ${cert?.name ?? certId} certification to reserve this machine`,
        );
      }
    }
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new Error("Reservation end must be after start");
    }
    if (new Date(input.startsAt).getTime() < Date.now()) {
      throw new Error("Cannot reserve in the past");
    }

    const horizonEnd = addDays(
      this.now(),
      this.state.settings.reservationHorizonDays,
    );
    if (new Date(input.startsAt) > new Date(horizonEnd)) {
      throw new Error(
        `Reservations only allowed within ${this.state.settings.reservationHorizonDays} days`,
      );
    }

    if (!isWithinOpeningHours(input.startsAt, input.endsAt)) {
      throw new Error("Reservation is outside opening hours");
    }

    const open = this.state.reservations.filter(
      (r) =>
        r.userId === input.userId &&
        r.status === "booked" &&
        new Date(r.endsAt).getTime() > Date.now(),
    );
    if (open.length >= this.state.settings.maxOpenReservations) {
      throw new Error(
        `Maximum of ${this.state.settings.maxOpenReservations} open reservations allowed`,
      );
    }

    const dayKey = laParts(input.startsAt).dateKey;
    const dayHours = open
      .filter((r) => laParts(r.startsAt).dateKey === dayKey)
      .reduce((sum, r) => sum + hoursBetween(r.startsAt, r.endsAt), 0);
    const requested = hoursBetween(input.startsAt, input.endsAt);
    if (dayHours + requested > this.state.settings.maxHoursPerDay) {
      throw new Error(
        `Maximum of ${this.state.settings.maxHoursPerDay} reservation hours per day`,
      );
    }

    const conflict = this.state.reservations.find(
      (r) =>
        r.machineId === input.machineId &&
        r.status === "booked" &&
        overlaps(r.startsAt, r.endsAt, input.startsAt, input.endsAt),
    );
    if (conflict) {
      throw new Error("Machine already reserved for that time");
    }

    const maintenance = this.state.maintenanceBlocks.find((m) =>
      m.machineId === input.machineId &&
      overlaps(m.startsAt, m.endsAt, input.startsAt, input.endsAt),
    );
    if (maintenance) {
      throw new Error("Machine is under maintenance during that time");
    }

    const now = this.now();
    const reservation: Reservation = {
      id: this.id("res"),
      userId: input.userId,
      machineId: input.machineId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "booked",
      createdById: input.createdById ?? input.userId,
      cancelledAt: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.reservations.push(reservation);
    return reservation;
  }

  async cancelReservation(id: string, userId: string): Promise<Reservation> {
    const reservation = this.state.reservations.find((r) => r.id === id);
    if (!reservation) throw new Error("Reservation not found");
    if (reservation.userId !== userId) {
      throw new Error("You can only cancel your own reservation");
    }
    if (reservation.status !== "booked") {
      throw new Error("Reservation is not active");
    }
    if (new Date(reservation.startsAt).getTime() <= Date.now()) {
      throw new Error("Cannot cancel a reservation after it has started");
    }
    reservation.status = "cancelled";
    reservation.cancelledAt = this.now();
    reservation.cancelReason = "user_cancelled";
    return this.touch(reservation);
  }

  async listMachines(): Promise<Machine[]> {
    return [...this.state.machines]
      .filter((m) => m.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getMachineAvailability(
    machineId: string,
    from: ISODate,
    to: ISODate,
  ): Promise<AvailabilitySlot[]> {
    const machine = this.state.machines.find((m) => m.id === machineId);
    if (!machine) throw new Error("Machine not found");

    const slotMin = this.state.settings.reservationSlotMinutes;
    const slots: AvailabilitySlot[] = [];
    const fromDate = new Date(`${from}T00:00:00-07:00`);
    const toDate = new Date(`${to}T23:59:59-07:00`);
    const now = Date.now();

    for (
      let cursor = fromDate.getTime();
      cursor < toDate.getTime();
      cursor += slotMin * 60_000
    ) {
      const startsAt = new Date(cursor).toISOString();
      const endsAt = new Date(cursor + slotMin * 60_000).toISOString();
      const startParts = laParts(startsAt);
      const window = OPENING_HOURS[startParts.weekday];
      const startMin = startParts.hour * 60 + startParts.minute;
      const endParts = laParts(endsAt);
      const endMin = endParts.hour * 60 + endParts.minute;

      if (
        !window ||
        startParts.dateKey !== endParts.dateKey ||
        startMin < window[0] * 60 ||
        endMin > window[1] * 60
      ) {
        slots.push({ startsAt, endsAt, available: false, reason: "closed" });
        continue;
      }
      if (cursor < now) {
        slots.push({ startsAt, endsAt, available: false, reason: "past" });
        continue;
      }
      const maint = this.state.maintenanceBlocks.find(
        (m) =>
          m.machineId === machineId &&
          overlaps(m.startsAt, m.endsAt, startsAt, endsAt),
      );
      if (maint) {
        slots.push({
          startsAt,
          endsAt,
          available: false,
          reason: "maintenance",
        });
        continue;
      }
      const res = this.state.reservations.find(
        (r) =>
          r.machineId === machineId &&
          r.status === "booked" &&
          overlaps(r.startsAt, r.endsAt, startsAt, endsAt),
      );
      if (res) {
        slots.push({
          startsAt,
          endsAt,
          available: false,
          reason: "reserved",
          reservationId: res.id,
        });
        continue;
      }
      slots.push({ startsAt, endsAt, available: true });
    }

    return slots;
  }

  // ── Learning ──────────────────────────────────────────────────────────────

  async listModules(): Promise<LearningModuleView[]> {
    const uid = this.currentUserId;
    const user = uid ? this.state.users.find((u) => u.id === uid) : null;
    const staff = user?.role === "staff" || user?.role === "admin";
    return this.state.learningModules
      .filter((m) => staff || m.published)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => this.moduleView(m, uid));
  }

  async getModule(slug: string): Promise<LearningModuleDetail | null> {
    // Staff/admin may open drafts by slug; members still only discover published via listModules.
    const mod = this.state.learningModules.find((m) => m.slug === slug);
    if (!mod) return null;
    const user = this.currentUserId
      ? this.state.users.find((u) => u.id === this.currentUserId)
      : null;
    const staff = user?.role === "staff" || user?.role === "admin";
    if (!mod.published && !staff) return null;
    const view = this.moduleView(mod, this.currentUserId);
    const lessons = this.state.lessons
      .filter((l) => l.moduleId === mod.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => {
        const content = this.state.contentPages.find(
          (c) => c.slug === l.contentSlug,
        );
        const completed =
          this.currentUserId != null &&
          this.state.lessonProgress.some(
            (p) =>
              p.userId === this.currentUserId && p.lessonId === l.id,
          );
        return {
          ...l,
          completed,
          html: content?.html ?? "",
        };
      });
    return { ...view, lessons };
  }

  async markLessonComplete(
    lessonId: string,
    userId: string,
  ): Promise<LessonProgress> {
    this.requireUser(userId);
    const lesson = this.state.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new Error("Lesson not found");
    const existing = this.state.lessonProgress.find(
      (p) => p.userId === userId && p.lessonId === lessonId,
    );
    if (existing) return existing;
    const now = this.now();
    const progress: LessonProgress = {
      id: this.id("lp"),
      userId,
      lessonId,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.lessonProgress.push(progress);
    return progress;
  }

  async startQuiz(moduleId: string, userId: string): Promise<QuizPayload> {
    this.requireUser(userId);
    const mod = this.state.learningModules.find((m) => m.id === moduleId);
    if (!mod || !mod.published) throw new Error("Module not found");

    const attemptLimit =
      mod.attemptLimit || this.state.settings.quizAttemptLimit;
    const prior = this.state.quizAttempts.filter(
      (a) => a.userId === userId && a.moduleId === moduleId,
    );
    if (prior.length >= attemptLimit) {
      throw new Error(`Attempt limit of ${attemptLimit} reached`);
    }

    const bank = this.state.questions.filter(
      (q) => q.moduleId === moduleId && q.active,
    );
    if (bank.length === 0) throw new Error("No quiz questions available");

    const count = Math.min(
      this.state.settings.quizQuestionCount,
      bank.length,
    );
    const sampled = shuffleInPlace([...bank]).slice(0, count);
    const attemptNumber = prior.length + 1;
    const startedAt = this.now();
    const attemptToken = this.id("quiz");

    this.quizTokens.set(attemptToken, {
      userId,
      moduleId,
      questionIds: sampled.map((q) => q.id),
      correctIndexes: sampled.map((q) => q.correctIndex),
      startedAt,
      attemptNumber,
    });

    return {
      attemptToken,
      moduleId,
      questions: sampled.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        choices: [...q.choices],
      })),
      passThresholdPercent:
        mod.passThresholdPercent || this.state.settings.quizPassThresholdPercent,
      attemptNumber,
      attemptLimit,
    };
  }

  async submitQuiz(input: SubmitQuizInput): Promise<QuizAttemptResult> {
    const token = this.quizTokens.get(input.attemptToken);
    if (!token) throw new Error("Invalid or expired quiz attempt token");
    if (token.userId !== input.userId || token.moduleId !== input.moduleId) {
      throw new Error("Quiz attempt token mismatch");
    }
    if (
      input.questionIds.length !== token.questionIds.length ||
      input.questionIds.some((id, i) => id !== token.questionIds[i])
    ) {
      throw new Error("Question set does not match started attempt");
    }
    if (input.answers.length !== token.questionIds.length) {
      throw new Error("Answer count mismatch");
    }

    const mod = this.state.learningModules.find((m) => m.id === input.moduleId);
    if (!mod) throw new Error("Module not found");

    let correct = 0;
    for (let i = 0; i < token.correctIndexes.length; i++) {
      if (input.answers[i] === token.correctIndexes[i]) correct += 1;
    }
    const scorePercent = Math.round(
      (correct / token.correctIndexes.length) * 100,
    );
    const threshold =
      mod.passThresholdPercent || this.state.settings.quizPassThresholdPercent;
    const passed = scorePercent >= threshold;
    const now = this.now();

    const attempt: QuizAttempt = {
      id: this.id("qa"),
      userId: input.userId,
      moduleId: input.moduleId,
      questionIds: [...input.questionIds],
      answers: [...input.answers],
      scorePercent,
      passed,
      startedAt: token.startedAt,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.quizAttempts.push(attempt);
    this.quizTokens.delete(input.attemptToken);

    let knowledgePassed = false;
    if (passed) {
      let uc = this.state.userCertifications.find(
        (c) =>
          c.userId === input.userId &&
          c.certificationId === mod.certificationId,
      );
      if (!uc) {
        uc = {
          id: this.id("uc"),
          userId: input.userId,
          certificationId: mod.certificationId,
          status: "knowledge_passed",
          knowledgePassedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        this.state.userCertifications.push(uc);
      } else if (
        uc.status !== "certified" &&
        uc.status !== "revoked"
      ) {
        uc.status = "knowledge_passed";
        uc.knowledgePassedAt = now;
        this.touch(uc);
      } else if (!uc.knowledgePassedAt) {
        uc.knowledgePassedAt = now;
        this.touch(uc);
      }

      if (mod.knowledgeOnly && uc.status !== "revoked") {
        uc.status = "certified";
        uc.checkedOffAt = uc.checkedOffAt ?? now;
        this.touch(uc);
        this.pushAudit({
          action: "cert_checked_off",
          actorId: input.userId,
          subjectUserId: input.userId,
          entityType: "UserCertification",
          entityId: uc.id,
          metadata: { via: "knowledge_only_quiz" },
        });
      }

      knowledgePassed = true;
      this.pushAudit({
        action: "cert_knowledge_passed",
        actorId: input.userId,
        subjectUserId: input.userId,
        entityType: "UserCertification",
        entityId: uc.id,
        metadata: { scorePercent, moduleId: mod.id },
      });
    }

    return { attempt, passed, scorePercent, knowledgePassed };
  }

  // ── Content / volunteer / settings ────────────────────────────────────────

  async listPolicies(): Promise<ContentPage[]> {
    return this.state.contentPages.filter(
      (p) => p.category === "policy" && p.published,
    );
  }

  async getContentBySlug(slug: string): Promise<ContentPage | null> {
    return (
      this.state.contentPages.find((p) => p.slug === slug && p.published) ??
      null
    );
  }

  async listVolunteerRoles(): Promise<VolunteerRole[]> {
    return [...this.state.volunteerRoles]
      .filter((r) => r.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async submitVolunteerInterest(
    input: VolunteerInterestInput,
  ): Promise<VolunteerInterest> {
    if (!input.name.trim() || !input.email.trim() || !input.message.trim()) {
      throw new Error("Name, email, and message are required");
    }
    const now = this.now();
    const interest: VolunteerInterest = {
      id: this.id("vi"),
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone,
      roleId: input.roleId ?? null,
      message: input.message.trim(),
      status: "new",
      userId: input.userId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.volunteerInterests.push(interest);
    return interest;
  }

  async getSettings(): Promise<OrgSettings> {
    return { ...this.state.settings };
  }

  async listMembershipProducts(): Promise<MembershipProduct[]> {
    const showPhase3 = this.state.settings.showPhase3Tiers;
    return [...this.state.membershipProducts]
      .filter((p) => p.visibleOnJoin && (showPhase3 || p.phase < 3))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getScholarshipFundSummary(): Promise<ScholarshipFundSummary> {
    const s = this.state.settings;
    const seatsFundable = Math.floor(
      s.scholarshipFundBalanceCents / s.makerMonthlyCents,
    );
    const communitySeatsUsed = this.state.users.filter(
      (u) =>
        u.tier === "community" &&
        (u.status === "active" || u.status === "pending"),
    ).length;
    return {
      fundBalanceCents: s.scholarshipFundBalanceCents,
      makerMonthlyCents: s.makerMonthlyCents,
      seatsFundable,
      seatsAwarded: s.scholarshipSeatsAwarded,
      seatsAvailable: Math.max(0, seatsFundable - s.scholarshipSeatsAwarded),
      patronSurchargeCents: s.patronScholarshipSurchargeCents,
      communitySeatCap: s.communitySeatCap,
      communitySeatsUsed,
    };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  async adminListMembers(query?: string): Promise<User[]> {
    const q = query?.trim().toLowerCase();
    return this.state.users.filter((u) => {
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q)
      );
    });
  }

  async adminUpdateMemberStatus(
    id: string,
    status: MembershipStatus,
    actorId: string,
  ): Promise<User> {
    const user = this.requireUser(id);
    const prev = user.status;
    user.status = status;
    this.touch(user);
    this.pushAudit({
      action: "status_changed",
      actorId,
      subjectUserId: id,
      entityType: "User",
      entityId: id,
      metadata: { from: prev, to: status },
    });
    return user;
  }

  async adminListBadges(): Promise<Badge[]> {
    return [...this.state.badges].sort((a, b) =>
      (a.label ?? a.uid).localeCompare(b.label ?? b.uid),
    );
  }

  async adminLinkBadge(
    badgeId: string,
    userId: string,
    actorId: string,
  ): Promise<Badge> {
    this.requireUser(userId);
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!badge) throw new Error("Badge not found");
    badge.userId = userId;
    this.touch(badge);
    this.pushAudit({
      action: "badge_linked",
      actorId,
      subjectUserId: userId,
      entityType: "Badge",
      entityId: badgeId,
    });
    return badge;
  }

  async adminUnlinkBadge(badgeId: string, actorId: string): Promise<Badge> {
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!badge) throw new Error("Badge not found");
    const prevUser = badge.userId;
    badge.userId = null;
    this.touch(badge);
    this.pushAudit({
      action: "badge_unlinked",
      actorId,
      subjectUserId: prevUser,
      entityType: "Badge",
      entityId: badgeId,
    });
    return badge;
  }

  async adminRecordCheckoff(input: CheckoffInput): Promise<UserCertification> {
    this.requireUser(input.userId);
    const cert = this.state.certifications.find(
      (c) => c.id === input.certificationId,
    );
    if (!cert) throw new Error("Certification not found");
    const now = input.checkedOffAt ?? this.now();
    let uc = this.state.userCertifications.find(
      (c) =>
        c.userId === input.userId &&
        c.certificationId === input.certificationId,
    );
    const expiresAt =
      cert.expiryMonths != null
        ? addDays(now, cert.expiryMonths * 30)
        : null;
    if (!uc) {
      uc = {
        id: this.id("uc"),
        userId: input.userId,
        certificationId: input.certificationId,
        status: "certified",
        knowledgePassedAt: now,
        checkedOffAt: now,
        checkedOffById: input.actorId,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };
      this.state.userCertifications.push(uc);
    } else {
      uc.status = "certified";
      uc.checkedOffAt = now;
      uc.checkedOffById = input.actorId;
      uc.expiresAt = expiresAt;
      uc.revokedAt = null;
      uc.revokedById = null;
      uc.revokeReason = null;
      this.touch(uc);
    }
    this.pushAudit({
      action: "cert_checked_off",
      actorId: input.actorId,
      subjectUserId: input.userId,
      entityType: "UserCertification",
      entityId: uc.id,
    });
    return uc;
  }

  async adminRevokeCertification(input: RevokeInput): Promise<UserCertification> {
    const uc = this.state.userCertifications.find(
      (c) =>
        c.userId === input.userId &&
        c.certificationId === input.certificationId,
    );
    if (!uc) throw new Error("User certification not found");
    uc.status = "revoked";
    uc.revokedAt = this.now();
    uc.revokedById = input.actorId;
    uc.revokeReason = input.reason;
    this.touch(uc);
    this.pushAudit({
      action: "cert_revoked",
      actorId: input.actorId,
      subjectUserId: input.userId,
      entityType: "UserCertification",
      entityId: uc.id,
      metadata: { reason: input.reason },
    });
    return uc;
  }

  async adminUpsertCertification(
    data: CertificationInput,
  ): Promise<Certification> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.certifications.find((c) => c.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const cert: Certification = {
      id: data.id ?? this.id("cert"),
      slug: data.slug,
      name: data.name,
      description: data.description ?? "",
      knowledgeOnly: data.knowledgeOnly ?? false,
      requiresCertificationIds: data.requiresCertificationIds ?? [],
      expiryMonths: data.expiryMonths ?? null,
      sortOrder: data.sortOrder ?? this.state.certifications.length + 1,
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.certifications.push(cert);
    return cert;
  }

  async adminUpsertClass(data: ClassSessionInput): Promise<ClassSession> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.classSessions.find((c) => c.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const session: ClassSession = {
      id: data.id ?? this.id("class"),
      title: data.title,
      slug:
        data.slug ??
        data.title.toLowerCase().replace(/\s+/g, "-").slice(0, 48),
      descriptionSlug: data.descriptionSlug ?? "class-generic",
      category: data.category ?? "workshop",
      instructorId: data.instructorId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      capacity: data.capacity,
      priceCents: data.priceCents ?? 0,
      zeffyUrl: data.zeffyUrl ?? null,
      prerequisiteCertificationIds: data.prerequisiteCertificationIds ?? [],
      location: data.location ?? "The Box",
      cancellationCutoffHours: data.cancellationCutoffHours ?? null,
      published: data.published ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.classSessions.push(session);
    return session;
  }

  async adminListRoster(classSessionId: string): Promise<BookingRosterRow[]> {
    return this.state.bookings
      .filter((b) => b.classSessionId === classSessionId)
      .map((b) => {
        const user = this.requireUser(b.userId);
        return {
          ...b,
          user: {
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            status: user.status,
          },
        };
      });
  }

  async adminMarkBookingPaid(
    bookingId: string,
    actorId: string,
  ): Promise<Booking> {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "awaiting_payment" && booking.status !== "waitlisted") {
      // Allow marking paid for awaiting_payment primarily
      if (booking.status !== "booked") {
        throw new Error(`Cannot mark paid from status ${booking.status}`);
      }
    }
    booking.status = "booked";
    booking.paidAt = this.now();
    booking.paidMarkedById = actorId;
    booking.paymentHoldExpiresAt = null;
    booking.waitlistPosition = null;
    this.touch(booking);
    this.pushAudit({
      action: "booking_marked_paid",
      actorId,
      subjectUserId: booking.userId,
      entityType: "Booking",
      entityId: booking.id,
    });
    return booking;
  }

  async adminMarkAttendance(
    bookingId: string,
    status: Extract<BookingStatus, "attended" | "no_show">,
    _actorId: string,
  ): Promise<Booking> {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");
    booking.status = status;
    if (status === "attended") booking.attendedAt = this.now();
    return this.touch(booking);
  }

  async adminPromoteFromWaitlist(
    classSessionId: string,
    actorId: string,
  ): Promise<Booking | null> {
    const session = this.state.classSessions.find((c) => c.id === classSessionId);
    if (!session) throw new Error("Class session not found");

    const seats = this.state.bookings.filter(
      (b) =>
        b.classSessionId === classSessionId &&
        SEAT_STATUSES.includes(b.status),
    );
    if (seats.length >= session.capacity) return null;

    const next = this.state.bookings
      .filter(
        (b) =>
          b.classSessionId === classSessionId && b.status === "waitlisted",
      )
      .sort(
        (a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0),
      )[0];
    if (!next) return null;

    const now = this.now();
    if (session.priceCents > 0) {
      next.status = "awaiting_payment";
      next.paymentHoldExpiresAt = addHours(
        now,
        this.state.settings.paymentHoldHours,
      );
    } else {
      next.status = "booked";
    }
    next.waitlistPosition = null;
    this.touch(next);

    const remaining = this.state.bookings
      .filter(
        (b) =>
          b.classSessionId === classSessionId && b.status === "waitlisted",
      )
      .sort(
        (a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0),
      );
    remaining.forEach((b, i) => {
      b.waitlistPosition = i + 1;
      this.touch(b);
    });

    void actorId;
    return next;
  }

  async adminCreateReservation(
    input: ReserveInput & { createdById: string },
  ): Promise<Reservation> {
    // Admin override: skip horizon / max-open / hours-per-day, still check overlap & machine
    this.requireUser(input.userId);
    const machine = this.state.machines.find((m) => m.id === input.machineId);
    if (!machine) throw new Error("Machine not found");
    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new Error("Reservation end must be after start");
    }
    const conflict = this.state.reservations.find(
      (r) =>
        r.machineId === input.machineId &&
        r.status === "booked" &&
        overlaps(r.startsAt, r.endsAt, input.startsAt, input.endsAt),
    );
    if (conflict) {
      throw new Error("Machine already reserved for that time");
    }
    const now = this.now();
    const reservation: Reservation = {
      id: this.id("res"),
      userId: input.userId,
      machineId: input.machineId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "booked",
      createdById: input.createdById,
      cancelledAt: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.reservations.push(reservation);
    this.pushAudit({
      action: "reservation_overridden",
      actorId: input.createdById,
      subjectUserId: input.userId,
      entityType: "Reservation",
      entityId: reservation.id,
    });
    return reservation;
  }

  async adminCancelReservation(
    id: string,
    actorId: string,
  ): Promise<Reservation> {
    const reservation = this.state.reservations.find((r) => r.id === id);
    if (!reservation) throw new Error("Reservation not found");
    reservation.status = "cancelled";
    reservation.cancelledAt = this.now();
    reservation.cancelReason = `cancelled_by_${actorId}`;
    return this.touch(reservation);
  }

  async adminUpsertMaintenanceBlock(
    data: MaintenanceBlockInput,
  ): Promise<MaintenanceBlock> {
    const actor = this.state.users.find((u) => u.id === data.createdById);
    const progress = this.toolChampionProgressFor(data.createdById);
    if (!canScheduleMaintenance(actor, progress.activeMachineIds)) {
      throw new Error(
        "Only staff, Shop Stewards, or active Tool Champions can schedule maintenance",
      );
    }
    const scope = maintenanceMachineScope(actor, progress.activeMachineIds);
    if (scope !== "all" && !scope.includes(data.machineId)) {
      throw new Error("You can only schedule maintenance on your championed machines");
    }
    if (new Date(data.endsAt).getTime() <= new Date(data.startsAt).getTime()) {
      throw new Error("Maintenance end must be after start");
    }

    const now = this.now();
    if (data.id) {
      const existing = this.state.maintenanceBlocks.find((m) => m.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const block: MaintenanceBlock = {
      id: data.id ?? this.id("mb"),
      machineId: data.machineId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      reason: data.reason,
      createdById: data.createdById,
      createdAt: now,
      updatedAt: now,
    };
    this.state.maintenanceBlocks.push(block);
    this.pushAudit({
      action: "maintenance_created",
      actorId: data.createdById,
      entityType: "MaintenanceBlock",
      entityId: block.id,
    });
    return block;
  }

  async adminListMaintenanceBlocks(): Promise<MaintenanceBlock[]> {
    return [...this.state.maintenanceBlocks];
  }

  private toolChampionProgressFor(userId: string): ToolChampionProgress {
    const terms = this.state.toolChampionTerms.filter((t) => t.userId === userId);
    const now = Date.now();
    const activeMachineIds = terms
      .filter(
        (t) =>
          t.status === "active" &&
          (!t.endsAt || new Date(t.endsAt).getTime() >= now),
      )
      .map((t) => t.machineId);
    const completedMachineIds = [
      ...new Set(
        terms
          .filter((t) => t.status === "completed")
          .map((t) => t.machineId),
      ),
    ];
    const user = this.state.users.find((u) => u.id === userId) ?? null;
    const lead = shopLeadProgress(completedMachineIds.length);
    return {
      terms: [...terms].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      activeMachineIds,
      completedMachineIds,
      completedCount: completedMachineIds.length,
      shopLeadEligible: lead.eligible,
      canScheduleMaintenance: canScheduleMaintenance(user, activeMachineIds),
      maintenanceMachineIds: maintenanceMachineScope(user, activeMachineIds),
    };
  }

  async getToolChampionProgress(userId: string): Promise<ToolChampionProgress> {
    return this.toolChampionProgressFor(userId);
  }

  async listToolChampionTerms(userId?: string): Promise<ToolChampionTerm[]> {
    const rows = userId
      ? this.state.toolChampionTerms.filter((t) => t.userId === userId)
      : this.state.toolChampionTerms;
    return [...rows].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async requestToolChampionTerm(
    input: ToolChampionRequestInput,
  ): Promise<ToolChampionTerm> {
    this.requireUser(input.userId);
    const machine = this.state.machines.find((m) => m.id === input.machineId);
    if (!machine?.active) throw new Error("Machine not found");

    const duplicate = this.state.toolChampionTerms.find(
      (t) =>
        t.userId === input.userId &&
        t.machineId === input.machineId &&
        (t.status === "pending" || t.status === "active"),
    );
    if (duplicate) {
      throw new Error("You already have a pending or active term on this machine");
    }

    const now = this.now();
    const term: ToolChampionTerm = {
      id: this.id("tc"),
      userId: input.userId,
      machineId: input.machineId,
      status: "pending",
      startsAt: null,
      endsAt: null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.toolChampionTerms.push(term);
    this.pushAudit({
      action: "tool_champion_requested",
      actorId: input.userId,
      subjectUserId: input.userId,
      entityType: "ToolChampionTerm",
      entityId: term.id,
    });
    return term;
  }

  async adminActivateToolChampionTerm(
    id: string,
    actorId: string,
  ): Promise<ToolChampionTerm> {
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!actor || (actor.role !== "staff" && actor.role !== "admin")) {
      throw new Error("Staff only");
    }
    const term = this.state.toolChampionTerms.find((t) => t.id === id);
    if (!term) throw new Error("Tool champion term not found");
    if (term.status !== "pending" && term.status !== "active") {
      throw new Error("Only pending terms can be activated");
    }
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + TOOL_CHAMPION_TERM_MONTHS);
    term.status = "active";
    term.startsAt = start.toISOString();
    term.endsAt = end.toISOString();
    this.touch(term);
    this.pushAudit({
      action: "tool_champion_activated",
      actorId,
      subjectUserId: term.userId,
      entityType: "ToolChampionTerm",
      entityId: term.id,
    });
    return term;
  }

  async adminCompleteToolChampionTerm(
    id: string,
    actorId: string,
  ): Promise<ToolChampionTerm> {
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!actor || (actor.role !== "staff" && actor.role !== "admin")) {
      throw new Error("Staff only");
    }
    const term = this.state.toolChampionTerms.find((t) => t.id === id);
    if (!term) throw new Error("Tool champion term not found");
    if (term.status !== "active") {
      throw new Error("Only active terms can be completed");
    }
    term.status = "completed";
    this.touch(term);
    this.pushAudit({
      action: "tool_champion_completed",
      actorId,
      subjectUserId: term.userId,
      entityType: "ToolChampionTerm",
      entityId: term.id,
    });
    return term;
  }

  async adminUpsertModule(data: ModuleInput): Promise<LearningModule> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.learningModules.find((m) => m.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const mod: LearningModule = {
      id: data.id ?? this.id("mod"),
      slug: data.slug,
      title: data.title,
      summary: data.summary ?? "",
      certificationId: data.certificationId,
      knowledgeOnly: data.knowledgeOnly ?? false,
      published: data.published ?? false,
      passThresholdPercent:
        data.passThresholdPercent ??
        this.state.settings.quizPassThresholdPercent,
      attemptLimit:
        data.attemptLimit ?? this.state.settings.quizAttemptLimit,
      sortOrder: data.sortOrder ?? this.state.learningModules.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.state.learningModules.push(mod);
    return mod;
  }

  async adminUpsertLesson(data: LessonInput): Promise<Lesson> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.lessons.find((l) => l.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const lesson: Lesson = {
      id: data.id ?? this.id("les"),
      moduleId: data.moduleId,
      slug: data.slug,
      title: data.title,
      contentSlug: data.contentSlug,
      sortOrder:
        data.sortOrder ??
        this.state.lessons.filter((l) => l.moduleId === data.moduleId).length +
          1,
      estimatedMinutes: data.estimatedMinutes ?? 10,
      createdAt: now,
      updatedAt: now,
    };
    this.state.lessons.push(lesson);
    return lesson;
  }

  async adminUpsertQuestion(data: QuestionInput): Promise<Question> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.questions.find((q) => q.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const question: Question = {
      id: data.id ?? this.id("q"),
      moduleId: data.moduleId,
      prompt: data.prompt,
      choices: data.choices,
      correctIndex: data.correctIndex,
      explanation: data.explanation,
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.questions.push(question);
    return question;
  }

  async adminListQuestions(moduleId: string): Promise<Question[]> {
    return this.state.questions
      .filter((q) => q.moduleId === moduleId)
      .sort((a, b) => a.prompt.localeCompare(b.prompt));
  }

  async adminPublishModule(
    id: string,
    published: boolean,
  ): Promise<LearningModule> {
    const mod = this.state.learningModules.find((m) => m.id === id);
    if (!mod) throw new Error("Module not found");
    mod.published = published;
    return this.touch(mod);
  }

  async adminUpsertMachine(data: MachineInput): Promise<Machine> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.machines.find((m) => m.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const machine: Machine = {
      id: data.id ?? this.id("m"),
      name: data.name,
      area: data.area,
      requiredCertificationIds: data.requiredCertificationIds,
      readerKey: data.readerKey,
      active: data.active ?? true,
      reservationRecommended: data.reservationRecommended ?? false,
      reservationRequired: data.reservationRequired ?? false,
      locationLabel: data.locationLabel ?? "",
      gettingStartedVideoUrl: data.gettingStartedVideoUrl ?? null,
      sortOrder: data.sortOrder ?? this.state.machines.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.state.machines.push(machine);
    return machine;
  }

  async adminListUsage(
    range: DateRange,
    filters?: UsageFilters,
  ): Promise<UsageSession[]> {
    return this.state.usageSessions.filter((s) => {
      if (filters?.userId && s.userId !== filters.userId) return false;
      if (filters?.machineId && s.machineId !== filters.machineId) return false;
      const t = new Date(s.startedAt).getTime();
      return (
        t >= new Date(range.from).getTime() &&
        t <= new Date(range.to).getTime()
      );
    });
  }

  async adminListAccessLogs(range: DateRange): Promise<AccessLog[]> {
    return this.state.accessLogs.filter((l) => {
      const t = new Date(l.requestedAt).getTime();
      return (
        t >= new Date(range.from).getTime() &&
        t <= new Date(range.to).getTime()
      );
    });
  }

  async adminListVolunteerInterests(): Promise<VolunteerInterest[]> {
    return [...this.state.volunteerInterests].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async adminUpdateVolunteerInterest(
    id: string,
    data: VolunteerInterestAdminUpdate,
  ): Promise<VolunteerInterest> {
    const interest = this.state.volunteerInterests.find((v) => v.id === id);
    if (!interest) throw new Error("Volunteer interest not found");
    if (data.status != null) interest.status = data.status;
    if (data.notes != null) interest.notes = data.notes;
    if (data.reviewedById != null) {
      interest.reviewedById = data.reviewedById;
      interest.reviewedAt = this.now();
    }
    return this.touch(interest);
  }

  async adminListContentMappings(): Promise<ContentPage[]> {
    return [...this.state.contentPages];
  }

  async adminSyncContent(): Promise<{ syncedAt: ISODateTime; count: number }> {
    const syncedAt = this.now();
    for (const page of this.state.contentPages) {
      page.syncedAt = syncedAt;
      this.touch(page);
    }
    return { syncedAt, count: this.state.contentPages.length };
  }

  async adminUpdateSettings(
    data: Partial<OrgSettings>,
  ): Promise<OrgSettings> {
    Object.assign(this.state.settings, data, { updatedAt: this.now() });
    return { ...this.state.settings };
  }

  async adminListAuditEvents(subjectUserId?: string): Promise<AuditEvent[]> {
    return this.state.auditEvents
      .filter((e) => !subjectUserId || e.subjectUserId === subjectUserId)
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
  }

  // ── Access control ────────────────────────────────────────────────────────

  async authorizeAccess(input: {
    readerKey: string;
    badgeUid: string;
  }): Promise<AuthorizeResult> {
    const now = this.now();
    const machine = this.state.machines.find(
      (m) => m.readerKey === input.readerKey,
    );
    const badge = this.state.badges.find((b) => b.uid === input.badgeUid);
    const user =
      badge?.userId != null
        ? this.state.users.find((u) => u.id === badge.userId) ?? null
        : null;

    const ownRes = this.state.reservations.find(
      (r) =>
        r.machineId === machine?.id &&
        r.status === "booked" &&
        r.userId === user?.id &&
        machine != null &&
        user != null &&
        overlaps(r.startsAt, r.endsAt, now, addHours(now, 0.01)),
    );

    const evaluation = evaluateMachineAccess({
      user,
      badge: badge ?? null,
      machine: machine ?? null,
      userCertifications: this.state.userCertifications,
      waiverSignatures: this.state.waiverSignatures,
      currentWaiverVersion: this.state.settings.currentWaiverVersion,
      hasOverlappingReservation: Boolean(ownRes),
      now,
    });

    let reservationNotice: string | undefined;
    let sessionId: string | undefined;

    if (evaluation.allow && machine && badge && user) {
      const windowEnd = addHours(now, 0.25); // 15 minutes
      const upcoming = this.state.reservations.find(
        (r) =>
          r.machineId === machine.id &&
          r.status === "booked" &&
          r.userId !== user.id &&
          new Date(r.startsAt) >= new Date(now) &&
          new Date(r.startsAt) <= new Date(windowEnd),
      );
      if (upcoming) {
        const other = this.state.users.find((u) => u.id === upcoming.userId);
        reservationNotice = `Reservation for ${other?.displayName ?? "another member"} starts soon`;
      }

      const session: UsageSession = {
        id: this.id("us"),
        userId: user.id,
        machineId: machine.id,
        badgeId: badge.id,
        startedAt: now,
        endedAt: null,
        reservationId: ownRes?.id ?? null,
        endedBy: "reader",
        createdAt: now,
        updatedAt: now,
      };
      this.state.usageSessions.push(session);
      sessionId = session.id;
    }

    const log: AccessLog = {
      id: this.id("al"),
      readerKey: input.readerKey,
      machineId: machine?.id ?? null,
      badgeUid: input.badgeUid,
      userId: user?.id ?? null,
      allow: evaluation.allow,
      reason: evaluation.reason,
      reservationNotice: reservationNotice ?? null,
      sessionId: sessionId ?? null,
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.accessLogs.push(log);

    return {
      allow: evaluation.allow,
      reason: evaluation.reason,
      userDisplayName: user?.displayName,
      sessionId,
      reservationNotice,
    };
  }

  async endAccess(input: {
    readerKey: string;
    sessionId: string;
  }): Promise<UsageSession> {
    const session = this.state.usageSessions.find((s) => s.id === input.sessionId);
    if (!session) throw new Error("Session not found");
    const machine = this.state.machines.find((m) => m.id === session.machineId);
    if (!machine || machine.readerKey !== input.readerKey) {
      throw new Error("Session does not match reader");
    }
    if (session.endedAt) throw new Error("Session already ended");
    session.endedAt = this.now();
    session.endedBy = "reader";
    return this.touch(session);
  }

  async getAllowlist(readerKey: string): Promise<AllowlistResult> {
    const machine = this.state.machines.find((m) => m.readerKey === readerKey);
    if (!machine) {
      throw new Error(`Unknown reader: ${readerKey}`);
    }
    const badgeUids: string[] = [];
    for (const badge of this.state.badges) {
      if (!badge.active || !badge.userId) continue;
      const user = this.state.users.find((u) => u.id === badge.userId) ?? null;
      const result = evaluateMachineAccess({
        user,
        badge,
        machine,
        userCertifications: this.state.userCertifications,
        waiverSignatures: this.state.waiverSignatures,
        currentWaiverVersion: this.state.settings.currentWaiverVersion,
      });
      if (result.allow) badgeUids.push(badge.uid);
    }
    badgeUids.sort();
    return {
      readerKey,
      badgeUids,
      versionHash: simpleHash(badgeUids.join(",")),
    };
  }

  async getDisplayFeed() {
    return buildDisplayFeed({
      machines: this.state.machines,
      usageSessions: this.state.usageSessions,
      reservations: this.state.reservations,
      maintenanceBlocks: this.state.maintenanceBlocks,
      classSessions: this.state.classSessions,
      bookings: this.state.bookings,
      users: this.state.users,
      certifications: this.state.certifications,
      learningModules: this.state.learningModules,
      membershipProducts: this.state.membershipProducts,
      promoSlides: this.state.promoSlides,
      displayConfig: this.state.displayConfig,
    });
  }

  async getMachineStatus() {
    return buildMachineStatuses({
      machines: this.state.machines,
      usageSessions: this.state.usageSessions,
      reservations: this.state.reservations,
      maintenanceBlocks: this.state.maintenanceBlocks,
      users: this.state.users,
      nameDisplayMode: this.state.displayConfig.nameDisplayMode,
      now: new Date(),
    });
  }

  async listPromos(): Promise<PromoSlide[]> {
    return [...this.state.promoSlides]
      .filter((p) => !p.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async savePromo(data: PromoSlideInput): Promise<PromoSlide> {
    const now = this.now();
    if (data.id) {
      const existing = this.state.promoSlides.find((p) => p.id === data.id);
      if (existing) {
        Object.assign(existing, data, { updatedAt: now });
        return existing;
      }
    }
    const slide: PromoSlide = {
      id: data.id ?? this.id("promo"),
      title: data.title,
      body: data.body,
      imageUrl: data.imageUrl ?? null,
      qrUrl: data.qrUrl ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      active: data.active ?? true,
      sortOrder: data.sortOrder ?? this.state.promoSlides.length + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.state.promoSlides.push(slide);
    return slide;
  }

  async deletePromo(id: string): Promise<void> {
    const slide = this.state.promoSlides.find((p) => p.id === id);
    if (!slide) throw new Error("Promo not found");
    slide.deletedAt = this.now();
    slide.active = false;
    slide.updatedAt = this.now();
  }

  async getDisplayConfig(): Promise<DisplayConfig> {
    return structuredClone(this.state.displayConfig);
  }

  async saveDisplayConfig(
    data: Partial<DisplayConfig>,
  ): Promise<DisplayConfig> {
    const allowedPanels: DisplayPanelId[] = [
      "today",
      "machines",
      "upcoming",
      "certs",
      "promos",
      "membership",
    ];
    if (data.panelOrder) {
      const filtered = data.panelOrder.filter((p) =>
        allowedPanels.includes(p),
      );
      this.state.displayConfig.panelOrder = filtered;
    }
    if (data.cadenceSeconds != null) {
      this.state.displayConfig.cadenceSeconds = Math.max(
        5,
        Math.min(120, data.cadenceSeconds),
      );
    }
    if (data.pinnedPanel !== undefined) {
      this.state.displayConfig.pinnedPanel = data.pinnedPanel;
    }
    if (data.nameDisplayMode) {
      const modes: NameDisplayMode[] = ["none", "first", "firstLast"];
      if (modes.includes(data.nameDisplayMode)) {
        this.state.displayConfig.nameDisplayMode = data.nameDisplayMode;
      }
    }
    if (data.membershipEveryNRotations != null) {
      this.state.displayConfig.membershipEveryNRotations = Math.max(
        1,
        data.membershipEveryNRotations,
      );
    }
    this.state.displayConfig.updatedAt = this.now();
    return structuredClone(this.state.displayConfig);
  }
}

export function createMockDataProvider(
  initialUserId?: string | null,
): MockDataProvider {
  return new MockDataProvider(loadFixtures(), initialUserId);
}
