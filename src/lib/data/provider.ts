import type { OpeningHours } from "@/lib/opening-hours";
import type { RateCard } from "@/lib/rate-card";
import type {
  AccessLog,
  AuditEvent,
  Badge,
  Booking,
  BookingStatus,
  Certification,
  ClassSession,
  ClassCategory,
  ContentCategory,
  ContentPage,
  AreaSteward,
  MembershipTier,
  UserRole,
  WishlistItemTier,
  SiteInfo,
  Project,
  DisplayConfig,
  DisplayPhoto,
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
  Person,
  PersonKind,
  Bounty,
  BountyStatus,
  CreditLedgerEntry,
  CreditWallet,
  InventoryArea,
  InventoryItem,
  ItemPhoto,
  ItemEvent,
  ItemCondition,
  ItemStatus,
  ReviewStatus,
  PhotoKind,
  InventoryIssueType,
  InventoryRetireReason,
  WishlistItem,
  WishlistItemStatus,
  WishlistPurchaseReport,
  WishlistPurchaseReportStatus,
  WishlistZone,
} from "./types";
import type {
  WishlistStats,
} from "./wishlist";

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
  /** Admin lists include sessions Zeffy or staff have cancelled. */
  includeCancelled?: boolean;
  /** Admin lists include the retired sheet import. The public page does not. */
  includeImported?: boolean;
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
  /** Prompts only, so a failed attempt does not reveal the answers. */
  safetyCriticalMissed: Pick<Question, "id" | "prompt">[];
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
  /**
   * What the class page says about this session, as HTML. Cleaned on save and
   * kept as this session's own content page. Leave it out to keep what is
   * there; send it empty to go back to the shared wording.
   */
  description?: string;
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
  /** The lesson's address inside its module. Made from the title when left out. */
  slug?: string;
  /**
   * Which content page holds the lesson's text. Leave it out: a new lesson
   * gets a pointer of its own, and `adminSaveLessonText` writes the page.
   */
  contentSlug?: string;
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
  role: LessonVideo["role"];
  /**
   * A YouTube link, or the id on its own in `youtubeId`. A new video needs
   * one of the two; the id is read out of the link.
   */
  url?: string;
  youtubeId?: string;
  channel?: string;
  /** Left out, a new video goes last in its lesson. */
  order?: number;
}

export interface MachineInput extends Partial<Machine> {
  name: string;
  area: Machine["area"];
  requiredCertificationIds: string[];
  readerKey: string;
}

/**
 * A page of text staff edit under Admin → Content. `id` picks the page to
 * change; without it a new page is made. Left-out fields keep their value.
 */
export interface ContentPageInput {
  id?: string;
  title: string;
  /** Sanitized on save: scripts, styles and unknown tags are dropped. */
  html: string;
  /** The page's address. Made from the title when a new page leaves it out. */
  slug?: string;
  category?: ContentCategory;
  /**
   * Change this only when the meaning changed. For the waiver, a new version
   * becomes the current one and every member is asked to sign again.
   */
  version?: string;
  published?: boolean;
}

export interface PersonInput {
  id?: string;
  name: string;
  roleTitle: string;
  kind: PersonKind;
  bio: string;
  sortOrder?: number;
  published?: boolean;
}

export interface ProjectInput {
  id?: string;
  title: string;
  maker: string;
  area: string;
  caption: string;
  imageSrc: string;
  imageAlt?: string;
  sortOrder?: number;
  published?: boolean;
}

export interface WishlistItemInput {
  id?: string;
  zoneId: string;
  name: string;
  model?: string;
  qty: number;
  priceCents: number;
  estimated?: boolean;
  url?: string | null;
  note?: string | null;
  tier?: WishlistItemTier;
  sortOrder?: number;
}

export interface VolunteerRoleInput {
  id?: string;
  title: string;
  /** What the role involves, shown on the Volunteer page. Left out keeps the text. */
  descriptionHtml?: string;
  active?: boolean;
  sortOrder?: number;
}

