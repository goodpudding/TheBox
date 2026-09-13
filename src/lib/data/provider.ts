import type {
  AccessLog,
  AuditEvent,
  Badge,
  Booking,
  BookingStatus,
  Certification,
  ClassSession,
  ClassCategory,
  ContentPage,
  DisplayConfig,
  DisplayPanelId,
  ISODate,
  ISODateTime,
  LearningModule,
  Lesson,
  LessonProgress,
  LessonVideo,
  Machine,
  MachineArea,
  MachineFloorStatus,
  MaintenanceBlock,
  MembershipProduct,
  MembershipStatus,
  NameDisplayMode,
  OrgSettings,
  PolicyAcknowledgement,
  PromoSlide,
  PublishBlocker,
  Question,
  QuizAttempt,
  Reservation,
  ScholarshipFundSummary,
  ToolChampionTerm,
  UsageSession,
  User,
  UserCertification,
  VideoWatch,
  VolunteerInterest,
  VolunteerInterestStatus,
  VolunteerRole,
  WaiverSignature,
  ClassInterestBoard,
  ClassInterestSignup,
  ClassInterestStatus,
} from "./types";

// Re-export view/DTO types used by the provider interface
export interface DateRange {
  from: ISODateTime;
  to: ISODateTime;
}

export interface ProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export interface SignWaiverInput {
  userId: string;
  fullNameTyped: string;
  agreed: boolean;
  ip: string;
  userAgent?: string;
}

export interface AckPolicyInput {
  userId: string;
  policySlug: string;
  version: string;
}

export interface UserCertificationView extends UserCertification {
  certification: Certification;
}

export interface ClassFilters {
  category?: string;
  upcomingOnly?: boolean;
}

export interface ClassSessionView extends ClassSession {
  instructor: Pick<User, "id" | "displayName">;
  bookedCount: number;
  waitlistCount: number;
  spotsRemaining: number;
  currentUserBooking?: Booking | null;
}

export interface ReservationFilters {
  userId?: string;
  machineId?: string;
  from?: ISODateTime;
  to?: ISODateTime;
  status?: Reservation["status"] | Reservation["status"][];
}

export interface ReserveInput {
  userId: string;
  machineId: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  createdById?: string;
}

export interface AvailabilitySlot {
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  available: boolean;
  reason?: "reserved" | "maintenance" | "closed" | "past";
  reservationId?: string;
}

export interface LearningModuleView extends LearningModule {
  certification: Certification;
  lessonCount: number;
  completedLessonCount: number;
  attemptCount: number;
  knowledgePassed: boolean;
  primaryVideosWatched: boolean;
  /** Member-facing progress chip. */
  memberStatus:
    | "not_started"
    | "in_progress"
    | "quiz_ready"
    | "knowledge_passed_needs_checkoff"
    | "certified";
  publishReadiness?: ModulePublishReadiness;
}

export interface LearningModuleDetail extends LearningModuleView {
  lessons: (Lesson & {
    completed: boolean;
    html: string;
    videos: (LessonVideo & { watched: boolean })[];
  })[];
  primaryVideosWatched: boolean;
  attemptsRemaining: number;
}

export interface QuizPayload {
  attemptToken: string;
  moduleId: string;
  questions: {
    id: string;
    prompt: string;
    choices: string[];
    /** True when more than one correctIndexes entry (multi-select). */
    multi?: boolean;
  }[];
  passThresholdPercent: number;
  attemptNumber: number;
  attemptLimit: number;
}

export interface SubmitQuizInput {
  attemptToken: string;
  userId: string;
  moduleId: string;
  questionIds: string[];
  answers: (number | number[] | null)[];
}

export interface QuizAttemptResult {
  attempt: QuizAttempt;
  passed: boolean;
  scorePct: number;
  scorePercent: number;
  thresholdMet: boolean;
  safetyCriticalMissed: Question[];
  attemptsRemaining: number;
  knowledgePassed: boolean;
}

export interface ModulePublishReadiness {
  canPublish: boolean;
  answerPendingCount: number;
  unreviewedPrimaryVideoCount: number;
  equipmentUnconfirmed: boolean;
  gapLessonCount: number;
  answerPendingQuestionIds: string[];
  unreviewedPrimaryVideoIds: string[];
  gapLessonIds: string[];
}

