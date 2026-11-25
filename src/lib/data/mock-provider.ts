import { readQuizToken, signQuizToken } from "./quiz-token";
import {
  MESSAGE_MAX,
  NAME_MAX,
  PHONE_MAX,
  clampInt,
  optionalText,
  requiredEmail,
  requiredText,
} from "./input-limits";
import {
  canScheduleMaintenance,
  evaluateMachineAccess,
  maintenanceMachineScope,
  shopLeadProgress,
  TOOL_CHAMPION_TERM_MONTHS,
} from "./access";
import {
  CONTENT_CATEGORIES,
  cleanContentHtml,
  contentHtmlHasText,
  contentSlug,
} from "./content-html";
import { isBadgeUid, normalizeBadgeUid } from "./badge-uid";
import { cloneFixtures, loadFixtures } from "./load-fixtures";
import { pictureAddress, webAddress } from "./site-info";
import {
  MAX_CARD_NUMBER,
  formatCardNumber,
  generateCode,
  normalizeCode,
  parseCardNumber,
} from "@/lib/redemption-code";
import { normalizeSignInEmail } from "@/lib/sign-in-email";
import {
  applyRateCardPatch,
  normalizeRateCard,
  rateCardChanges,
  type RateCard,
} from "../rate-card";
import { isTextBlockSlug } from "./text-blocks";
import {
  computePublishReadiness,
  describePublishBlockers,
  youtubeIdFrom,
  gradeQuizAttempt,
  publishBlockersFromReadiness,
} from "./learning";
import type {
  AckPolicyInput,
  AllowlistResult,
  AuthorizeResult,
  AvailabilitySlot,
  BookingRosterRow,
  CheckoffInput,
  ClassFilters,
  ClassInterestBoardAdminUpdate,
  ClassInterestBoardInput,
  ClassInterestBoardView,
  ClassInterestSignupInput,
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
  ModulePublishReadiness,
  OnboardingState,
  PendingCheckoff,
  ProfileInput,
  PromoSlideInput,
  DisplayPhotoInput,
  PublishModuleResult,
  QuestionInput,
  QuizAttemptResult,
  QuizPayload,
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
  VideoInput,
  VolunteerInterestAdminUpdate,
  VolunteerInterestInput,
  BountyRequestInput,
  BountyView,
  CreateInventoryItemInput,
  InventoryCsvMappedRow,
  InventoryDuplicateHit,
  InventoryImportResult,
  InventoryIssueInput,
  InventoryItemDetail,
  InventoryItemView,
  InventoryListFilters,
  UpdateInventoryItemInput,
  WishlistCatalog,
  WishlistItemView,
  WishlistPurchaseReportInput,
  WishlistPurchaseReportView,
  ContentPageInput,
  PersonInput,
  ProjectInput,
  WishlistItemInput,
  BountyModeration,
  VolunteerRoleInput,
  CodeOffer,
  CodeRedemption,
  CreateCodesInput,
  RedemptionCodeView,
  NewMemberInput,
  StaffCodeOffer,
  PublicEquipmentItem,
} from "./provider";
import { DISPLAY_CAPTION_MAX, DISPLAY_PHOTO_LIMIT } from "./provider";
import { buildDisplayFeed, buildMachineStatuses } from "./display-feed";
import {
  boardNeedsExpiry,
  canProposeInterestBoard,
  canPublishInterestBoard,
  CLASS_INTEREST_DEFAULT_THRESHOLD,
  CLASS_INTEREST_OPEN_DAYS,
  CLASS_INTEREST_PRIORITY_HOURS,
  interestSignupCount,
  isStaffRole,
} from "./class-interest";
import { canClaimBounty, canCompleteBounty, isValidBountyEmail } from "./bounties";
import {
  balanceFromEntries,
  classCreditsShortfallMessage,
  creditGrantCentsForProduct,
  hourlyRateCentsFor,
  inferCreditGrantCents,
  machineDebitCents,
  machineDebitNote,
} from "../credits";
import {
  canMarkWishlistPurchased,
  isRecentlyFunded,
  isValidWishlistEmail,
  matchZeffyPaymentToWishlistItem,
  wishlistStats,
} from "./wishlist";
import { kioskPinPolicyError } from "@/lib/workstation/pin-policy";
import type {
  AccessLog,
  AuditAction,
  AuditEvent,
  Badge,
  Booking,
  BookingStatus,
  Certification,
  ClassSession,
  ClassInterestBoard,
  ClassInterestSignup,
  ClassInterestStatus,
  ContentPage,
  CreditLedgerEntry,
  CreditLedgerKind,
  CreditWallet,
  DisplayConfig,
  DisplayPhoto,
  DisplayPanelId,
  ISODate,
  ISODateTime,
  LearningModule,
  Lesson,
  LessonProgress,
  LessonVideo,
  Machine,
  MaintenanceBlock,
  MembershipProduct,
  MembershipStatus,
  NameDisplayMode,
  OrgSettings,
  PolicyAcknowledgement,
  PromoSlide,
  Question,
  QuizAttempt,
  Reservation,
  UsageSession,
  User,
  UserCertification,
  VideoWatch,
  VolunteerInterest,
  VolunteerRole,
  WaiverSignature,
  Person,
  PersonKind,
  MockFixtureBundle,
  ScholarshipFundSummary,
  ToolChampionTerm,
  Bounty,
  BountyStatus,
  InventoryArea,
  InventoryItem,
  ItemEvent,
  ItemEventType,
  ItemPhoto,
  ItemStatus,
  PhotoKind,
  WishlistItem,
  WishlistPurchaseReport,
  Project,
  SiteInfo,
  UserRole,
  MembershipTier,
  VideoRole,
  AreaSteward,
  RedemptionCode,
} from "./types";
import {
  canInventory,
  formatAssetTag,
  INVENTORY_AUTO_APPROVE_STEWARDS,
  isTempPhotoExpired,
  parseAssetTag,
  stewardAreaIds,
} from "../inventory";
import { notifyStewardsOfIssue } from "../inventory/notify";
import { isIssuedPhotoKey, isPhotoMimeType } from "../inventory/upload-policy";
import {
  checkedOpeningHours,
  normalizeOpeningHours,
  openingHoursChanges,
  type OpeningHours,
} from "../opening-hours";

const TZ = "America/Los_Angeles";

const SEAT_STATUSES: BookingStatus[] = ["booked", "awaiting_payment", "attended"];

/**
 * Inventory fields for the people who look after an item: stewards of its
 * area and staff. Everyone else browses the catalog without them.
 */
const INVENTORY_PRIVATE_FIELDS = [
  "donorName",
  "estimatedValue",
  "notes",
  "serialNumber",
] as const satisfies ReadonlyArray<keyof InventoryItem>;

/**
 * Whether an item is listed on the public Equipment page: approved, still the
 * shop's to use (not retired, not missing), not broken, and not switched off.
 * An item that needs repair or is out for repair is still shown.
 */
function isPublicEquipment(item: InventoryItem): boolean {
  return (
    item.reviewStatus === "APPROVED" &&
    item.status !== "RETIRED" &&
    item.status !== "MISSING" &&
    item.condition !== "BROKEN" &&
    item.showPublicly !== false
  );
}

const PHOTO_KINDS: readonly PhotoKind[] = ["FRONT", "SIDE", "SERIAL", "OTHER"];

/** The add-item form sends three photos. This leaves room for a few extras. */
const MAX_PHOTOS_PER_SUBMISSION = 12;

type InventoryPhotoInput = CreateInventoryItemInput["photoKeys"][number];

function photoDimension(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100_000
    ? value
    : null;
}

/**
 * Photo details as a caller sent them. The key must be one the upload route
 * could have issued and the type one an upload can be stored as. This does
 * not check who uploaded the file.
 */
function checkedPhotoInput(raw: unknown): InventoryPhotoInput {
  const refused = "That photo could not be attached. Upload it again.";
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(refused);
  }
  const photo = raw as Record<string, unknown>;
  if (!isIssuedPhotoKey(photo.storageKey)) throw new Error(refused);
  if (photo.thumbKey != null && !isIssuedPhotoKey(photo.thumbKey)) {
    throw new Error(refused);
  }
  if (!PHOTO_KINDS.includes(photo.kind as PhotoKind)) {
    throw new Error("Unknown photo kind.");
  }
  if (!isPhotoMimeType(photo.mimeType)) {
    throw new Error("Photos must be JPEG, PNG, or WebP images.");
  }
  return {
    storageKey: photo.storageKey,
    thumbKey: (photo.thumbKey as string | null | undefined) ?? null,
    kind: photo.kind as PhotoKind,
    mimeType: photo.mimeType,
    width: photoDimension(photo.width),
    height: photoDimension(photo.height),
  };
}

function checkedPhotoInputs(raw: unknown): InventoryPhotoInput[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error("That photo could not be attached. Upload it again.");
  }
  if (raw.length > MAX_PHOTOS_PER_SUBMISSION) {
    throw new Error("Too many photos for one item.");
  }
  return raw.map(checkedPhotoInput);
}

function endsAfterShopClosing(endsAt: string, hours: OpeningHours): boolean {
  const end = laParts(endsAt);
  const day = hours[end.weekday];
  if (!day) return true;
  return end.hour * 60 + end.minute > day.close;
}

const VIDEO_ROLES: readonly VideoRole[] = ["primary", "supporting", "conditional"];

/** A copy without the keys whose value is undefined, so an edit cannot blank a field it did not send. */
function definedOnly<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function questionCorrectIndexes(q: Question): number[] {
  if (q.correctIndexes && q.correctIndexes.length > 0) {
    return q.correctIndexes;
  }
  return [q.correctIndex];
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

function isWithinOpeningHours(
  startsAt: string,
  endsAt: string,
  hours: OpeningHours,
): boolean {
  const start = laParts(startsAt);
  const end = laParts(endsAt);
  if (start.dateKey !== end.dateKey) return false;
  const day = hours[start.weekday];
  if (!day) return false;
  const startMin = start.hour * 60 + start.minute;
  const endMin = end.hour * 60 + end.minute;
  return startMin >= day.open && endMin <= day.close && endMin > startMin;
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

function randomTemporaryPin(): string {
  const buf = new Uint32Array(1);
  for (let attempt = 0; attempt < 30; attempt++) {
    crypto.getRandomValues(buf);
    const pin = String(buf[0]! % 1_000_000).padStart(6, "0");
    if (!kioskPinPolicyError(pin)) return pin;
  }
  return "482917";
}

const STAFF_OWNED_CLASS_FIELDS = [
  "title",
  "slug",
  "descriptionSlug",
  "category",
  "instructorId",
  "startsAt",
  "endsAt",
  "capacity",
  "priceCents",
  "zeffyUrl",
  "location",
  "cancellationCutoffHours",
  "published",
  "prerequisiteCertificationIds",
] as const;

/** Fields a staff save changed, so a later Zeffy pull leaves them alone. */
export function mergeStaffEdits(
  existing: ClassSession,
  data: Partial<ClassSession>,
): string[] {
  const owned = new Set(existing.staffEditedFields ?? []);
  for (const key of STAFF_OWNED_CLASS_FIELDS) {
    if (data[key] === undefined) continue;
    const next = data[key];
    const prev = existing[key];
    const same =
      Array.isArray(next) && Array.isArray(prev)
        ? JSON.stringify(next) === JSON.stringify(prev)
        : next === prev;
    if (!same) owned.add(key);
  }
  return [...owned];
}

const MEMBER_ROLES: readonly UserRole[] = ["member", "staff", "admin"];

const MEMBERSHIP_TIERS: readonly MembershipTier[] = [
  "day",
  "community",
  "maker",
  "household_addon",
  "patron",
  "friend",
  "scholarship",
  "maker_pro",
  "unlimited",
  "team",
  "shop_steward",
];

/** Ten past the largest order in the list, so a new row lands at the end. */
function nextSortOrder(rows: { sortOrder: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 10;
}

export const CODE_NOT_VALID =
  "That code is not valid. Check it and try again, or ask staff.";
export const CODE_ALREADY_USED = "That code has already been used.";
const CODE_EXPIRED = "That code has expired. Ask staff about it.";

/**
 * A change to a code that the database has to agree to before anything else
 * is saved. Two requests can each load a code as unused; only the one whose
 * conditional write lands may go on. See createPersistingProxy.
 */
export type CodeClaim =
  | {
      codeId: string;
      action: "redeem";
      userId: string;
      /** Set when staff redeemed it for the member at the desk. */
      staffId?: string;
      at: string;
    }
  | { codeId: string; action: "void"; userId: string | null; at: string };

/** The same day of the month, `months` later; the last day when there is no such day. */
function addCalendarMonths(iso: string, months: number): string {
  const from = new Date(iso);
  const to = new Date(from.getTime());
  to.setUTCDate(1);
  to.setUTCMonth(from.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0),
  ).getUTCDate();
  to.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return to.toISOString();
}

/**
 * A date staff typed ("2027-01-31") as the last second of that day at the
 * shop, or a full time as it is. Null when it is neither.
 */
function endOfShopDay(value: string): string | null {
  const text = value.trim();
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!day) {
    const time = new Date(text).getTime();
    return /^\d{4}-\d{2}-\d{2}T/.test(text) && Number.isFinite(time)
      ? new Date(time).toISOString()
      : null;
  }
  const [y, m, d] = [Number(day[1]), Number(day[2]), Number(day[3])];
  // Pacific time is 8 hours behind UTC in winter and 7 in summer.
  for (const offset of [8, 7]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, 23 + offset, 59, 59));
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hourCycle: "h23",
    }).format(candidate);
    if (Number(hour) === 23) return candidate.toISOString();
  }
  return null;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "SawStop Table Saw" → "sawstop-table-saw", for a made-up reader key. */
function readerSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "machine";
}

export class MockDataProvider implements DataProvider {
  private state: MockFixtureBundle;
  private currentUserId: string | null;
  /** Scrypt hashes for tests and the server provider. Never copied onto User. */
  private pinHashes = new Map<string, string>();

