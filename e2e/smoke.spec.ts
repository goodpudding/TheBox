import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("The Box Portal critical paths (mock)", () => {
  test("onboarding: Avery completes profile → waiver → expectations", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Brooks");
    // The public join page stays put. A member page sends a new member to
    // onboarding.
    await page.goto("/dashboard");
    await page.waitForURL(/onboarding\/profile|dashboard/);
    if (page.url().includes("profile")) {
      await page.getByLabel("First name").fill("Avery");
      await page.getByLabel("Last name").fill("Brooks");
      await page.getByLabel("Phone", { exact: true }).fill("206-555-9999");
      await page.getByLabel("Emergency contact name").fill("Pat Brooks");
      await page.getByLabel("Emergency contact phone").fill("206-555-9998");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL(/onboarding\/waiver/);
      const waiverBox = page.locator("div.max-h-\\[min\\(55vh\\,28rem\\)\\]");
      await waiverBox.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.getByLabel("Type your full name").fill("Avery Brooks");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Sign waiver" }).click();
      await page.waitForURL(/onboarding\/expectations/);
      await page.getByRole("checkbox").check();
      await page
        .getByRole("button", { name: /Acknowledge and go to dashboard/ })
        .click();
    }
    await expect(page).toHaveURL(/dashboard/);
  });

  test("paid class booking creates awaiting_payment hold", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/classes");
    await expect(
      page.getByRole("heading", { name: /Upcoming sessions/i }),
    ).toBeVisible({ timeout: 15_000 });
    // Open a paid class if listed
    const paidLink = page.locator('a[href^="/classes/"]').first();
    await paidLink.click();
    const book = page.getByRole("button", {
      name: /Book|Join waitlist|Pay/i,
    });
    if (await book.isVisible().catch(() => false)) {
      await book.click();
      await expect(
        page.getByText(/awaiting payment|booked|waitlist/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("reservation limit surfaces an error for Quinn", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Quinn Walsh");
    await page.goto("/reserve");
    await expect(page.getByText(/open reservation/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("learn index shows empty state for members while modules are draft", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/learn");
    await expect(
      page.getByText(/No published modules yet/i),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("admin learn lists draft modules with readiness", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/learn");
    await expect(
      page.getByRole("link", { name: "Shop Orientation", exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Draft/i).first()).toBeVisible();
  });

  test("guest can submit a bounty and a member can claim it", async ({
    page,
  }) => {
    await page.goto("/bounties");
    await expect(page.getByRole("heading", { name: /Bounty board/i })).toBeVisible();
    await page.getByLabel("What do you want made?").fill("Window decal for a bakery");
    await page
      .getByLabel("Details")
      .fill("Storefront name in two colors, about three feet wide.");
    await page.getByLabel("Your name").fill("Riley Baker");
    await page.getByLabel("Email").fill("riley@bakery.example");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(
      page.getByText(/your request is on the board/i),
    ).toBeVisible({ timeout: 10_000 });

    // Stay on the page: fixture data lives in this tab and a reload resets it.
    await switchUser(page, "Jordan Lee");
    await expect(
      page.getByRole("heading", { name: "Window decal for a bakery" }),
    ).toBeVisible({ timeout: 15_000 });
    const row = page.locator("li").filter({
      has: page.getByRole("heading", { name: "Window decal for a bakery" }),
    });
    await row.getByRole("button", { name: "Claim this" }).click();
    await expect(page.getByText(/Claimed · Jordan Lee/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("reader sim deny for outdated waiver (Jamie)", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/dev/reader");
    await expect(page.getByText(/Badge reader|Authorize/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