/** Member awaiting hands-on checkoff after passing the knowledge quiz. */
export interface PendingCheckoff {
  userId: string;
  userDisplayName: string;
  userEmail: string;
  certificationId: string;
  certificationName: string;
  knowledgePassedAt: ISODateTime;
  machineIds: string[];
  machineNames: string[];
  /** Active tool champions for those machines. */
  championUserIds: string[];
  championDisplayNames: string[];
  /** Viewer may record the checkoff (staff/admin or champion of a related machine). */
  canCheckoff: boolean;
}

export type PublishModuleResult =
  | { ok: true; module: LearningModule }
  | { ok: false; reasons: PublishBlocker[]; readiness: ModulePublishReadiness };

export interface VolunteerInterestInput {
  name: string;
  email: string;
  phone?: string;
  roleId?: string | null;
  message: string;
  userId?: string | null;
}

export interface UsageTotal {
  machineId: string;
  machineName: string;
  sessionCount: number;
  totalMinutes: number;
}

export interface CheckoffInput {
  userId: string;
  certificationId: string;
  actorId: string;
  checkedOffAt?: ISODateTime;
}

export interface RevokeInput {
  userId: string;
  certificationId: string;
  actorId: string;
  reason: string;
}

export interface CertificationInput extends Partial<Certification> {
  name: string;
  slug: string;
}

export interface ClassSessionInput extends Partial<ClassSession> {
  title: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  capacity: number;
  instructorId: string;
}

export interface BookingRosterRow extends Booking {
  user: Pick<User, "id" | "displayName" | "email" | "status">;
}

export interface MaintenanceBlockInput {
  id?: string;
  machineId: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  reason: string;
  createdById: string;
}

export interface ToolChampionRequestInput {
  userId: string;
  machineId: string;
  notes?: string;
}

export interface ToolChampionProgress {
  terms: ToolChampionTerm[];
  activeMachineIds: string[];
  completedMachineIds: string[];
  completedCount: number;
  shopLeadEligible: boolean;
  canScheduleMaintenance: boolean;
  maintenanceMachineIds: "all" | string[];
}

export interface ModuleInput extends Partial<LearningModule> {
  title: string;
  slug: string;
  certificationId: string;
}

export interface LessonInput extends Partial<Lesson> {
  moduleId: string;
  title: string;
  slug: string;
  contentSlug: string;
}

