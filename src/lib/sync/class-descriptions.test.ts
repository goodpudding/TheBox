import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const pages = new Map<string, Row>();
const writes: string[] = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    contentPage: {
      async findUnique(args: { where: { slug: string } }) {
        return pages.get(args.where.slug) ?? null;
      },
      async upsert(args: { where: { slug: string }; create: Row; update: Row }) {
        const slug = args.where.slug;
        writes.push(slug);
        const before = pages.get(slug);
        pages.set(slug, before ? { ...before, ...args.update } : { ...args.create });
        return pages.get(slug);
      },
    },
  },
}));

const NOW = new Date("2026-11-22T10:00:00.000Z");
const REPAIR = {
  slug: "class-zeffy-camp-repair",
  title: "Repair Café",
  html: "<p>Bring something broken.</p>",
};

async function save(descriptions: (typeof REPAIR)[]) {
  const { saveClassDescriptions } = await import("./class-descriptions");
  return saveClassDescriptions(descriptions, NOW);
}

beforeEach(() => {
  pages.clear();
  writes.length = 0;
});

describe("saving descriptions pulled from Zeffy", () => {
  it("creates a published class page the first time", async () => {
    expect(await save([REPAIR])).toBe(1);
    expect(pages.get(REPAIR.slug)).toMatchObject({
      slug: REPAIR.slug,
      title: "Repair Café",
      html: "<p>Bring something broken.</p>",
      category: "class",
      published: true,
    });
  });

  it("writes nothing when the description has not changed", async () => {
    await save([REPAIR]);
    writes.length = 0;
    expect(await save([REPAIR])).toBe(0);
    expect(writes).toEqual([]);
  });

  it("updates the page when the wording on Zeffy changes", async () => {
    await save([REPAIR]);
    expect(await save([{ ...REPAIR, html: "<p>Now with coffee.</p>" }])).toBe(1);
    expect(pages.get(REPAIR.slug)).toMatchObject({ html: "<p>Now with coffee.</p>" });
  });

  it("brings back a page that was unpublished or deleted", async () => {
    await save([REPAIR]);
    pages.set(REPAIR.slug, {
      ...pages.get(REPAIR.slug),
      published: false,
      deletedAt: new Date("2026-11-01T00:00:00Z"),
    });
    expect(await save([REPAIR])).toBe(1);
    expect(pages.get(REPAIR.slug)).toMatchObject({ published: true, deletedAt: null });
  });
});
