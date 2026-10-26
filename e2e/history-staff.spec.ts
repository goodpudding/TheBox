import { test, expect } from "@playwright/test";

test.describe("History and staff (public)", () => {
  test("history page tells the shop story and links to staff", async ({
    page,
  }) => {
    await page.goto("/history");
    await expect(
      page.getByRole("heading", { name: "How The Box got here" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/October 2021/)).toBeVisible();
    await expect(page.getByText(/Mitchell Allen/)).toBeVisible();
    await page.getByRole("link", { name: "Staff & instructors" }).click();
    await expect(page).toHaveURL(/\/staff/);
  });

  test("staff page lists staff and instructors", async ({ page }) => {
    await page.goto("/staff");
    await expect(
      page.getByRole("heading", { name: "Staff & instructors" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Mitchell Allen" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Paul Illian" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wendy" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Matt Swanson" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Read the history" })).toBeVisible();
  });
});