export interface BountyModeration {
  title?: string;
  description?: string;
  /** Off the public board without deleting it. */
  hidden?: boolean;
  /** Back to open: drops the claim and the completion. */
  reopen?: boolean;
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

export interface BountyRequestInput {
  title: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  businessName?: string | null;
  userId?: string | null;
}

/** requesterEmail and userId are omitted for anonymous viewers. */
export interface BountyView
  extends Omit<Bounty, "requesterEmail" | "userId"> {
  requesterEmail?: string;
  userId?: string | null;
  claimedByDisplayName?: string | null;
}

export interface InventoryListFilters {
  search?: string;
  areaId?: string | null;
  condition?: ItemCondition | ItemCondition[];
  status?: ItemStatus | ItemStatus[];
  reviewStatus?: ReviewStatus | ReviewStatus[];
  location?: string;
  includeRetired?: boolean;
  includePending?: boolean;
}

export interface CreateInventoryItemInput {
  name: string;
  model?: string | null;
  manufacturer?: string | null;
  serialNumber?: string | null;
  noSerial?: boolean;
  quantity?: number;
  isMachine?: boolean;
  areaId?: string | null;
  location?: string | null;
  condition: ItemCondition;
  notes?: string | null;
  photoKeys: Array<{
    storageKey: string;
    thumbKey?: string | null;
    kind: PhotoKind;
    mimeType: string;
    width?: number | null;
    height?: number | null;
  }>;
  continueDespiteDuplicate?: boolean;
}

export interface UpdateInventoryItemInput {
  name?: string;
  model?: string | null;
  manufacturer?: string | null;
  serialNumber?: string | null;
  noSerial?: boolean;
  quantity?: number;
  isMachine?: boolean;
  areaId?: string | null;
  location?: string | null;
  condition?: ItemCondition;
  notes?: string | null;
}

export interface InventoryItemView extends InventoryItem {
  assetTag: string;
  areaName?: string | null;
  createdByName?: string | null;
  reviewedByName?: string | null;
  frontPhoto?: ItemPhoto | null;
}

export interface InventoryItemDetail extends InventoryItemView {
  photos: ItemPhoto[];
  events: Array<ItemEvent & { actorName?: string | null }>;
}

export interface InventoryDuplicateHit {
  id: string;
  assetTag: string;
  name: string;
}

export interface InventoryIssueInput {
  type: InventoryIssueType;
  note?: string | null;
  photoKey?: string | null;
  photoMimeType?: string | null;
}

export interface InventoryCsvMappedRow {
  name: string;
  model?: string | null;
  manufacturer?: string | null;
  serialNumber?: string | null;
  quantity?: number;
  condition: ItemCondition;
  areaId?: string | null;
  location?: string | null;
  notes?: string | null;
  photoLinks?: Partial<Record<PhotoKind, string>>;
}

export interface InventoryImportResult {
  dryRun: boolean;
  created: number;
  failed: Array<{ row: number; reason: string }>;
  preview: Array<{
    row: number;
    name: string;
    areaId: string | null;
    condition: ItemCondition;
    photoCount: number;
  }>;
}

export interface WishlistItemView extends WishlistItem {
  zoneName: string;
  pendingReportCount: number;
}

export interface WishlistCatalog {
  zones: WishlistZone[];
  items: WishlistItemView[];
  recentlyFunded: WishlistItemView[];
  stats: WishlistStats;
}

export interface WishlistPurchaseReportInput {
  itemId: string;
  name: string;
  email: string;
  note?: string | null;
  userId?: string | null;
}

export interface WishlistPurchaseReportView extends WishlistPurchaseReport {
  itemName: string;
  itemStatus: WishlistItemStatus;
  itemModel: string;
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

/** Contact and review fields are only present for staff and the proposer. */
export interface ClassInterestBoardView
  extends Omit<
    ClassInterestBoard,
    "contactEmail" | "contactName" | "staffNotes" | "reviewedById"
  > {
  contactEmail?: string;
  contactName?: string;
  staffNotes?: string | null;
  reviewedById?: string | null;
  interestCount: number;
  viewerSignedUp: boolean;
  daysRemaining: number | null;
  proposedByDisplayName?: string | null;
  instructorHintDisplayName?: string | null;
}

export interface DisplayHoursToday {
  label: string;
  /** Minutes since midnight. Both 0 on a day the shop does not open. */
  openMinute: number;
  closeMinute: number;
  /** The same times as whole hours, for a display page loaded before half hours existed. */
  openHour: number;
  closeHour: number;
  /** True on a day the shop does not open at all. */
  closed: boolean;
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

/** An event with enough about it to fill a slide of its own. */
export interface DisplayEventItem extends DisplayUpcomingItem {
  priceCents: number;
  /** What the event is about, as plain text. Null when nothing is written. */
  description: string | null;
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

/** Glanceable bounty row for the lobby TV — no emails or claim actions. */
export interface DisplayBounty {
  id: string;
  title: string;
  businessName?: string | null;
  status: Extract<BountyStatus, "open" | "claimed">;
  claimedByDisplayName?: string;
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
  bounties: DisplayBounty[];
  promos: PromoSlide[];
  /** The next three weeks of events, one per slide, each once. */
  spotlight: DisplayEventItem[];
  /** Free open events over the next five weeks, each once. */
  community: DisplayEventItem[];
  /** Photos for the picture side of each slide, in rotation order. */
  photos: DisplayFeedPhoto[];
  membership: DisplayMembershipTier;
  config: DisplayConfig;
}

/** The display keeps at most this many photos. */
export const DISPLAY_PHOTO_LIMIT = 60;
export const DISPLAY_CAPTION_MAX = 120;

export interface DisplayFeedPhoto {
  id: string;
  url: string;
  caption: string | null;
}

/**
 * A new photo needs the id the upload route returned and its mime type.
 * An edit needs the id and whichever fields change.
 */
export interface DisplayPhotoInput {
  id: string;
  caption?: string | null;
  active?: boolean;
  sortOrder?: number;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
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
  getCreditWallet(userId: string): Promise<CreditWallet>;

