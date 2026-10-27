import { prisma } from "@/lib/db";
import { listAllZeffyCampaigns, getZeffyCampaign } from "@/lib/zeffy/client";
import type { ZeffyCampaign } from "@/lib/zeffy/types";
import type { ClassSource } from "@/lib/data/types";
import {
  campaignInWindow,
  isClassCampaign,
  planClassSync,
  type ClassSyncRow,
} from "@/lib/sync/zeffy-classes";
import {
  applyCalendarOps,
  calendarAccount,
  fetchCalendarAccessToken,
  getCalendarIds,
  planCalendarOps,
  type CalendarOp,
  type CalendarSession,
} from "@/lib/sync/google-calendar";

export interface ClassSyncCounts {
  created: number;
  updated: number;
  cancelled: number;
  pulled: number;
  calendar: { created: number; updated: number; deleted: number; errors: string[] };
  lastSyncedAt: string | null;
}

function parseFields(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : null;
  } catch {
    return null;
  }
}

async function loadExisting(): Promise<ClassSyncRow[]> {
  const rows = await prisma.classSession.findMany();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    descriptionSlug: row.descriptionSlug,
    category: row.category as ClassSyncRow["category"],
    instructorId: row.instructorId,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    capacity: row.capacity,
    priceCents: row.priceCents,
    zeffyUrl: row.zeffyUrl,
    zeffyCampaignId: row.zeffyCampaignId,
    zeffyOccurrenceId: row.zeffyOccurrenceId,
    source: (row.source as ClassSource) || "admin",
    location: row.location,
    published: row.published,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    staffEditedFields: parseFields(row.staffEditedFields),
    prerequisiteCertificationIds: [],
    cancellationCutoffHours: row.cancellationCutoffHours,
  }));
}

