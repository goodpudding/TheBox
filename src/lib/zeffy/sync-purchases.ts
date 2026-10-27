import { createServerDataProvider } from "@/lib/data/factory";
import { getZeffyApiKey } from "@/lib/zeffy/config";
import { listAllZeffyPayments, getZeffyCampaign } from "@/lib/zeffy/client";
import { extractBuyerEmail } from "@/lib/zeffy/apply-payment";
import { isMembershipCampaign, isMembershipPayment } from "@/lib/zeffy/memberships";
import { applyZeffyWebhookPayment } from "@/lib/zeffy/provider-bridge";
import type { ZeffyPayment } from "@/lib/zeffy/types";

const PAID = /succeed|complete|paid|success/i;

function isPaid(payment: ZeffyPayment): boolean {
  if (!payment.status) return true;
  return PAID.test(payment.status);
}

async function asMembershipPayment(payment: ZeffyPayment): Promise<ZeffyPayment> {
  if (isMembershipPayment(payment) || !payment.campaign_id) return payment;
  try {
    const campaign = await getZeffyCampaign(payment.campaign_id);
    if (!isMembershipCampaign(campaign)) return payment;
    return { ...payment, campaign_category: campaign.category };
  } catch {
    return payment;
  }
}

/** Pull recent Zeffy payments for one email and apply membership (and class tickets). */
export async function syncZeffyPurchasesForEmail(
  email: string,
): Promise<{ checked: number; applied: number }> {
  if (!getZeffyApiKey()) return { checked: 0, applied: 0 };
  const since = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
  const payments = await listAllZeffyPayments({ createdGte: since });
  const mine = payments.filter(
    (payment) => extractBuyerEmail(payment) === email.trim().toLowerCase() && isPaid(payment),
  );
  const provider = await createServerDataProvider(null);
  let applied = 0;
  for (const payment of mine) {
    const normalized = await asMembershipPayment(payment);
    const outcome = await applyZeffyWebhookPayment(provider, normalized);
    if (outcome.result.status === "applied") applied += 1;
  }
  return { checked: mine.length, applied };
}
