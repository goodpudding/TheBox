import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("staff set the machine rates", () => {
  test("a new laser rate shows in the worked example and is kept", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/settings");

    const rate = page.getByLabel("Laser, member, per hour ($)");
    await expect(rate).toHaveValue("15.00", { timeout: 15_000 });
    await expect(
      page.getByText("A 40-minute laser job costs a member $10.00 and a non-member $16.67."),
    ).toBeVisible();

    // The example follows what is typed, before anything is saved.
    await rate.fill("18");
    await expect(
      page.getByText("A 40-minute laser job costs a member $12.00 and a non-member $16.67."),
    ).toBeVisible();

    // A value that cannot be saved says why in place of the examples.
    await rate.fill("-3");
    await expect(page.getByText("Laser, member, per hour cannot be negative.")).toBeVisible();

    await rate.fill("18");
    await page.getByRole("button", { name: "Save machine rates" }).click();
    await expect(page.getByText("Machine rates saved. The next job sent uses them.")).toBeVisible();
    await expect(rate).toHaveValue("18.00");

    // Still there after leaving the page and coming back inside the app.
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/members/);
    await page.goBack();
    await expect(page.getByLabel("Laser, member, per hour ($)")).toHaveValue("18.00");
    await expect(
      page.getByText("A 40-minute laser job costs a member $12.00 and a non-member $16.67."),
    ).toBeVisible();
  });
});