export interface QuestionInput extends Partial<Question> {
  moduleId: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export interface VideoInput extends Partial<LessonVideo> {
  lessonId: string;
  title: string;
  youtubeId: string;
  url: string;
  channel: string;
  role: LessonVideo["role"];
  order: number;
}

export interface MachineInput extends Partial<Machine> {
  name: string;
  area: Machine["area"];
  requiredCertificationIds: string[];
  readerKey: string;
}

export interface UsageFilters {
  userId?: string;
  machineId?: string;
}

export interface VolunteerInterestAdminUpdate {
  status?: VolunteerInterestStatus;
  notes?: string;
  reviewedById?: string;
}

export interface ClassInterestBoardInput {
  title: string;
  summary: string;
  category?: ClassCategory;
  threshold?: number;
  proposedByUserId?: string | null;
  contactName: string;
  contactEmail: string;
  instructorHintUserId?: string | null;
  forcePending?: boolean;
}

export interface ClassInterestSignupInput {
  boardId: string;
  userId?: string | null;
  email: string;
  displayName: string;
}

export interface ClassInterestBoardAdminUpdate {
  status?: ClassInterestStatus;
  threshold?: number;
  closesAt?: ISODateTime | null;
  staffNotes?: string | null;
  instructorHintUserId?: string | null;
  reviewedById?: string | null;
}

export interface ClassInterestBoardView extends ClassInterestBoard {
  interestCount: number;
  viewerSignedUp: boolean;
  daysRemaining: number | null;
  proposedByDisplayName?: string | null;
  instructorHintDisplayName?: string | null;
}

export interface DisplayHoursToday {
  label: string;
  openHour: number;
  closeHour: number;
}

export interface DisplayTodaySession {
  id: string;
  title: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  location: string;
  category: ClassCategory;
  spotsRemaining: number;
  capacity: number;
}

export interface DisplayTodayReservation {
  machineId: string;
  machineName: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  displayName: string;
}

export interface DisplayMachineStatus {
  id: string;
  name: string;
  area: MachineArea;
  status: MachineFloorStatus;
  since?: ISODateTime;
  displayName?: string;
  reservedAt?: ISODateTime;
  attendedOperationRequired?: boolean;
}

export interface DisplayUpcomingItem {
  id: string;
  title: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  location: string;
  category: ClassCategory;
  spotsRemaining: number;
  bookingUrl: string;
}

export interface DisplayCheckoff {
  id: string;
  title: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
  location: string;
  spotsRemaining: number;
}

export interface DisplayOnlineCert {
  certificationId: string;
  name: string;
  moduleSlug: string;
}

export interface DisplayMembershipTier {
  joinUrl: string;
  products: Pick<
    MembershipProduct,
    "id" | "name" | "tier" | "priceCents" | "billingInterval" | "summary"
  >[];
}

export interface DisplayFeed {
  now: ISODateTime;
  hours: DisplayHoursToday;
  isOpen: boolean;
  todaySessions: DisplayTodaySession[];
  todayReservations: DisplayTodayReservation[];
  machines: DisplayMachineStatus[];
  upcoming: DisplayUpcomingItem[];
  checkoffs: DisplayCheckoff[];
  onlineCerts: DisplayOnlineCert[];
  promos: PromoSlide[];
  membership: DisplayMembershipTier;
  config: DisplayConfig;
}

export interface PromoSlideInput extends Partial<PromoSlide> {
  title: string;
  body: string;
  startsAt: ISODateTime;
  endsAt: ISODateTime;
}

export interface AuthorizeResult {
  allow: boolean;
  reason: string;
  userDisplayName?: string;
  sessionId?: string;
  reservationNotice?: string;
}

export interface AllowlistResult {
  readerKey: string;
  badgeUids: string[];
  versionHash: string;
}

export interface OnboardingState {
  profileComplete: boolean;
  waiverSignedCurrent: boolean;
  expectationsAcknowledged: boolean;
  complete: boolean;
  nextStep: "profile" | "waiver" | "expectations" | null;
}

/**
 * Every read/write the UI needs. Mock and Prisma implement the same contract.
 */
export interface DataProvider {
  getCurrentUser(): Promise<User | null>;
  setCurrentUserId(id: string | null): Promise<void>;
  listSwitchableUsers(): Promise<User[]>;
  getOnboardingState(userId: string): Promise<OnboardingState>;

  getMember(id: string): Promise<User | null>;
  updateMemberProfile(id: string, data: ProfileInput): Promise<User>;
  getWaiver(version?: string): Promise<ContentPage>;
  signWaiver(input: SignWaiverInput): Promise<WaiverSignature>;
  listWaiverHistory(userId: string): Promise<WaiverSignature[]>;
  acknowledgePolicy(input: AckPolicyInput): Promise<PolicyAcknowledgement>;
  listBadges(userId: string): Promise<Badge[]>;

  listCertifications(): Promise<Certification[]>;
  /** Full catalog joined with this member’s status (includes not_started). */
  getCertifications(userId: string): Promise<UserCertificationView[]>;

  getUsage(userId: string, range?: DateRange): Promise<UsageSession[]>;
  getUsageTotals(userId: string, month: string): Promise<UsageTotal[]>;

  listClasses(filters?: ClassFilters): Promise<ClassSessionView[]>;
  getClass(id: string): Promise<ClassSessionView | null>;
  book(classSessionId: string, userId: string): Promise<Booking>;
  cancel(bookingId: string, userId: string): Promise<Booking>;

  listReservations(filters: ReservationFilters): Promise<Reservation[]>;
  reserve(input: ReserveInput): Promise<Reservation>;
  cancelReservation(id: string, userId: string): Promise<Reservation>;
  listMachines(): Promise<Machine[]>;
  getMachineAvailability(
    machineId: string,
    from: ISODate,
    to: ISODate,
  ): Promise<AvailabilitySlot[]>;

