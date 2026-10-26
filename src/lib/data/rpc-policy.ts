import type { DataProvider } from "./provider";
import type { User } from "./types";
import { isStaffRole } from "./access";

export type DataMethod = keyof DataProvider;

type Access = "public" | "user" | "staff" | "dev";

type Rule = {
  access: Access;
  /** -1 when the method has no acting-user argument. */
  arg: number;
  /** When set, `args[arg]` is an object and these fields are the acting user. */
  field?: string | readonly string[];
};

/**
 * Every DataProvider method. A missing key fails typecheck and the route test.
 * `arg: -1` means nothing is rewritten. Otherwise that argument (or `field` on
 * it) is the acting user and is replaced with the session id for non-staff.
 */
export const RPC_RULES = {
  getCurrentUser: { access: "public", arg: -1 },
  setCurrentUserId: { access: "dev", arg: -1 },
  listSwitchableUsers: { access: "dev", arg: -1 },
  getOnboardingState: { access: "user", arg: 0 },
  getMember: { access: "user", arg: 0 },
  updateMemberProfile: { access: "user", arg: 0 },
  getWaiver: { access: "user", arg: -1 },
  signWaiver: { access: "user", arg: 0, field: "userId" },
  listWaiverHistory: { access: "user", arg: 0 },
  acknowledgePolicy: { access: "user", arg: 0, field: "userId" },
  listBadges: { access: "user", arg: 0 },
  listCertifications: { access: "public", arg: -1 },
  getCertifications: { access: "user", arg: 0 },
  getUsage: { access: "user", arg: 0 },
  getUsageTotals: { access: "user", arg: 0 },
  getCreditWallet: { access: "user", arg: 0 },
  listClasses: { access: "public", arg: -1 },
  getClass: { access: "public", arg: -1 },
  book: { access: "user", arg: 1 },
  cancel: { access: "user", arg: 1 },
  payBookingWithCredits: { access: "user", arg: 1 },
  listReservations: { access: "user", arg: 0, field: "userId" },
  reserve: { access: "user", arg: 0, field: ["userId", "createdById"] },
  cancelReservation: { access: "user", arg: 1 },
  listMachines: { access: "public", arg: -1 },
  getMachineAvailability: { access: "user", arg: -1 },
  listModules: { access: "public", arg: -1 },
  getModule: { access: "public", arg: -1 },
  markLessonComplete: { access: "user", arg: 1 },
  markVideoWatched: { access: "user", arg: 1 },
  getQuestionBank: { access: "user", arg: -1 },
  startQuiz: { access: "user", arg: 1 },
  submitQuiz: { access: "user", arg: 0, field: "userId" },
  getModulePublishReadiness: { access: "staff", arg: -1 },
  listPendingCheckoffs: { access: "user", arg: 0 },
  recordCheckoff: { access: "user", arg: 0, field: "actorId" },
  listPolicies: { access: "public", arg: -1 },
  getContentBySlug: { access: "public", arg: -1 },
  listPeople: { access: "public", arg: -1 },
  listVolunteerRoles: { access: "public", arg: -1 },
  submitVolunteerInterest: { access: "public", arg: 0, field: "userId" },
  listBounties: { access: "public", arg: -1 },
  getBounty: { access: "public", arg: -1 },
  submitBountyRequest: { access: "public", arg: 0, field: "userId" },
  claimBounty: { access: "user", arg: 1 },
  completeBounty: { access: "user", arg: 1 },
  listInventoryAreas: { access: "user", arg: -1 },
  listAreaStewards: { access: "user", arg: -1 },
  upsertInventoryArea: { access: "user", arg: 0 },
  listInventoryManufacturers: { access: "user", arg: -1 },
  listInventoryLocations: { access: "user", arg: -1 },
  pendingInventoryCount: { access: "user", arg: 0 },
  listInventoryItems: { access: "user", arg: 0 },
  getInventoryItem: { access: "user", arg: 0 },
  findInventoryBySerial: { access: "user", arg: -1 },
  createInventoryItem: { access: "user", arg: 0 },
  updateInventoryItem: { access: "user", arg: 0 },
  reviewInventoryItem: { access: "user", arg: 0 },
  changeInventoryStatus: { access: "user", arg: 0 },
  moveInventoryItem: { access: "user", arg: 0 },
  reportInventoryIssue: { access: "user", arg: 0 },
  retireInventoryItem: { access: "user", arg: 0 },
  addInventoryPhoto: { access: "user", arg: 0 },
  markInventoryLabelsPrinted: { access: "user", arg: 0 },
  importInventoryCsv: { access: "user", arg: 0 },
  getWishlistCatalog: { access: "public", arg: -1 },
  reportWishlistPurchase: { access: "public", arg: 0, field: "userId" },
  adminListWishlistPurchaseReports: { access: "staff", arg: -1 },
  adminConfirmWishlistPurchase: { access: "staff", arg: 1 },
  adminDismissWishlistPurchase: { access: "staff", arg: 1 },
  adminMarkWishlistPurchased: { access: "staff", arg: 1 },
  getSettings: { access: "public", arg: -1 },
  listMembershipProducts: { access: "public", arg: -1 },
  getScholarshipFundSummary: { access: "public", arg: -1 },
  listBookingsForUser: { access: "user", arg: 0 },
  listInterestBoards: { access: "public", arg: -1 },
  getInterestBoard: { access: "public", arg: 1 },
  proposeInterestBoard: { access: "public", arg: 0, field: "proposedByUserId" },
  joinInterestBoard: { access: "public", arg: 0, field: "userId" },
  leaveInterestBoard: { access: "public", arg: 1, field: "userId" },
  listInterestSignups: { access: "staff", arg: -1 },
  resuggestInterestBoard: { access: "user", arg: 1 },
  adminListMembers: { access: "staff", arg: -1 },
  adminUpdateMemberStatus: { access: "staff", arg: 2 },
  adminSetMemberTeacher: { access: "staff", arg: 2 },
  adminGrantCredits: { access: "staff", arg: 0, field: "actorId" },
  adminApproveInterestBoard: { access: "staff", arg: 1 },
  adminRejectInterestBoard: { access: "staff", arg: 1 },
  adminUpdateInterestBoard: { access: "staff", arg: -1 },
  adminLinkInterestBoardToClass: { access: "staff", arg: 2 },
  adminListBadges: { access: "staff", arg: -1 },
  adminLinkBadge: { access: "staff", arg: 2 },
  adminUnlinkBadge: { access: "staff", arg: 1 },
  adminRecordCheckoff: { access: "staff", arg: 0, field: "actorId" },
  adminRevokeCertification: { access: "staff", arg: 0, field: "actorId" },
  adminUpsertCertification: { access: "staff", arg: -1 },
  adminUpsertClass: { access: "staff", arg: -1 },
  adminListRoster: { access: "staff", arg: -1 },
  adminMarkBookingPaid: { access: "staff", arg: 1 },
  applyZeffyPaymentToBooking: { access: "staff", arg: -1 },
  createBookingFromZeffyPayment: { access: "staff", arg: -1 },
  findBookingByZeffyPaymentId: { access: "staff", arg: -1 },
  applyZeffyTicketPayment: { access: "staff", arg: -1 },
  applyZeffyMembershipPayment: { access: "staff", arg: -1 },
  adminMarkAttendance: { access: "staff", arg: 2 },
  adminPromoteFromWaitlist: { access: "staff", arg: 1 },
  adminCreateReservation: { access: "staff", arg: 0, field: "createdById" },
  adminCancelReservation: { access: "staff", arg: 1 },
  adminUpsertMaintenanceBlock: { access: "staff", arg: 0, field: "createdById" },
  adminListMaintenanceBlocks: { access: "staff", arg: -1 },
  getToolChampionProgress: { access: "user", arg: 0 },
  listToolChampionTerms: { access: "user", arg: 0 },
  requestToolChampionTerm: { access: "user", arg: 0, field: "userId" },
  adminActivateToolChampionTerm: { access: "staff", arg: 1 },
  adminCompleteToolChampionTerm: { access: "staff", arg: 1 },
  adminUpsertModule: { access: "staff", arg: -1 },
  adminUpsertLesson: { access: "staff", arg: -1 },
  adminUpsertQuestion: { access: "staff", arg: -1 },
  adminDeleteQuestion: { access: "staff", arg: -1 },
  adminListQuestions: { access: "staff", arg: -1 },
  adminUpsertVideo: { access: "staff", arg: -1 },
  adminDeleteVideo: { access: "staff", arg: -1 },
  adminSetVideoReviewed: { access: "staff", arg: -1 },
  adminListVideos: { access: "staff", arg: -1 },
  adminPublishModule: { access: "staff", arg: -1 },
  adminUpsertMachine: { access: "staff", arg: -1 },
  adminListUsage: { access: "staff", arg: -1 },
  adminListAccessLogs: { access: "staff", arg: -1 },
  adminListVolunteerInterests: { access: "staff", arg: -1 },
  adminUpdateVolunteerInterest: { access: "staff", arg: -1 },
  adminListContentMappings: { access: "staff", arg: -1 },
  adminSyncContent: { access: "staff", arg: -1 },
  adminUpdateSettings: { access: "staff", arg: -1 },
  adminListAuditEvents: { access: "staff", arg: -1 },
  getDisplayFeed: { access: "public", arg: -1 },
  getMachineStatus: { access: "public", arg: -1 },
  listPromos: { access: "staff", arg: -1 },
  savePromo: { access: "staff", arg: -1 },
  deletePromo: { access: "staff", arg: -1 },
  getDisplayConfig: { access: "staff", arg: -1 },
  saveDisplayConfig: { access: "staff", arg: -1 },
  authorizeAccess: { access: "staff", arg: -1 },
  endAccess: { access: "staff", arg: -1 },
  getAllowlist: { access: "staff", arg: -1 },
} as const satisfies Record<DataMethod, Rule>;

