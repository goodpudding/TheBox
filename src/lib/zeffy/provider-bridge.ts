import type { DataProvider } from "@/lib/data/provider";
import { isMembershipPayment } from "@/lib/zeffy/memberships";
import type {
  ZeffyApplyResult,
  ZeffyMembershipApplyResult,
  ZeffyPayment,
} from "@/lib/zeffy/types";

/** Apply a completed Zeffy ticket payment through the DataProvider. */
export async function applyZeffyPaymentViaProvider(
  provider: DataProvider,
  payment: ZeffyPayment,
  paidAtIso?: string,
): Promise<ZeffyApplyResult> {
  return provider.applyZeffyTicketPayment(payment, paidAtIso);
}

/** Apply a completed Zeffy membership payment through the DataProvider. */
export async function applyZeffyMembershipViaProvider(
  provider: DataProvider,
  payment: ZeffyPayment,
  paidAtIso?: string,
): Promise<ZeffyMembershipApplyResult> {
  return provider.applyZeffyMembershipPayment(payment, paidAtIso);
}

export async function applyZeffyWebhookPayment(
  provider: DataProvider,
  payment: ZeffyPayment,
  paidAtIso?: string,
): Promise<
  | { kind: "membership"; result: ZeffyMembershipApplyResult }
  | { kind: "ticket"; result: ZeffyApplyResult }
> {
  if (isMembershipPayment(payment)) {
    return {
      kind: "membership",
      result: await provider.applyZeffyMembershipPayment(payment, paidAtIso, {
        createIfMissing: true,
      }),
    };
  }
  return {
    kind: "ticket",
    result: await applyZeffyPaymentViaProvider(provider, payment, paidAtIso),
  };
}
