import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("staff manage the volunteer roles", () => {
  test("a new role and what it involves show on the Volunteer page", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/volunteers");

    await page.getByRole("button", { name: "Add a role" }).click();
    await page.getByLabel("Title").fill("Kiln Tender");
    await page.getByRole("textbox", { name: "What the role involves" }).click();
    await page.keyboard.type("Loads and unloads the kiln on firing days.");
    await page.getByRole("button", { name: "Save role" }).click();
    await expect(page.getByRole("status")).toContainText("Saved Kiln Tender.");
    await expect(page.getByRole("button", { name: "Edit Kiln Tender" })).toBeVisible();

    // The fixture UI keeps its data in the page, so follow a link, not a reload.
    await page.getByRole("link", { name: "Volunteer", exact: true }).first().click();
    await expect(page).toHaveURL(/\/volunteer$/);
    await expect(page.getByText("Kiln Tender").first()).toBeVisible();
    await expect(page.getByText("Loads and unloads the kiln on firing days.")).toBeVisible();
  });
});