/** Index of the acting-user argument, or -1 when the method has none. */
export const ACTOR_ARG_INDEX: Record<DataMethod, number> = Object.fromEntries(
  (Object.keys(RPC_RULES) as DataMethod[]).map((name) => [
    name,
    RPC_RULES[name].arg,
  ]),
) as Record<DataMethod, number>;

const DEV_BLOCKED = new Set(["setCurrentUserId", "listSwitchableUsers", "getState"]);

export function devToolsLocked(
  env: { NODE_ENV?: string; NEXT_PUBLIC_DEMO_MODE?: string } = process.env,
): boolean {
  return env.NODE_ENV === "production" && env.NEXT_PUBLIC_DEMO_MODE !== "true";
}

export type RpcSuccess = { status: 200; body: { ok: true; result: unknown } };
export type RpcFailure = {
  status: number;
  body: { ok: false; error: string };
};
export type RpcResponse = RpcSuccess | RpcFailure;

function pinArgs(
  method: DataMethod,
  args: unknown[],
  userId: string,
): unknown[] {
  const rule = RPC_RULES[method] as Rule;
  if (rule.arg < 0) return args;
  const next = args.slice();
  if (rule.field) {
    const current = next[rule.arg];
    const base =
      current && typeof current === "object" && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : {};
    const fields = Array.isArray(rule.field) ? rule.field : [rule.field];
    for (const field of fields) base[field] = userId;
    next[rule.arg] = base;
    return next;
  }
  next[rule.arg] = userId;
  return next;
}

