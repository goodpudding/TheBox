import { cleanContentHtml, contentHtmlHasText } from "@/lib/data/content-html";
import { isMembershipCampaign } from "@/lib/zeffy/memberships";
import type { ZeffyCampaign, ZeffyRate } from "@/lib/zeffy/types";
import type { ClassSession, ClassSource } from "@/lib/data/types";

export const SHOP_ADDRESS = "611 SW 152nd St, Burien, WA";
export const SINGLE_OCCURRENCE_ID = "default";
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface ClassSyncRow {
  id: string;
  title: string;
  slug: string;
  descriptionSlug: string;
  category: ClassSession["category"];
  instructorId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  priceCents: number;
  zeffyUrl: string | null;
  zeffyCampaignId: string | null;
  zeffyOccurrenceId: string | null;
  source: ClassSource;
  location: string;
  published: boolean;
  cancelledAt: string | null;
  staffEditedFields: string[] | null;
  prerequisiteCertificationIds: string[];
  cancellationCutoffHours: number | null;
}

export interface PlannedClass {
  id: string | null;
  existing: ClassSyncRow | null;
  fields: Omit<ClassSyncRow, "id" | "staffEditedFields">;
}

/** What an event's Zeffy page says about it, to keep as a class page. */
export interface PlannedDescription {
  /** The content page's slug: one page per Zeffy event, shared by its dates. */
  slug: string;
  title: string;
  html: string;
}

export interface ClassSyncPlan {
  upserts: PlannedClass[];
  /** One per listed event that has a description on Zeffy. */
  descriptions: PlannedDescription[];
  cancelIds: string[];
  created: number;
  updated: number;
  cancelled: number;
}

export function zeffyTimeToIso(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const ms = value > 1e12 ? value : value * 1000;
  return new Date(ms).toISOString();
}

export function lowestPriceCents(rates: ZeffyRate[] | undefined): number {
  const amounts = (rates ?? [])
    .filter((rate) => !rate.is_add_on)
    .map((rate) => rate.amount)
    .filter((amount) => Number.isFinite(amount) && amount > 0);
  if (amounts.length === 0) return 0;
  return Math.min(...amounts);
}

export function capacityFromRates(
  rates: ZeffyRate[] | undefined,
  fallback: number,
): number {
  const seats = (rates ?? [])
    .map((rate) => rate.seats)
    .filter((seats): seats is number => typeof seats === "number" && seats > 0);
  if (seats.length === 0) return fallback;
  return seats.reduce((sum, n) => sum + n, 0);
}

function campaignEndMs(campaign: ZeffyCampaign): number | null {
  const times = [
    campaign.end_date,
    ...(campaign.occurrences ?? []).map((item) => item.end),
  ]
    .map((value) => {
      const iso = zeffyTimeToIso(value);
      return iso ? new Date(iso).getTime() : null;
    })
    .filter((value): value is number => value != null);
  if (times.length === 0) return null;
  return Math.max(...times);
}

export function isClassCampaign(campaign: ZeffyCampaign): boolean {
  if (campaign.type === "donation_form") return false;
  if (isMembershipCampaign(campaign)) return false;
  return true;
}

export function campaignInWindow(campaign: ZeffyCampaign, now: Date): boolean {
  const end = campaignEndMs(campaign);
  if (end == null) return !campaign.is_archived;
  return end >= now.getTime() - WINDOW_MS;
}

function isCancelledCampaign(campaign: ZeffyCampaign): boolean {
  if (campaign.is_archived) return true;
  const status = campaign.status.toLowerCase();
  return status === "archived" || status === "cancelled" || status === "canceled";
}

function occurrenceKey(campaignId: string, occurrenceId: string): string {
  return `${campaignId}:${occurrenceId}`;
}

function slugFor(campaignId: string, occurrenceId: string): string {
  const a = campaignId.replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase();
  const b = occurrenceId.replace(/[^a-z0-9]/gi, "").slice(0, 10).toLowerCase();
  return `zeffy-${a}-${b}`;
}

const ZEFFY_DESCRIPTION_PREFIX = "class-zeffy-";

/** Slug of the page that holds one Zeffy event's description. */
export function zeffyDescriptionSlug(campaignId: string): string {
  const id = campaignId.replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 60);
  return `${ZEFFY_DESCRIPTION_PREFIX}${id}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * A Zeffy description as HTML the site will show, or null when there is
 * nothing to read. Zeffy sends HTML; plain text is turned into paragraphs.
 * Either way only the tags a staff-written page may hold are kept.
 */
export function zeffyDescriptionHtml(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const marked = /<[a-z][^>]*>/i.test(text)
    ? text
    : text
        .split(/\n\s*\n/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br />")}</p>`)
        .join("");
  const html = cleanContentHtml(marked);
  return contentHtmlHasText(html) ? html : null;
}

function applyStaffEdits(
  existing: ClassSyncRow,
  next: Omit<ClassSyncRow, "id" | "staffEditedFields">,
): Omit<ClassSyncRow, "id" | "staffEditedFields"> {
  const owned = new Set(existing.staffEditedFields ?? []);
  const merged = { ...next };
  for (const key of owned) {
    if (key in existing) {
      (merged as Record<string, unknown>)[key] = (existing as unknown as Record<string, unknown>)[key];
    }
  }
  return merged;
}

