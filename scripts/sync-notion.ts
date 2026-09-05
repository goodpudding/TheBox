/**
 * Sync Notion pages/databases into ContentPage cache.
 *
 * Env:
 *   NOTION_TOKEN
 *   NOTION_POLICIES_DB_ID (optional database of policy pages)
 *   NOTION_WAIVER_PAGE_ID
 *   NOTION_HOURS_PAGE_ID
 *   NOTION_VOLUNTEER_DB_ID
 *   DATABASE_URL
 *
 * Usage: npm run sync:notion
 *
 * Without NOTION_TOKEN, exits 0 after printing setup instructions (safe for CI).
 */
import { Client } from "@notionhq/client";
import { PrismaClient } from "@prisma/client";
import sanitizeHtml from "sanitize-html";

const prisma = new PrismaClient();

function plainRichText(
  rich: Array<{ plain_text?: string }> | undefined,
): string {
  return (rich ?? []).map((t) => t.plain_text ?? "").join("");
}

async function upsertPage(input: {
  notionId: string;
  slug: string;
  title: string;
  html: string;
  category: string;
  version?: string;
}) {
  const existing = await prisma.contentPage.findFirst({
    where: { OR: [{ notionId: input.notionId }, { slug: input.slug }] },
  });
  const html = sanitizeHtml(input.html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "h1",
      "h2",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt"],
      a: ["href", "name", "target", "rel"],
    },
  });
  if (existing) {
    await prisma.contentPage.update({
      where: { id: existing.id },
      data: {
        notionId: input.notionId,
        title: input.title,
        html,
        category: input.category,
        version: input.version ?? existing.version,
        syncedAt: new Date(),
        published: true,
      },
    });
  } else {
    await prisma.contentPage.create({
      data: {
        id: `notion-${input.notionId.slice(0, 8)}`,
        notionId: input.notionId,
        slug: input.slug,
        title: input.title,
        html,
        category: input.category,
        version: input.version ?? "1",
        syncedAt: new Date(),
        published: true,
      },
    });
  }
}

/** Minimal block→HTML for paragraphs and headings. */
async function pageToHtml(notion: Client, pageId: string): Promise<string> {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  const parts: string[] = [];
  for (const block of blocks.results) {
    if (!("type" in block)) continue;
    const type = block.type;
    // @ts-expect-error dynamic Notion block shapes
    const data = block[type];
    const text = plainRichText(data?.rich_text);
    if (!text) continue;
    if (type === "heading_1") parts.push(`<h1>${text}</h1>`);
    else if (type === "heading_2") parts.push(`<h2>${text}</h2>`);
    else if (type === "heading_3") parts.push(`<h3>${text}</h3>`);
    else if (type === "bulleted_list_item") parts.push(`<li>${text}</li>`);
    else parts.push(`<p>${text}</p>`);
  }
  return parts.join("\n");
}

async function syncPage(
  notion: Client,
  pageId: string,
  slug: string,
  category: string,
) {
  const page = await notion.pages.retrieve({ page_id: pageId });
  // @ts-expect-error Notion page properties vary
  const titleProp = page.properties?.title ?? page.properties?.Name;
  const title =
    plainRichText(titleProp?.title) ||
    plainRichText(titleProp?.rich_text) ||
    slug;
  const html = await pageToHtml(notion, pageId);
  await upsertPage({
    notionId: pageId,
    slug,
    title,
    html,
    category,
  });
  console.log(`Synced page ${slug}`);
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.log(`Notion sync skipped — set NOTION_TOKEN and page/database IDs.

Required / optional env:
  NOTION_TOKEN
  NOTION_WAIVER_PAGE_ID
  NOTION_HOURS_PAGE_ID
  NOTION_POLICIES_DB_ID
  NOTION_VOLUNTEER_DB_ID
  DATABASE_URL

Mock content remains in data/mock/content until sync runs.`);
    return;
  }

  const notion = new Client({ auth: token });

  if (process.env.NOTION_WAIVER_PAGE_ID) {
    await syncPage(
      notion,
      process.env.NOTION_WAIVER_PAGE_ID,
      "waiver",
      "waiver",
    );
  }
  if (process.env.NOTION_HOURS_PAGE_ID) {
    await syncPage(
      notion,
      process.env.NOTION_HOURS_PAGE_ID,
      "hours",
      "hours",
    );
  }

  // Database sync: use search/query via dataSources if available; otherwise page IDs only.
  // Notion SDK v5 moved database query — keep a defensive stub.
  for (const [envKey, category] of [
    ["NOTION_POLICIES_DB_ID", "policy"],
    ["NOTION_VOLUNTEER_DB_ID", "volunteer"],
  ] as const) {
    const dbId = process.env[envKey];
    if (!dbId) continue;
    console.log(
      `Database sync for ${envKey} (${category}) is configured (${dbId}). ` +
        `Add page IDs individually or extend this script for Notion SDK v5 data sources.`,
    );
  }

  console.log("Notion sync complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