export async function handleDataRpc(input: {
  method: unknown;
  args: unknown;
  sessionUser: User | null;
  provider: DataProvider;
  productionLocked?: boolean;
}): Promise<RpcResponse> {
  const method = typeof input.method === "string" ? input.method : "";
  const args = Array.isArray(input.args) ? input.args : null;
  if (!method || !args) {
    return { status: 400, body: { ok: false, error: "method and args are required" } };
  }

  const locked = input.productionLocked ?? devToolsLocked();
  if (DEV_BLOCKED.has(method) && locked) {
    return { status: 403, body: { ok: false, error: "Not available in production" } };
  }

  if (!(method in RPC_RULES)) {
    return { status: 400, body: { ok: false, error: `Unknown method: ${method}` } };
  }

  const name = method as DataMethod;
  const rule = RPC_RULES[name];
  const staff = isStaffRole(input.sessionUser);

  if (rule.access === "staff" || name.startsWith("admin")) {
    if (!input.sessionUser) {
      return { status: 401, body: { ok: false, error: "Sign in required" } };
    }
    if (!staff) {
      return { status: 403, body: { ok: false, error: "Staff only" } };
    }
  } else if (rule.access === "user") {
    if (!input.sessionUser) {
      return { status: 401, body: { ok: false, error: "Sign in required" } };
    }
  }

  const pinned =
    input.sessionUser && !staff
      ? pinArgs(name, args, input.sessionUser.id)
      : args;

  const fn = input.provider[name] as (...a: unknown[]) => Promise<unknown>;
  try {
    const result = await fn.apply(input.provider, pinned);
    return { status: 200, body: { ok: true, result } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return { status: 200, body: { ok: false, error: message } };
  }
}
