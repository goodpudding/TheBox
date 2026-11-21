import { describe, expect, it } from "vitest";
import { createMockDataProvider } from "./mock-provider";

describe("adminSaveContentPage", () => {
  it("changes the text members read", async () => {
    const provider = createMockDataProvider();
    const hours = await provider.getContentBySlug("hours");
    const saved = await provider.adminSaveContentPage({
      id: hours!.id,
      title: "Hours of Operation",
      html: "<p>Closed Mondays in December.</p>",
    });
    expect(saved.slug).toBe("hours");
    expect(saved.version).toBe(hours!.version);
    expect((await provider.getContentBySlug("hours"))?.html).toBe(
      "<p>Closed Mondays in December.</p>",
    );
  });

  it("strips script and styling from what staff paste in", async () => {
    const provider = createMockDataProvider();
    const faq = await provider.getContentBySlug("faq");
    const saved = await provider.adminSaveContentPage({
      id: faq!.id,
      title: faq!.title,
      html: '<p style="color:red" onclick="steal()">Hi <b>there</b></p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
    });
    expect(saved.html).not.toMatch(/script|onclick|style=|javascript:/i);
    expect(saved.html).toContain("<b>there</b>");
  });

  it("creates a page and gives it an address from its title", async () => {
    const provider = createMockDataProvider();
    const page = await provider.adminSaveContentPage({
      title: "Parking & Loading",
      html: "<p>Park on SW 153rd.</p>",
      category: "policy",
    });
    expect(page.slug).toBe("parking-loading");
    expect(page.published).toBe(true);
    expect((await provider.listPolicies()).map((p) => p.slug)).toContain("parking-loading");
  });

  it("refuses an address another page already has", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminSaveContentPage({
        title: "Hours again",
        slug: "hours",
        html: "<p>x</p>",
        category: "other",
      }),
    ).rejects.toThrow('Another page already uses the address "hours".');
  });

  it("needs a title and some text", async () => {
    const provider = createMockDataProvider();
    await expect(
      provider.adminSaveContentPage({ title: " ", html: "<p>x</p>", category: "other" }),
    ).rejects.toThrow("Give the page a title.");
    await expect(
      provider.adminSaveContentPage({ title: "Empty", html: "<p> </p>", category: "other" }),
    ).rejects.toThrow("The page has no text yet.");
  });

  it("hides an unpublished policy from members and keeps it for staff", async () => {
    const provider = createMockDataProvider();
    const policy = (await provider.listPolicies())[0]!;
    await provider.adminSaveContentPage({
      id: policy.id,
      title: policy.title,
      html: policy.html,
      published: false,
    });
    expect((await provider.listPolicies()).map((p) => p.id)).not.toContain(policy.id);
    expect((await provider.adminListContentMappings()).map((p) => p.id)).toContain(policy.id);
  });

  it("asks every member to sign again when the waiver gets a new version", async () => {
    const provider = createMockDataProvider();
    const waiver = await provider.getWaiver();
    const signer = (await provider.adminListMembers()).find((m) => m.status === "active")!;
    await provider.signWaiver({
      userId: signer.id,
      fullNameTyped: "Test Member",
      agreed: true,
      ip: "127.0.0.1",
    });
    expect((await provider.getOnboardingState(signer.id)).waiverSignedCurrent).toBe(true);

    const saved = await provider.adminSaveContentPage({
      id: waiver.id,
      title: waiver.title,
      html: "<p>New waiver text reviewed by counsel.</p>",
      version: "2026.2",
    });
    expect(saved.version).toBe("2026.2");
    expect((await provider.getSettings()).currentWaiverVersion).toBe("2026.2");
    expect((await provider.getWaiver()).html).toContain("reviewed by counsel");
    expect((await provider.getOnboardingState(signer.id)).waiverSignedCurrent).toBe(false);
  });

  it("fixes a typo in the waiver without asking anyone to sign again", async () => {
    const provider = createMockDataProvider();
    const waiver = await provider.getWaiver();
    const before = (await provider.getSettings()).currentWaiverVersion;
    await provider.adminSaveContentPage({
      id: waiver.id,
      title: waiver.title,
      html: waiver.html.replace("makerspace", "maker space"),
    });
    expect((await provider.getSettings()).currentWaiverVersion).toBe(before);
  });

  it("keeps the address of a page whose address is an older path", async () => {
    // Lessons find their text by this address. Tidying it on save would cut
    // the lesson off from its own page.
    const provider = createMockDataProvider();
    const page = (await provider.adminListContentMappings()).find((p) =>
      p.slug.includes("/"),
    )!;
    const saved = await provider.adminSaveContentPage({
      id: page.id,
      title: page.title,
      html: "<p>Reworded.</p>",
    });
    expect(saved.slug).toBe(page.slug);
  });
});
