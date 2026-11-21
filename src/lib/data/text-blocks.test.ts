import { describe, expect, it } from "vitest";
import { cleanContentHtml, contentHtmlHasText } from "./content-html";
import { createMockDataProvider } from "./mock-provider";
import {
  TEXT_BLOCKS,
  fillTextBlock,
  inlineTextBlock,
  textBlockHtml,
  textBlockPlainText,
} from "./text-blocks";

describe("the built-in text blocks", () => {
  it("have one entry per slug, each with a title and words to show", () => {
    const slugs = TEXT_BLOCKS.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const block of TEXT_BLOCKS) {
      expect(block.slug, block.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(block.title.trim(), block.slug).not.toBe("");
      expect(contentHtmlHasText(block.html), block.slug).toBe(true);
    }
  });

  it("come through the save-time clean-up unchanged, so an untouched save changes nothing", () => {
    for (const block of TEXT_BLOCKS) {
      expect(cleanContentHtml(block.html), block.slug).toBe(block.html);
    }
  });
});

describe("fillTextBlock", () => {
  it("puts values in and escapes them", () => {
    expect(
      fillTextBlock('<p>Email <a href="mailto:{contactEmail}">{contactEmail}</a></p>', {
        contactEmail: 'a@b.org"><script>x</script>',
      }),
    ).toBe(
      '<p>Email <a href="mailto:a@b.org&quot;&gt;&lt;script&gt;x&lt;/script&gt;">a@b.org&quot;&gt;&lt;script&gt;x&lt;/script&gt;</a></p>',
    );
  });

  it("leaves a placeholder it has no value for", () => {
    expect(fillTextBlock("<p>{days} days, {unknown}</p>", { days: 14 })).toBe(
      "<p>14 days, {unknown}</p>",
    );
  });
});

describe("text block shapes", () => {
  it("unwraps paragraphs for use inside a sentence", () => {
    expect(inlineTextBlock("<p>One.</p>")).toBe("One.");
    expect(inlineTextBlock("<p>One.</p><p>Two <strong>b</strong>.</p>")).toBe(
      "One.<br><br>Two <strong>b</strong>.",
    );
  });

  it("gives plain words where a tag cannot go", () => {
    expect(textBlockPlainText("<p>Tom &amp; Rosa&#39;s <em>shop</em></p><p>Next</p>")).toBe(
      "Tom & Rosa's shop Next",
    );
  });

  it("uses the saved words when there are some, else the built-in ones", () => {
    const slug = TEXT_BLOCKS[0]!.slug;
    expect(textBlockHtml(slug, {})).toBe(TEXT_BLOCKS[0]!.html);
    expect(textBlockHtml(slug, { [slug]: "<p>Saved</p>" })).toBe("<p>Saved</p>");
    expect(textBlockHtml("no-such-block", {})).toBe("");
  });
});

describe("text blocks in the data layer", () => {
  it("has nothing saved to begin with", async () => {
    const provider = createMockDataProvider();
    expect(await provider.listTextBlocks()).toEqual({});
  });

  it("saves a block under its fixed address and hands it to every page", async () => {
    const provider = createMockDataProvider();
    const saved = await provider.adminSaveContentPage({
      title: "Join page: directions",
      slug: "join-directions",
      category: "block",
      html: "<p>Use the alley door.</p>",
    });
    expect(saved.slug).toBe("join-directions");
    expect(saved.category).toBe("block");
    expect(await provider.listTextBlocks()).toEqual({
      "join-directions": "<p>Use the alley door.</p>",
    });
  });

  it("keeps blocks out of the policy list", async () => {
    const provider = createMockDataProvider();
    await provider.adminSaveContentPage({
      title: "Join page: directions",
      slug: "join-directions",
      category: "block",
      html: "<p>Use the alley door.</p>",
    });
    expect((await provider.listPolicies()).map((p) => p.slug)).not.toContain("join-directions");
  });

  it("goes back to the built-in words when the saved block is unpublished", async () => {
    const provider = createMockDataProvider();
    const saved = await provider.adminSaveContentPage({
      title: "Join page: directions",
      slug: "join-directions",
      category: "block",
      html: "<p>Use the alley door.</p>",
    });
    await provider.adminSaveContentPage({
      id: saved.id,
      title: saved.title,
      html: saved.html,
      published: false,
    });
    expect(await provider.listTextBlocks()).toEqual({});
  });

  it("refuses a block the pages do not use", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminSaveContentPage({
        title: "Mystery",
        slug: "not-a-real-block",
        category: "block",
        html: "<p>x</p>",
      }),
    ).rejects.toThrow("That is not a piece of text any page shows.");
  });
});
