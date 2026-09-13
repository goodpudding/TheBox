import type { DataProvider } from "@/lib/data/provider";
import type { ZeffyApplyResult, ZeffyPayment } from "@/lib/zeffy/types";

/** Apply a completed Zeffy payment through the DataProvider. */
export async function applyZeffyPaymentViaProvider(
  provider: DataProvider,
  payment: ZeffyPayment,
  paidAtIso?: string,
): Promise<ZeffyApplyResult> {
  return provider.applyZeffyTicketPayment(payment, paidAtIso);
}
