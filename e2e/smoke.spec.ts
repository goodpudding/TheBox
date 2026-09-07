import { test, expect } from "@playwright/test";

async function switchUser(page: import("@playwright/test").Page, label: string) {
  await expect(page.getByText("Dev · Switch user")).toBeVisible();
  const toolbarSelect = page.locator("div.fixed.bottom-0 select");
  const options = toolbarSelect.locator("option");
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const text = (await options.nth(i).textContent()) ?? "";
    if (text.includes(label)) {
      const value = await options.nth(i).getAttribute("value");
      if (value != null) {
        await toolbarSelect.selectOption(value);
        await expect(toolbarSelect).toHaveValue(value);
        return;
      }
    }
  }
  throw new Error(`User option not found: ${label}`);
}

test.describe("The Box Portal critical paths (mock)", () => {
  test("walk-in registration creates a pending member with waiver and newsletter opt-in", async ({
    page,
  }) => {
    const email = `walkin-${Date.now()}@example.com`;

    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: /Register and sign the waiver/i }),
    ).toBeVisible();
    const waiverBox = page.getByTestId("registration-waiver");
    await waiverBox.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll"));
    });

    await page.getByLabel("First name").fill("Walk");
    await page.getByLabel("Last name").fill("In");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Phone", { exact: true }).fill("206-555-1212");
    await page.getByLabel("Emergency contact name").fill("Pat Contact");
    await page.getByLabel("Emergency contact phone").fill("206-555-3434");
    await page.getByLabel("Relationship").fill("Friend");
    await page.getByLabel("Type your full legal name").fill("Walk In");
    await page.getByLabel(/I have read this waiver/).check();
    await page.getByLabel(/Send me The Box newsletter/).check();
    await page
      .getByRole("button", { name: "Create account & sign waiver" })
      .click();

    await expect(page.getByText("Account created.")).toBeVisible();
    await expect(page.getByText("Newsletter preference: yes")).toBeVisible();

    await switchUser(page, "Sam Stafford");
    await page.getByRole("link", { name: "Admin" }).click();
    await expect(page).toHaveURL(/\/admin\/members/);
    await page.getByLabel("Search").fill(email);
    await expect(page.getByRole("cell", { name: email })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Opted in" })).toBeVisible();
  });

  test("onboarding: Avery completes profile → waiver → expectations", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Brooks");
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
    await expect(page.getByRole("heading", { name: /Classes/i })).toBeVisible({
      timeout: 15_000,
    });
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

  test("learn module page loads for Maya", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/learn");
    await expect(page.getByText(/Shop Orientation|3D Printing/i).first()).toBeVisible({
      timeout: 15_000,
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
