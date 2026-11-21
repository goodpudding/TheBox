import { prisma } from "@/lib/db";
import {
  DEFAULT_RATE_CARD,
  RATE_CARD_RECORD_ID,
  normalizeRateCard,
  type RateCard,
} from "@/lib/rate-card";

/**
 * The card jobs are priced from, read straight from the database: the
 * workstation routes do not go through the data provider.
 *
 * Read it once per request and pass it to everything that prices, so the
 * hint on the desk, the estimate and the charge all use the same numbers. A
 * database error is thrown, not swallowed: a job that cannot be priced from
 * the shop's card is not sent. A row that is there but is not JSON is logged
 * and treated as no card, the same as the rest of the site treats it.
 */
export async function loadRateCard(): Promise<RateCard> {
  const row = await prisma.siteRecord.findUnique({
    where: { id: RATE_CARD_RECORD_ID },
  });
  if (!row) return { ...DEFAULT_RATE_CARD };
  try {
    return normalizeRateCard(JSON.parse(row.data));
  } catch {
    console.error(
      JSON.stringify({ siteRecord: RATE_CARD_RECORD_ID, error: "unreadable JSON" }),
    );
    return { ...DEFAULT_RATE_CARD };
  }
}
