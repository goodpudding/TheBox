import type { MembershipProduct, User } from "@/lib/data/types";
import { extractBuyerEmail } from "@/lib/zeffy/apply-payment";
import {
  inferBillingInterval,
  inferMembershipTier,
  isMembershipPayment,
} from "@/lib/zeffy/memberships";
import type {
  ZeffyMembershipApplyResult,
  ZeffyPayment,
} from "@/lib/zeffy/types";

export interface ZeffyMemberStore {
  findAppliedPayment(paymentId: string): { userId: string } | null;
  findUserByEmail(email: string): User | null;
  findProductByCampaignAndRate(
    campaignId: string,
    rateId?: string | null,
  ): MembershipProduct | null;
  upsertMemberFromZeffy(input: {
    email: string;
    firstName: string;
    lastName: string;
    paymentId: string;
    paidAt: string;
    tier: User["tier"];
    billingInterval: User["billingInterval"];
    shopAccess: boolean;
    createIfMissing: boolean;
  }): User | null;
}

/**
 * Map a completed Zeffy membership payment onto a portal user.
 * Idempotent on payment id. Optionally creates a member when email is new.
 */
export function applyZeffyMembershipToStore(
  payment: ZeffyPayment,
  store: ZeffyMemberStore,
  options?: { createIfMissing?: boolean; paidAtIso?: string },
): ZeffyMembershipApplyResult {
  const existing = store.findAppliedPayment(payment.id);
  if (existing) {
    return { status: "duplicate", userId: existing.userId };
  }

  if (!isMembershipPayment(payment)) {
    return {
      status: "ignored",
      reason: "not_membership",
      detail: payment.campaign_category,
    };
  }

  const email = extractBuyerEmail(payment);
  if (!email) {
    return { status: "ignored", reason: "no_email" };
  }

  const createIfMissing = options?.createIfMissing ?? false;
  const already = store.findUserByEmail(email);
  if (!already && !createIfMissing) {
    return { status: "ignored", reason: "no_member", detail: email };
  }

  const rateId = payment.items?.find((i) => i.rate_id)?.rate_id ?? null;
  const product = store.findProductByCampaignAndRate(
    payment.campaign_id,
    rateId,
  );

  const rateTitle =
    payment.items?.find((i) => i.rate_title)?.rate_title ??
    product?.name ??
    "Membership";
  const amount = payment.items?.[0]?.amount ?? payment.amount;
  const recurrence =
    payment.items?.find((i) => i.recurrence_interval)?.recurrence_interval ??
    payment.recurring?.interval ??
    null;

  const tier = product?.tier ?? inferMembershipTier(rateTitle, amount);
  const billingInterval =
    product?.billingInterval ?? inferBillingInterval(rateTitle, recurrence);
  const shopAccess = product?.shopAccess ?? tier !== "friend";

  const paidAt =
    options?.paidAtIso ??
    new Date((payment.created || Date.now() / 1000) * 1000).toISOString();

  const user = store.upsertMemberFromZeffy({
    email,
    firstName: payment.buyer?.first_name?.trim() ?? "",
    lastName: payment.buyer?.last_name?.trim() ?? "",
    paymentId: payment.id,
    paidAt,
    tier,
    billingInterval,
    shopAccess,
    createIfMissing,
  });

  if (!user) {
    return { status: "ignored", reason: "no_member", detail: email };
  }

  return {
    status: "applied",
    userId: user.id,
    created: !already,
    tier,
  };
}

export function membershipUserIdFromEmail(email: string): string {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `u-zeffy-${(h >>> 0).toString(16).padStart(8, "0")}`;
}