  listClasses(filters?: ClassFilters): Promise<ClassSessionView[]>;
  getClass(id: string): Promise<ClassSessionView | null>;
  book(classSessionId: string, userId: string): Promise<Booking>;
  cancel(bookingId: string, userId: string): Promise<Booking>;
  /** Debit the full class price when the wallet covers it. Never a Zeffy split. */
  payBookingWithCredits(bookingId: string, userId: string): Promise<Booking>;

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
  listPeople(kind?: PersonKind): Promise<Person[]>;
  listVolunteerRoles(): Promise<VolunteerRole[]>;
  submitVolunteerInterest(
    input: VolunteerInterestInput,
  ): Promise<VolunteerInterest>;
  listBounties(filters?: {
    status?: BountyStatus | BountyStatus[];
  }): Promise<BountyView[]>;
  getBounty(id: string): Promise<BountyView | null>;
  submitBountyRequest(input: BountyRequestInput): Promise<Bounty>;
  claimBounty(id: string, userId: string): Promise<Bounty>;
  completeBounty(id: string, userId: string): Promise<Bounty>;

  listInventoryAreas(): Promise<InventoryArea[]>;
  listAreaStewards(): Promise<import("./types").AreaSteward[]>;
  upsertInventoryArea(
    actorId: string,
    data: { id?: string; slug: string; name: string; active?: boolean },
  ): Promise<InventoryArea>;
  listInventoryManufacturers(): Promise<string[]>;
  listInventoryLocations(): Promise<string[]>;
  pendingInventoryCount(userId: string): Promise<number>;
  listInventoryItems(
    viewerId: string,
    filters?: InventoryListFilters,
  ): Promise<InventoryItemView[]>;
  getInventoryItem(
    viewerId: string,
    assetTag: string,
  ): Promise<InventoryItemDetail | null>;
  findInventoryBySerial(
    serial: string,
  ): Promise<InventoryDuplicateHit[]>;
  createInventoryItem(
    userId: string,
    data: CreateInventoryItemInput,
  ): Promise<InventoryItemView>;
  updateInventoryItem(
    userId: string,
    id: string,
    patch: UpdateInventoryItemInput,
  ): Promise<InventoryItemView>;
  reviewInventoryItem(
    userId: string,
    id: string,
    decision: "approve" | "reject",
    reason?: string,
  ): Promise<InventoryItemView>;
  changeInventoryStatus(
    userId: string,
    id: string,
    status: ItemStatus,
    note?: string,
  ): Promise<InventoryItemView>;
  moveInventoryItem(
    userId: string,
    id: string,
    location: string,
    note?: string,
  ): Promise<InventoryItemView>;
  reportInventoryIssue(
    userId: string,
    id: string,
    input: InventoryIssueInput,
  ): Promise<ItemEvent>;
  retireInventoryItem(
    userId: string,
    id: string,
    reason: InventoryRetireReason | string,
  ): Promise<InventoryItemView>;
  addInventoryPhoto(
    userId: string,
    itemId: string,
    photo: {
      storageKey: string;
      thumbKey?: string | null;
      kind: PhotoKind;
      mimeType: string;
      width?: number | null;
      height?: number | null;
    },
  ): Promise<ItemPhoto>;
  markInventoryLabelsPrinted(
    userId: string,
    itemIds: string[],
  ): Promise<void>;
  importInventoryCsv(
    userId: string,
    rows: InventoryCsvMappedRow[],
    dryRun: boolean,
  ): Promise<InventoryImportResult>;