  listModules(): Promise<LearningModuleView[]>;
  getModule(slug: string): Promise<LearningModuleDetail | null>;
  markLessonComplete(lessonId: string, userId: string): Promise<LessonProgress>;
  markVideoWatched(videoId: string, userId: string): Promise<VideoWatch>;
  getQuestionBank(moduleId: string): Promise<Question[]>;
  startQuiz(moduleId: string, userId: string): Promise<QuizPayload>;
  submitQuiz(input: SubmitQuizInput): Promise<QuizAttemptResult>;
  getModulePublishReadiness(moduleId: string): Promise<ModulePublishReadiness>;
  /**
   * Members with knowledge_passed on non–knowledge-only certs.
   * Pass viewerId to mark canCheckoff and optionally filter to a champion’s machines.
   */
  listPendingCheckoffs(viewerId: string): Promise<PendingCheckoff[]>;
  /**
   * Staff/admin always; active tool champions may check off certs required by
   * their championed machines.
   */
  recordCheckoff(input: CheckoffInput): Promise<UserCertification>;

  listPolicies(): Promise<ContentPage[]>;
  getContentBySlug(slug: string): Promise<ContentPage | null>;
  listVolunteerRoles(): Promise<VolunteerRole[]>;
  submitVolunteerInterest(
    input: VolunteerInterestInput,
  ): Promise<VolunteerInterest>;
  getSettings(): Promise<OrgSettings>;
  listMembershipProducts(): Promise<MembershipProduct[]>;
  getScholarshipFundSummary(): Promise<ScholarshipFundSummary>;
  listBookingsForUser(userId: string): Promise<Booking[]>;

  listInterestBoards(filters?: {
    status?: ClassInterestStatus | ClassInterestStatus[];
    proposedByUserId?: string;
    /** Public catalog: open + ready (after expiry sweep). */
    publicOnly?: boolean;
  }): Promise<ClassInterestBoardView[]>;
  getInterestBoard(
    id: string,
    viewerUserId?: string | null,
  ): Promise<ClassInterestBoardView | null>;
  proposeInterestBoard(
    input: ClassInterestBoardInput,
  ): Promise<ClassInterestBoard>;
  joinInterestBoard(
    input: ClassInterestSignupInput,
  ): Promise<ClassInterestSignup>;
  leaveInterestBoard(
    boardId: string,
    opts: { userId?: string | null; email?: string | null },
  ): Promise<void>;
  listInterestSignups(boardId: string): Promise<ClassInterestSignup[]>;
  resuggestInterestBoard(
    boardId: string,
    actorUserId: string,
  ): Promise<ClassInterestBoard>;

  adminListMembers(query?: string): Promise<User[]>;
  adminUpdateMemberStatus(
    id: string,
    status: MembershipStatus,
    actorId: string,
  ): Promise<User>;
  adminSetMemberTeacher(
    id: string,
    isTeacher: boolean,
    actorId: string,
  ): Promise<User>;
  adminApproveInterestBoard(
    id: string,
    actorId: string,
    opts?: { threshold?: number; closesAt?: ISODateTime },
  ): Promise<ClassInterestBoard>;
  adminRejectInterestBoard(
    id: string,
    actorId: string,
    notes?: string,
  ): Promise<ClassInterestBoard>;
  adminUpdateInterestBoard(
    id: string,
    data: ClassInterestBoardAdminUpdate,
  ): Promise<ClassInterestBoard>;
  adminLinkInterestBoardToClass(
    boardId: string,
    classSessionId: string,
    actorId: string,
  ): Promise<ClassInterestBoard>;
  /** All badges (linked and unlinked) for admin linking UI. */
  adminListBadges(): Promise<Badge[]>;
  adminLinkBadge(
    badgeId: string,
    userId: string,
    actorId: string,
  ): Promise<Badge>;
  adminUnlinkBadge(badgeId: string, actorId: string): Promise<Badge>;
  adminRecordCheckoff(input: CheckoffInput): Promise<UserCertification>;
  adminRevokeCertification(input: RevokeInput): Promise<UserCertification>;
  adminUpsertCertification(data: CertificationInput): Promise<Certification>;
  adminUpsertClass(data: ClassSessionInput): Promise<ClassSession>;
  adminListRoster(classSessionId: string): Promise<BookingRosterRow[]>;
  adminMarkBookingPaid(bookingId: string, actorId: string): Promise<Booking>;
  /** Mark paid + attach Zeffy payment id (webhook/sync). */
  applyZeffyPaymentToBooking(input: {
    bookingId: string;
    paymentId: string;
    paidAt: string;
  }): Promise<Booking>;
  /** Create a booked seat from a completed Zeffy ticket payment. */
  createBookingFromZeffyPayment(input: {
    classSessionId: string;
    userId: string;
    paymentId: string;
    paidAt: string;
  }): Promise<Booking>;
  findBookingByZeffyPaymentId(paymentId: string): Promise<Booking | null>;
  /** Full ticket apply path (preferred entry for webhook/sync). */
  applyZeffyTicketPayment(
    payment: import("@/lib/zeffy/types").ZeffyPayment,
    paidAtIso?: string,
  ): Promise<import("@/lib/zeffy/types").ZeffyApplyResult>;
  adminMarkAttendance(
    bookingId: string,
    status: Extract<BookingStatus, "attended" | "no_show">,
    actorId: string,
  ): Promise<Booking>;
  adminPromoteFromWaitlist(
    classSessionId: string,
    actorId: string,
  ): Promise<Booking | null>;
  adminCreateReservation(
    input: ReserveInput & { createdById: string },
  ): Promise<Reservation>;
  adminCancelReservation(id: string, actorId: string): Promise<Reservation>;
  adminUpsertMaintenanceBlock(
    data: MaintenanceBlockInput,
  ): Promise<MaintenanceBlock>;
  adminListMaintenanceBlocks(): Promise<MaintenanceBlock[]>;

