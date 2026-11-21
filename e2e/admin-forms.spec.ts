import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("admin forms say what happened", () => {
  test("creating a certification shows a success line, not an error", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/certifications");
    await page.getByLabel("Name").fill("Kiln");
    await page.getByLabel("Slug").fill("kiln");
    await page.getByRole("button", { name: /create|save|add/i }).first().click();
    await expect(page.getByText("Certification created.")).toBeVisible();
    await expect(page.getByText(/Cannot read properties|null \(reading|not an object/i)).toHaveCount(0);
    // The form is cleared for the next one.
    await expect(page.getByLabel("Name")).toHaveValue("");
  });
});