  getWishlistCatalog(): Promise<WishlistCatalog>;
  reportWishlistPurchase(
    input: WishlistPurchaseReportInput,
  ): Promise<WishlistPurchaseReport>;
  adminListWishlistPurchaseReports(filters?: {
    status?: WishlistPurchaseReportStatus | WishlistPurchaseReportStatus[];
  }): Promise<WishlistPurchaseReportView[]>;
  adminConfirmWishlistPurchase(
    reportId: string,
    actorId: string,
  ): Promise<WishlistItem>;
  adminDismissWishlistPurchase(
    reportId: string,
    actorId: string,
  ): Promise<WishlistPurchaseReport>;
  adminMarkWishlistPurchased(
    itemId: string,
    actorId: string,
  ): Promise<WishlistItem>;
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
  /**
   * Change a member's role, membership tier, shop access or staff note.
   * The person acting is whoever is signed in, never an id the caller sends.
   * Only an admin may change a role, never their own, and the last active
   * admin cannot be demoted.
   */
  adminUpdateMember(
    id: string,
    patch: {
      role?: UserRole;
      tier?: MembershipTier | null;
      shopAccess?: boolean;
      notes?: string;
    },
  ): Promise<User>;
  /** Member chooses their shop PIN. Rejects bad and trivial PINs. Clears a reset flag. */
  setMyKioskPin(userId: string, pin: string): Promise<User>;
  /**
   * Staff or admin issues a one-time temporary PIN. The plaintext is returned
   * once and is not stored or written to the audit row.
   */
  adminResetMemberKioskPin(
    memberId: string,
    actorId: string,
  ): Promise<{ user: User; temporaryPin: string }>;
  adminSetMemberTeacher(
    id: string,
    isTeacher: boolean,
    actorId: string,
  ): Promise<User>;
  adminGrantCredits(input: {
    userId: string;
    amountCents: number;
    actorId: string;
    note?: string;
    sourcePaymentId?: string | null;
  }): Promise<CreditLedgerEntry>;
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
  /** Every class: drafts, cancelled and past ones too. Upcoming first. */
  adminListClasses(): Promise<ClassSessionView[]>;
  /**
   * Take a class off the calendar. Bookings are left as they are, and no
   * money or credits move. The hourly Zeffy pull does not undo it.
   */
  adminCancelClass(id: string): Promise<ClassSession>;
  adminRestoreClass(id: string): Promise<ClassSession>;
  /** Staff put a member in a class. Capacity, waitlist and payment hold as usual. */
  adminAddBooking(classSessionId: string, userId: string): Promise<Booking>;
  /** Staff cancel a member's booking, at any time before or after the cutoff. */
  adminCancelBooking(bookingId: string): Promise<Booking>;
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
  applyZeffyMembershipPayment(
    payment: import("@/lib/zeffy/types").ZeffyPayment,
    paidAtIso?: string,
    options?: { createIfMissing?: boolean },
  ): Promise<import("@/lib/zeffy/types").ZeffyMembershipApplyResult>;
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
  /**
   * Schedule or change a maintenance block as whoever is signed in. Staff and
   * active Shop Stewards may; the provider refuses everyone else. The page a
   * steward uses calls this: the `admin…` methods are staff only by name.
   */
  scheduleMaintenance(
    data: Omit<MaintenanceBlockInput, "createdById">,
  ): Promise<MaintenanceBlock>;
  /** The maintenance schedule, for the same people who may change it. */
  listMaintenanceSchedule(): Promise<MaintenanceBlock[]>;

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
  /**
   * Remove a lesson with its videos and the watch and progress records for
   * them. Certifications members hold are never touched. The only lesson of a
   * published module is refused.
   */
  adminDeleteLesson(id: string): Promise<void>;
  /**
   * Save the text members read in a lesson. The text is a content page; a
   * lesson that has none yet gets one and is pointed at it.
   */
  adminSaveLessonText(lessonId: string, html: string): Promise<ContentPage>;
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
  /** Every machine, switched off or not. The public list hides inactive ones. */
  adminListMachines(): Promise<Machine[]>;
  /** Every certification, switched off or not. */
  adminListCertifications(): Promise<Certification[]>;
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
  adminSaveContentPage(input: ContentPageInput): Promise<ContentPage>;

