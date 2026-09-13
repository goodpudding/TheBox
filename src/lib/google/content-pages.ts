/**
 * ContentPage upsert for Drive-synced Docs. Mirrors the Notion helper but keys
 * on `googleFileId` first, then slug, so a Doc renamed in Drive keeps its page
 * and a page that pre-dates Drive (fixture/Notion) gets adopted by id on first sync.
 */
import type { PrismaClient } from "@prisma/client";
import type { ContentCategory } from "@/lib/data/types";

export interface DriveContentInput {
  googleFileId: string;
  slug: string;
  title: string;
  /** Already sanitized HTML (see googleDocHtmlToContentHtml). */
  html: string;
  category: ContentCategory;
  /** Explicit version from the Content Index or Doc title; otherwise existing is kept. */
  version?: string | null;
  published?: boolean;
}

export interface UpsertResult {
  id: string;
  slug: string;
  action: "created" | "updated" | "unchanged";
  versionChanged: boolean;
}

export async function upsertContentPageFromDrive(
  prisma: PrismaClient,
  input: DriveContentInput,
  now: Date = new Date(),
): Promise<UpsertResult> {
  const existing = await prisma.contentPage.findFirst({
    where: {
      OR: [{ googleFileId: input.googleFileId }, { slug: input.slug }],
    },
    orderBy: { googleFileId: "desc" },
  });

  const published = input.published ?? true;

  if (existing) {
    const version = input.version ?? existing.version;
    const unchanged =
      existing.html === input.html &&
      existing.title === input.title &&
      existing.category === input.category &&
      existing.version === version &&
      existing.published === published &&
      existing.googleFileId === input.googleFileId &&
      existing.deletedAt === null;

    await prisma.contentPage.update({
      where: { id: existing.id },
      data: {
        googleFileId: input.googleFileId,
        title: input.title,
        html: input.html,
        category: input.category,
        version,
        published,
        syncedAt: now,
        deletedAt: null,
      },
    });
    return {
      id: existing.id,
      slug: existing.slug,
      action: unchanged ? "unchanged" : "updated",
      versionChanged: existing.version !== version,
    };
  }

  const created = await prisma.contentPage.create({
    data: {
      id: `gdrive-${input.googleFileId.slice(0, 12)}`,
      googleFileId: input.googleFileId,
      slug: input.slug,
      title: input.title,
      html: input.html,
      category: input.category,
      version: input.version ?? "1",
      published,
      syncedAt: now,
    },
  });
  return { id: created.id, slug: created.slug, action: "created", versionChanged: false };
}

/**
 * Pages that were synced from Drive before but whose Doc is no longer in the
 * folder get unpublished (not deleted) so history stays intact.
 */
export async function unpublishMissingDrivePages(
  prisma: PrismaClient,
  seenFileIds: Set<string>,
  now: Date = new Date(),
): Promise<string[]> {
  const stale = await prisma.contentPage.findMany({
    where: {
      googleFileId: { not: null },
      published: true,
      deletedAt: null,
    },
    select: { id: true, slug: true, googleFileId: true },
  });
  const toUnpublish = stale.filter(
    (p) => p.googleFileId && !seenFileIds.has(p.googleFileId),
  );
  for (const p of toUnpublish) {
    await prisma.contentPage.update({
      where: { id: p.id },
      data: { published: false, syncedAt: now },
    });
  }
  return toUnpublish.map((p) => p.slug);
}