  /** Tool champion / Shop lead track */
  getToolChampionProgress(userId: string): Promise<ToolChampionProgress>;
  listToolChampionTerms(userId?: string): Promise<ToolChampionTerm[]>;
  requestToolChampionTerm(
    input: ToolChampionRequestInput,
  ): Promise<ToolChampionTerm>;
  adminActivateToolChampionTerm(
    id: string,
    actorId: string,
  ): Promise<ToolChampionTerm>;
  adminCompleteToolChampionTerm(
    id: string,
    actorId: string,
  ): Promise<ToolChampionTerm>;

  adminUpsertModule(data: ModuleInput): Promise<LearningModule>;
  adminUpsertLesson(data: LessonInput): Promise<Lesson>;
  adminUpsertQuestion(data: QuestionInput): Promise<Question>;
  adminDeleteQuestion(id: string): Promise<void>;
  /** Quiz bank for a module (includes inactive). */
  adminListQuestions(moduleId: string): Promise<Question[]>;
  adminUpsertVideo(data: VideoInput): Promise<LessonVideo>;
  adminDeleteVideo(id: string): Promise<void>;
  adminSetVideoReviewed(
    videoId: string,
    reviewed: boolean,
  ): Promise<LessonVideo>;
  adminListVideos(moduleId: string): Promise<LessonVideo[]>;
  /**
   * Enforces publish guard in the data layer.
   * `published: false` always unpublishes; `published: true` may refuse.
   */
  adminPublishModule(
    id: string,
    published: boolean,
  ): Promise<PublishModuleResult>;
  adminUpsertMachine(data: MachineInput): Promise<Machine>;
  adminListUsage(
    range: DateRange,
    filters?: UsageFilters,
  ): Promise<UsageSession[]>;
  adminListAccessLogs(range: DateRange): Promise<AccessLog[]>;
  adminListVolunteerInterests(): Promise<VolunteerInterest[]>;
  adminUpdateVolunteerInterest(
    id: string,
    data: VolunteerInterestAdminUpdate,
  ): Promise<VolunteerInterest>;
  adminListContentMappings(): Promise<ContentPage[]>;
  adminSyncContent(): Promise<{ syncedAt: ISODateTime; count: number }>;
  adminUpdateSettings(data: Partial<OrgSettings>): Promise<OrgSettings>;
  adminListAuditEvents(subjectUserId?: string): Promise<AuditEvent[]>;

  getDisplayFeed(): Promise<DisplayFeed>;
  getMachineStatus(): Promise<DisplayMachineStatus[]>;
  listPromos(): Promise<PromoSlide[]>;
  savePromo(data: PromoSlideInput): Promise<PromoSlide>;
  deletePromo(id: string): Promise<void>;
  getDisplayConfig(): Promise<DisplayConfig>;
  saveDisplayConfig(data: Partial<DisplayConfig>): Promise<DisplayConfig>;

  authorizeAccess(input: {
    readerKey: string;
    badgeUid: string;
  }): Promise<AuthorizeResult>;
  endAccess(input: {
    readerKey: string;
    sessionId: string;
  }): Promise<UsageSession>;
  getAllowlist(readerKey: string): Promise<AllowlistResult>;
}