  /** Volunteer roles, including ones that are switched off. */
  adminListVolunteerRoles(): Promise<VolunteerRole[]>;
  /** Saves the role and its description page together. */
  adminSaveVolunteerRole(input: VolunteerRoleInput): Promise<VolunteerRole>;

  /** Creates a badge for a member. The UID is stored the way readers send it. */
  adminRegisterBadge(
    userId: string,
    input: { uid: string; label?: string },
  ): Promise<Badge>;
  /** Switch a lost badge off at every reader, or back on. */
  adminSetBadgeActive(badgeId: string, active: boolean): Promise<Badge>;

  /** Every bounty with contact details, hidden ones included. */
  adminListBounties(): Promise<Bounty[]>;
  adminUpdateBounty(id: string, patch: BountyModeration): Promise<Bounty>;
  /** Removes a request for good. For spam. */
  adminDeleteBounty(id: string): Promise<void>;

  adminDeleteMaintenanceBlock(id: string): Promise<void>;

  /** Replaces the list of members who steward an inventory area. */
  adminSetAreaStewards(areaId: string, userIds: string[]): Promise<AreaSteward[]>;
  /**
   * The pieces of page text staff have changed, by slug. A slug that is
   * missing shows its built-in wording (src/lib/data/text-blocks.ts).
   */
  listTextBlocks(): Promise<Record<string, string>>;

  /** Staff directory, including people who are hidden. */
  adminListPeople(): Promise<Person[]>;
  adminSavePerson(input: PersonInput): Promise<Person>;
  adminDeletePerson(id: string): Promise<void>;

  /** The "Made at the makerspace" gallery. */
  listProjects(): Promise<Project[]>;
  adminListProjects(): Promise<Project[]>;
  adminSaveProject(input: ProjectInput): Promise<Project>;
  adminDeleteProject(id: string): Promise<void>;

  adminSaveWishlistItem(input: WishlistItemInput): Promise<WishlistItem>;
  adminDeleteWishlistItem(id: string): Promise<void>;

  /** Shop name, address and social links shown in the footer. */
  /** Machine prices. Members see these; the kiosk and the server price jobs from them. */
  getRateCard(): Promise<RateCard>;
  /** Change some of the prices. Refuses the whole change if any value will not do. */
  adminSaveRateCard(patch: Partial<RateCard>): Promise<RateCard>;

  /**
   * The week the shop is open: what the lobby display, machine reservations
   * and the hours on the Join page all follow.
   */
  getOpeningHours(): Promise<OpeningHours>;
  /** Replaces the whole week. Refuses one that makes no sense, in plain words. */
  adminSaveOpeningHours(week: OpeningHours): Promise<OpeningHours>;

  getSiteInfo(): Promise<SiteInfo>;
  adminSaveSiteInfo(input: Partial<SiteInfo>): Promise<SiteInfo>;
  adminUpdateSettings(data: Partial<OrgSettings>): Promise<OrgSettings>;
  adminListAuditEvents(subjectUserId?: string): Promise<AuditEvent[]>;

  getDisplayFeed(): Promise<DisplayFeed>;
  getMachineStatus(): Promise<DisplayMachineStatus[]>;
  listPromos(): Promise<PromoSlide[]>;
  savePromo(data: PromoSlideInput): Promise<PromoSlide>;
  deletePromo(id: string): Promise<void>;
  getDisplayConfig(): Promise<DisplayConfig>;
  saveDisplayConfig(data: Partial<DisplayConfig>): Promise<DisplayConfig>;
  listDisplayPhotos(): Promise<DisplayPhoto[]>;
  saveDisplayPhoto(data: DisplayPhotoInput): Promise<DisplayPhoto>;
  deleteDisplayPhoto(id: string): Promise<void>;

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
