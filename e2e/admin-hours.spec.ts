import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("staff set the opening hours", () => {
  test("a day changed in Settings is the day members read on Join", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    // Before: closed on Mondays, and the Hours page adds its note underneath.
    const hours = page.locator("section").filter({ hasText: /When we.re open/ });
    await expect(hours.getByText("Monday Closed", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(hours.getByText("Tuesday 1:00 – 8:00 PM", { exact: true })).toBeVisible();
    await expect(hours.getByText(/Holiday closures/)).toBeVisible();

    await page.goto("/admin/settings");
    const monday = page.getByRole("group", { name: /^Monday/ });
    await monday.getByLabel("Closed").uncheck();
    await monday.getByLabel("Monday opens").selectOption({ label: "10:30 AM" });
    await monday.getByLabel("Monday closes").selectOption({ label: "2:30 PM" });
    await page.getByRole("button", { name: "Save opening hours" }).click();
    await expect(page.getByText("Opening hours saved.")).toBeVisible();

    // The fixture UI keeps its data in the page, so go by a link, not a reload.
    await page.getByRole("link", { name: "Join", exact: true }).first().click();
    await expect(page).toHaveURL(/\/join$/);
    await expect(hours.getByText("Monday 10:30 AM – 2:30 PM", { exact: true })).toBeVisible();
    await expect(hours.getByText("Monday Closed", { exact: true })).toHaveCount(0);
  });

  test("a week that makes no sense is refused in words staff can act on", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/settings");
    const tuesday = page.getByRole("group", { name: /^Tuesday/ });
    await tuesday.getByLabel("Tuesday closes").selectOption({ label: "11:00 AM" });
    await page.getByRole("button", { name: "Save opening hours" }).click();
    await expect(page.getByText(/Tuesday closes before it opens/)).toBeVisible();
  });
});
