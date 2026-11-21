import { prisma } from "@/lib/db";
import type { PlannedDescription } from "@/lib/sync/zeffy-classes";

/**
 * Keep each Zeffy event's description as a class page, so the class's own
 * page and the lobby display can show what it is about. A page is written
 * only when its wording or title changed, or it had been hidden. Returns how
 * many were written.
 */
export async function saveClassDescriptions(
  descriptions: PlannedDescription[],
  now: Date,
): Promise<number> {
  let written = 0;
  for (const description of descriptions) {
    const existing = await prisma.contentPage.findUnique({
      where: { slug: description.slug },
    });
    if (
      existing &&
      existing.html === description.html &&
      existing.title === description.title &&
      existing.published &&
      !existing.deletedAt
    ) {
      continue;
    }
    await prisma.contentPage.upsert({
      where: { slug: description.slug },
      create: {
        id: `content_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
        slug: description.slug,
        title: description.title,
        html: description.html,
        category: "class",
        version: "1",
        published: true,
        syncedAt: now,
      },
      update: {
        title: description.title,
        html: description.html,
        published: true,
        deletedAt: null,
        syncedAt: now,
      },
    });
    written += 1;
  }
  return written;
}
