import type {
  BillingInterval,
  MembershipProduct,
  MembershipTier,
} from "@/lib/data/types";
import type {
  ZeffyCampaign,
  ZeffyPayment,
  ZeffyRate,
} from "@/lib/zeffy/types";

const GENERIC_RATE_NAME = /^memberships?$/i;

export function isMembershipCategory(category?: string | null): boolean {
  return (category ?? "").toLowerCase().includes("membership");
}

/** Membership programs are ticketing campaigns with a membership category. */
export function isMembershipCampaign(campaign: {
  category?: string | null;
  type?: string | null;
}): boolean {
  return isMembershipCategory(campaign.category);
}

export function isMembershipPayment(payment: ZeffyPayment): boolean {
  return isMembershipCategory(payment.campaign_category);
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\bLXCL:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferMembershipTier(
  name: string,
  priceCents: number,
): MembershipTier {
  const n = name.toLowerCase();
  if (/\bday pass\b/.test(n) || /(^|\s)day(\s|$)/.test(n)) return "day";
  if (/\bstudent\b/.test(n) || /\byouth\b/.test(n)) return "community";
  if (/\bcommunity\b/.test(n) && !/\blab\b/.test(n)) return "community";
  if (n.includes("household")) return "household_addon";
  if (n.includes("patron")) return "patron";
  if (n.includes("friend")) return "friend";
  if (n.includes("scholarship")) return "scholarship";
  if (n.includes("steward")) return "shop_steward";
  if (n.includes("unlimited")) return "unlimited";
  if (/\bteam\b/.test(n)) return "team";
  if (n.includes("pro") || /\bplus\b/.test(n)) return "maker_pro";
  if (n.includes("maker")) return "maker";
  if (priceCents === 7500) return "maker_pro";
  if (priceCents === 2000) return "community";
  if (priceCents === 0) return "scholarship";
  return "maker";
}

export function inferBillingInterval(
  name: string,
  recurrence?: string | null,
): BillingInterval {
  const blob = `${name} ${recurrence ?? ""}`.toLowerCase();
  if (/\bday\b/.test(blob) || blob.includes("daily")) return "daily";
  if (blob.includes("annual") || blob.includes("year")) return "annual";
  if (blob.includes("none") || blob.includes("one-time") || blob.includes("once")) {
    return "none";
  }
  return "monthly";
}

export function membershipProductIdForRate(rateId: string): string {
  return `mp-zeffy-${rateId}`;
}

const FALLBACK_SUMMARY =
  "Checkout stays on Zeffy. After you pay, this portal handles your account, waiver, certifications, and shop access.";

export function mapRateToMembershipProduct(input: {
  campaign: ZeffyCampaign;
  rate: ZeffyRate;
  sortOrder: number;
  highlight: boolean;
  nowIso: string;
}): MembershipProduct {
  const { campaign, rate, sortOrder, highlight, nowIso } = input;
  const rateTitle = rate.title?.trim() || "Membership";
  const rates = campaign.rates ?? [rate];
  const generic = GENERIC_RATE_NAME.test(rateTitle);
  const name =
    rates.length === 1 && generic && campaign.title.trim()
      ? campaign.title.trim()
      : rateTitle;

  const rateSummary = stripHtml(rate.description);
  const campaignSummary = stripHtml(campaign.description);
  const onlyRate = (campaign.rates ?? [rate]).length <= 1;
  const summary =
    rateSummary || (onlyRate ? campaignSummary : "") || FALLBACK_SUMMARY;

  const joinable = campaign.status === "active" && !campaign.is_archived;
  // Infer tier from the Zeffy rate title, not the campaign/org name
  // ("Lamp Community Lab" would otherwise match "community").
  const tier = inferMembershipTier(rateTitle, rate.amount);
  const billingInterval = inferBillingInterval(rateTitle, null);

  return {
    id: membershipProductIdForRate(rate.id),
    tier,
    name,
    summary,
    priceCents: rate.amount,
    billingInterval,
    annualPriceCents: null,
    shopAccess: tier !== "friend",
    phase: 1,
    visibleOnJoin: joinable,
    joinable,
    highlight,
    sortOrder,
    isAddOn: Boolean(rate.is_add_on) || tier === "household_addon",
    cappedSeats: rate.seats ?? null,
    zeffyCampaignId: campaign.id,
    zeffyRateId: rate.id,
    zeffyUrl: campaign.url,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export interface ZeffyCatalogSkip {
  id: string;
  title: string;
  reason: string;
}

export interface ZeffyMembershipCatalog {
  products: MembershipProduct[];
  campaigns: Array<{
    id: string;
    title: string;
    status: string;
    url: string | null;
    rateCount: number;
  }>;
  skipped: ZeffyCatalogSkip[];
  primaryUrl: string | null;
}

export function catalogFromMembershipCampaigns(
  campaigns: ZeffyCampaign[],
  nowIso: string = new Date().toISOString(),
): ZeffyMembershipCatalog {
  const products: MembershipProduct[] = [];
  const skipped: ZeffyCatalogSkip[] = [];
  const listed: ZeffyMembershipCatalog["campaigns"] = [];
  let sortOrder = 10;

  for (const campaign of campaigns) {
    listed.push({
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      url: campaign.url,
      rateCount: (campaign.rates ?? []).length,
    });

    if (campaign.is_archived) {
      skipped.push({
        id: campaign.id,
        title: campaign.title,
        reason: "archived",
      });
      continue;
    }
    if (campaign.status !== "active") {
      skipped.push({
        id: campaign.id,
        title: campaign.title,
        reason: `status:${campaign.status || "unknown"}`,
      });
      continue;
    }

    const rates = (campaign.rates ?? []).filter((r) => r?.id);
    if (!rates.length) {
      skipped.push({
        id: campaign.id,
        title: campaign.title,
        reason: "no_rates",
      });
      continue;
    }

    const highlightIndex = 0;
    rates.forEach((rate, i) => {
      products.push(
        mapRateToMembershipProduct({
          campaign: { ...campaign, rates },
          rate,
          sortOrder,
          highlight: i === highlightIndex && rates.length === 1,
          nowIso,
        }),
      );
      sortOrder += 10;
    });
  }

  const primaryUrl =
    products.find((p) => p.zeffyUrl)?.zeffyUrl ??
    listed.find((c) => c.status === "active" && c.url)?.url ??
    null;

  return { products, campaigns: listed, skipped, primaryUrl };
}

export async function fetchZeffyMembershipCatalog(): Promise<ZeffyMembershipCatalog> {
  const { getZeffyCampaign, listAllZeffyCampaigns } = await import(
    "@/lib/zeffy/client"
  );
  const all = await listAllZeffyCampaigns();
  const membership = all.filter(isMembershipCampaign);
  const detailed: ZeffyCampaign[] = [];
  for (const campaign of membership) {
    detailed.push(await getZeffyCampaign(campaign.id));
  }
  return catalogFromMembershipCampaigns(detailed);
}

let catalogCache: { at: number; value: ZeffyMembershipCatalog } | null = null;
const CATALOG_TTL_MS = 60_000;

export async function getCachedZeffyMembershipCatalog(
  force = false,
): Promise<ZeffyMembershipCatalog> {
  const now = Date.now();
  if (
    !force &&
    catalogCache &&
    now - catalogCache.at < CATALOG_TTL_MS
  ) {
    return catalogCache.value;
  }
  const value = await fetchZeffyMembershipCatalog();
  catalogCache = { at: now, value };
  return value;
}

export function clearZeffyMembershipCatalogCache(): void {
  catalogCache = null;
}
