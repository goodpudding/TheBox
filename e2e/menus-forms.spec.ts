import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("menus and forms that open by themselves", () => {
  test("the You menu closes when the route changes", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/dashboard");
    const primary = page.getByRole("navigation", { name: "Primary" });
    await primary.getByRole("link", { name: "Reserve", exact: true }).click();
    await page.waitForURL(/\/reserve$/);

    await primary.getByRole("button", { name: /^You/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();

    // Back button: no link in the menu was clicked.
    await page.goBack();
    await page.waitForURL(/\/dashboard$/);
    await expect(page.getByRole("menu")).toHaveCount(0);

    // A menu link closes it too.
    await primary.getByRole("button", { name: /^You/ }).click();
    await page.getByRole("menuitem", { name: "Usage" }).click();
    await page.waitForURL(/\/usage$/);
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("the class suggestion form opens from a #suggest link only", async ({
    page,
  }) => {
    await page.goto("/interest");
    await expect(
      page.getByRole("heading", { name: "Class interest board" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Suggest a class" })).toBeVisible();
    await expect(page.locator("section#suggest")).toHaveCount(0);

    // The link on the events page.
    await page.goto("/events");
    await page.locator('a[href="/interest#suggest"]').click();
    await page.waitForURL(/\/interest#suggest$/);
    await expect(page.locator("section#suggest")).toBeVisible();

    // The same address typed in, or opened from an email.
    await page.goto("/join");
    await page.goto("/interest#suggest");
    await expect(page.locator("section#suggest")).toBeVisible();
  });

  test("a member reaches the bounty form by button or by #request link", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/made");
    const primary = page.getByRole("navigation", { name: "Primary" });

    // Arriving signed in, without the link: the board, no form.
    await primary.getByRole("link", { name: "Bounties", exact: true }).click();
    await page.waitForURL(/\/bounties$/);
    await expect(page.getByText("Member board")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("section#request")).toHaveCount(0);
    await page.getByRole("button", { name: "Request something made" }).click();
    await expect(page.locator("section#request")).toBeVisible();

    // Arriving through the link on Made here: the form is open.
    await page.goBack();
    await page.waitForURL(/\/made$/);
    await page.locator('a[href="/bounties#request"]').first().click();
    await page.waitForURL(/\/bounties#request$/);
    await expect(page.locator("section#request")).toBeVisible();
  });
});