/**
 * Decide which Zeffy events become class rows. Does not touch csv or admin rows.
 */
export function planClassSync(input: {
  campaigns: ZeffyCampaign[];
  existing: ClassSyncRow[];
  now: Date;
  defaultInstructorId: string | null;
  defaultCapacity: number;
  shopAddress?: string;
}): ClassSyncPlan {
  const address = input.shopAddress ?? SHOP_ADDRESS;
  const zeffyRows = input.existing.filter((row) => row.source === "zeffy");
  const byKey = new Map(
    zeffyRows
      .filter((row) => row.zeffyCampaignId)
      .map((row) => [
        occurrenceKey(row.zeffyCampaignId!, row.zeffyOccurrenceId ?? SINGLE_OCCURRENCE_ID),
        row,
      ]),
  );
  const seen = new Set<string>();
  const upserts: PlannedClass[] = [];
  const descriptions: PlannedDescription[] = [];
  let created = 0;
  let updated = 0;

  for (const campaign of input.campaigns) {
    if (!isClassCampaign(campaign) || !campaignInWindow(campaign, input.now)) {
      continue;
    }
    const cancelled = isCancelledCampaign(campaign);
    const descriptionHtml = zeffyDescriptionHtml(campaign.description);
    const descriptionSlug = zeffyDescriptionSlug(campaign.id);
    let listed = false;
    const occurrences =
      campaign.occurrences && campaign.occurrences.length > 0
        ? campaign.occurrences
        : [
            {
              id: SINGLE_OCCURRENCE_ID,
              start: campaign.start_date ?? 0,
              end: campaign.end_date ?? campaign.start_date ?? 0,
              is_archived: false,
            },
          ];

    for (const occurrence of occurrences) {
      const occurrenceId = occurrence.id || SINGLE_OCCURRENCE_ID;
      const key = occurrenceKey(campaign.id, occurrenceId);
      seen.add(key);
      const existing = byKey.get(key) ?? null;
      const startsAt =
        zeffyTimeToIso(occurrence.start) ??
        zeffyTimeToIso(campaign.start_date) ??
        input.now.toISOString();
      const endsAt =
        zeffyTimeToIso(occurrence.end) ??
        zeffyTimeToIso(campaign.end_date) ??
        startsAt;
      if (new Date(endsAt).getTime() < input.now.getTime()) {
        continue;
      }
      const priceCents = lowestPriceCents(campaign.rates);
      const fields: Omit<ClassSyncRow, "id" | "staffEditedFields"> = {
        title: campaign.title,
        slug: existing?.slug ?? slugFor(campaign.id, occurrenceId),
        // The event's own words when Zeffy has some. Without them, whatever
        // the class pointed at before, unless that was a Zeffy description
        // that has since been removed. A description staff wrote on the site
        // wins either way (applyStaffEdits below).
        descriptionSlug: descriptionHtml
          ? descriptionSlug
          : existing && !existing.descriptionSlug.startsWith(ZEFFY_DESCRIPTION_PREFIX)
            ? existing.descriptionSlug
            : "class-generic",
        category: priceCents > 0 ? "workshop" : "open_studio",
        instructorId: input.defaultInstructorId ?? existing?.instructorId ?? "",
        startsAt,
        endsAt,
        capacity: capacityFromRates(campaign.rates, input.defaultCapacity),
        priceCents,
        zeffyUrl: campaign.url,
        zeffyCampaignId: campaign.id,
        zeffyOccurrenceId: occurrenceId,
        source: "zeffy",
        location: campaign.location?.trim() || address,
        published: true,
        cancelledAt:
          cancelled || occurrence.is_archived ? input.now.toISOString() : null,
        prerequisiteCertificationIds: existing?.prerequisiteCertificationIds ?? [],
        cancellationCutoffHours: existing?.cancellationCutoffHours ?? null,
      };
      if (!existing && !input.defaultInstructorId) continue;
      if (!existing && fields.cancelledAt) continue;
      const merged = existing ? applyStaffEdits(existing, fields) : fields;
      if (existing?.cancelledAt && !fields.cancelledAt && !(existing.staffEditedFields ?? []).includes("cancelledAt")) {
        merged.cancelledAt = null;
      }
      upserts.push({ id: existing?.id ?? null, existing, fields: merged });
      listed = true;
      if (existing) updated += 1;
      else created += 1;
    }
    if (listed && descriptionHtml) {
      descriptions.push({
        slug: descriptionSlug,
        title: campaign.title,
        html: descriptionHtml,
      });
    }
  }

  const cancelIds: string[] = [];
  for (const row of zeffyRows) {
    if (row.cancelledAt) continue;
    const ended = new Date(row.endsAt).getTime() < input.now.getTime();
    const key = occurrenceKey(
      row.zeffyCampaignId ?? "",
      row.zeffyOccurrenceId ?? SINGLE_OCCURRENCE_ID,
    );
    if (ended || !seen.has(key)) cancelIds.push(row.id);
  }

  return {
    upserts,
    descriptions,
    cancelIds,
    created,
    updated,
    cancelled: cancelIds.length,
  };
}