export async function syncClassesFromZeffy(now = new Date()): Promise<{
  created: number;
  updated: number;
  cancelled: number;
  pulled: number;
}> {
  const listed = await listAllZeffyCampaigns();
  const campaigns = await enrichClassCampaigns(listed, now);
  if (campaigns[0]) {
    console.info(
      JSON.stringify({
        zeffyCampaignSample: {
          id: campaigns[0].id,
          type: campaigns[0].type,
          category: campaigns[0].category,
          keys: Object.keys(campaigns[0]),
          rateCount: campaigns[0].rates?.length ?? 0,
        },
      }),
    );
  }
  const settings = await prisma.orgSettings.findUnique({ where: { id: "default" } });
  let instructorId = settings?.defaultInstructorId ?? null;
  if (!instructorId) {
    const admin = await prisma.user.findFirst({
      where: { role: "admin", deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    instructorId = admin?.id ?? null;
  }
  if (!instructorId) {
    throw new Error(
      "No default class instructor. Set one under Admin → Settings, or sign in an admin, then sync again.",
    );
  }
  const existing = await loadExisting();
  const plan = planClassSync({
    campaigns,
    existing,
    now,
    defaultInstructorId: instructorId,
    defaultCapacity: settings?.defaultClassCapacity ?? 8,
  });
  const pulled = campaigns.filter(
    (campaign) => isClassCampaign(campaign) && campaignInWindow(campaign, now),
  ).length;
  const syncedAt = now;

  for (const item of plan.upserts) {
    const data = {
      title: item.fields.title,
      slug: item.fields.slug,
      descriptionSlug: item.fields.descriptionSlug,
      category: item.fields.category,
      instructorId: item.fields.instructorId,
      startsAt: new Date(item.fields.startsAt),
      endsAt: new Date(item.fields.endsAt),
      capacity: item.fields.capacity,
      priceCents: item.fields.priceCents,
      zeffyUrl: item.fields.zeffyUrl,
      zeffyCampaignId: item.fields.zeffyCampaignId,
      zeffyOccurrenceId: item.fields.zeffyOccurrenceId,
      source: "zeffy",
      location: item.fields.location,
      published: item.fields.published,
      cancelledAt: item.fields.cancelledAt ? new Date(item.fields.cancelledAt) : null,
      prerequisiteCertificationIds: JSON.stringify(item.fields.prerequisiteCertificationIds),
      cancellationCutoffHours: item.fields.cancellationCutoffHours,
      syncedAt,
    };
    if (item.id) {
      await prisma.classSession.update({ where: { id: item.id }, data });
    } else {
      await prisma.classSession.create({
        data: {
          id: `class_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
          ...data,
        },
      });
    }
  }

  if (plan.cancelIds.length > 0) {
    await prisma.classSession.updateMany({
      where: { id: { in: plan.cancelIds } },
      data: { cancelledAt: syncedAt, published: false, syncedAt },
    });
  }

  await prisma.auditEvent.create({
    data: {
      id: `audit_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      action: "sync.zeffy_classes",
      entityType: "ClassSession",
      entityId: "zeffy",
      metadata: JSON.stringify({
        created: plan.created,
        updated: plan.updated,
        cancelled: plan.cancelled,
      }),
      occurredAt: syncedAt,
    },
  });

  return {
    created: plan.created,
    updated: plan.updated,
    cancelled: plan.cancelled,
    pulled,
  };
}

async function enrichClassCampaigns(
  campaigns: ZeffyCampaign[],
  now: Date,
): Promise<ZeffyCampaign[]> {
  const detailed: ZeffyCampaign[] = [];
  for (const campaign of campaigns) {
    if (
      !isClassCampaign(campaign) ||
      !campaignInWindow(campaign, now) ||
      (campaign.rates && campaign.rates.length > 0)
    ) {
      detailed.push(campaign);
      continue;
    }
    try {
      detailed.push(await getZeffyCampaign(campaign.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : "campaign fetch failed";
      console.error(JSON.stringify({ zeffyCampaign: campaign.id, error: message }));
      detailed.push(campaign);
    }
  }
  return detailed;
}

async function pushGoogle(now: Date): Promise<ClassSyncCounts["calendar"]> {
  const empty = { created: 0, updated: 0, deleted: 0, errors: [] as string[] };
  const account = calendarAccount();
  const ids = getCalendarIds();
  if (!account || !ids) return empty;

  const rows = await prisma.classSession.findMany({
    where: { source: { in: ["zeffy", "admin"] } },
  });
  const sessions: CalendarSession[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    priceCents: row.priceCents,
    capacity: row.capacity,
    zeffyUrl: row.zeffyUrl,
    location: row.location,
    source: row.source as ClassSource,
    googleEventId: row.googleEventId,
    googleCalendarId: row.googleCalendarId,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    description: null,
  }));
  const ops = planCalendarOps(sessions, ids);
  if (ops.length === 0) return empty;

  let token: string;
  try {
    token = await fetchCalendarAccessToken(account);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google auth failed";
    console.error(JSON.stringify({ calendar: "auth", error: message }));
    return { ...empty, errors: [message] };
  }

  const written = new Map<string, { eventId: string | null; calendarId: string | null }>();
  const result = await applyCalendarOps(ops, async (op) => {
    const saved = await calendarRequest(token, op);
    if (op.kind === "delete") {
      written.set(op.sessionId, { eventId: null, calendarId: null });
    } else if (saved && typeof saved === "object" && "id" in saved && saved.id) {
      written.set(op.sessionId, {
        eventId: saved.id,
        calendarId: op.calendarId,
      });
    }
    return saved;
  });

  for (const [id, value] of written) {
    await prisma.classSession.update({
      where: { id },
      data: {
        googleEventId: value.eventId,
        googleCalendarId: value.calendarId,
        syncedAt: now,
      },
    });
  }
  return result;
}

async function calendarRequest(
  token: string,
  op: CalendarOp,
): Promise<{ id?: string } | void> {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(op.calendarId)}/events`;
  if (op.kind === "create") {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(op.body),
    });
    if (!res.ok) throw new Error(`Google create ${res.status}`);
    return (await res.json()) as { id?: string };
  }
  if (op.kind === "patch") {
    const res = await fetch(`${base}/${encodeURIComponent(op.eventId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(op.body),
    });
    if (!res.ok) throw new Error(`Google patch ${res.status}`);
    return (await res.json()) as { id?: string };
  }
  const res = await fetch(`${base}/${encodeURIComponent(op.eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Google delete ${res.status}`);
}

export async function archiveCsvClasses(): Promise<{ archived: number }> {
  const result = await prisma.classSession.updateMany({
    where: { source: "csv", cancelledAt: null },
    data: { cancelledAt: new Date(), published: false },
  });
  return { archived: result.count };
}

export async function lastClassSyncAt(): Promise<string | null> {
  const row = await prisma.classSession.findFirst({
    where: { syncedAt: { not: null } },
    orderBy: { syncedAt: "desc" },
    select: { syncedAt: true },
  });
  return row?.syncedAt?.toISOString() ?? null;
}

export async function runClassSync(now = new Date()): Promise<ClassSyncCounts> {
  const classes = await syncClassesFromZeffy(now);
  const calendar = await pushGoogle(now);
  return {
    ...classes,
    calendar,
    lastSyncedAt: now.toISOString(),
  };
}