  constructor(bundle: MockFixtureBundle, initialUserId?: string | null) {
    this.state = cloneFixtures(bundle);
    this.state.lessonVideos ??= [];
    this.state.videoWatches ??= [];
    this.state.people ??= [];
    this.state.bounties ??= [];
    this.state.creditLedgerEntries ??= [];
    this.state.inventoryAreas ??= [];
    this.state.areaStewards ??= [];
    this.state.inventoryItems ??= [];
    this.state.itemPhotos ??= [];
    this.state.itemEvents ??= [];
    this.state.wishlistZones ??= [];
    this.state.wishlistItems ??= [];
    this.state.wishlistPurchaseReports ??= [];
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

  private appendLedger(input: {
    /** Set when a repeat of the same action must land on the same row. */
    id?: string;
    userId: string;
    kind: CreditLedgerKind;
    amountCents: number;
    sourcePaymentId?: string | null;
    usageSessionId?: string | null;
    bookingId?: string | null;
    actorId?: string | null;
    note?: string | null;
    occurredAt?: string;
  }): CreditLedgerEntry {
    const now = input.occurredAt ?? this.now();
    const entry: CreditLedgerEntry = {
      id: input.id ?? this.id("cl"),
      userId: input.userId,
      kind: input.kind,
      amountCents: input.amountCents,
      sourcePaymentId: input.sourcePaymentId ?? null,
      usageSessionId: input.usageSessionId ?? null,
      bookingId: input.bookingId ?? null,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
      occurredAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.creditLedgerEntries.push(entry);
    return entry;
  }

  private debitMachineSession(session: UsageSession): void {
    if (!session.endedAt) return;
    const already = this.state.creditLedgerEntries.some(
      (e) => e.kind === "machine" && e.usageSessionId === session.id,
    );
    if (already) return;
    const machine = this.state.machines.find((m) => m.id === session.machineId);
    if (!machine) return;
    const debit = machineDebitCents(
      machine,
      session.startedAt,
      session.endedAt,
    );
    if (debit <= 0) return;
    this.appendLedger({
      userId: session.userId,
      kind: "machine",
      amountCents: -debit,
      usageSessionId: session.id,
      note: machineDebitNote(machine, session.startedAt, session.endedAt),
      occurredAt: session.endedAt,
    });
  }

  /**
   * An id for a booking's payment or refund that two requests sent together
   * will both arrive at. On the live site each request loads the database for
   * itself, so a button pressed twice passes every check twice. With the same
   * id the second save lands on the first row and the member is charged, or
   * refunded, once. The count keeps a later, separate payment on its own row.
   */
  private repeatSafeId(prefix: string, bookingId: string, kind: CreditLedgerKind): string {
    const earlier = this.state.creditLedgerEntries.filter(
      (e) => e.bookingId === bookingId && e.kind === kind,
    ).length;
    return `${prefix}-${bookingId}-${earlier + 1}`;
  }

  private refundClassCredits(booking: Booking): void {
    const spent = this.state.creditLedgerEntries
      .filter((e) => e.bookingId === booking.id && e.kind === "class")
      .reduce((sum, e) => sum + e.amountCents, 0);
    const refunded = this.state.creditLedgerEntries
      .filter((e) => e.bookingId === booking.id && e.kind === "class_refund")
      .reduce((sum, e) => sum + e.amountCents, 0);
    const net = spent + refunded;
    if (net >= 0) return;
    const session = this.state.classSessions.find(
      (c) => c.id === booking.classSessionId,
    );
    this.appendLedger({
      id: this.repeatSafeId("cl-refund", booking.id, "class_refund"),
      userId: booking.userId,
      kind: "class_refund",
      amountCents: -net,
      bookingId: booking.id,
      note: session
        ? `${session.title} · credits refunded`
        : "Class credits refunded",
    });
  }

  private grantMembershipCreditsFromPayment(
    payment: import("@/lib/zeffy/types").ZeffyPayment,
    userId: string,
  ): void {
    if (
      this.state.creditLedgerEntries.some(
        (e) =>
          e.sourcePaymentId === payment.id && e.kind === "membership_grant",
      )
    ) {
      return;
    }
    const rateId = payment.items?.find((i) => i.rate_id)?.rate_id ?? null;
    const products = this.state.membershipProducts;
    let product: MembershipProduct | null = null;
    if (rateId) {
      product =
        products.find(
          (p) =>
            p.zeffyCampaignId === payment.campaign_id &&
            p.zeffyRateId === rateId,
        ) ?? null;
    }
    product =
      product ??
      products.find((p) => p.zeffyCampaignId === payment.campaign_id) ??
      null;
    const rateTitle =
      payment.items?.find((i) => i.rate_title)?.rate_title ??
      product?.name ??
      "";
    const amount = payment.items?.[0]?.amount ?? payment.amount;
    const grant = product
      ? creditGrantCentsForProduct(product)
      : inferCreditGrantCents({
          name: rateTitle,
          priceCents: amount,
        });
    if (grant <= 0) return;
    this.appendLedger({
      userId,
      kind: "membership_grant",
      amountCents: grant,
      sourcePaymentId: payment.id,
      note: `${rateTitle || "Membership Plus"} · $${(grant / 100).toFixed(0)} machine credit`,
    });
    this.pushAudit({
      action: "credits_granted",
      actorId: "system:zeffy",
      subjectUserId: userId,
      entityType: "CreditLedgerEntry",
      entityId: payment.id,
      metadata: { amountCents: grant, paymentId: payment.id },
    });
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

  private lessonsForModule(moduleId: string): Lesson[] {
    return this.state.lessons.filter((l) => l.moduleId === moduleId);
  }

  private videosForModule(moduleId: string): LessonVideo[] {
    const lessonIds = new Set(
      this.lessonsForModule(moduleId).map((l) => l.id),
    );
    return this.state.lessonVideos.filter((v) => lessonIds.has(v.lessonId));
  }

  private primaryVideosForModule(moduleId: string): LessonVideo[] {
    return this.videosForModule(moduleId).filter((v) => v.role === "primary");
  }

  private primaryVideosWatched(
    moduleId: string,
    userId: string | null,
  ): boolean {
    const primaries = this.primaryVideosForModule(moduleId);
    if (primaries.length === 0) return true;
    if (userId == null) return false;
    return primaries.every((v) =>
      this.state.videoWatches.some(
        (w) => w.userId === userId && w.videoId === v.id,
      ),
    );
  }

  private publishReadinessFor(mod: LearningModule): ModulePublishReadiness {
    return computePublishReadiness({
      module: mod,
      lessons: this.lessonsForModule(mod.id),
      videos: this.videosForModule(mod.id),
      questions: this.state.questions.filter((q) => q.moduleId === mod.id),
    });
  }

  private moduleView(
    mod: LearningModule,
    userId: string | null,
  ): LearningModuleView {
    const certification = this.state.certifications.find(
      (c) => c.id === mod.certificationId,
    )!;
    const lessons = this.lessonsForModule(mod.id);
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
    const uc =
      userId == null
        ? undefined
        : this.state.userCertifications.find(
            (row) =>
              row.userId === userId &&
              row.certificationId === mod.certificationId,
          );
    const knowledgePassed = Boolean(
      uc &&
        (uc.status === "knowledge_passed" ||
          uc.status === "certified" ||
          !!uc.knowledgePassedAt),
    );
    const certified = uc?.status === "certified";
    const primaryVideosWatched =
      userId != null && this.primaryVideosWatched(mod.id, userId);
    const videoWatchCount =
      userId == null
        ? 0
        : this.videosForModule(mod.id).filter((v) =>
            this.state.videoWatches.some(
              (w) => w.userId === userId && w.videoId === v.id,
            ),
          ).length;

    let memberStatus: LearningModuleView["memberStatus"] = "not_started";
    if (certified) memberStatus = "certified";
    else if (knowledgePassed) {
      // Quiz never grants machine access; always needs staff checkoff messaging.
      memberStatus = "knowledge_passed_needs_checkoff";
    } else if (primaryVideosWatched) {
      memberStatus = "quiz_ready";
    } else if (
      completedLessonCount > 0 ||
      attemptCount > 0 ||
      videoWatchCount > 0
    ) {
      memberStatus = "in_progress";
    }

    return {
      ...mod,
      certification,
      lessonCount: lessons.length,
      completedLessonCount,
      attemptCount,
      knowledgePassed,
      primaryVideosWatched,
      memberStatus,
      publishReadiness: this.publishReadinessFor(mod),
    };
  }

  private activeChampionUserIdsForMachines(machineIds: string[]): string[] {
    const now = Date.now();
    const ids = new Set<string>();
    for (const t of this.state.toolChampionTerms) {
      if (
        t.status === "active" &&
        machineIds.includes(t.machineId) &&
        (!t.endsAt || new Date(t.endsAt).getTime() >= now)
      ) {
        ids.add(t.userId);
      }
    }
    return [...ids];
  }

  private canActorCheckoffCert(
    actorId: string,
    certificationId: string,
  ): boolean {
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!actor) return false;
    if (actor.role === "staff" || actor.role === "admin") return true;
    const activeMachineIds =
      this.toolChampionProgressFor(actorId).activeMachineIds;
    return this.state.machines.some(
      (m) =>
        activeMachineIds.includes(m.id) &&
        m.requiredCertificationIds.includes(certificationId),
    );
  }

  async listPendingCheckoffs(viewerId: string): Promise<PendingCheckoff[]> {
    this.requireUser(viewerId);
    const viewer = this.state.users.find((u) => u.id === viewerId)!;
    const isStaff = viewer.role === "staff" || viewer.role === "admin";
    const viewerChampMachines = isStaff
      ? null
      : this.toolChampionProgressFor(viewerId).activeMachineIds;

    const knowledgeOnlyCertIds = new Set(
      this.state.learningModules
        .filter((m) => m.knowledgeOnly)
        .map((m) => m.certificationId),
    );

    const pending = this.state.userCertifications.filter(
      (uc) =>
        uc.status === "knowledge_passed" &&
        !knowledgeOnlyCertIds.has(uc.certificationId),
    );

    const rows: PendingCheckoff[] = [];
    for (const uc of pending) {
      const user = this.state.users.find((u) => u.id === uc.userId);
      const cert = this.state.certifications.find(
        (c) => c.id === uc.certificationId,
      );
      if (!user || !cert) continue;

      const machines = this.state.machines.filter(
        (m) =>
          m.active && m.requiredCertificationIds.includes(uc.certificationId),
      );
      const machineIds = machines.map((m) => m.id);

      if (
        viewerChampMachines &&
        !machineIds.some((id) => viewerChampMachines.includes(id))
      ) {
        continue;
      }

      const championUserIds =
        this.activeChampionUserIdsForMachines(machineIds);
      const championDisplayNames = championUserIds
        .map(
          (id) =>
            this.state.users.find((u) => u.id === id)?.displayName ?? id,
        )
        .sort((a, b) => a.localeCompare(b));

      rows.push({
        userId: user.id,
        userDisplayName: user.displayName,
        userEmail: user.email,
        certificationId: cert.id,
        certificationName: cert.name,
        knowledgePassedAt: uc.knowledgePassedAt ?? uc.updatedAt,
        machineIds,
        machineNames: machines.map((m) => m.name).sort((a, b) => a.localeCompare(b)),
        championUserIds,
        championDisplayNames,
        canCheckoff: this.canActorCheckoffCert(viewerId, cert.id),
      });
    }

    return rows.sort((a, b) => {
      const t =
        new Date(a.knowledgePassedAt).getTime() -
        new Date(b.knowledgePassedAt).getTime();
      if (t !== 0) return t;
      return a.userDisplayName.localeCompare(b.userDisplayName);
    });
  }

  async recordCheckoff(input: CheckoffInput): Promise<UserCertification> {
    if (!this.canActorCheckoffCert(input.actorId, input.certificationId)) {
      throw new Error(
        "Not allowed to record checkoff for this certification",
      );
    }
    return this.adminRecordCheckoff(input);
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
    const fullNameTyped = requiredText(input.fullNameTyped, "Your full name", 200);
    const now = this.now();
    const sig: WaiverSignature = {
      id: this.id("ws"),
      userId: input.userId,
      version: this.state.settings.currentWaiverVersion,
      signedAt: now,
      fullNameTyped,
      ip: optionalText(input.ip, "IP", 64) ?? "",
      userAgent: optionalText(input.userAgent, "User agent", 512) ?? undefined,
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

  // ── Class interest boards ─────────────────────────────────────────────────

  private sweepInterestExpiry(): void {
    const nowMs = Date.now();
    for (const board of this.state.classInterestBoards) {
      if (boardNeedsExpiry(board, nowMs)) {
        board.status = "expired";
        this.touch(board);
      }
    }
  }

  private toInterestView(
    board: ClassInterestBoard,
    viewerUserId?: string | null,
  ): ClassInterestBoardView {
    const interestCount = interestSignupCount(
      board.id,
      this.state.classInterestSignups,
    );
    let viewerSignedUp = false;
    if (viewerUserId) {
      const viewer = this.state.users.find((u) => u.id === viewerUserId);
      viewerSignedUp = this.state.classInterestSignups.some(
        (s) =>
          s.boardId === board.id &&
          !s.deletedAt &&
          (s.userId === viewerUserId ||
            (viewer &&
              s.email.toLowerCase() === viewer.email.toLowerCase())),
      );
    }
    let daysRemaining: number | null = null;
    if (board.closesAt && (board.status === "open" || board.status === "ready")) {
      const ms = new Date(board.closesAt).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
    const proposedBy = board.proposedByUserId
      ? this.state.users.find((u) => u.id === board.proposedByUserId)
      : null;
    const instructor = board.instructorHintUserId
      ? this.state.users.find((u) => u.id === board.instructorHintUserId)
      : null;
    const view: ClassInterestBoardView = {
      ...board,
      interestCount,
      viewerSignedUp,
      daysRemaining,
      proposedByDisplayName: proposedBy?.displayName ?? board.contactName,
      instructorHintDisplayName: instructor?.displayName ?? null,
    };
    const isProposer =
      !!this.currentUserId && board.proposedByUserId === this.currentUserId;
    if (!this.viewerIsStaff() && !isProposer) {
      delete view.contactEmail;
      delete view.contactName;
      delete view.staffNotes;
      delete view.reviewedById;
    }
    return view;
  }

  /** Non-staff see live boards and their own proposals, not pending/rejected/expired ones. */
  private interestBoardVisible(board: ClassInterestBoard): boolean {
    if (
      board.status === "open" ||
      board.status === "ready" ||
      board.status === "scheduled"
    ) {
      return true;
    }
    return !!this.currentUserId && board.proposedByUserId === this.currentUserId;
  }

  private viewerIsStaff(): boolean {
    if (!this.currentUserId) return false;
    return isStaffRole(
      this.state.users.find((u) => u.id === this.currentUserId) ?? null,
    );
  }

  private assertInterestPriority(classSessionId: string, userId: string): void {
    const board = this.state.classInterestBoards.find(
      (b) =>
        b.scheduledClassSessionId === classSessionId &&
        b.status === "scheduled" &&
        b.priorityBookingEndsAt &&
        new Date(b.priorityBookingEndsAt).getTime() > Date.now(),
    );
    if (!board) return;
    const user = this.requireUser(userId);
    const onList = this.state.classInterestSignups.some(
      (s) =>
        s.boardId === board.id &&
        !s.deletedAt &&
        (s.userId === userId ||
          s.email.toLowerCase() === user.email.toLowerCase()),
    );
    if (!onList) {
      const ends = board.priorityBookingEndsAt
        ? new Date(board.priorityBookingEndsAt).toLocaleString()
        : "soon";
      throw new Error(
        `This class is in a priority window for interest-list signups until ${ends}`,
      );
    }
  }

  async listInterestBoards(filters?: {
    status?: ClassInterestStatus | ClassInterestStatus[];
    proposedByUserId?: string;
    publicOnly?: boolean;
  }): Promise<ClassInterestBoardView[]> {
    this.sweepInterestExpiry();
    const viewerId = this.currentUserId;
    let boards = this.state.classInterestBoards.filter((b) => !b.deletedAt);
    if (filters?.publicOnly) {
      boards = boards.filter(
        (b) => b.status === "open" || b.status === "ready",
      );
    } else if (!this.viewerIsStaff()) {
      boards = boards.filter((b) => this.interestBoardVisible(b));
    }
    if (filters?.proposedByUserId) {
      boards = boards.filter(
        (b) => b.proposedByUserId === filters.proposedByUserId,
      );
    }
    if (filters?.status) {
      const set = new Set(
        Array.isArray(filters.status) ? filters.status : [filters.status],
      );
      boards = boards.filter((b) => set.has(b.status));
    }
    return boards
      .map((b) => this.toInterestView(b, viewerId))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }

  async getInterestBoard(
    id: string,
    viewerUserId?: string | null,
  ): Promise<ClassInterestBoardView | null> {
    this.sweepInterestExpiry();
    const board = this.state.classInterestBoards.find(
      (b) => b.id === id && !b.deletedAt,
    );
    if (!board) return null;
    if (!this.viewerIsStaff() && !this.interestBoardVisible(board)) return null;
    return this.toInterestView(
      board,
      viewerUserId ?? this.currentUserId,
    );
  }

  async proposeInterestBoard(
    input: ClassInterestBoardInput,
  ): Promise<ClassInterestBoard> {
    const filled = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0;
    if (
      !filled(input.title) ||
      !filled(input.summary) ||
      !filled(input.contactName) ||
      !filled(input.contactEmail)
    ) {
      throw new Error("Title, summary, name, and email are required");
    }
    const title = requiredText(input.title, "Title", 120);
    const summary = requiredText(input.summary, "Summary", 2000);
    const contactName = requiredText(input.contactName, "Name", NAME_MAX);
    const contactEmail = requiredEmail(input.contactEmail).toLowerCase();
    const staff = this.viewerIsStaff();

    const proposer = input.proposedByUserId
      ? this.state.users.find((u) => u.id === input.proposedByUserId)
      : null;
    if (input.proposedByUserId && !proposer) {
      throw new Error("Proposer not found");
    }
    if (proposer && !canProposeInterestBoard(proposer) && !input.forcePending) {
      throw new Error("Only active members or teachers can propose classes");
    }

    const now = this.now();
    const publishDirect =
      !input.forcePending && canPublishInterestBoard(proposer ?? null);
    // The proposer picks how many people it takes, within reason. Only staff
    // may go below two or name someone else as the instructor.
    const asked = Number(input.threshold ?? CLASS_INTEREST_DEFAULT_THRESHOLD);
    const threshold = Number.isFinite(asked)
      ? clampInt(asked, staff ? 1 : 2, staff ? 500 : 50)
      : CLASS_INTEREST_DEFAULT_THRESHOLD;
    const ownHint = proposer?.isTeacher ? proposer.id : null;
    const instructorHintUserId = staff
      ? (input.instructorHintUserId ?? ownHint)
      : ownHint;
    const category =
      typeof input.category === "string" && input.category.length <= 40
        ? input.category
        : "workshop";
    const opensAt = publishDirect ? now : null;
    const closesAt = publishDirect
      ? addHours(now, CLASS_INTEREST_OPEN_DAYS * 24)
      : null;

    const board: ClassInterestBoard = {
      id: this.id("interest"),
      title,
      summary,
      category,
      status: publishDirect ? "open" : "pending",
      threshold,
      proposedByUserId: input.proposedByUserId ?? null,
      contactName,
      contactEmail,
      instructorHintUserId,
      opensAt,
      closesAt,
      scheduledClassSessionId: null,
      priorityBookingEndsAt: null,
      resuggestedFromId: null,
      reviewedById: null,
      reviewedAt: null,
      staffNotes: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.classInterestBoards.push(board);
    return board;
  }

  async joinInterestBoard(
    input: ClassInterestSignupInput,
  ): Promise<ClassInterestSignup> {
    this.sweepInterestExpiry();
    const board = this.state.classInterestBoards.find(
      (b) => b.id === input.boardId && !b.deletedAt,
    );
    if (!board) throw new Error("Interest board not found");
    if (board.status !== "open" && board.status !== "ready") {
      throw new Error("This interest board is not open for signups");
    }

    const filled = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0;
    if (!filled(input.email) || !filled(input.displayName)) {
      throw new Error("Name and email are required");
    }
    const email = requiredEmail(input.email).toLowerCase();
    const displayName = requiredText(input.displayName, "Name", NAME_MAX);

    const existing = this.state.classInterestSignups.find(
      (s) =>
        s.boardId === board.id &&
        !s.deletedAt &&
        ((input.userId && s.userId === input.userId) ||
          s.email.toLowerCase() === email),
    );
    const now = this.now();
    if (existing) {
      const own = !!input.userId && existing.userId === input.userId;
      if (own || this.viewerIsStaff()) return existing;
      // Someone else typed an email that is already on the list. Answer as if
      // it were a new signup so the form cannot be used to look people up.
      return {
        id: this.id("cis"),
        boardId: board.id,
        userId: input.userId ?? null,
        email,
        displayName,
        createdAt: now,
        updatedAt: now,
      };
    }

    const signup: ClassInterestSignup = {
      id: this.id("cis"),
      boardId: board.id,
      userId: input.userId ?? null,
      email,
      displayName,
      createdAt: now,
      updatedAt: now,
    };
    this.state.classInterestSignups.push(signup);

    const count = interestSignupCount(
      board.id,
      this.state.classInterestSignups,
    );
    if (board.status === "open" && count >= board.threshold) {
      board.status = "ready";
      this.touch(board);
    }
    return signup;
  }

  async leaveInterestBoard(
    boardId: string,
    opts: { userId?: string | null; email?: string | null },
  ): Promise<void> {
    const email = opts.email?.trim().toLowerCase();
    const signup = this.state.classInterestSignups.find(
      (s) =>
        s.boardId === boardId &&
        !s.deletedAt &&
        ((opts.userId && s.userId === opts.userId) ||
          (email && s.email.toLowerCase() === email)),
    );
    if (!signup) return;
    signup.deletedAt = this.now();
    this.touch(signup);

    const board = this.state.classInterestBoards.find((b) => b.id === boardId);
    if (board && board.status === "ready") {
      const count = interestSignupCount(
        boardId,
        this.state.classInterestSignups,
      );
      if (count < board.threshold && board.scheduledClassSessionId == null) {
        const stillOpen =
          board.closesAt && new Date(board.closesAt).getTime() > Date.now();
        board.status = stillOpen ? "open" : "expired";
        this.touch(board);
      }
    }
  }

  async listInterestSignups(boardId: string): Promise<ClassInterestSignup[]> {
    return this.state.classInterestSignups
      .filter((s) => s.boardId === boardId && !s.deletedAt)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }

  async resuggestInterestBoard(
    boardId: string,
    actorUserId: string,
  ): Promise<ClassInterestBoard> {
    const prior = this.state.classInterestBoards.find((b) => b.id === boardId);
    if (!prior) throw new Error("Interest board not found");
    if (prior.status !== "expired" && prior.status !== "cancelled") {
      throw new Error("Only expired or cancelled boards can be resuggested");
    }
    const actor = this.requireUser(actorUserId);
    if (
      prior.proposedByUserId &&
      prior.proposedByUserId !== actorUserId &&
      !isStaffRole(actor)
    ) {
      throw new Error("Only the original proposer or staff can resuggest");
    }

    const next = await this.proposeInterestBoard({
      title: prior.title,
      summary: prior.summary,
      category: prior.category,
      threshold: prior.threshold,
      proposedByUserId: actorUserId,
      contactName: actor.displayName,
      contactEmail: actor.email,
      instructorHintUserId: prior.instructorHintUserId,
    });
    next.resuggestedFromId = prior.id;
    this.touch(next);
    return next;
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
      .filter((c) => filters?.includeCancelled || !c.cancelledAt)
      .filter((c) => filters?.includeImported || c.source !== "csv")
      .filter((c) => !filters?.category || c.category === filters.category)
      .filter(
        (c) =>
          !filters?.upcomingOnly || new Date(c.endsAt).getTime() >= now,
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
    if ((!session.published || session.deletedAt) && !this.viewerIsStaff()) {
      return null;
    }
    return this.toClassView(session, this.currentUserId);
  }

  async book(classSessionId: string, userId: string): Promise<Booking> {
    this.requireUser(userId);
    await this.assertMemberCanTransact(userId);
    const session = this.state.classSessions.find((c) => c.id === classSessionId);
    if (!session || !session.published) {
      throw new Error("Class session not found");
    }
    if (session.cancelledAt) throw new Error("This class was cancelled.");
    if (new Date(session.startsAt).getTime() < Date.now()) {
      throw new Error("Cannot book a class that has already started");
    }

    this.assertInterestPriority(classSessionId, userId);
    return this.placeBooking(session, userId, "You already have a booking for this class");
  }

  /**
   * The part of a booking that is the same whoever makes it: one booking per
   * person, prerequisites, then a seat, a payment hold or the waitlist.
   */
  private placeBooking(
    session: ClassSession,
    userId: string,
    alreadyBooked: string,
  ): Booking {
    const classSessionId = session.id;
    const existing = this.state.bookings.find(
      (b) =>
        b.classSessionId === classSessionId &&
        b.userId === userId &&
        !["cancelled", "expired", "no_show"].includes(b.status),
    );
    if (existing) {
      throw new Error(alreadyBooked);
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

    // Same reasoning as repeatSafeId: a double press books one seat. The
    // count makes a rebooking after a cancel a booking of its own.
    const earlierBookings = this.state.bookings.filter(
      (b) => b.classSessionId === classSessionId && b.userId === userId,
    ).length;
    const booking: Booking = {
      id: `bk-${classSessionId}-${userId}-${earlierBookings + 1}`,
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

  async getCreditWallet(userId: string): Promise<CreditWallet> {
    const entries = this.state.creditLedgerEntries
      .filter((e) => e.userId === userId && !e.deletedAt)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      );
    return {
      userId,
      balanceCents: balanceFromEntries(entries),
      entries,
    };
  }

  async payBookingWithCredits(
    bookingId: string,
    userId: string,
  ): Promise<Booking> {
    this.requireUser(userId);
    await this.assertMemberCanTransact(userId);
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== userId) {
      throw new Error("You can only pay for your own booking");
    }
    if (booking.status !== "awaiting_payment") {
      throw new Error(`Cannot pay booking in status ${booking.status}`);
    }
    const session = this.state.classSessions.find(
      (c) => c.id === booking.classSessionId,
    );
    if (!session) throw new Error("Class session not found");
    if (session.priceCents <= 0) {
      throw new Error("This class is free — no credits needed");
    }
    const wallet = await this.getCreditWallet(userId);
    if (wallet.balanceCents < session.priceCents) {
      throw new Error(
        classCreditsShortfallMessage(wallet.balanceCents, session.priceCents),
      );
    }
    const now = this.now();
    this.appendLedger({
      id: this.repeatSafeId("cl-pay", booking.id, "class"),
      userId,
      kind: "class",
      amountCents: -session.priceCents,
      bookingId: booking.id,
      note: `${session.title} · paid with credits`,
      occurredAt: now,
    });
    booking.status = "booked";
    booking.paidAt = now;
    booking.paidMarkedById = userId;
    booking.paymentHoldExpiresAt = null;
    booking.waitlistPosition = null;
    this.touch(booking);
    this.pushAudit({
      action: "credits_class_paid",
      actorId: userId,
      subjectUserId: userId,
      entityType: "Booking",
      entityId: booking.id,
      metadata: { amountCents: session.priceCents },
    });
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

    return this.releaseBooking(booking, session, userId);
  }

  /**
   * Cancel a booking and pass its seat on: the first person waiting moves up,
   * or the waitlist is renumbered. Credits spent on it are given back.
   */
  private async releaseBooking(
    booking: Booking,
    session: ClassSession,
    actorId: string,
  ): Promise<Booking> {
    const wasSeat = SEAT_STATUSES.includes(booking.status);
    booking.status = "cancelled";
    booking.cancelledAt = this.now();
    this.touch(booking);

    if (wasSeat) {
      await this.adminPromoteFromWaitlist(session.id, actorId);
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

    this.refundClassCredits(booking);
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

    if (!isWithinOpeningHours(input.startsAt, input.endsAt, this.openingHours())) {
      throw new Error("Reservation is outside opening hours");
    }

    if (
      machine.attendedOperationRequired &&
      endsAfterShopClosing(input.endsAt, this.openingHours())
    ) {
      throw new Error(
        "Attended-operation machines cannot be reserved past shop closing",
      );
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
    const machineMaxHours =
      machine.maxReservationHours ?? this.state.settings.maxHoursPerDay;
    if (requested > machineMaxHours + 1e-9) {
      throw new Error(
        `This machine can only be reserved for up to ${machineMaxHours} hours at a time`,
      );
    }
    const dayCap = Math.max(
      this.state.settings.maxHoursPerDay,
      machineMaxHours,
    );
    if (dayHours + requested > dayCap + 1e-9) {
      throw new Error(
        `Maximum of ${dayCap} reservation hours per day on this machine`,
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

    const slotMin = Math.max(5, this.state.settings.reservationSlotMinutes);
    const slots: AvailabilitySlot[] = [];
    const isDate = (value: unknown) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!isDate(from) || !isDate(to)) {
      throw new Error("Invalid date range");
    }
    const fromDate = new Date(`${from}T00:00:00-07:00`);
    const toDate = new Date(`${to}T23:59:59-07:00`);
    const spanDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    // The loop below builds one slot per step, so the span has to be bounded.
    const maxDays = Math.max(62, this.state.settings.reservationHorizonDays + 7);
    if (!Number.isFinite(spanDays) || spanDays < 0 || spanDays > maxDays) {
      throw new Error("Date range is too long");
    }
    const now = Date.now();
    const openingHours = this.openingHours();

    for (
      let cursor = fromDate.getTime();
      cursor < toDate.getTime();
      cursor += slotMin * 60_000
    ) {
      const startsAt = new Date(cursor).toISOString();
      const endsAt = new Date(cursor + slotMin * 60_000).toISOString();
      const startParts = laParts(startsAt);
      const day = openingHours[startParts.weekday];
      const startMin = startParts.hour * 60 + startParts.minute;
      const endParts = laParts(endsAt);
      const endMin = endParts.hour * 60 + endParts.minute;

      if (
        !day ||
        startParts.dateKey !== endParts.dateKey ||
        startMin < day.open ||
        endMin > day.close
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
    const uid = this.currentUserId;
    const attemptLimit =
      mod.attemptLimit || this.state.settings.quizAttemptLimit;
    const attemptCount =
      uid == null
        ? 0
        : this.state.quizAttempts.filter(
            (a) => a.userId === uid && a.moduleId === mod.id,
          ).length;
    const primaryVideosWatched = this.primaryVideosWatched(mod.id, uid);
    const lessons = this.state.lessons
      .filter((l) => l.moduleId === mod.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => {
        const content = this.state.contentPages.find(
          (c) => c.slug === l.contentSlug,
        );
        const completed =
          uid != null &&
          this.state.lessonProgress.some(
            (p) => p.userId === uid && p.lessonId === l.id,
          );
        const videos = this.state.lessonVideos
          .filter((v) => v.lessonId === l.id)
          .sort((a, b) => a.order - b.order)
          .map((v) => ({
            ...v,
            watched:
              uid != null &&
              this.state.videoWatches.some(
                (w) => w.userId === uid && w.videoId === v.id,
              ),
          }));
        return {
          ...l,
          completed,
          html: content?.html ?? "",
          videos,
        };
      });
    return {
      ...view,
      lessons,
      primaryVideosWatched,
      attemptsRemaining: Math.max(0, attemptLimit - attemptCount),
    };
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

  async markVideoWatched(
    videoId: string,
    userId: string,
  ): Promise<VideoWatch> {
    this.requireUser(userId);
    const video = this.state.lessonVideos.find((v) => v.id === videoId);
    if (!video) throw new Error("Video not found");
    const existing = this.state.videoWatches.find(
      (w) => w.userId === userId && w.videoId === videoId,
    );
    if (existing) return existing;
    const now = this.now();
    const watch: VideoWatch = {
      id: this.id("vw"),
      userId,
      videoId,
      watchedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.videoWatches.push(watch);
    return watch;
  }

  async getQuestionBank(moduleId: string): Promise<Question[]> {
    return this.state.questions.filter(
      (q) => q.moduleId === moduleId && q.active,
    );
  }

  async getModulePublishReadiness(
    moduleId: string,
  ): Promise<ModulePublishReadiness> {
    const mod = this.state.learningModules.find((m) => m.id === moduleId);
    if (!mod) throw new Error("Module not found");
    return this.publishReadinessFor(mod);
  }

  async startQuiz(moduleId: string, userId: string): Promise<QuizPayload> {
    this.requireUser(userId);
    const mod = this.state.learningModules.find((m) => m.id === moduleId);
    if (!mod) throw new Error("Module not found");
    const user = this.requireUser(userId);
    const staff = user.role === "staff" || user.role === "admin";
    if (!mod.published && !staff) throw new Error("Module not found");

    if (!this.primaryVideosWatched(moduleId, userId)) {
      throw new Error(
        "Watch all required (primary) videos before taking the quiz",
      );
    }

    const attemptLimit =
      mod.attemptLimit || this.state.settings.quizAttemptLimit;
    const prior = this.state.quizAttempts.filter(
      (a) => a.userId === userId && a.moduleId === moduleId,
    );
    if (prior.length >= attemptLimit) {
      throw new Error(`Attempt limit of ${attemptLimit} reached`);
    }

    // Always exclude answerPending from the sampled bank (draft + published).
    const bank = this.state.questions.filter(
      (q) => q.moduleId === moduleId && q.active && !q.answerPending,
    );
    if (bank.length === 0) throw new Error("No quiz questions available");

    const count = Math.min(
      this.state.settings.quizQuestionCount,
      bank.length,
    );
    const sampled = shuffleInPlace([...bank]).slice(0, count);
    const attemptNumber = prior.length + 1;
    const startedAt = this.now();
    // Signed, not stored: the next request runs on a different provider.
    const attemptToken = await signQuizToken({
      userId,
      moduleId,
      questionIds: sampled.map((q) => q.id),
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
        multi: questionCorrectIndexes(q).length > 1 ? true : undefined,
      })),
      passThresholdPercent:
        mod.passThresholdPercent || this.state.settings.quizPassThresholdPercent,
      attemptNumber,
      attemptLimit,
    };
  }

  async submitQuiz(input: SubmitQuizInput): Promise<QuizAttemptResult> {
    const token = await readQuizToken(input.attemptToken);
    if (!token) throw new Error("Invalid or expired quiz attempt token");
    if (token.userId !== input.userId || token.moduleId !== input.moduleId) {
      throw new Error("Quiz attempt token mismatch");
    }
    if (
      !Array.isArray(input.questionIds) ||
      input.questionIds.length !== token.questionIds.length ||
      input.questionIds.some((id, i) => id !== token.questionIds[i])
    ) {
      throw new Error("Question set does not match started attempt");
    }
    if (
      !Array.isArray(input.answers) ||
      input.answers.length !== token.questionIds.length
    ) {
      throw new Error("Answer count mismatch");
    }

    const mod = this.state.learningModules.find((m) => m.id === input.moduleId);
    if (!mod) throw new Error("Module not found");

    const earlier = this.state.quizAttempts.filter(
      (a) => a.userId === input.userId && a.moduleId === input.moduleId,
    );
    // A token is good for one submission. The start time is the attempt's id.
    if (earlier.some((a) => a.startedAt === token.startedAt)) {
      throw new Error("This quiz attempt was already submitted");
    }
    const limit = mod.attemptLimit || this.state.settings.quizAttemptLimit;
    if (earlier.length >= limit) {
      throw new Error(`Attempt limit of ${limit} reached`);
    }

    // Grade against the questions as they are now. If staff changed the bank
    // mid-attempt, the member starts again.
    const questions: Question[] = [];
    for (const id of token.questionIds) {
      const question = this.state.questions.find(
        (q) => q.id === id && q.moduleId === input.moduleId && q.active,
      );
      if (!question) {
        throw new Error("This quiz changed while you were taking it. Start again.");
      }
      questions.push(question);
    }

    const threshold =
      mod.passThresholdPercent || this.state.settings.quizPassThresholdPercent;
    const graded = gradeQuizAttempt({
      questions,
      answers: input.answers,
      passThresholdPercent: threshold,
      requireSafetyCriticalAll: this.state.settings.requireSafetyCriticalAll,
    });
    const now = this.now();
    const attemptLimit =
      mod.attemptLimit || this.state.settings.quizAttemptLimit;

    const attempt: QuizAttempt = {
      id: this.id("qa"),
      userId: input.userId,
      moduleId: input.moduleId,
      questionIds: [...input.questionIds],
      answers: structuredClone(input.answers),
      scorePercent: graded.scorePct,
      passed: graded.passed,
      thresholdMet: graded.thresholdMet,
      safetyCriticalMissedIds: graded.safetyCriticalMissed.map((q) => q.id),
      startedAt: token.startedAt,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.state.quizAttempts.push(attempt);

    const priorCount = this.state.quizAttempts.filter(
      (a) => a.userId === input.userId && a.moduleId === input.moduleId,
    ).length;
    const attemptsRemaining = Math.max(0, attemptLimit - priorCount);

    let knowledgePassed = false;
    if (graded.passed) {
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
      } else if (uc.status !== "certified" && uc.status !== "revoked") {
        uc.status = "knowledge_passed";
        uc.knowledgePassedAt = now;
        this.touch(uc);
      } else if (!uc.knowledgePassedAt) {
        uc.knowledgePassedAt = now;
        this.touch(uc);
      }

      // Never certified from quiz alone (including knowledgeOnly modules).
      knowledgePassed = true;
      this.pushAudit({
        action: "cert_knowledge_passed",
        actorId: input.userId,
        subjectUserId: input.userId,
        entityType: "UserCertification",
        entityId: uc.id,
        metadata: {
          scorePercent: graded.scorePct,
          moduleId: mod.id,
          thresholdMet: graded.thresholdMet,
        },
      });
    }

    return {
      attempt,
      passed: graded.passed,
      scorePct: graded.scorePct,
      scorePercent: graded.scorePct,
      thresholdMet: graded.thresholdMet,
      // Prompt only. The full question carries the correct answer.
      safetyCriticalMissed: graded.safetyCriticalMissed.map((q) => ({
        id: q.id,
        prompt: q.prompt,
      })),
      attemptsRemaining,
      knowledgePassed,
    };
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

  async listPeople(kind?: PersonKind): Promise<Person[]> {
    return this.state.people
      .filter((p) => p.published && (kind ? p.kind === kind : true))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listVolunteerRoles(): Promise<VolunteerRole[]> {
    return [...this.state.volunteerRoles]
      .filter((r) => r.active)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminListVolunteerRoles(): Promise<VolunteerRole[]> {
    return [...this.state.volunteerRoles].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminSaveVolunteerRole(input: VolunteerRoleInput): Promise<VolunteerRole> {
    const now = this.now();
    const title = requiredText(input.title, "Title", NAME_MAX);
    const existing = input.id
      ? this.state.volunteerRoles.find((r) => r.id === input.id)
      : undefined;
    if (input.id && !existing) throw new Error("That role no longer exists.");
    const sameTitle = this.state.volunteerRoles.find(
      (r) => r.id !== existing?.id && r.title.trim().toLowerCase() === title.toLowerCase(),
    );
    if (sameTitle) throw new Error(`There is already a role called "${sameTitle.title}".`);

    let role: VolunteerRole;
    if (existing) {
      Object.assign(existing, {
        title,
        active: input.active ?? existing.active,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        updatedAt: now,
      });
      role = existing;
    } else {
      // The address and the description page keep their names for good, so
      // a later rename does not break the sign-up form or the page link.
      let slug = contentSlug(title).slice(0, 48).replace(/-+$/g, "") || "role";
      const taken = (candidate: string) =>
        this.state.volunteerRoles.some((r) => r.slug === candidate) ||
        this.state.contentPages.some((p) => p.slug === `volunteer-${candidate}`);
      for (let n = 2; taken(slug); n += 1) {
        slug = `${slug.replace(/-\d+$/, "")}-${n}`;
      }
      role = {
        id: this.id("vr"),
        slug,
        title,
        contentSlug: `volunteer-${slug}`,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? nextSortOrder(this.state.volunteerRoles),
        createdAt: now,
        updatedAt: now,
      };
      this.state.volunteerRoles.push(role);
    }

    if (input.descriptionHtml !== undefined) {
      const html = cleanContentHtml(input.descriptionHtml);
      const page = this.state.contentPages.find((p) => p.slug === role.contentSlug);
      if (page) {
        if (page.html !== html || page.title !== title || !page.published) {
          Object.assign(page, {
            html,
            title,
            published: contentHtmlHasText(html),
            updatedAt: now,
          });
        }
      } else if (contentHtmlHasText(html)) {
        this.state.contentPages.push({
          id: this.id("content"),
          slug: role.contentSlug,
          title,
          html,
          category: "volunteer",
          version: "1",
          published: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    this.pushAudit({
      action: "volunteer_role_saved",
      actorId: this.currentUserId ?? null,
      entityType: "VolunteerRole",
      entityId: role.id,
      metadata: { title: role.title, active: role.active },
    });
    return { ...role };
  }

  async submitVolunteerInterest(
    input: VolunteerInterestInput,
  ): Promise<VolunteerInterest> {
    const filled = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0;
    if (!filled(input.name) || !filled(input.email) || !filled(input.message)) {
      throw new Error("Name, email, and message are required");
    }
    const name = requiredText(input.name, "Name", NAME_MAX);
    const email = requiredEmail(input.email);
    const message = requiredText(input.message, "Message", MESSAGE_MAX);
    const phone = optionalText(input.phone, "Phone", PHONE_MAX) ?? undefined;
    const roleId =
      typeof input.roleId === "string" &&
      this.state.volunteerRoles.some((r) => r.id === input.roleId)
        ? input.roleId
        : null;
    const now = this.now();
    const interest: VolunteerInterest = {
      id: this.id("vi"),
      name,
      email,
      phone,
      roleId,
      message,
      status: "new",
      userId: input.userId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.volunteerInterests.push(interest);
    return interest;
  }

  private toBountyView(bounty: Bounty): BountyView {
    const claimer = bounty.claimedByUserId
      ? this.state.users.find((u) => u.id === bounty.claimedByUserId)
      : undefined;
    const view: BountyView = {
      ...bounty,
      claimedByDisplayName: claimer?.displayName ?? null,
    };
    // Contact details are for staff, the person who asked, and the member
    // who took the job. Any other account sees the request without them.
    const viewer = this.currentUserId;
    const mayContact =
      !!viewer &&
      (this.viewerIsStaff() ||
        bounty.userId === viewer ||
        bounty.claimedByUserId === viewer);
    if (!mayContact) {
      delete view.requesterEmail;
      delete view.userId;
    }
    return view;
  }

  async listBounties(filters?: {
    status?: BountyStatus | BountyStatus[];
  }): Promise<BountyView[]> {
    const statuses = filters?.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;
    const rank: Record<BountyStatus, number> = {
      open: 0,
      claimed: 1,
      completed: 2,
    };
    return this.state.bounties
      .filter((b) => !b.deletedAt)
      .filter((b) => (statuses ? statuses.includes(b.status) : true))
      .map((b) => this.toBountyView(b))
      .sort((a, b) => {
        const byStatus = rank[a.status] - rank[b.status];
        if (byStatus !== 0) return byStatus;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  async getBounty(id: string): Promise<BountyView | null> {
    const bounty = this.state.bounties.find((b) => b.id === id && !b.deletedAt);
    return bounty ? this.toBountyView(bounty) : null;
  }

  async adminListBounties(): Promise<Bounty[]> {
    return this.state.bounties
      .map((b) => ({ ...b }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async adminUpdateBounty(id: string, patch: BountyModeration): Promise<Bounty> {
    const bounty = this.state.bounties.find((b) => b.id === id);
    if (!bounty) throw new Error("That request no longer exists.");
    const actorId = this.currentUserId ?? null;
    const now = this.now();
    const note = (action: AuditAction) =>
      this.pushAudit({ action, actorId, entityType: "Bounty", entityId: id });

    if (patch.title !== undefined || patch.description !== undefined) {
      const title = (patch.title ?? bounty.title).trim();
      const description = (patch.description ?? bounty.description).trim();
      if (title.length < 3 || title.length > 120) {
        throw new Error("Title should be between 3 and 120 characters");
      }
      if (description.length < 10 || description.length > 2000) {
        throw new Error("The description should be between 10 and 2000 characters");
      }
      if (title !== bounty.title || description !== bounty.description) {
        bounty.title = title;
        bounty.description = description;
        note("bounty_edited_by_staff");
      }
    }
    if (patch.hidden !== undefined && patch.hidden !== Boolean(bounty.deletedAt)) {
      bounty.deletedAt = patch.hidden ? now : null;
      note(patch.hidden ? "bounty_hidden" : "bounty_unhidden");
    }
    if (patch.reopen && bounty.status !== "open") {
      bounty.status = "open";
      bounty.claimedByUserId = null;
      bounty.claimedAt = null;
      bounty.completedAt = null;
      note("bounty_reopened");
    }
    bounty.updatedAt = now;
    return { ...bounty };
  }

  async adminDeleteBounty(id: string): Promise<void> {
    const bounty = this.state.bounties.find((b) => b.id === id);
    if (!bounty) throw new Error("That request is already gone.");
    this.state.bounties = this.state.bounties.filter((b) => b.id !== id);
    this.pushAudit({
      action: "bounty_removed",
      actorId: this.currentUserId ?? null,
      entityType: "Bounty",
      entityId: id,
      metadata: { title: bounty.title },
    });
  }

  async submitBountyRequest(input: BountyRequestInput): Promise<Bounty> {
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const title = text(input.title);
    const description = text(input.description);
    const requesterEmail = text(input.requesterEmail);
    if (!text(input.requesterName)) {
      throw new Error("Name is required");
    }
    const requesterName = requiredText(input.requesterName, "Name", NAME_MAX);
    const businessName = optionalText(input.businessName, "Business name", NAME_MAX);
    if (title.length < 3 || title.length > 120) {
      throw new Error("Title should be between 3 and 120 characters");
    }
    if (description.length < 10 || description.length > 2000) {
      throw new Error("Describe what you want made (at least 10 characters)");
    }
    if (!requesterName) {
      throw new Error("Name is required");
    }
    if (requesterEmail.length > 254 || !isValidBountyEmail(requesterEmail)) {
      throw new Error("A valid email is required so a member can follow up");
    }
    const now = this.now();
    const bounty: Bounty = {
      id: this.id("bounty"),
      title,
      description,
      requesterName,
      requesterEmail,
      businessName,
      userId: input.userId ?? null,
      status: "open",
      claimedByUserId: null,
      claimedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.bounties.push(bounty);
    return bounty;
  }

  async claimBounty(id: string, userId: string): Promise<Bounty> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error("Sign in as a member to claim a bounty");
    if (!canClaimBounty(user)) {
      throw new Error(
        "An active membership with shop access is required to claim",
      );
    }
    const bounty = this.state.bounties.find((b) => b.id === id && !b.deletedAt);
    if (!bounty) throw new Error("Bounty not found");
    if (bounty.status === "claimed") {
      const claimer = this.state.users.find(
        (u) => u.id === bounty.claimedByUserId,
      );
      throw new Error(
        `Already claimed by ${claimer?.displayName ?? "another member"}`,
      );
    }
    if (bounty.status !== "open") {
      throw new Error("This bounty is not open to claim");
    }
    const now = this.now();
    bounty.status = "claimed";
    bounty.claimedByUserId = user.id;
    bounty.claimedAt = now;
    return this.touch(bounty);
  }

  async completeBounty(id: string, userId: string): Promise<Bounty> {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error("Sign in to complete a bounty");
    const bounty = this.state.bounties.find((b) => b.id === id && !b.deletedAt);
    if (!bounty) throw new Error("Bounty not found");
    if (bounty.status !== "claimed") {
      throw new Error("Only claimed bounties can be marked completed");
    }
    if (!canCompleteBounty(user, bounty)) {
      throw new Error("Only the member who claimed this can mark it done");
    }
    bounty.status = "completed";
    bounty.completedAt = this.now();
    return this.touch(bounty);
  }

  private toWishlistItemView(item: WishlistItem): WishlistItemView {
    const zone = this.state.wishlistZones.find((z) => z.id === item.zoneId);
    const pendingReportCount = this.state.wishlistPurchaseReports.filter(
      (r) => r.itemId === item.id && r.status === "pending",
    ).length;
    return {
      ...item,
      zoneName: zone?.name ?? item.zoneId,
      pendingReportCount,
    };
  }

  async getWishlistCatalog(): Promise<WishlistCatalog> {
    const zones = [...this.state.wishlistZones].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    const items = this.state.wishlistItems.map((i) =>
      this.toWishlistItemView(i),
    );
    const recentlyFunded = items
      .filter((i) => isRecentlyFunded(i))
      .sort((a, b) => {
        const aAt = a.fulfilledAt ? new Date(a.fulfilledAt).getTime() : 0;
        const bAt = b.fulfilledAt ? new Date(b.fulfilledAt).getTime() : 0;
        return bAt - aAt;
      });
    return {
      zones,
      items,
      recentlyFunded,
      stats: wishlistStats(this.state.wishlistItems),
    };
  }

  async reportWishlistPurchase(
    input: WishlistPurchaseReportInput,
  ): Promise<WishlistPurchaseReport> {
    const item = this.state.wishlistItems.find((i) => i.id === input.itemId);
    if (!item) throw new Error("Wishlist item not found");
    if (item.status === "fulfilled") {
      throw new Error("This item is already marked purchased");
    }
    const name = requiredText(input.name, "Name", NAME_MAX);
    const email = typeof input.email === "string" ? input.email.trim() : "";
    if (email.length > 254 || !isValidWishlistEmail(email)) {
      throw new Error("A valid email is required so staff can follow up");
    }
    const note = optionalText(input.note, "Note", 1000);
    const now = this.now();
    const report: WishlistPurchaseReport = {
      id: this.id("wpr"),
      itemId: item.id,
      name,
      email,
      note,
      userId: input.userId ?? null,
      status: "pending",
      reviewedById: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.wishlistPurchaseReports.push(report);
    this.pushAudit({
      action: "wishlist_purchase_reported",
      actorId: input.userId ?? null,
      entityType: "WishlistPurchaseReport",
      entityId: report.id,
      metadata: { itemId: item.id },
    });
    return report;
  }

  async adminListWishlistPurchaseReports(filters?: {
    status?:
      | import("./types").WishlistPurchaseReportStatus
      | import("./types").WishlistPurchaseReportStatus[];
  }): Promise<WishlistPurchaseReportView[]> {
    const statuses = filters?.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;
    return this.state.wishlistPurchaseReports
      .filter((r) => (statuses ? statuses.includes(r.status) : true))
      .map((r) => {
        const item = this.state.wishlistItems.find((i) => i.id === r.itemId);
        return {
          ...r,
          itemName: item?.name ?? r.itemId,
          itemStatus: item?.status ?? "needed",
          itemModel: item?.model ?? "",
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  private fulfillWishlistItem(
    item: WishlistItem,
    actorId: string,
    by: "staff" | "zeffy",
    paymentId?: string | null,
  ): WishlistItem {
    const now = this.now();
    item.status = "fulfilled";
    item.fulfilledAt = now;
    item.fulfilledBy = by;
    if (paymentId) item.zeffyPaymentId = paymentId;
    this.touch(item);
    for (const report of this.state.wishlistPurchaseReports) {
      if (report.itemId === item.id && report.status === "pending") {
        report.status = "confirmed";
        report.reviewedById = actorId;
        report.reviewedAt = now;
        this.touch(report);
      }
    }
    this.pushAudit({
      action: "wishlist_item_fulfilled",
      actorId,
      entityType: "WishlistItem",
      entityId: item.id,
      metadata: { by, paymentId: paymentId ?? null },
    });
    return item;
  }

  async adminConfirmWishlistPurchase(
    reportId: string,
    actorId: string,
  ): Promise<WishlistItem> {
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!canMarkWishlistPurchased(actor)) {
      throw new Error("Only staff can confirm a wishlist purchase");
    }
    const report = this.state.wishlistPurchaseReports.find(
      (r) => r.id === reportId,
    );
    if (!report) throw new Error("Purchase report not found");
    if (report.status !== "pending") {
      throw new Error("This report is no longer pending");
    }
    const item = this.state.wishlistItems.find((i) => i.id === report.itemId);
    if (!item) throw new Error("Wishlist item not found");
    if (item.status === "fulfilled") {
      report.status = "confirmed";
      report.reviewedById = actorId;
      report.reviewedAt = this.now();
      this.touch(report);
      return item;
    }
    return this.fulfillWishlistItem(item, actorId, "staff");
  }

  async adminDismissWishlistPurchase(
    reportId: string,
    actorId: string,
  ): Promise<WishlistPurchaseReport> {
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!canMarkWishlistPurchased(actor)) {
      throw new Error("Only staff can dismiss a purchase report");
    }
    const report = this.state.wishlistPurchaseReports.find(
      (r) => r.id === reportId,
    );
    if (!report) throw new Error("Purchase report not found");
    if (report.status !== "pending") {
      throw new Error("This report is no longer pending");
    }
    report.status = "dismissed";
    report.reviewedById = actorId;
    report.reviewedAt = this.now();
    this.pushAudit({
      action: "wishlist_purchase_dismissed",
      actorId,
      entityType: "WishlistPurchaseReport",
      entityId: report.id,
      metadata: { itemId: report.itemId },
    });
    return this.touch(report);
  }

  async adminMarkWishlistPurchased(
    itemId: string,
    actorId: string,
  ): Promise<WishlistItem> {
    const actor = this.state.users.find((u) => u.id === actorId);
    if (!canMarkWishlistPurchased(actor)) {
      throw new Error("Only staff can mark a wishlist item purchased");
    }
    const item = this.state.wishlistItems.find((i) => i.id === itemId);
    if (!item) throw new Error("Wishlist item not found");
    if (item.status === "fulfilled") return item;
    return this.fulfillWishlistItem(item, actorId, "staff");
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

  // ── Redemption codes ──────────────────────────────────────────────────────

  private codeClaims: CodeClaim[] = [];

  /** The claims the last call made. Server helper; not part of DataProvider. */
  takeCodeClaims(): CodeClaim[] {
    const claims = this.codeClaims;
    this.codeClaims = [];
    return claims;
  }

  /** The code someone typed, if it can be used right now. Otherwise why not. */
  private usableCode(text: string): RedemptionCode {
    const wanted = normalizeCode(text);
    const code = wanted
      ? this.state.redemptionCodes.find((c) => c.code === wanted)
      : undefined;
    // One answer for "no such code" and "staff cancelled it", so a guess
    // learns nothing from the difference.
    if (!code || code.voidedAt) throw new Error(CODE_NOT_VALID);
    if (code.redeemedAt) throw new Error(CODE_ALREADY_USED);
    if (code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()) {
      throw new Error(CODE_EXPIRED);
    }
    return code;
  }

  /**
   * When a membership code would run to for this person, or why it cannot be
   * used. `atDesk` words the refusal for the staff member reading it.
   */
  private membershipEndFor(user: User, code: RedemptionCode, atDesk = false): string {
    const now = this.now();
    const active = user.status === "active" && Boolean(user.tier);
    const endsAt = user.membershipEndsAt ?? null;
    const running = endsAt !== null && new Date(endsAt).getTime() > Date.now();
    if (active && endsAt === null) {
      throw new Error(
        atDesk
          ? `${user.displayName} already pays for a membership, so a membership card cannot be added to it. The card has not been used. You can void it and make a shop credit code for them instead.`
          : "You already have a membership, so this code cannot be added to it here. Bring it to staff and they can turn it into shop credit.",
      );
    }
    if (active && running && user.tier !== code.tier) {
      throw new Error(
        atDesk
          ? `${user.displayName} has a different gifted membership running until ${endsAt!.slice(0, 10)}. The card has not been used.`
          : "You have a different gifted membership that is still running. See staff to combine it with this code.",
      );
    }
    const base = active && running ? endsAt! : now;
    return addCalendarMonths(base, code.months ?? 0);
  }

  private shopAccessForTier(tier: MembershipTier): boolean {
    const product = this.state.membershipProducts.find((p) => p.tier === tier);
    return product ? product.shopAccess : tier !== "friend";
  }

  /** Why this person cannot use the code on this class, or null when they can. */
  private classCodeProblem(
    code: RedemptionCode,
    session: ClassSession | undefined,
    userId: string,
    atDesk = false,
  ): string | null {
    if (
      !session ||
      !session.published ||
      session.cancelledAt ||
      session.deletedAt ||
      new Date(session.startsAt).getTime() <= Date.now()
    ) {
      return "That class is not available. Choose another.";
    }
    if (code.classSessionId) {
      if (code.classSessionId !== session.id) return "This code is for a different class.";
    } else if (session.priceCents > (code.maxPriceCents ?? 0)) {
      return `This code does not cover that class. It is good for one class up to ${dollars(code.maxPriceCents ?? 0)}.`;
    }
    const mine = this.state.bookings.some(
      (b) =>
        b.classSessionId === session.id &&
        b.userId === userId &&
        !["cancelled", "expired", "no_show"].includes(b.status),
    );
    if (mine) {
      return atDesk
        ? "They already have a booking for that class."
        : "You already have a booking for that class.";
    }
    const seats = this.state.bookings.filter(
      (b) => b.classSessionId === session.id && SEAT_STATUSES.includes(b.status),
    ).length;
    if (seats >= session.capacity) {
      return "That class is full. Choose another, or ask staff.";
    }
    return null;
  }

  async getCodeOffer(userId: string, codeText: string): Promise<CodeOffer> {
    return this.offerFor(this.requireUser(userId), this.usableCode(codeText), false);
  }

  /** What `code` would give `user` right now. */
  private offerFor(user: User, code: RedemptionCode, atDesk: boolean): CodeOffer {
    const userId = user.id;
    const offer: CodeOffer = { kind: code.kind, expiresAt: code.expiresAt ?? null };
    if (code.kind === "credit") {
      offer.amountCents = code.amountCents ?? 0;
    } else if (code.kind === "membership") {
      offer.tier = code.tier ?? undefined;
      offer.months = code.months ?? undefined;
      offer.membershipEndsAt = this.membershipEndFor(user, code, atDesk);
    } else {
      offer.maxPriceCents = code.classSessionId ? null : (code.maxPriceCents ?? 0);
      offer.classes = this.state.classSessions
        .filter((s) => this.classCodeProblem(code, s, userId, atDesk) === null)
        .filter((s) => code.classSessionId || s.priceCents > 0)
        .sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .map((s) => ({
          id: s.id,
          title: s.title,
          startsAt: s.startsAt,
          priceCents: s.priceCents,
        }));
    }
    return offer;
  }

  /** Whoever is acting, when they are staff. Otherwise this throws. */
  private requireStaffActor(): User {
    const actor = this.state.users.find((u) => u.id === this.currentUserId) ?? null;
    if (!actor || !isStaffRole(actor)) throw new Error("Staff only");
    return actor;
  }

  /**
   * The code staff mean by a card number ("014") or a full code, if it can be
   * used right now. Staff are told plainly what is wrong with a card: they
   * can already see every code.
   */
  private usableCodeForStaff(ref: string): RedemptionCode {
    const cardNumber = parseCardNumber(ref);
    if (cardNumber === null) return this.usableCode(ref);
    const card = formatCardNumber(cardNumber);
    const code = this.state.redemptionCodes.find((c) => c.cardNumber === cardNumber);
    if (!code) throw new Error(`No gift card has the number ${card}.`);
    if (code.voidedAt) throw new Error(`Card ${card} was voided. It cannot be redeemed.`);
    if (code.redeemedAt) {
      const who =
        this.state.users.find((u) => u.id === code.redeemedByUserId)?.displayName ??
        "someone";
      throw new Error(
        `Card ${card} has already been redeemed, for ${who} on ${code.redeemedAt.slice(0, 10)}.`,
      );
    }
    if (code.expiresAt && new Date(code.expiresAt).getTime() <= Date.now()) {
      throw new Error(`Card ${card} has expired.`);
    }
    return code;
  }

  async adminGetCodeOfferFor(memberId: string, ref: string): Promise<StaffCodeOffer> {
    this.requireStaffActor();
    const member = this.requireUser(memberId);
    const code = this.usableCodeForStaff(ref);
    return {
      ...this.offerFor(member, code, true),
      codeId: code.id,
      cardNumber: code.cardNumber ?? null,
    };
  }

  async adminRedeemCodeFor(
    memberId: string,
    ref: string,
    choice?: { classSessionId?: string },
  ): Promise<CodeRedemption> {
    const staff = this.requireStaffActor();
    const member = this.requireUser(memberId);
    return this.applyCode(member, this.usableCodeForStaff(ref), choice, staff);
  }

  async adminCreateMember(input: NewMemberInput): Promise<User> {
    const staff = this.requireStaffActor();
    const firstName = requiredText(input.firstName, "First name", NAME_MAX);
    const lastName = optionalText(input.lastName, "Last name", NAME_MAX) ?? "";
    let email: string;
    try {
      // The same form sign-in stores, so a later sign-in finds this row.
      email = normalizeSignInEmail(input.email);
    } catch {
      throw new Error("Enter their email address, such as pat@example.com.");
    }
    const existing = this.state.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      throw new Error(
        `That email already belongs to ${existing.displayName}. Open their page to redeem the card for them.`,
      );
    }
    const now = this.now();
    const user: User = {
      id: `member-${crypto.randomUUID()}`,
      email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      // What a first sign-in makes: a member who has not joined or onboarded.
      role: "member",
      status: "pending",
      tier: null,
      shopAccess: false,
      isTeacher: false,
      profileComplete: false,
      createdAt: now,
      updatedAt: now,
    };
    this.state.users.push(user);
    this.pushAudit({
      action: "member_created",
      actorId: staff.id,
      subjectUserId: user.id,
      entityType: "User",
      entityId: user.id,
      metadata: { via: "staff" },
    });
    return user;
  }

  async redeemCode(
    userId: string,
    codeText: string,
    choice?: { classSessionId?: string },
  ): Promise<CodeRedemption> {
    return this.applyCode(this.requireUser(userId), this.usableCode(codeText), choice, null);
  }

  /**
   * Give `user` what `code` is for and mark it used. The one path for a
   * member redeeming their own code and for staff redeeming a card for them
   * (`staff` set): the benefit always lands on `user`.
   */
  private async applyCode(
    user: User,
    code: RedemptionCode,
    choice: { classSessionId?: string } | undefined,
    staff: User | null,
  ): Promise<CodeRedemption> {
    const userId = user.id;
    const atDesk = staff !== null;
    const card = code.cardNumber ? `Gift card ${formatCardNumber(code.cardNumber)}` : null;
    const now = this.now();
    const done: CodeRedemption = { kind: code.kind };
    let summary: string;
    let granted: Record<string, unknown>;

    if (code.kind === "credit") {
      const amountCents = code.amountCents ?? 0;
      this.appendLedger({
        // The row id comes from the code, so a repeat lands on the same row.
        id: `cl-code-${code.id}`,
        userId,
        kind: "gift_code",
        amountCents,
        sourcePaymentId: `code:${code.id}`,
        note: card ?? "Redeemed a code",
        occurredAt: now,
      });
      done.amountCents = amountCents;
      summary = `${dollars(amountCents)} shop credit`;
      granted = { amountCents };
    } else if (code.kind === "membership") {
      const tier = code.tier!;
      const endsAt = this.membershipEndFor(user, code, atDesk);
      user.status = "active";
      user.tier = tier;
      user.shopAccess = this.shopAccessForTier(tier);
      user.membershipEndsAt = endsAt;
      this.touch(user);
      done.tier = tier;
      done.membershipEndsAt = endsAt;
      summary = `${tier} membership, ${code.months} month${code.months === 1 ? "" : "s"}, to ${endsAt.slice(0, 10)}`;
      granted = { tier, months: code.months, membershipEndsAt: endsAt };
    } else {
      const sessionId = choice?.classSessionId ?? code.classSessionId ?? "";
      if (!sessionId) throw new Error("Choose a class to use this code on.");
      const session = this.state.classSessions.find((c) => c.id === sessionId);
      const problem = this.classCodeProblem(code, session, userId, atDesk);
      if (problem || !session) throw new Error(problem ?? "That class is not available.");

      // Credit for exactly this class, then the ordinary booking and payment,
      // so seats, cancelling and refunds follow the rules every booking does.
      // If any step refuses, put everything back and leave the code unused.
      const before = {
        ledger: [...this.state.creditLedgerEntries],
        bookings: this.state.bookings.map((b) => ({ ...b })),
        audit: this.state.auditEvents.length,
      };
      try {
        if (session.priceCents > 0) {
          this.appendLedger({
            id: `cl-code-${code.id}`,
            userId,
            kind: "gift_code",
            amountCents: session.priceCents,
            sourcePaymentId: `code:${code.id}`,
            note: `Class code · ${session.title}`,
            occurredAt: now,
          });
        }
        const booking = await this.book(session.id, userId);
        if (booking.status === "waitlisted") {
          throw new Error("That class is full. Choose another, or ask staff.");
        }
        if (session.priceCents > 0) {
          await this.payBookingWithCredits(booking.id, userId);
        }
        done.bookingId = booking.id;
      } catch (err) {
        this.state.creditLedgerEntries = before.ledger;
        this.state.bookings = before.bookings;
        this.state.auditEvents.length = before.audit;
        throw err;
      }
      done.classSessionId = session.id;
      done.classTitle = session.title;
      summary = `Booked: ${session.title}`;
      granted = { classSessionId: session.id, amountCents: session.priceCents };
    }

    code.redeemedAt = now;
    code.redeemedByUserId = userId;
    code.redeemedByStaffId = staff?.id ?? null;
    code.redeemedSummary = summary;
    code.updatedAt = now;
    this.codeClaims.push(
      staff
        ? { codeId: code.id, action: "redeem", userId, staffId: staff.id, at: now }
        : { codeId: code.id, action: "redeem", userId, at: now },
    );
    this.pushAudit({
      action: "code_redeemed",
      // Who did it: the member themselves, or the staff member at the desk.
      actorId: staff?.id ?? userId,
      subjectUserId: userId,
      entityType: "RedemptionCode",
      entityId: code.id,
      metadata: {
        codeId: code.id,
        kind: code.kind,
        ...granted,
        ...(staff ? { atDesk: true } : {}),
        ...(code.cardNumber ? { cardNumber: code.cardNumber } : {}),
      },
    });
    done.balanceCents = (await this.getCreditWallet(userId)).balanceCents;
    return done;
  }

  async adminListCodes(): Promise<RedemptionCodeView[]> {
    return [...this.state.redemptionCodes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((code) => ({
        ...code,
        redeemedByName: code.redeemedByUserId
          ? (this.state.users.find((u) => u.id === code.redeemedByUserId)?.displayName ??
            null)
          : null,
        redeemedByStaffName: code.redeemedByStaffId
          ? (this.state.users.find((u) => u.id === code.redeemedByStaffId)?.displayName ??
            null)
          : null,
        classTitle: code.classSessionId
          ? (this.state.classSessions.find((c) => c.id === code.classSessionId)?.title ??
            null)
          : null,
      }));
  }

  async adminCreateCodes(input: CreateCodesInput): Promise<RedemptionCode[]> {
    const now = this.now();
    const quantity = Math.trunc(Number(input.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 50) {
      throw new Error("Make between 1 and 50 codes at a time.");
    }
    const fields: Partial<RedemptionCode> = {};
    if (input.kind === "credit") {
      const amountCents = Math.round(Number(input.amountCents));
      if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 100_000) {
        throw new Error("Enter an amount between $1 and $1,000.");
      }
      fields.amountCents = amountCents;
    } else if (input.kind === "membership") {
      if (!input.tier || !MEMBERSHIP_TIERS.includes(input.tier)) {
        throw new Error("Choose which membership the code is for.");
      }
      const months = Math.trunc(Number(input.months));
      if (!Number.isFinite(months) || months < 1 || months > 36) {
        throw new Error("Enter how many months, from 1 to 36.");
      }
      fields.tier = input.tier;
      fields.months = months;
    } else if (input.kind === "class") {
      if (input.classSessionId) {
        const session = this.state.classSessions.find((c) => c.id === input.classSessionId);
        if (!session) throw new Error("That class no longer exists. Choose another.");
        fields.classSessionId = session.id;
      } else {
        const max = Math.round(Number(input.maxPriceCents));
        if (!Number.isFinite(max) || max < 100 || max > 100_000) {
          throw new Error(
            "Choose the class this code is for, or the highest class price it covers (from $1 to $1,000).",
          );
        }
        fields.maxPriceCents = max;
      }
    } else {
      throw new Error("Choose what the code is for.");
    }
    let expiresAt: string | null = null;
    if (input.expiresAt && input.expiresAt.trim()) {
      expiresAt = endOfShopDay(input.expiresAt);
      if (!expiresAt) throw new Error("Enter the expiry as a date.");
      if (new Date(expiresAt).getTime() <= Date.now()) {
        throw new Error("That expiry date is in the past.");
      }
    }
    const note = optionalText(input.note, "Note", 200);
    const zeffyPaymentId = optionalText(input.zeffyPaymentId, "Zeffy payment ID", 100);

    // Gift card numbers: consecutive, and never one a card already has.
    let firstCardNumber: number | null = null;
    if (input.numberAsCards) {
      const inUse = this.state.redemptionCodes
        .map((c) => c.cardNumber ?? 0)
        .filter((n) => n > 0);
      const next = inUse.length > 0 ? Math.max(...inUse) + 1 : 1;
      const first = input.firstCardNumber === undefined ? next : Number(input.firstCardNumber);
      if (!Number.isInteger(first) || first < 1 || first + quantity - 1 > MAX_CARD_NUMBER) {
        throw new Error(
          `Enter the first card number as a whole number from 1 to ${MAX_CARD_NUMBER}, with room for the whole batch.`,
        );
      }
      const clash = inUse
        .filter((n) => n >= first && n < first + quantity)
        .sort((a, b) => a - b)[0];
      if (clash !== undefined) {
        throw new Error(
          `Card number ${formatCardNumber(clash)} is already in use. Start at ${formatCardNumber(next)} or later.`,
        );
      }
      firstCardNumber = first;
    }

    const taken = new Set(this.state.redemptionCodes.map((c) => c.code));
    const made: RedemptionCode[] = [];
    while (made.length < quantity) {
      const text = generateCode();
      if (taken.has(text)) continue;
      taken.add(text);
      made.push({
        id: `code-${crypto.randomUUID()}`,
        code: text,
        kind: input.kind,
        amountCents: null,
        tier: null,
        months: null,
        classSessionId: null,
        maxPriceCents: null,
        ...fields,
        note,
        zeffyPaymentId,
        expiresAt,
        createdById: this.currentUserId ?? null,
        redeemedAt: null,
        redeemedByUserId: null,
        redeemedSummary: null,
        voidedAt: null,
        voidedById: null,
        cardNumber: firstCardNumber === null ? null : firstCardNumber + made.length,
        redeemedByStaffId: null,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.state.redemptionCodes.push(...made);
    this.pushAudit({
      action: "codes_created",
      actorId: this.currentUserId ?? null,
      entityType: "RedemptionCode",
      entityId: made[0]!.id,
      // What was made, never the codes themselves.
      metadata: {
        count: made.length,
        kind: input.kind,
        ...fields,
        expiresAt,
        ...(firstCardNumber === null
          ? {}
          : {
              firstCardNumber,
              lastCardNumber: firstCardNumber + made.length - 1,
            }),
      },
    });
    return made.map((c) => ({ ...c }));
  }

  async adminVoidCode(id: string): Promise<RedemptionCode> {
    const code = this.state.redemptionCodes.find((c) => c.id === id);
    if (!code) throw new Error("That code no longer exists.");
    if (code.redeemedAt) {
      throw new Error("That code has already been redeemed, so it cannot be voided.");
    }
    if (code.voidedAt) return { ...code };
    const now = this.now();
    code.voidedAt = now;
    code.voidedById = this.currentUserId ?? null;
    code.updatedAt = now;
    this.codeClaims.push({
      codeId: code.id,
      action: "void",
      userId: this.currentUserId ?? null,
      at: now,
    });
    this.pushAudit({
      action: "code_voided",
      actorId: this.currentUserId ?? null,
      entityType: "RedemptionCode",
      entityId: code.id,
      metadata: { codeId: code.id, kind: code.kind },
    });
    return { ...code };
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

  async adminUpdateMember(
    id: string,
    patch: {
      role?: UserRole;
      tier?: MembershipTier | null;
      shopAccess?: boolean;
      notes?: string;
      membershipEndsAt?: string | null;
    },
  ): Promise<User> {
    const user = this.requireUser(id);
    // Who is acting comes from the session, not from the request. A role
    // change that trusted a sent id could be claimed in an admin's name.
    const actor = this.state.users.find((u) => u.id === this.currentUserId) ?? null;

    if (patch.role !== undefined && patch.role !== user.role) {
      if (!MEMBER_ROLES.includes(patch.role)) throw new Error("Unknown role.");
      if (actor?.role !== "admin") throw new Error("Only an admin can change roles.");
      if (actor.id === user.id) throw new Error("You cannot change your own role.");
      const otherActiveAdmins = this.state.users.filter(
        (u) => u.role === "admin" && u.status === "active" && u.id !== user.id,
      );
      if (user.role === "admin" && user.status === "active" && otherActiveAdmins.length === 0) {
        throw new Error("This is the last active admin. Make someone else an admin first.");
      }
      const from = user.role;
      user.role = patch.role;
      this.pushAudit({
        action: "member_role_changed",
        actorId: actor.id,
        subjectUserId: id,
        entityType: "User",
        entityId: id,
        metadata: { from, to: patch.role },
      });
    }

    const changed: Record<string, unknown> = {};
    if (patch.tier !== undefined && patch.tier !== (user.tier ?? null)) {
      if (patch.tier !== null && !MEMBERSHIP_TIERS.includes(patch.tier)) {
        throw new Error("Unknown membership.");
      }
      changed.tier = { from: user.tier ?? null, to: patch.tier };
      user.tier = patch.tier;
    }
    if (patch.shopAccess !== undefined && patch.shopAccess !== user.shopAccess) {
      changed.shopAccess = { from: user.shopAccess, to: patch.shopAccess };
      user.shopAccess = patch.shopAccess;
    }
    if (patch.membershipEndsAt !== undefined) {
      const text = (patch.membershipEndsAt ?? "").trim();
      const endsAt = text ? endOfShopDay(text) : null;
      if (text && !endsAt) throw new Error("Enter the end date as a date.");
      if (endsAt !== (user.membershipEndsAt ?? null)) {
        changed.membershipEndsAt = { from: user.membershipEndsAt ?? null, to: endsAt };
        user.membershipEndsAt = endsAt;
      }
    }
    if (patch.notes !== undefined) {
      const notes = optionalText(patch.notes, "Staff note", MESSAGE_MAX) ?? "";
      if (notes !== (user._notes ?? "")) {
        // The note itself stays out of the audit trail.
        changed.notes = true;
        if (notes) user._notes = notes;
        else delete user._notes;
      }
    }
    if (Object.keys(changed).length > 0) {
      this.pushAudit({
        action: "member_updated",
        actorId: actor?.id ?? null,
        subjectUserId: id,
        entityType: "User",
        entityId: id,
        metadata: changed,
      });
    }
    this.touch(user);
    return user;
  }

  private async rememberPin(userId: string, pin: string): Promise<void> {
    if (process.env.VITEST !== "true") return;
    const { hashKioskPin, normalizePin } = await import(
      "@/lib/workstation/pin"
    );
    this.pinHashes.set(userId, await hashKioskPin(normalizePin(pin)));
  }

  /** Test/server helper. Not part of the DataProvider surface. */
  kioskPinRecord(userId: string): { hash: string; mustChange: boolean } | null {
    const hash = this.pinHashes.get(userId);
    if (!hash) return null;
    const user = this.state.users.find((row) => row.id === userId);
    return { hash, mustChange: Boolean(user?.kioskPinMustChange) };
  }

  async setMyKioskPin(userId: string, pin: string): Promise<User> {
    const problem = kioskPinPolicyError(pin);
    if (problem) throw new Error(problem);
    const user = this.requireUser(userId);
    await this.rememberPin(userId, pin);
    user.kioskPinSet = true;
    user.kioskPinMustChange = false;
    this.touch(user);
    return user;
  }

  async adminResetMemberKioskPin(
    memberId: string,
    actorId: string,
  ): Promise<{ user: User; temporaryPin: string }> {
    const actor = this.requireUser(actorId);
    if (!isStaffRole(actor)) {
      throw new Error("Only staff can reset a shop PIN.");
    }
    const user = this.requireUser(memberId);
    const temporaryPin = randomTemporaryPin();
    await this.rememberPin(memberId, temporaryPin);
    user.kioskPinSet = true;
    user.kioskPinMustChange = true;
    this.touch(user);
    this.pushAudit({
      action: "member.pin_reset",
      actorId,
      subjectUserId: memberId,
      entityType: "user",
      entityId: memberId,
      metadata: { mustChange: true },
    });
    return { user, temporaryPin };
  }

  async adminSetMemberTeacher(
    id: string,
    isTeacher: boolean,
    actorId: string,
  ): Promise<User> {
    this.requireUser(actorId);
    const user = this.requireUser(id);
    user.isTeacher = isTeacher;
    this.touch(user);
    return user;
  }

  async adminGrantCredits(input: {
    userId: string;
    amountCents: number;
    actorId: string;
    note?: string;
    sourcePaymentId?: string | null;
  }): Promise<CreditLedgerEntry> {
    this.requireUser(input.actorId);
    this.requireUser(input.userId);
    if (!Number.isFinite(input.amountCents) || input.amountCents === 0) {
      throw new Error("Grant amount must be a non-zero number of cents");
    }
    const paymentId = input.sourcePaymentId?.trim() || null;
    if (paymentId) {
      const existing = this.state.creditLedgerEntries.find(
        (e) =>
          e.sourcePaymentId === paymentId &&
          (e.kind === "zeffy_payment" || e.kind === "staff_grant"),
      );
      if (existing) return existing;
    }
    const kind: CreditLedgerKind = paymentId ? "zeffy_payment" : "staff_grant";
    const entry = this.appendLedger({
      userId: input.userId,
      kind,
      amountCents: Math.trunc(input.amountCents),
      actorId: input.actorId,
      sourcePaymentId: paymentId,
      note:
        input.note?.trim() ||
        (kind === "zeffy_payment"
          ? "Zeffy payment applied as credit"
          : input.amountCents > 0
            ? "Staff grant"
            : "Staff adjustment"),
    });
    this.pushAudit({
      action: "credits_granted",
      actorId: input.actorId,
      subjectUserId: input.userId,
      entityType: "CreditLedgerEntry",
      entityId: entry.id,
      metadata: {
        amountCents: entry.amountCents,
        kind,
        sourcePaymentId: paymentId,
      },
    });
    return entry;
  }

  async adminApproveInterestBoard(
    id: string,
    actorId: string,
    opts?: { threshold?: number; closesAt?: ISODateTime },
  ): Promise<ClassInterestBoard> {
    this.requireUser(actorId);
    const board = this.state.classInterestBoards.find((b) => b.id === id);
    if (!board) throw new Error("Interest board not found");
    if (board.status !== "pending") {
      throw new Error("Only pending proposals can be approved");
    }
    const now = this.now();
    board.status = "open";
    board.opensAt = now;
    board.closesAt =
      opts?.closesAt ?? addHours(now, CLASS_INTEREST_OPEN_DAYS * 24);
    if (opts?.threshold != null) board.threshold = opts.threshold;
    board.reviewedById = actorId;
    board.reviewedAt = now;
    this.touch(board);

    const count = interestSignupCount(
      board.id,
      this.state.classInterestSignups,
    );
    if (count >= board.threshold) {
      board.status = "ready";
      this.touch(board);
    }
    return board;
  }

  async adminRejectInterestBoard(
    id: string,
    actorId: string,
    notes?: string,
  ): Promise<ClassInterestBoard> {
    this.requireUser(actorId);
    const board = this.state.classInterestBoards.find((b) => b.id === id);
    if (!board) throw new Error("Interest board not found");
    board.status = "cancelled";
    board.reviewedById = actorId;
    board.reviewedAt = this.now();
    if (notes != null) board.staffNotes = notes;
    return this.touch(board);
  }

  async adminUpdateInterestBoard(
    id: string,
    data: ClassInterestBoardAdminUpdate,
  ): Promise<ClassInterestBoard> {
    const board = this.state.classInterestBoards.find((b) => b.id === id);
    if (!board) throw new Error("Interest board not found");
    if (data.status != null) board.status = data.status;
    if (data.threshold != null) board.threshold = data.threshold;
    if (data.closesAt !== undefined) board.closesAt = data.closesAt;
    if (data.staffNotes !== undefined) board.staffNotes = data.staffNotes;
    if (data.instructorHintUserId !== undefined) {
      board.instructorHintUserId = data.instructorHintUserId;
    }
    if (data.reviewedById !== undefined) {
      board.reviewedById = data.reviewedById;
      board.reviewedAt = this.now();
    }
    this.touch(board);
    if (board.status === "open") {
      const count = interestSignupCount(
        board.id,
        this.state.classInterestSignups,
      );
      if (count >= board.threshold) {
        board.status = "ready";
        this.touch(board);
      }
    }
    return board;
  }

  async adminLinkInterestBoardToClass(
    boardId: string,
    classSessionId: string,
    actorId: string,
  ): Promise<ClassInterestBoard> {
    this.requireUser(actorId);
    const board = this.state.classInterestBoards.find((b) => b.id === boardId);
    if (!board) throw new Error("Interest board not found");
    const session = this.state.classSessions.find((c) => c.id === classSessionId);
    if (!session) throw new Error("Class session not found");
    const now = this.now();
    board.scheduledClassSessionId = classSessionId;
    board.status = "scheduled";
    board.priorityBookingEndsAt = addHours(
      now,
      CLASS_INTEREST_PRIORITY_HOURS,
    );
    board.reviewedById = actorId;
    board.reviewedAt = now;
    return this.touch(board);
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

  async adminRegisterBadge(
    userId: string,
    input: { uid: string; label?: string },
  ): Promise<Badge> {
    const member = this.requireUser(userId);
    const uid = normalizeBadgeUid(typeof input.uid === "string" ? input.uid : "");
    if (!isBadgeUid(uid)) {
      throw new Error(
        "That does not look like a badge number. Type the letters and digits printed on the fob, or tap it on a reader.",
      );
    }
    const existing = this.state.badges.find((b) => normalizeBadgeUid(b.uid) === uid);
    if (existing) {
      const owner = existing.userId
        ? this.state.users.find((u) => u.id === existing.userId)
        : undefined;
      throw new Error(
        owner
          ? `That badge is already registered to ${owner.displayName}.`
          : "That badge is already registered. Link it to this member from the list.",
      );
    }
    const now = this.now();
    const badge: Badge = {
      id: this.id("badge"),
      uid,
      label: optionalText(input.label, "Label", NAME_MAX) ?? undefined,
      userId: member.id,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.badges.push(badge);
    this.pushAudit({
      action: "badge_registered",
      actorId: this.currentUserId ?? null,
      subjectUserId: member.id,
      entityType: "Badge",
      entityId: badge.id,
    });
    return { ...badge };
  }

  async adminSetBadgeActive(badgeId: string, active: boolean): Promise<Badge> {
    const badge = this.state.badges.find((b) => b.id === badgeId);
    if (!badge) throw new Error("Badge not found");
    if (badge.active !== active) {
      badge.active = active;
      this.touch(badge);
      this.pushAudit({
        action: active ? "badge_reactivated" : "badge_deactivated",
        actorId: this.currentUserId ?? null,
        subjectUserId: badge.userId,
        entityType: "Badge",
        entityId: badge.id,
      });
    }
    return { ...badge };
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

  async adminUpsertClass(input: ClassSessionInput): Promise<ClassSession> {
    const now = this.now();
    // The description is a content page, not a column on the class.
    const { description, ...data } = input;
    if (data.id) {
      const existing = this.state.classSessions.find((c) => c.id === data.id);
      if (existing) {
        // A class keeps the address it was given. Its title can change.
        const changes = { ...data, slug: existing.slug };
        const staffEditedFields = mergeStaffEdits(existing, changes);
        Object.assign(existing, changes, {
          staffEditedFields,
          updatedAt: now,
        });
        if (description !== undefined) this.saveClassDescription(existing, description);
        return existing;
      }
    }
    const session: ClassSession = {
      id: data.id ?? this.id("class"),
      title: data.title,
      slug: this.uniqueClassSlug(data.slug ?? data.title, data.startsAt),
      descriptionSlug: data.descriptionSlug ?? "class-generic",
      category: data.category ?? "workshop",
      instructorId: data.instructorId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      capacity: data.capacity,
      priceCents: data.priceCents ?? 0,
      zeffyUrl: data.zeffyUrl ?? null,
      zeffyCampaignId: data.zeffyCampaignId ?? null,
      zeffyOccurrenceId: data.zeffyOccurrenceId ?? null,
      source: data.source ?? "admin",
      googleEventId: data.googleEventId ?? null,
      googleCalendarId: data.googleCalendarId ?? null,
      syncedAt: data.syncedAt ?? null,
      cancelledAt: data.cancelledAt ?? null,
      staffEditedFields: data.staffEditedFields ?? null,
      prerequisiteCertificationIds: data.prerequisiteCertificationIds ?? [],
      location: data.location ?? "Discover Burien Makerspace",
      cancellationCutoffHours: data.cancellationCutoffHours ?? null,
      published: data.published ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.classSessions.push(session);
    if (description !== undefined) this.saveClassDescription(session, description);
    return session;
  }

  /**
   * A class address nobody else has. The database allows each one once, and
   * the same class runs week after week under one title: the second session
   * gets its date added, and a counter after that.
   */
  private uniqueClassSlug(source: string, startsAt: string): string {
    const taken = new Set(this.state.classSessions.map((c) => c.slug));
    const base = contentSlug(source).slice(0, 48).replace(/-+$/g, "") || "class";
    if (!taken.has(base)) return base;
    const date = new Date(startsAt);
    const dated = Number.isNaN(date.getTime())
      ? base
      : `${base}-${date.toISOString().slice(0, 10)}`;
    if (!taken.has(dated)) return dated;
    for (let n = 2; ; n += 1) {
      const candidate = `${dated}-${n}`;
      if (!taken.has(candidate)) return candidate;
    }
  }

  /**
   * Keep what staff wrote about one session as that session's own page.
   * Several sessions can start out pointing at one shared page; an edit to
   * one must not change the others, so the edited session gets its own.
   */
  private saveClassDescription(session: ClassSession, rawHtml: string): void {
    const now = this.now();
    const html = cleanContentHtml(rawHtml);
    const ownSlug = `class-description-${contentSlug(session.id)}`;
    const own = this.state.contentPages.find((p) => p.slug === ownSlug);

    if (!contentHtmlHasText(html)) {
      // Emptied: back to the wording every class without its own text shows.
      if (own?.published) Object.assign(own, { published: false, updatedAt: now });
      if (session.descriptionSlug === ownSlug) {
        session.descriptionSlug = "class-generic";
        session.staffEditedFields = [
          ...new Set([...(session.staffEditedFields ?? []), "descriptionSlug"]),
        ];
      }
      return;
    }

    const current = this.state.contentPages.find(
      (p) => p.slug === session.descriptionSlug && p.published,
    );
    if (current && current.html === html) return;

    if (own) {
      Object.assign(own, { html, title: session.title, published: true, updatedAt: now });
    } else {
      this.state.contentPages.push({
        id: this.id("content"),
        slug: ownSlug,
        title: session.title,
        html,
        category: "class",
        version: "1",
        published: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (session.descriptionSlug !== ownSlug) {
      session.descriptionSlug = ownSlug;
      // The Zeffy pull keeps fields staff own.
      session.staffEditedFields = [
        ...new Set([...(session.staffEditedFields ?? []), "descriptionSlug"]),
      ];
    }
  }

  async adminListClasses(): Promise<ClassSessionView[]> {
    const now = Date.now();
    const start = (c: ClassSession) => new Date(c.startsAt).getTime();
    const ended = (c: ClassSession) => new Date(c.endsAt).getTime() < now;
    return this.state.classSessions
      .filter((c) => !c.deletedAt)
      .sort((a, b) => {
        if (ended(a) !== ended(b)) return ended(a) ? 1 : -1;
        // Upcoming soonest first; past most recent first.
        return ended(a) ? start(b) - start(a) : start(a) - start(b);
      })
      .map((c) => this.toClassView(c, this.currentUserId));
  }

  private requireClass(id: string): ClassSession {
    const session = this.state.classSessions.find((c) => c.id === id && !c.deletedAt);
    if (!session) throw new Error("Class session not found");
    return session;
  }

  async adminCancelClass(id: string): Promise<ClassSession> {
    const session = this.requireClass(id);
    if (session.cancelledAt) throw new Error("This class is already cancelled.");
    session.cancelledAt = this.now();
    // Without this the hourly Zeffy pull would put the class back.
    session.staffEditedFields = [
      ...new Set([...(session.staffEditedFields ?? []), "cancelledAt"]),
    ];
    this.touch(session);
    this.pushAudit({
      action: "class_cancelled",
      actorId: this.currentUserId ?? null,
      entityType: "ClassSession",
      entityId: session.id,
      metadata: { title: session.title, startsAt: session.startsAt },
    });
    return session;
  }

  async adminRestoreClass(id: string): Promise<ClassSession> {
    const session = this.requireClass(id);
    if (!session.cancelledAt) throw new Error("This class is not cancelled.");
    session.cancelledAt = null;
    // Zeffy decides again from here, as it did before the staff cancel.
    const owned = (session.staffEditedFields ?? []).filter((f) => f !== "cancelledAt");
    session.staffEditedFields = owned.length > 0 ? owned : null;
    this.touch(session);
    this.pushAudit({
      action: "class_restored",
      actorId: this.currentUserId ?? null,
      entityType: "ClassSession",
      entityId: session.id,
      metadata: { title: session.title, startsAt: session.startsAt },
    });
    return session;
  }

  async adminAddBooking(classSessionId: string, userId: string): Promise<Booking> {
    const user = this.requireUser(userId);
    if (user.status === "suspended") {
      throw new Error(`${user.displayName} is suspended and cannot be booked into a class.`);
    }
    const session = this.requireClass(classSessionId);
    if (session.cancelledAt) throw new Error("This class was cancelled.");
    // Staff can add a walk-in once a class has started, but not after it ends.
    if (new Date(session.endsAt).getTime() < Date.now()) {
      throw new Error("This class has already finished.");
    }
    const booking = this.placeBooking(
      session,
      userId,
      `${user.displayName} already has a booking for this class.`,
    );
    this.pushAudit({
      action: "booking_added_by_staff",
      actorId: this.currentUserId ?? null,
      subjectUserId: userId,
      entityType: "Booking",
      entityId: booking.id,
      metadata: { classSessionId, status: booking.status },
    });
    return booking;
  }

  async adminCancelBooking(bookingId: string): Promise<Booking> {
    const booking = this.state.bookings.find((b) => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status === "cancelled") {
      throw new Error("That booking is already cancelled.");
    }
    if (["expired", "attended", "no_show"].includes(booking.status)) {
      throw new Error(`A booking marked ${booking.status.replace(/_/g, " ")} cannot be cancelled.`);
    }
    const session = this.state.classSessions.find(
      (c) => c.id === booking.classSessionId,
    );
    if (!session) throw new Error("Class session not found");
    const actorId = this.currentUserId ?? booking.userId;
    const from = booking.status;
    await this.releaseBooking(booking, session, actorId);
    this.pushAudit({
      action: "booking_cancelled_by_staff",
      actorId: this.currentUserId ?? null,
      subjectUserId: booking.userId,
      entityType: "Booking",
      entityId: booking.id,
      metadata: { classSessionId: session.id, from },
    });
    return booking;
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

  async findBookingByZeffyPaymentId(
    paymentId: string,
  ): Promise<Booking | null> {
    return (
      this.state.bookings.find((b) => b.zeffyPaymentId === paymentId) ?? null
    );
  }

  async applyZeffyPaymentToBooking(input: {
    bookingId: string;
    paymentId: string;
    paidAt: string;
  }): Promise<Booking> {
    const booking = this.state.bookings.find((b) => b.id === input.bookingId);
    if (!booking) throw new Error("Booking not found");
    booking.status = "booked";
    booking.paidAt = input.paidAt;
    booking.zeffyPaymentId = input.paymentId;
    booking.paidMarkedById = null;
    booking.paymentHoldExpiresAt = null;
    booking.waitlistPosition = null;
    this.touch(booking);
    this.pushAudit({
      action: "booking_paid_zeffy",
      actorId: "system:zeffy",
      subjectUserId: booking.userId,
      entityType: "Booking",
      entityId: booking.id,
      metadata: { paymentId: input.paymentId },
    });
    return booking;
  }

  async createBookingFromZeffyPayment(input: {
    classSessionId: string;
    userId: string;
    paymentId: string;
    paidAt: string;
  }): Promise<Booking> {
    const existing = await this.findBookingByZeffyPaymentId(input.paymentId);
    if (existing) return existing;

    const booking: Booking = {
      id: this.id("bk"),
      classSessionId: input.classSessionId,
      userId: input.userId,
      status: "booked",
      paidAt: input.paidAt,
      zeffyPaymentId: input.paymentId,
      paidMarkedById: null,
      createdAt: input.paidAt,
      updatedAt: input.paidAt,
    };
    this.state.bookings.push(booking);
    this.pushAudit({
      action: "booking_created_zeffy",
      actorId: "system:zeffy",
      subjectUserId: booking.userId,
      entityType: "Booking",
      entityId: booking.id,
      metadata: { paymentId: input.paymentId },
    });
    return booking;
  }

  async applyZeffyTicketPayment(
    payment: import("@/lib/zeffy/types").ZeffyPayment,
    paidAtIso?: string,
  ): Promise<import("@/lib/zeffy/types").ZeffyApplyResult> {
    const { applyZeffyPaymentToStore } = await import(
      "@/lib/zeffy/apply-payment"
    );

    const ticket = applyZeffyPaymentToStore(
      payment,
      {
        findBookingByPaymentId: (paymentId) =>
          this.state.bookings.find((b) => b.zeffyPaymentId === paymentId) ??
          null,
        findClassByCampaignId: (campaignId) =>
          this.state.classSessions.find(
            (c) => c.zeffyCampaignId === campaignId,
          ) ?? null,
        findUserByEmail: (email) =>
          this.state.users.find((u) => u.email.toLowerCase() === email) ?? null,
        listBookingsForClass: (classSessionId) =>
          this.state.bookings.filter((b) => b.classSessionId === classSessionId),
        createBookedPaid: (input) => {
          const booking: Booking = {
            id: this.id("bk"),
            classSessionId: input.classSessionId,
            userId: input.userId,
            status: "booked",
            paidAt: input.paidAt,
            zeffyPaymentId: input.paymentId,
            paidMarkedById: null,
            createdAt: input.paidAt,
            updatedAt: input.paidAt,
          };
          this.state.bookings.push(booking);
          this.pushAudit({
            action: "booking_created_zeffy",
            actorId: "system:zeffy",
            subjectUserId: booking.userId,
            entityType: "Booking",
            entityId: booking.id,
            metadata: { paymentId: input.paymentId },
          });
          return booking;
        },
        markPaidFromZeffy: (input) => {
          const booking = this.state.bookings.find(
            (b) => b.id === input.bookingId,
          );
          if (!booking) throw new Error("Booking not found");
          booking.status = "booked";
          booking.paidAt = input.paidAt;
          booking.zeffyPaymentId = input.paymentId;
          booking.paidMarkedById = null;
          booking.paymentHoldExpiresAt = null;
          booking.waitlistPosition = null;
          this.touch(booking);
          this.pushAudit({
            action: "booking_paid_zeffy",
            actorId: "system:zeffy",
            subjectUserId: booking.userId,
            entityType: "Booking",
            entityId: booking.id,
            metadata: { paymentId: input.paymentId },
          });
          return booking;
        },
      },
      paidAtIso,
    );
    if (ticket.status === "applied" || ticket.status === "duplicate") {
      return ticket;
    }

    const match = matchZeffyPaymentToWishlistItem(
      payment,
      this.state.wishlistItems,
    );
    if (match.status === "duplicate") {
      return { status: "wishlist_duplicate", itemId: match.itemId };
    }
    if (match.status === "applied") {
      const item = this.state.wishlistItems.find((i) => i.id === match.itemId);
      if (item && item.status !== "fulfilled") {
        this.fulfillWishlistItem(item, "system:zeffy", "zeffy", payment.id);
      }
      return { status: "wishlist_applied", itemId: match.itemId };
    }
    return ticket;
  }

  async applyZeffyMembershipPayment(
    payment: import("@/lib/zeffy/types").ZeffyPayment,
    paidAtIso?: string,
    options?: { createIfMissing?: boolean },
  ): Promise<import("@/lib/zeffy/types").ZeffyMembershipApplyResult> {
    const { applyZeffyMembershipToStore, membershipUserIdFromEmail } =
      await import("@/lib/zeffy/apply-membership");

    const result = applyZeffyMembershipToStore(
      payment,
      {
        findAppliedPayment: (paymentId) => {
          const event = this.state.auditEvents.find(
            (e) =>
              e.action === "membership_applied_zeffy" &&
              (e.metadata as { paymentId?: string } | undefined)?.paymentId ===
                paymentId,
          );
          if (!event?.subjectUserId) return null;
          return { userId: event.subjectUserId };
        },
        findUserByEmail: (email) =>
          this.state.users.find((u) => u.email.toLowerCase() === email) ??
          null,
        findProductByCampaignAndRate: (campaignId, rateId) => {
          const products = this.state.membershipProducts;
          if (rateId) {
            const exact = products.find(
              (p) =>
                p.zeffyCampaignId === campaignId && p.zeffyRateId === rateId,
            );
            if (exact) return exact;
          }
          return (
            products.find((p) => p.zeffyCampaignId === campaignId) ?? null
          );
        },
        upsertMemberFromZeffy: (input) => {
          let user =
            this.state.users.find(
              (u) => u.email.toLowerCase() === input.email,
            ) ?? null;
          const created = !user;
          if (!user) {
            if (!input.createIfMissing) return null;
            const now = input.paidAt;
            user = {
              id: membershipUserIdFromEmail(input.email),
              email: input.email,
              firstName: input.firstName,
              lastName: input.lastName,
              displayName:
                `${input.firstName} ${input.lastName}`.trim() ||
                input.email.split("@")[0] ||
                "Member",
              role: "member",
              status: "active",
              tier: input.tier,
              billingInterval: input.billingInterval ?? null,
              shopAccess: input.shopAccess,
              isTeacher: false,
              profileComplete: false,
              createdAt: now,
              updatedAt: now,
            };
            this.state.users.push(user);
          } else {
            user.status = "active";
            user.tier = input.tier;
            user.billingInterval = input.billingInterval ?? user.billingInterval;
            user.shopAccess = input.shopAccess;
            // A paying member now. The end date of a gifted membership would
            // otherwise lapse them while Zeffy is still billing.
            user.membershipEndsAt = null;
            if (!user.firstName && input.firstName) {
              user.firstName = input.firstName;
            }
            if (!user.lastName && input.lastName) {
              user.lastName = input.lastName;
            }
            if (!user.displayName && (input.firstName || input.lastName)) {
              user.displayName =
                `${input.firstName} ${input.lastName}`.trim();
            }
            this.touch(user);
          }
          this.pushAudit({
            action: "membership_applied_zeffy",
            actorId: "system:zeffy",
            subjectUserId: user.id,
            entityType: "User",
            entityId: user.id,
            metadata: {
              paymentId: input.paymentId,
              created,
              tier: input.tier,
            },
          });
          return user;
        },
      },
      {
        createIfMissing: options?.createIfMissing ?? false,
        paidAtIso,
      },
    );
    if (result.status === "applied" && result.userId) {
      this.grantMembershipCreditsFromPayment(payment, result.userId);
    }
    return result;
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
    if (
      machine.attendedOperationRequired &&
      endsAfterShopClosing(input.endsAt, this.openingHours())
    ) {
      throw new Error(
        "Attended-operation machines cannot be reserved past shop closing",
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
    if (!canScheduleMaintenance(actor)) {
      throw new Error(
        "Only staff or Shop Stewards can schedule maintenance",
      );
    }
    const scope = maintenanceMachineScope(actor);
    if (scope !== "all" && !scope.includes(data.machineId)) {
      throw new Error("You are not allowed to schedule maintenance on that machine");
    }
    if (new Date(data.endsAt).getTime() <= new Date(data.startsAt).getTime()) {
      throw new Error("Maintenance end must be after start");
    }

    const now = this.now();
    if (data.id) {
      const existing = this.state.maintenanceBlocks.find((m) => m.id === data.id);
      if (existing) {
        // Who first scheduled it stays on the block. The edit is in the audit trail.
        Object.assign(existing, data, {
          createdById: existing.createdById,
          updatedAt: now,
        });
        this.pushAudit({
          action: "maintenance_updated",
          actorId: data.createdById,
          entityType: "MaintenanceBlock",
          entityId: existing.id,
        });
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

  /**
   * The signed-in person, if they may schedule maintenance. Who that is
   * comes from the session the provider was made for, never from the
   * request, so the check cannot be passed by naming someone else.
   */
  private maintenanceActor(): User {
    const actor = this.state.users.find((u) => u.id === this.currentUserId);
    if (!actor || !canScheduleMaintenance(actor)) {
      throw new Error("Only staff or Shop Stewards can schedule maintenance");
    }
    return actor;
  }

  async scheduleMaintenance(
    data: Omit<MaintenanceBlockInput, "createdById">,
  ): Promise<MaintenanceBlock> {
    const actor = this.maintenanceActor();
    return this.adminUpsertMaintenanceBlock({
      id: data.id,
      machineId: data.machineId,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      reason: data.reason,
      createdById: actor.id,
    });
  }

  async listMaintenanceSchedule(): Promise<MaintenanceBlock[]> {
    this.maintenanceActor();
    return [...this.state.maintenanceBlocks];
  }

  async adminDeleteMaintenanceBlock(id: string): Promise<void> {
    const block = this.state.maintenanceBlocks.find((m) => m.id === id);
    if (!block) throw new Error("That maintenance block is already gone.");
    this.state.maintenanceBlocks = this.state.maintenanceBlocks.filter((m) => m.id !== id);
    this.pushAudit({
      action: "maintenance_removed",
      actorId: this.currentUserId ?? null,
      entityType: "MaintenanceBlock",
      entityId: id,
      metadata: { machineId: block.machineId, startsAt: block.startsAt, endsAt: block.endsAt },
    });
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
      canScheduleMaintenance: canScheduleMaintenance(user),
      maintenanceMachineIds: maintenanceMachineScope(user),
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
    const existing = data.id
      ? this.state.learningModules.find((m) => m.id === data.id)
      : undefined;
    const settings = this.state.settings;

    const title = (data.title ?? "").trim().slice(0, 200);
    if (!title) throw new Error("Give the module a title.");
    const slug = contentSlug(data.slug ?? existing?.slug ?? title);
    if (!slug) {
      throw new Error("Give the module an address made of letters or numbers.");
    }
    if (this.state.learningModules.some((m) => m.slug === slug && m.id !== existing?.id)) {
      throw new Error(`Another module already uses the address "${slug}".`);
    }
    const certificationId = data.certificationId ?? existing?.certificationId;
    if (!this.state.certifications.some((c) => c.id === certificationId)) {
      throw new Error("Choose a certification for this module.");
    }
    if (data.passThresholdPercent !== undefined) {
      const pct = data.passThresholdPercent;
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
        throw new Error("The pass mark must be between 1 and 100 percent.");
      }
    }
    if (data.attemptLimit !== undefined) {
      const limit = data.attemptLimit;
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        throw new Error("Members need at least 1 attempt.");
      }
    }
    if (data.sortOrder !== undefined && !Number.isFinite(data.sortOrder)) {
      throw new Error("The order must be a number.");
    }
    const equipmentStatus =
      data.equipmentStatus ?? existing?.equipmentStatus ?? "confirmed";
    if (equipmentStatus !== "confirmed" && equipmentStatus !== "unconfirmed") {
      throw new Error("Say whether the equipment matches this module.");
    }
    const staysPublished = Boolean(existing?.published) && data.published !== false;
    if (staysPublished && equipmentStatus !== "confirmed") {
      throw new Error(
        "Unpublish the module before marking its equipment as not confirmed.",
      );
    }

    const next: LearningModule = {
      id: existing?.id ?? data.id ?? this.id("mod"),
      slug,
      title,
      summary: (data.summary ?? existing?.summary ?? "").trim().slice(0, 2000),
      certificationId: certificationId as string,
      knowledgeOnly: data.knowledgeOnly ?? existing?.knowledgeOnly ?? false,
      published: staysPublished,
      equipmentStatus,
      passThresholdPercent:
        data.passThresholdPercent ??
        existing?.passThresholdPercent ??
        settings.quizPassThresholdPercent,
      attemptLimit:
        data.attemptLimit ?? existing?.attemptLimit ?? settings.quizAttemptLimit,
      sortOrder:
        data.sortOrder ??
        existing?.sortOrder ??
        this.state.learningModules.length + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    // "Publish" here goes through the same guard as the Publish button. A
    // module that is not ready stays a draft, and nothing is saved.
    if (data.published === true && !existing?.published) {
      const readiness = this.publishReadinessFor(next);
      if (!readiness.canPublish) {
        throw new Error(
          `This module cannot be published yet: ${describePublishBlockers(readiness).join("; ")}.`,
        );
      }
      next.published = true;
    }

    if (existing) {
      Object.assign(existing, next);
      return existing;
    }
    this.state.learningModules.push(next);
    return next;
  }

  async adminUpsertLesson(data: LessonInput): Promise<Lesson> {
    const now = this.now();
    const existing = data.id
      ? this.state.lessons.find((l) => l.id === data.id)
      : undefined;
    const title = (data.title ?? "").trim().slice(0, 200);
    if (!title) throw new Error("Give the lesson a title.");
    const moduleId = existing?.moduleId ?? data.moduleId;
    if (!this.state.learningModules.some((m) => m.id === moduleId)) {
      throw new Error("That module no longer exists.");
    }
    const slug = contentSlug(data.slug ?? existing?.slug ?? title);
    if (!slug) {
      throw new Error("Give the lesson an address made of letters or numbers.");
    }
    if (
      this.state.lessons.some(
        (l) => l.moduleId === moduleId && l.slug === slug && l.id !== existing?.id,
      )
    ) {
      throw new Error(`Another lesson in this module already uses the address "${slug}".`);
    }
    if (existing) {
      // Only what was sent changes. A field the form left out stays as it is.
      Object.assign(existing, definedOnly(data), {
        moduleId,
        title,
        slug,
        contentSlug: (data.contentSlug ?? "").trim() || existing.contentSlug,
        updatedAt: now,
      });
      return existing;
    }
    const mod = this.state.learningModules.find((m) => m.id === moduleId);
    const lesson: Lesson = {
      id: data.id ?? this.id("les"),
      moduleId,
      slug,
      title,
      contentSlug:
        (data.contentSlug ?? "").trim() || `lesson-${mod?.slug ?? "module"}-${slug}`,
      sortOrder:
        data.sortOrder ??
        this.state.lessons.filter((l) => l.moduleId === moduleId).length + 1,
      estimatedMinutes: data.estimatedMinutes ?? 10,
      gap: data.gap ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.state.lessons.push(lesson);
    return lesson;
  }

  async adminDeleteLesson(id: string): Promise<void> {
    const lesson = this.state.lessons.find((l) => l.id === id);
    if (!lesson) throw new Error("That lesson no longer exists.");
    const mod = this.state.learningModules.find((m) => m.id === lesson.moduleId);
    const siblings = this.state.lessons.filter((l) => l.moduleId === lesson.moduleId);
    if (mod?.published && siblings.length === 1) {
      throw new Error(
        "This is the only lesson in a published module. Unpublish the module first.",
      );
    }
    // The lesson's videos go with it, and so do the records of who watched
    // them and who finished the lesson: they describe something that no
    // longer exists. A certification is a separate record and is not touched.
    const videoIds = new Set(
      this.state.lessonVideos.filter((v) => v.lessonId === id).map((v) => v.id),
    );
    this.state.videoWatches = this.state.videoWatches.filter(
      (w) => !videoIds.has(w.videoId),
    );
    this.state.lessonVideos = this.state.lessonVideos.filter(
      (v) => v.lessonId !== id,
    );
    for (const q of this.state.questions) {
      if (q.sourceVideoId && videoIds.has(q.sourceVideoId)) {
        q.sourceVideoId = null;
        q.updatedAt = this.now();
      }
    }
    const progressRemoved = this.state.lessonProgress.filter(
      (p) => p.lessonId === id,
    ).length;
    this.state.lessonProgress = this.state.lessonProgress.filter(
      (p) => p.lessonId !== id,
    );
    this.state.lessons = this.state.lessons.filter((l) => l.id !== id);
    this.pushAudit({
      action: "learning_lesson_removed",
      actorId: this.currentUserId ?? null,
      entityType: "lesson",
      entityId: id,
      metadata: {
        moduleId: lesson.moduleId,
        title: lesson.title,
        videos: videoIds.size,
        progressRows: progressRemoved,
      },
    });
  }

  async adminSaveLessonText(lessonId: string, html: string): Promise<ContentPage> {
    const lesson = this.state.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new Error("That lesson no longer exists.");
    const existing = this.state.contentPages.find(
      (p) => p.slug === lesson.contentSlug,
    );
    if (existing) {
      const saved = await this.adminSaveContentPage({
        id: existing.id,
        title: existing.title,
        html,
        published: true,
      });
      if (lesson.contentSlug !== saved.slug) {
        lesson.contentSlug = saved.slug;
        this.touch(lesson);
      }
      return saved;
    }
    // No page yet. Older lessons carry a path here ("learn/laser/safety")
    // that a page address cannot be, so the lesson gets a page of its own
    // and is pointed at it.
    const mod = this.state.learningModules.find((m) => m.id === lesson.moduleId);
    const base =
      contentSlug(`lesson-${mod?.slug ?? "module"}-${lesson.slug}`) ||
      `lesson-${this.id("text")}`;
    const taken = new Set(this.state.contentPages.map((p) => p.slug));
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    const saved = await this.adminSaveContentPage({
      title: lesson.title,
      html,
      slug,
      category: "lesson",
    });
    lesson.contentSlug = saved.slug;
    this.touch(lesson);
    return saved;
  }

  async adminUpsertQuestion(data: QuestionInput): Promise<Question> {
    const now = this.now();
    const existing = data.id
      ? this.state.questions.find((q) => q.id === data.id)
      : undefined;
    const prompt = (data.prompt ?? "").trim().slice(0, 1000);
    if (!prompt) throw new Error("Write the question.");
    const choices = (data.choices ?? existing?.choices ?? []).map((c) =>
      String(c ?? "").trim().slice(0, 500),
    );
    if (choices.length < 2) throw new Error("A question needs at least 2 choices.");
    if (choices.length > 6) throw new Error("A question can have at most 6 choices.");
    if (choices.some((c) => !c)) {
      throw new Error("Fill in every choice, or remove the empty one.");
    }

    // Which answers are right. A list sent with the save is what staff
    // ticked. Without one, an edit keeps the answers the question has,
    // unless the single answer sent is a different one.
    const before = existing ? questionCorrectIndexes(existing) : null;
    let indexes: number[];
    if (data.correctIndexes != null) {
      indexes = [...new Set(data.correctIndexes)].sort((a, b) => a - b);
    } else if (before && (data.correctIndex == null || data.correctIndex === existing?.correctIndex)) {
      indexes = [...before];
    } else {
      indexes = [data.correctIndex ?? 0];
    }
    if (
      indexes.length === 0 ||
      indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= choices.length)
    ) {
      throw new Error("Tick at least one right answer from the choices.");
    }
    const unchanged =
      before != null &&
      before.length === indexes.length &&
      [...before].sort((a, b) => a - b).every((v, i) => v === indexes[i]);
    const correctIndexes = unchanged && existing?.correctIndexes ? existing.correctIndexes : indexes;
    const correctIndex = unchanged && existing ? existing.correctIndex : indexes[0]!;

    if (existing) {
      Object.assign(existing, definedOnly(data), {
        prompt,
        choices,
        correctIndex,
        correctIndexes,
        updatedAt: now,
      });
      return existing;
    }
    const question: Question = {
      id: data.id ?? this.id("q"),
      moduleId: data.moduleId,
      prompt,
      choices,
      correctIndex,
      correctIndexes,
      explanation: data.explanation,
      active: data.active ?? true,
      safetyCritical: data.safetyCritical ?? false,
      source: data.source ?? "video",
      sourceVideoId: data.sourceVideoId ?? null,
      verifyAgainstVideo: data.verifyAgainstVideo ?? true,
      answerPending: data.answerPending ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.state.questions.push(question);
    return question;
  }

  async adminDeleteQuestion(id: string): Promise<void> {
    const idx = this.state.questions.findIndex((q) => q.id === id);
    if (idx < 0) throw new Error("Question not found");
    this.state.questions.splice(idx, 1);
  }

  async adminListQuestions(moduleId: string): Promise<Question[]> {
    return this.state.questions
      .filter((q) => q.moduleId === moduleId)
      .sort((a, b) => a.prompt.localeCompare(b.prompt));
  }

  async adminUpsertVideo(data: VideoInput): Promise<LessonVideo> {
    const now = this.now();
    const lesson = this.state.lessons.find((l) => l.id === data.lessonId);
    if (!lesson) throw new Error("Lesson not found");
    const existing = data.id
      ? this.state.lessonVideos.find((v) => v.id === data.id)
      : undefined;
    const title = (data.title ?? "").trim().slice(0, 300);
    if (!title) throw new Error("Give the video a title.");
    if (!VIDEO_ROLES.includes(data.role)) {
      throw new Error("Choose whether the video is required, extra, or only for some members.");
    }
    // Staff paste a link. The id is read out of it; an id typed on its own
    // still works, and an edit that sends neither keeps what the video has.
    const typedId = (data.youtubeId ?? "").trim();
    const link = (data.url ?? "").trim();
    const youtubeId =
      typedId || youtubeIdFrom(link) || (existing && !link ? existing.youtubeId : "");
    if (!youtubeId) throw new Error("Paste the video's YouTube link.");
    const url = link || `https://www.youtube.com/watch?v=${youtubeId}`;
    const condition =
      data.condition === undefined
        ? (existing?.condition ?? null)
        : (optionalText(data.condition, "Who should watch it", 300) ?? null);

    if (existing) {
      Object.assign(existing, definedOnly(data), {
        title,
        youtubeId,
        url,
        condition,
        updatedAt: now,
      });
      return existing;
    }
    const video: LessonVideo = {
      id: data.id ?? this.id("vid"),
      lessonId: data.lessonId,
      order:
        data.order ??
        this.state.lessonVideos
          .filter((v) => v.lessonId === data.lessonId)
          .reduce((max, v) => Math.max(max, v.order), 0) + 1,
      provider: data.provider ?? "youtube",
      youtubeId,
      url,
      title,
      channel: (data.channel ?? "").trim(),
      role: data.role,
      condition,
      durationSeconds: data.durationSeconds ?? null,
      verifiedAt: data.verifiedAt ?? null,
      staffReviewed: data.staffReviewed ?? false,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.state.lessonVideos.push(video);
    return video;
  }

  async adminDeleteVideo(id: string): Promise<void> {
    const idx = this.state.lessonVideos.findIndex((v) => v.id === id);
    if (idx < 0) throw new Error("Video not found");
    this.state.videoWatches = this.state.videoWatches.filter(
      (w) => w.videoId !== id,
    );
    for (const q of this.state.questions) {
      if (q.sourceVideoId === id) {
        q.sourceVideoId = null;
        q.updatedAt = this.now();
      }
    }
    this.state.lessonVideos.splice(idx, 1);
  }

  async adminSetVideoReviewed(
    videoId: string,
    reviewed: boolean,
  ): Promise<LessonVideo> {
    const video = this.state.lessonVideos.find((v) => v.id === videoId);
    if (!video) throw new Error("Video not found");
    video.staffReviewed = reviewed;
    if (reviewed && !video.verifiedAt) video.verifiedAt = this.now();
    return this.touch(video);
  }

  async adminListVideos(moduleId: string): Promise<LessonVideo[]> {
    return this.videosForModule(moduleId).sort((a, b) => {
      if (a.lessonId !== b.lessonId) {
        return a.lessonId.localeCompare(b.lessonId);
      }
      return a.order - b.order;
    });
  }

  async adminPublishModule(
    id: string,
    published: boolean,
  ): Promise<PublishModuleResult> {
    const mod = this.state.learningModules.find((m) => m.id === id);
    if (!mod) throw new Error("Module not found");
    if (!published) {
      mod.published = false;
      this.touch(mod);
      return { ok: true, module: mod };
    }
    const readiness = this.publishReadinessFor(mod);
    if (!readiness.canPublish) {
      return {
        ok: false,
        readiness,
        reasons: publishBlockersFromReadiness(readiness),
      };
    }
    mod.published = true;
    this.touch(mod);
    return { ok: true, module: mod };
  }

  async adminListMachines(): Promise<Machine[]> {
    return [...this.state.machines].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminListCertifications(): Promise<Certification[]> {
    return [...this.state.certifications].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminUpsertMachine(data: MachineInput): Promise<Machine> {
    const now = this.now();
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Give the machine a name.");
    const existing = data.id
      ? this.state.machines.find((m) => m.id === data.id)
      : undefined;
    // A shop without badge readers has nothing to type here, and the
    // database wants a different key on every machine. Blank keeps the key a
    // machine already has, or makes one up for a new machine.
    const readerKey =
      (data.readerKey ?? "").trim() ||
      existing?.readerKey ||
      `reader-${readerSlug(name)}-${this.id("k").slice(-4)}`;
    const clash = this.state.machines.find(
      (m) => m.readerKey === readerKey && m.id !== existing?.id,
    );
    if (clash) {
      throw new Error(
        `Reader key "${readerKey}" is already used by ${clash.name}. Give this machine a different one, or leave it blank.`,
      );
    }
    if (existing) {
      Object.assign(existing, data, { name, readerKey, updatedAt: now });
      return existing;
    }
    const machine: Machine = {
      id: data.id ?? this.id("m"),
      name,
      area: data.area,
      requiredCertificationIds: data.requiredCertificationIds ?? [],
      readerKey,
      active: data.active ?? true,
      reservationRecommended: data.reservationRecommended ?? false,
      reservationRequired: data.reservationRequired ?? false,
      attendedOperationRequired: data.attendedOperationRequired ?? false,
      locationLabel: data.locationLabel ?? "",
      gettingStartedVideoUrl: data.gettingStartedVideoUrl ?? null,
      maxReservationHours: data.maxReservationHours ?? null,
      sortOrder: data.sortOrder ?? this.state.machines.length + 1,
      hourlyRateCents:
        data.hourlyRateCents ??
        hourlyRateCentsFor(
          {
            id: data.id ?? "m-new",
            name: data.name,
            area: data.area,
            hourlyRateCents: null,
          },
          normalizeRateCard(this.state.rateCard),
        ),
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

  // ── Lists staff keep: directory, gallery, wishlist, shop details ──────────

  async adminListPeople(): Promise<Person[]> {
    return [...this.state.people].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminSavePerson(input: PersonInput): Promise<Person> {
    const now = this.now();
    const name = requiredText(input.name, "Name", NAME_MAX);
    const roleTitle = optionalText(input.roleTitle, "Role", NAME_MAX) ?? "";
    const bio = optionalText(input.bio, "Bio", MESSAGE_MAX) ?? "";
    if (input.kind !== "staff" && input.kind !== "instructor") {
      throw new Error("Choose staff or instructor.");
    }
    const existing = input.id
      ? this.state.people.find((p) => p.id === input.id)
      : undefined;
    if (input.id && !existing) throw new Error("That person is no longer in the directory.");
    if (existing) {
      Object.assign(existing, {
        name,
        roleTitle,
        bio,
        kind: input.kind,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        published: input.published ?? existing.published,
        updatedAt: now,
      });
      return { ...existing };
    }
    const person: Person = {
      id: this.id("person"),
      slug: contentSlug(name) || this.id("p"),
      name,
      roleTitle,
      kind: input.kind,
      bio,
      sortOrder: input.sortOrder ?? nextSortOrder(this.state.people),
      published: input.published ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.people.push(person);
    return { ...person };
  }

  async adminDeletePerson(id: string): Promise<void> {
    this.state.people = this.state.people.filter((p) => p.id !== id);
  }

  async listProjects(): Promise<Project[]> {
    return this.state.projects
      .filter((p) => p.published)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminListProjects(): Promise<Project[]> {
    return [...this.state.projects].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async adminSaveProject(input: ProjectInput): Promise<Project> {
    const now = this.now();
    const title = requiredText(input.title, "Title", NAME_MAX);
    const fields = {
      title,
      maker: optionalText(input.maker, "Maker", NAME_MAX) ?? "",
      area: optionalText(input.area, "Area", NAME_MAX) ?? "",
      caption: optionalText(input.caption, "Caption", 500) ?? "",
      imageSrc: pictureAddress(input.imageSrc),
      imageAlt: optionalText(input.imageAlt, "Picture description", 300) ?? title,
    };
    const existing = input.id
      ? this.state.projects.find((p) => p.id === input.id)
      : undefined;
    if (input.id && !existing) throw new Error("That project is no longer in the gallery.");
    if (existing) {
      Object.assign(existing, fields, {
        sortOrder: input.sortOrder ?? existing.sortOrder,
        published: input.published ?? existing.published,
        updatedAt: now,
      });
      return { ...existing };
    }
    const project: Project = {
      id: this.id("proj"),
      ...fields,
      sortOrder: input.sortOrder ?? nextSortOrder(this.state.projects),
      published: input.published ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.projects.push(project);
    return { ...project };
  }

  async adminDeleteProject(id: string): Promise<void> {
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
  }

  async adminSaveWishlistItem(input: WishlistItemInput): Promise<WishlistItem> {
    const now = this.now();
    const name = requiredText(input.name, "Item name", NAME_MAX);
    if (!this.state.wishlistZones.some((z) => z.id === input.zoneId)) {
      throw new Error("Choose a wishlist zone for this item.");
    }
    const priceCents = Math.round(Number(input.priceCents));
    if (!Number.isFinite(priceCents) || priceCents < 0 || priceCents > 100_000_00) {
      throw new Error("Enter a price of zero or more.");
    }
    const qty = Math.round(Number(input.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 1000) {
      throw new Error("Quantity must be at least 1.");
    }
    const link = typeof input.url === "string" ? input.url.trim() : "";
    if (link && (link.length > 1000 || !/^https?:\/\/[^\s<>"]+$/i.test(link))) {
      throw new Error("The link must be a web address that starts with https://");
    }
    const fields = {
      zoneId: input.zoneId,
      name,
      model: optionalText(input.model, "Model", 200) ?? "",
      qty,
      priceCents,
      estimated: input.estimated ?? false,
      url: link || null,
      note: optionalText(input.note, "Note", 500),
      tier: input.tier === "stretch" ? ("stretch" as const) : ("core" as const),
    };
    const existing = input.id
      ? this.state.wishlistItems.find((i) => i.id === input.id)
      : undefined;
    if (input.id && !existing) throw new Error("That item is no longer on the wishlist.");
    if (existing) {
      Object.assign(existing, fields, {
        sortOrder: input.sortOrder ?? existing.sortOrder,
        updatedAt: now,
      });
      return { ...existing };
    }
    const item: WishlistItem = {
      id: this.id("wl"),
      ...fields,
      status: "needed",
      fulfilledAt: null,
      fulfilledBy: null,
      sortOrder:
        input.sortOrder ??
        nextSortOrder(this.state.wishlistItems.filter((i) => i.zoneId === input.zoneId)),
      createdAt: now,
      updatedAt: now,
    };
    this.state.wishlistItems.push(item);
    return { ...item };
  }

  async adminDeleteWishlistItem(id: string): Promise<void> {
    this.state.wishlistItems = this.state.wishlistItems.filter((i) => i.id !== id);
    // A report about an item that is gone has nothing left to confirm.
    this.state.wishlistPurchaseReports = this.state.wishlistPurchaseReports.filter(
      (r) => r.itemId !== id,
    );
  }

  async getRateCard(): Promise<RateCard> {
    return normalizeRateCard(this.state.rateCard);
  }

  async adminSaveRateCard(patch: Partial<RateCard>): Promise<RateCard> {
    const before = normalizeRateCard(this.state.rateCard);
    // Throws on the first bad value, before anything is changed.
    const after = applyRateCardPatch(before, patch);
    const changes = rateCardChanges(before, after);
    if (Object.keys(changes).length === 0) return before;
    this.state.rateCard = after;
    this.pushAudit({
      action: "rate_card_changed",
      actorId: this.currentUserId ?? null,
      entityType: "rate_card",
      entityId: "default",
      metadata: changes,
    });
    return { ...after };
  }

  /** The stored week, with the default for any day that cannot be read. */
  private openingHours(): OpeningHours {
    return normalizeOpeningHours(this.state.openingHours);
  }

  async getOpeningHours(): Promise<OpeningHours> {
    return this.openingHours();
  }

  async adminSaveOpeningHours(week: OpeningHours): Promise<OpeningHours> {
    const before = this.openingHours();
    // Throws on the first day that will not do, before anything is changed.
    const after = checkedOpeningHours(week);
    const changes = openingHoursChanges(before, after);
    if (Object.keys(changes).length === 0) return before;
    this.state.openingHours = after;
    this.pushAudit({
      action: "opening_hours_changed",
      actorId: this.currentUserId ?? null,
      entityType: "opening_hours",
      entityId: "default",
      metadata: changes,
    });
    return after.map((day) => (day ? { ...day } : null));
  }

  async getSiteInfo(): Promise<SiteInfo> {
    return { ...this.state.siteInfo };
  }

  async adminSaveSiteInfo(input: Partial<SiteInfo>): Promise<SiteInfo> {
    const current = this.state.siteInfo;
    const next: SiteInfo = {
      orgName:
        input.orgName === undefined
          ? current.orgName
          : requiredText(input.orgName, "Shop name", 200),
      addressLine:
        input.addressLine === undefined
          ? current.addressLine
          : (optionalText(input.addressLine, "Address", 300) ?? ""),
      blurb:
        input.blurb === undefined
          ? current.blurb
          : (optionalText(input.blurb, "Description", 600) ?? ""),
      facebookUrl:
        input.facebookUrl === undefined
          ? current.facebookUrl
          : webAddress(input.facebookUrl, "The Facebook link"),
      instagramUrl:
        input.instagramUrl === undefined
          ? current.instagramUrl
          : webAddress(input.instagramUrl, "The Instagram link"),
    };
    this.state.siteInfo = next;
    return { ...next };
  }

  async listTextBlocks(): Promise<Record<string, string>> {
    const saved: Record<string, string> = {};
    for (const page of this.state.contentPages) {
      if (page.category === "block" && page.published) saved[page.slug] = page.html;
    }
    return saved;
  }

  async adminSaveContentPage(input: ContentPageInput): Promise<ContentPage> {
    const now = this.now();
    const title = (input.title ?? "").trim().slice(0, 200);
    if (!title) throw new Error("Give the page a title.");
    const html = cleanContentHtml(input.html ?? "");
    if (!contentHtmlHasText(html)) throw new Error("The page has no text yet.");
    const existing = input.id
      ? this.state.contentPages.find((p) => p.id === input.id)
      : undefined;
    if (input.id && !existing) throw new Error("That page no longer exists.");

    // A page that exists keeps its address exactly. Lessons and classes find
    // their text by it, and some older addresses are paths ("learn/laser/safety")
    // that tidying up would change.
    const slug = existing ? existing.slug : contentSlug(input.slug ?? title);
    if (!slug) throw new Error("Give the page an address made of letters or numbers.");
    const clash = this.state.contentPages.find(
      (p) => p.slug === slug && p.id !== existing?.id,
    );
    if (clash) {
      throw new Error(
        `Another page already uses the address "${slug}". It is "${clash.title}".`,
      );
    }
    const version = (input.version ?? existing?.version ?? "1").trim().slice(0, 40) || "1";
    const category = input.category ?? existing?.category ?? "other";
    if (!CONTENT_CATEGORIES.includes(category)) throw new Error("Unknown page type.");
    // A block's address is what ties it to its place on a page.
    if (category === "block" && !isTextBlockSlug(slug)) {
      throw new Error("That is not a piece of text any page shows.");
    }

    let page: ContentPage;
    if (existing) {
      Object.assign(existing, {
        title,
        html,
        slug,
        version,
        category,
        published: input.published ?? existing.published,
        updatedAt: now,
      });
      page = existing;
    } else {
      page = {
        id: this.id("content"),
        slug,
        title,
        html,
        category,
        version,
        published: input.published ?? true,
        createdAt: now,
        updatedAt: now,
      };
      this.state.contentPages.push(page);
    }
    // The waiver members sign is the one whose version the settings name.
    // A new version on the published waiver makes it the current one, which
    // is what asks every member to sign again.
    if (
      page.category === "waiver" &&
      page.published &&
      page.version !== this.state.settings.currentWaiverVersion
    ) {
      Object.assign(this.state.settings, {
        currentWaiverVersion: page.version,
        updatedAt: now,
      });
    }
    this.pushAudit({
      action: existing ? "content_page_updated" : "content_page_created",
      actorId: this.currentUserId ?? null,
      entityType: "content_page",
      entityId: page.id,
      metadata: { slug: page.slug, version: page.version, published: page.published },
    });
    return { ...page };
  }

  async adminUpdateSettings(
    data: Partial<OrgSettings>,
  ): Promise<OrgSettings> {
    if (data.defaultInstructorId) {
      const instructor = this.state.users.find(
        (user) => user.id === data.defaultInstructorId,
      );
      if (!instructor) {
        throw new Error(
          "That default instructor is not a member. Choose someone from the list, or leave it blank.",
        );
      }
    } else if (data.defaultInstructorId === "") {
      data.defaultInstructorId = null;
    }
    for (const key of ["hoursContentSlug", "memberExpectationsPolicySlug"] as const) {
      const slug = data[key];
      if (slug === undefined || slug === this.state.settings[key]) continue;
      if (!this.state.contentPages.some((p) => p.slug === slug && p.published)) {
        throw new Error("Choose a published page from the list.");
      }
    }
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
    // Credits are not a gate. A $0 or negative wallet still starts the job.
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
    this.touch(session);
    // Never block the reader: debit after the session ends, even if the
    // wallet goes negative.
    this.debitMachineSession(session);
    return session;
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

  private recordItemEvent(input: {
    itemId: string;
    type: ItemEventType;
    actorId: string;
    changes?: ItemEvent["changes"];
    note?: string | null;
    photoId?: string | null;
  }): ItemEvent {
    const event: ItemEvent = {
      id: this.id("ie"),
      itemId: input.itemId,
      type: input.type,
      actorId: input.actorId,
      changes: input.changes ?? null,
      note: input.note ?? null,
      photoId: input.photoId ?? null,
      createdAt: this.now(),
    };
    this.state.itemEvents.push(event);
    return event;
  }

  private nextTagNumber(): number {
    const max = this.state.inventoryItems.reduce(
      (m, item) => Math.max(m, item.tagNumber),
      0,
    );
    return max + 1;
  }

  /** Stewards of the item's area and staff. Same rule as seeing it pending. */
  private seesInventoryPrivateFields(
    viewer: User | null | undefined,
    item: InventoryItem,
  ): boolean {
    return canInventory(viewer, "viewPending", {
      areaId: item.areaId,
      stewards: this.state.areaStewards,
    });
  }

  /** Photos of the item this viewer may see. The serial plate is private. */
  private inventoryPhotosFor(
    viewer: User | null | undefined,
    item: InventoryItem,
  ): ItemPhoto[] {
    const all = this.seesInventoryPrivateFields(viewer, item);
    return this.state.itemPhotos.filter(
      (p) => p.itemId === item.id && (all || p.kind !== "SERIAL"),
    );
  }

  private toInventoryView(
    item: InventoryItem,
    viewer: User | null | undefined,
  ): InventoryItemView {
    const area = item.areaId
      ? this.state.inventoryAreas.find((a) => a.id === item.areaId)
      : undefined;
    const createdBy = this.state.users.find((u) => u.id === item.createdById);
    const reviewedBy = item.reviewedById
      ? this.state.users.find((u) => u.id === item.reviewedById)
      : undefined;
    const photos = this.inventoryPhotosFor(viewer, item);
    const front = photos.find((p) => p.kind === "FRONT") ?? photos[0] ?? null;
    const view: InventoryItemView = {
      ...item,
      assetTag: formatAssetTag(item.tagNumber),
      areaName: area?.name ?? null,
      createdByName: createdBy?.displayName ?? null,
      reviewedByName: reviewedBy?.displayName ?? null,
      frontPhoto: front,
    };
    if (!this.seesInventoryPrivateFields(viewer, item)) {
      for (const field of INVENTORY_PRIVATE_FIELDS) delete view[field];
    }
    return view;
  }

  /** Items with this serial that the viewer is allowed to know about. */
  private inventorySerialHits(
    serial: unknown,
    viewer: User | null | undefined,
  ): InventoryItem[] {
    const key = typeof serial === "string" ? serial.trim().toLowerCase() : "";
    if (!key) return [];
    return this.state.inventoryItems.filter(
      (i) =>
        i.serialNumber &&
        i.serialNumber.trim().toLowerCase() === key &&
        (i.reviewStatus === "APPROVED" ||
          this.seesInventoryPrivateFields(viewer, i)),
    );
  }

  private requireInventoryItem(id: string): InventoryItem {
    const item = this.state.inventoryItems.find((i) => i.id === id);
    if (!item) throw new Error("Item not found");
    return item;
  }

  private cleanupTempPhotos(): void {
    const leftover = this.state.itemPhotos.filter(
      (p) => !p.itemId && isTempPhotoExpired(p.createdAt),
    );
    if (leftover.length === 0) return;
    const drop = new Set(leftover.map((p) => p.id));
    this.state.itemPhotos = this.state.itemPhotos.filter((p) => !drop.has(p.id));
  }

  async listInventoryAreas(): Promise<InventoryArea[]> {
    return this.state.inventoryAreas
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  async listAreaStewards() {
    return this.state.areaStewards.slice();
  }

  async adminSetAreaStewards(areaId: string, userIds: string[]): Promise<AreaSteward[]> {
    const area = this.state.inventoryAreas.find((a) => a.id === areaId);
    if (!area) throw new Error("That inventory area no longer exists.");
    const wanted = [...new Set(Array.isArray(userIds) ? userIds : [])];
    for (const userId of wanted) {
      if (!this.state.users.some((u) => u.id === userId && !u.deletedAt)) {
        throw new Error("One of those people is not a member any more.");
      }
    }
    const current = this.state.areaStewards.filter((s) => s.areaId === areaId);
    const now = this.now();
    // Rows for people who stay are kept as they are, so only real changes are written.
    const kept = current.filter((s) => wanted.includes(s.userId));
    const added: AreaSteward[] = wanted
      .filter((userId) => !kept.some((s) => s.userId === userId))
      .map((userId) => ({ id: this.id("as"), areaId, userId, createdAt: now }));
    const removedCount = current.length - kept.length;
    this.state.areaStewards = [
      ...this.state.areaStewards.filter((s) => s.areaId !== areaId),
      ...kept,
      ...added,
    ];
    if (added.length > 0 || removedCount > 0) {
      this.pushAudit({
        action: "area_stewards_changed",
        actorId: this.currentUserId ?? null,
        entityType: "InventoryArea",
        entityId: areaId,
        metadata: { stewards: wanted },
      });
    }
    return [...kept, ...added];
  }

  async upsertInventoryArea(
    actorId: string,
    data: { id?: string; slug: string; name: string; active?: boolean },
  ): Promise<InventoryArea> {
    const actor = this.requireUser(actorId);
    if (!canInventory(actor, "manageAreas")) {
      throw new Error("Staff only");
    }
    const slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const name = data.name.trim();
    if (!slug || !name) throw new Error("Area name and slug are required");
    const now = this.now();
    const existing = data.id
      ? this.state.inventoryAreas.find((a) => a.id === data.id)
      : this.state.inventoryAreas.find((a) => a.slug === slug);
    if (existing) {
      existing.name = name;
      existing.slug = slug;
      existing.active = data.active ?? existing.active;
      existing.updatedAt = now;
      return existing;
    }
    const area: InventoryArea = {
      id: this.id("ia"),
      slug,
      name,
      sortOrder:
        this.state.inventoryAreas.reduce((m, a) => Math.max(m, a.sortOrder), 0) +
        1,
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.state.inventoryAreas.push(area);
    return area;
  }

  async listInventoryManufacturers(): Promise<string[]> {
    const set = new Set<string>();
    for (const item of this.state.inventoryItems) {
      if (item.manufacturer?.trim()) set.add(item.manufacturer.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  async listInventoryLocations(): Promise<string[]> {
    const set = new Set<string>();
    for (const item of this.state.inventoryItems) {
      if (item.location?.trim()) set.add(item.location.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  async pendingInventoryCount(userId: string): Promise<number> {
    const user = this.requireUser(userId);
    if (!canInventory(user, "viewPending", { stewards: this.state.areaStewards })) {
      return 0;
    }
    const staff = user.role === "staff" || user.role === "admin";
    const areas = stewardAreaIds(user, this.state.areaStewards);
    return this.state.inventoryItems.filter((item) => {
      if (item.reviewStatus !== "PENDING") return false;
      if (staff) return true;
      if (!item.areaId) return true;
      return areas.includes(item.areaId);
    }).length;
  }

  /**
   * What a visitor who is not signed in sees on the Equipment page. Built by
   * picking fields: nothing on the stored item reaches the public unless it
   * is named here.
   */
  async listPublicEquipment(): Promise<PublicEquipmentItem[]> {
    const areas = new Map(this.state.inventoryAreas.map((a) => [a.id, a]));
    const order = (item: InventoryItem): number =>
      (item.areaId ? areas.get(item.areaId)?.sortOrder : undefined) ??
      Number.MAX_SAFE_INTEGER;
    return this.state.inventoryItems
      .filter(isPublicEquipment)
      .sort(
        (a, b) =>
          order(a) - order(b) ||
          (a.areaId ?? "").localeCompare(b.areaId ?? "") ||
          a.name.localeCompare(b.name),
      )
      .map((item): PublicEquipmentItem => {
        const area = item.areaId ? areas.get(item.areaId) : undefined;
        // The front photo or none. A side or serial-plate photo never stands in.
        const front = this.state.itemPhotos.find(
          (p) => p.itemId === item.id && p.kind === "FRONT",
        );
        return {
          name: item.name,
          manufacturer: item.manufacturer ?? null,
          model: item.model ?? null,
          quantity: item.quantity > 1 ? item.quantity : null,
          area: area ? { id: area.id, name: area.name } : null,
          photo: front
            ? { storageKey: front.storageKey, thumbKey: front.thumbKey ?? null }
            : null,
        };
      });
  }

  async listInventoryItems(
    viewerId: string,
    filters?: InventoryListFilters,
  ): Promise<InventoryItemView[]> {
    const viewer = this.requireUser(viewerId);
    const canPending = canInventory(viewer, "viewPending", {
      stewards: this.state.areaStewards,
    });
    const staff = viewer.role === "staff" || viewer.role === "admin";
    const areas = stewardAreaIds(viewer, this.state.areaStewards);
    const search = filters?.search?.trim().toLowerCase();
    const conditions = filters?.condition
      ? Array.isArray(filters.condition)
        ? filters.condition
        : [filters.condition]
      : null;
    const statuses = filters?.status
      ? Array.isArray(filters.status)
        ? filters.status
        : [filters.status]
      : null;
    const reviews = filters?.reviewStatus
      ? Array.isArray(filters.reviewStatus)
        ? filters.reviewStatus
        : [filters.reviewStatus]
      : null;
    const includeRetired = Boolean(filters?.includeRetired);
    const includePending = Boolean(filters?.includePending) && canPending;

    return this.state.inventoryItems
      .filter((item) => {
        if (!includeRetired && item.status === "RETIRED") return false;
        if (item.reviewStatus === "REJECTED") {
          if (!canPending) return false;
          // Same rule as pending items: a steward's own areas only.
          if (!staff && item.areaId && !areas.includes(item.areaId)) return false;
        }
        if (item.reviewStatus === "PENDING") {
          if (!includePending || !canPending) return false;
          if (!staff && item.areaId && !areas.includes(item.areaId)) return false;
        }
        if (filters?.areaId && item.areaId !== filters.areaId) return false;
        if (filters?.location && item.location !== filters.location) return false;
        if (conditions && !conditions.includes(item.condition)) return false;
        if (statuses && !statuses.includes(item.status)) return false;
        if (reviews && !reviews.includes(item.reviewStatus)) return false;
        if (search) {
          const tag = formatAssetTag(item.tagNumber).toLowerCase();
          // Matching on a serial the viewer is not shown would let them
          // work it out one character at a time.
          const hay = [
            item.name,
            item.model,
            item.manufacturer,
            this.seesInventoryPrivateFields(viewer, item)
              ? item.serialNumber
              : null,
            tag,
            item.location,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      })
      .map((item) => this.toInventoryView(item, viewer))
      .sort((a, b) => a.tagNumber - b.tagNumber);
  }

  async getInventoryItem(
    viewerId: string,
    assetTag: string,
  ): Promise<InventoryItemDetail | null> {
    const viewer = this.requireUser(viewerId);
    const tagNumber = parseAssetTag(assetTag);
    if (tagNumber == null) return null;
    const item = this.state.inventoryItems.find((i) => i.tagNumber === tagNumber);
    if (!item) return null;
    const canPending = canInventory(viewer, "viewPending", {
      areaId: item.areaId,
      stewards: this.state.areaStewards,
    });
    if (item.reviewStatus !== "APPROVED" && !canPending) return null;
    const photos = this.inventoryPhotosFor(viewer, item).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    // The history records old and new values for edited fields. Drop the
    // ones this viewer is not shown on the item itself.
    const hidden: ReadonlySet<string> = new Set(
      canPending ? [] : INVENTORY_PRIVATE_FIELDS,
    );
    const events = this.state.itemEvents
      .filter((e) => e.itemId === item.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((e) => ({
        ...e,
        changes: e.changes
          ? Object.fromEntries(
              Object.entries(e.changes).filter(([field]) => !hidden.has(field)),
            )
          : e.changes,
        actorName:
          this.state.users.find((u) => u.id === e.actorId)?.displayName ?? null,
      }));
    return { ...this.toInventoryView(item, viewer), photos, events };
  }

  /**
   * Serial lookup for the add-item form. It answers for the signed-in user:
   * approved items for anyone, and items still in review (or rejected) only
   * for a steward of that area or staff.
   */
  async findInventoryBySerial(serial: string): Promise<InventoryDuplicateHit[]> {
    const viewer = this.currentUserId
      ? this.state.users.find((u) => u.id === this.currentUserId)
      : null;
    return this.inventorySerialHits(serial, viewer).map((i) => ({
      id: i.id,
      assetTag: formatAssetTag(i.tagNumber),
      name: i.name,
    }));
  }

  async createInventoryItem(
    userId: string,
    data: CreateInventoryItemInput,
  ): Promise<InventoryItemView> {
    return this.insertInventoryItem(userId, data, { trustedPhotos: false });
  }

  /**
   * `trustedPhotos` is for photos the server chose itself (the CSV import's
   * placeholders). Anything a caller sent goes through `checkedPhotoInputs`.
   */
  private async insertInventoryItem(
    userId: string,
    data: CreateInventoryItemInput,
    opts: { trustedPhotos: boolean },
  ): Promise<InventoryItemView> {
    this.cleanupTempPhotos();
    const user = this.requireUser(userId);
    if (!canInventory(user, "submit", { stewards: this.state.areaStewards })) {
      throw new Error("Sign in as a volunteer or staff to add inventory");
    }
    const name = data.name.trim();
    if (!name) throw new Error("Item name is required");
    const photos = opts.trustedPhotos
      ? (data.photoKeys ?? [])
      : checkedPhotoInputs(data.photoKeys);
    const hasFront = photos.some((p) => p.kind === "FRONT");
    const hasSide = photos.some((p) => p.kind === "SIDE");
    if (!hasFront || !hasSide) {
      throw new Error("Front and side photos are required");
    }
    const noSerial = Boolean(data.noSerial);
    const serial = noSerial ? null : data.serialNumber?.trim() || null;
    if (!noSerial && !photos.some((p) => p.kind === "SERIAL") && !serial) {
      throw new Error("Add a serial photo or mark that there is no serial");
    }
    if (serial && !data.continueDespiteDuplicate) {
      // Only items the submitter may know about. A match that is still in
      // review is for the steward to sort out, not something to reveal here.
      const dupes = this.inventorySerialHits(serial, user);
      if (dupes.length > 0) {
        throw new Error(
          `This might already be in inventory: ${dupes.map((d) => `${formatAssetTag(d.tagNumber)} ${d.name}`).join(", ")}`,
        );
      }
    }
    const now = this.now();
    const stewardOwn =
      canInventory(user, "approve", {
        areaId: data.areaId ?? null,
        stewards: this.state.areaStewards,
      }) && Boolean(data.areaId);
    const auto =
      INVENTORY_AUTO_APPROVE_STEWARDS && stewardOwn;
    const item: InventoryItem = {
      id: this.id("inv"),
      tagNumber: this.nextTagNumber(),
      name,
      model: data.model?.trim() || null,
      manufacturer: data.manufacturer?.trim() || null,
      serialNumber: serial,
      noSerial,
      quantity: Math.max(1, Math.floor(data.quantity ?? 1)),
      isMachine: Boolean(data.isMachine),
      areaId: data.areaId ?? null,
      location: data.location?.trim() || null,
      condition: data.condition,
      status: "ACTIVE",
      notes: data.notes?.trim() || null,
      reviewStatus: auto ? "APPROVED" : "PENDING",
      reviewedById: auto ? user.id : null,
      reviewedAt: auto ? now : null,
      rejectReason: null,
      createdById: user.id,
      createdAt: now,
      updatedAt: now,
      showPublicly: true,
    };
    this.state.inventoryItems.push(item);
    for (const photo of photos) {
      this.state.itemPhotos.push({
        id: this.id("ip"),
        itemId: item.id,
        kind: photo.kind,
        storageKey: photo.storageKey,
        thumbKey: photo.thumbKey ?? photo.storageKey,
        mimeType: photo.mimeType,
        width: photo.width ?? null,
        height: photo.height ?? null,
        uploadedById: user.id,
        createdAt: now,
      });
    }
    this.recordItemEvent({
      itemId: item.id,
      type: "CREATED",
      actorId: user.id,
    });
    if (auto) {
      this.recordItemEvent({
        itemId: item.id,
        type: "APPROVED",
        actorId: user.id,
        changes: { reviewStatus: { from: "PENDING", to: "APPROVED" } },
      });
    }
    return this.toInventoryView(item, user);
  }

  async updateInventoryItem(
    userId: string,
    id: string,
    patch: UpdateInventoryItemInput,
  ): Promise<InventoryItemView> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(id);
    // Permission comes from where the item is now. Moving it also needs
    // permission on the area it is going to.
    const stewards = this.state.areaStewards;
    const moving = patch.areaId !== undefined && patch.areaId !== item.areaId;
    if (
      !canInventory(user, "edit", { areaId: item.areaId, stewards }) ||
      (moving && !canInventory(user, "edit", { areaId: patch.areaId, stewards }))
    ) {
      throw new Error("Stewards can edit items in their areas");
    }
    const changes: NonNullable<ItemEvent["changes"]> = {};
    const apply = <K extends keyof InventoryItem>(
      field: K,
      next: InventoryItem[K] | undefined,
    ) => {
      if (next === undefined) return;
      if (item[field] === next) return;
      changes[field] = { from: item[field], to: next };
      item[field] = next;
    };
    apply("name", patch.name?.trim() as InventoryItem["name"] | undefined);
    apply("model", patch.model === undefined ? undefined : patch.model?.trim() || null);
    apply(
      "manufacturer",
      patch.manufacturer === undefined
        ? undefined
        : patch.manufacturer?.trim() || null,
    );
    apply(
      "serialNumber",
      patch.serialNumber === undefined
        ? undefined
        : patch.serialNumber?.trim() || null,
    );
    apply("noSerial", patch.noSerial);
    apply(
      "quantity",
      patch.quantity == null
        ? undefined
        : (Math.max(1, Math.floor(patch.quantity)) as InventoryItem["quantity"]),
    );
    apply("isMachine", patch.isMachine);
    apply("areaId", patch.areaId === undefined ? undefined : patch.areaId);
    apply(
      "location",
      patch.location === undefined ? undefined : patch.location?.trim() || null,
    );
    apply("condition", patch.condition);
    apply("notes", patch.notes === undefined ? undefined : patch.notes?.trim() || null);
    apply(
      "showPublicly",
      patch.showPublicly === undefined ? undefined : Boolean(patch.showPublicly),
    );
    this.touch(item);
    if (Object.keys(changes).length > 0) {
      this.recordItemEvent({
        itemId: item.id,
        type: changes.condition ? "CONDITION_CHANGED" : "UPDATED",
        actorId: user.id,
        changes,
      });
    }
    return this.toInventoryView(item, user);
  }

  async reviewInventoryItem(
    userId: string,
    id: string,
    decision: "approve" | "reject",
    reason?: string,
  ): Promise<InventoryItemView> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(id);
    const action = decision === "approve" ? "approve" : "reject";
    if (
      !canInventory(user, action, {
        areaId: item.areaId,
        stewards: this.state.areaStewards,
      })
    ) {
      throw new Error("Stewards can only review items in their areas");
    }
    if (item.reviewStatus !== "PENDING") {
      throw new Error("This item is not awaiting review");
    }
    const now = this.now();
    if (decision === "reject") {
      const why = reason?.trim();
      if (!why) throw new Error("A reject reason is required");
      item.reviewStatus = "REJECTED";
      item.rejectReason = why;
      item.reviewedById = user.id;
      item.reviewedAt = now;
      this.touch(item);
      this.recordItemEvent({
        itemId: item.id,
        type: "REJECTED",
        actorId: user.id,
        changes: { reviewStatus: { from: "PENDING", to: "REJECTED" } },
        note: why,
      });
      return this.toInventoryView(item, user);
    }
    item.reviewStatus = "APPROVED";
    item.reviewedById = user.id;
    item.reviewedAt = now;
    item.rejectReason = null;
    this.touch(item);
    this.recordItemEvent({
      itemId: item.id,
      type: "APPROVED",
      actorId: user.id,
      changes: { reviewStatus: { from: "PENDING", to: "APPROVED" } },
    });
    return this.toInventoryView(item, user);
  }

  async changeInventoryStatus(
    userId: string,
    id: string,
    status: ItemStatus,
    note?: string,
  ): Promise<InventoryItemView> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(id);
    if (
      !canInventory(user, "changeStatus", {
        areaId: item.areaId,
        stewards: this.state.areaStewards,
      })
    ) {
      throw new Error("Stewards can change status in their areas");
    }
    if (status === "RETIRED") {
      return this.retireInventoryItem(userId, id, note ?? "retired");
    }
    const from = item.status;
    item.status = status;
    this.touch(item);
    this.recordItemEvent({
      itemId: item.id,
      type: "STATUS_CHANGED",
      actorId: user.id,
      changes: { status: { from, to: status } },
      note: note?.trim() || null,
    });
    return this.toInventoryView(item, user);
  }

  async moveInventoryItem(
    userId: string,
    id: string,
    location: string,
    note?: string,
  ): Promise<InventoryItemView> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(id);
    if (
      !canInventory(user, "move", {
        areaId: item.areaId,
        stewards: this.state.areaStewards,
      })
    ) {
      throw new Error("Stewards can move items in their areas");
    }
    const next = location.trim();
    if (!next) throw new Error("Location is required");
    const from = item.location ?? null;
    item.location = next;
    this.touch(item);
    this.recordItemEvent({
      itemId: item.id,
      type: "MOVED",
      actorId: user.id,
      changes: { location: { from, to: next } },
      note: note?.trim() || null,
    });
    return this.toInventoryView(item, user);
  }

  async reportInventoryIssue(
    userId: string,
    id: string,
    input: InventoryIssueInput,
  ): Promise<ItemEvent> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(id);
    if (item.reviewStatus !== "APPROVED") {
      throw new Error("Only approved items can receive issue reports");
    }
    if (!canInventory(user, "reportIssue")) {
      throw new Error("Sign in to report an issue");
    }
    let photoId: string | null = null;
    if (input.photoKey != null && input.photoKey !== "") {
      const checked = checkedPhotoInput({
        storageKey: input.photoKey,
        kind: "OTHER",
        mimeType: input.photoMimeType ?? "image/jpeg",
      });
      const photo: ItemPhoto = {
        id: this.id("ip"),
        itemId: item.id,
        kind: "OTHER",
        storageKey: checked.storageKey,
        thumbKey: checked.storageKey,
        mimeType: checked.mimeType,
        uploadedById: user.id,
        createdAt: this.now(),
      };
      this.state.itemPhotos.push(photo);
      photoId = photo.id;
    }
    const event = this.recordItemEvent({
      itemId: item.id,
      type: "ISSUE_REPORTED",
      actorId: user.id,
      note: [input.type, input.note?.trim()].filter(Boolean).join(" · ") || input.type,
      photoId,
    });
    const area = item.areaId
      ? this.state.inventoryAreas.find((a) => a.id === item.areaId) ?? null
      : null;
    const stewardUsers = this.state.areaStewards
      .filter((s) => (item.areaId ? s.areaId === item.areaId : true))
      .map((s) => this.state.users.find((u) => u.id === s.userId))
      .filter((u): u is User => Boolean(u));
    const staff = this.state.users.filter(
      (u) => u.role === "staff" || u.role === "admin",
    );
    void notifyStewardsOfIssue({
      itemName: item.name,
      assetTag: formatAssetTag(item.tagNumber),
      area,
      stewards: stewardUsers.length > 0 ? stewardUsers : staff,
      reporterName: user.displayName,
      issueType: input.type,
      note: input.note,
    });
    return event;
  }

  async retireInventoryItem(
    userId: string,
    id: string,
    reason: string,
  ): Promise<InventoryItemView> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(id);
    if (!canInventory(user, "retire")) {
      throw new Error("Only staff can retire items");
    }
    const why = reason.trim();
    if (!why) throw new Error("A retire reason is required");
    const from = item.status;
    item.status = "RETIRED";
    item.retiredAt = this.now();
    item.retiredReason = why;
    this.touch(item);
    this.recordItemEvent({
      itemId: item.id,
      type: "RETIRED",
      actorId: user.id,
      changes: { status: { from, to: "RETIRED" } },
      note: why,
    });
    return this.toInventoryView(item, user);
  }

  async addInventoryPhoto(
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
  ): Promise<ItemPhoto> {
    const user = this.requireUser(userId);
    const item = this.requireInventoryItem(itemId);
    if (
      !canInventory(user, "addPhoto", {
        areaId: item.areaId,
        stewards: this.state.areaStewards,
      })
    ) {
      throw new Error("Volunteers can add photos");
    }
    const checked = checkedPhotoInput(photo);
    const row: ItemPhoto = {
      id: this.id("ip"),
      itemId: item.id,
      kind: checked.kind,
      storageKey: checked.storageKey,
      thumbKey: checked.thumbKey ?? checked.storageKey,
      mimeType: checked.mimeType,
      width: checked.width ?? null,
      height: checked.height ?? null,
      uploadedById: user.id,
      createdAt: this.now(),
    };
    this.state.itemPhotos.push(row);
    this.recordItemEvent({
      itemId: item.id,
      type: "PHOTO_ADDED",
      actorId: user.id,
      photoId: row.id,
    });
    this.touch(item);
    return row;
  }

  async markInventoryLabelsPrinted(
    userId: string,
    itemIds: string[],
  ): Promise<void> {
    const user = this.requireUser(userId);
    if (!canInventory(user, "printLabels")) {
      throw new Error("Staff only");
    }
    const now = this.now();
    for (const id of itemIds) {
      const item = this.state.inventoryItems.find((i) => i.id === id);
      if (!item) continue;
      item.labelPrintedAt = now;
      this.touch(item);
      this.recordItemEvent({
        itemId: item.id,
        type: "LABEL_PRINTED",
        actorId: user.id,
      });
    }
  }

  async importInventoryCsv(
    userId: string,
    rows: InventoryCsvMappedRow[],
    dryRun: boolean,
  ): Promise<InventoryImportResult> {
    const user = this.requireUser(userId);
    if (!canInventory(user, "importCsv")) {
      throw new Error("Staff only");
    }
    const failed: InventoryImportResult["failed"] = [];
    const preview: InventoryImportResult["preview"] = [];
    let created = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const name = row.name?.trim();
      if (!name) {
        failed.push({ row: i + 1, reason: "Missing item name" });
        continue;
      }
      const photoLinks = row.photoLinks ?? {};
      const photoCount = Object.values(photoLinks).filter(Boolean).length;
      preview.push({
        row: i + 1,
        name,
        areaId: row.areaId ?? null,
        condition: row.condition,
        photoCount,
      });
      if (dryRun) continue;
      const photoKeys: CreateInventoryItemInput["photoKeys"] = [];
      for (const kind of ["FRONT", "SIDE", "SERIAL"] as PhotoKind[]) {
        const link = photoLinks[kind];
        if (!link) continue;
        try {
          const copied = await this.copyDrivePhoto(link, kind);
          if (copied) photoKeys.push(copied);
        } catch (err) {
          failed.push({
            row: i + 1,
            reason: `Photo ${kind}: ${err instanceof Error ? err.message : "copy failed"}`,
          });
        }
      }
      if (!photoKeys.some((p) => p.kind === "FRONT")) {
        photoKeys.push({
          storageKey: `fixture:import-${name.toLowerCase().replace(/\s+/g, "-")}-front`,
          kind: "FRONT",
          mimeType: "image/svg+xml",
        });
      }
      if (!photoKeys.some((p) => p.kind === "SIDE")) {
        photoKeys.push({
          storageKey: `fixture:import-${name.toLowerCase().replace(/\s+/g, "-")}-side`,
          kind: "SIDE",
          mimeType: "image/svg+xml",
        });
      }
      const item = await this.insertInventoryItem(
        userId,
        {
          name,
          model: row.model,
          manufacturer: row.manufacturer,
          serialNumber: row.serialNumber,
          noSerial: !row.serialNumber,
          quantity: row.quantity ?? 1,
          areaId: row.areaId,
          location: row.location,
          condition: row.condition,
          notes: row.notes
            ? `${row.notes}\nImported from Google Form`
            : "Imported from Google Form",
          photoKeys,
          continueDespiteDuplicate: true,
        },
        { trustedPhotos: true },
      );
      const createdEvent = this.state.itemEvents.find(
        (e) => e.itemId === item.id && e.type === "CREATED",
      );
      if (createdEvent) createdEvent.note = "Imported from Google Form";
      created += 1;
    }
    return { dryRun, created, failed, preview };
  }

  private async copyDrivePhoto(
    _link: string,
    _kind: PhotoKind,
  ): Promise<CreateInventoryItemInput["photoKeys"][number] | null> {
    // Drive copy lives in API/storage (server-only). Mock UI uses fixture placeholders.
    return null;
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
      openingHours: this.openingHours(),
      displayPhotos: this.state.displayPhotos,
      contentPages: this.state.contentPages,
      bounties: this.state.bounties,
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
      "bounties",
      "promos",
      "membership",
      "findus",
      "spotlight",
      "community",
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
    if (data.motion === "full" || data.motion === "calm") {
      this.state.displayConfig.motion = data.motion;
    }
    this.state.displayConfig.updatedAt = this.now();
    return structuredClone(this.state.displayConfig);
  }

  async listDisplayPhotos(): Promise<DisplayPhoto[]> {
    return (this.state.displayPhotos ?? [])
      .filter((p) => !p.deletedAt)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => structuredClone(p));
  }

  async saveDisplayPhoto(data: DisplayPhotoInput): Promise<DisplayPhoto> {
    const photos = (this.state.displayPhotos ??= []);
    const now = this.now();
    const caption =
      data.caption === undefined
        ? undefined
        : data.caption?.trim().slice(0, DISPLAY_CAPTION_MAX) || null;

    const existing = photos.find((p) => p.id === data.id && !p.deletedAt);
    if (existing) {
      if (caption !== undefined) existing.caption = caption;
      if (data.active !== undefined) existing.active = Boolean(data.active);
      if (data.sortOrder !== undefined && Number.isFinite(data.sortOrder)) {
        existing.sortOrder = Math.trunc(data.sortOrder);
      }
      existing.updatedAt = now;
      return structuredClone(existing);
    }

    // A new row stands for a file the upload route just stored, so it must
    // carry that route's id and the type the route worked out.
    if (!DISPLAY_PHOTO_ID.test(data.id) || !isPhotoMimeType(data.mimeType)) {
      throw new Error("Unknown photo");
    }
    const kept = photos.filter((p) => !p.deletedAt);
    if (kept.length >= DISPLAY_PHOTO_LIMIT) {
      throw new Error(
        `The display holds ${DISPLAY_PHOTO_LIMIT} photos at most. Delete one first.`,
      );
    }
    const size = (value: number | null | undefined): number | null =>
      typeof value === "number" && value > 0 && value < 100_000
        ? Math.round(value)
        : null;
    const photo: DisplayPhoto = {
      id: data.id,
      caption: caption ?? null,
      active: data.active ?? true,
      sortOrder:
        data.sortOrder !== undefined && Number.isFinite(data.sortOrder)
          ? Math.trunc(data.sortOrder)
          : Math.max(0, ...kept.map((p) => p.sortOrder)) + 1,
      mimeType: data.mimeType,
      width: size(data.width),
      height: size(data.height),
      createdAt: now,
      updatedAt: now,
    };
    photos.push(photo);
    return structuredClone(photo);
  }

  async deleteDisplayPhoto(id: string): Promise<void> {
    const photo = (this.state.displayPhotos ?? []).find(
      (p) => p.id === id && !p.deletedAt,
    );
    if (!photo) throw new Error("Photo not found");
    photo.deletedAt = this.now();
    photo.active = false;
    photo.updatedAt = this.now();
  }
}

/** Ids the photo upload route issues: a random UUID. */
const DISPLAY_PHOTO_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function createMockDataProvider(
  initialUserId?: string | null,
): MockDataProvider {
  return new MockDataProvider(loadFixtures(), initialUserId);
}
