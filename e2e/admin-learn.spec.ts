import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

/** A fixture question with four right answers out of four. */
const QUESTION = "Which of these should you remove or secure before running any machine?";

test.describe("staff edit a learning module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/learn");
    await page.getByRole("link", { name: "Shop Orientation", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/learn\/mod-shop-orientation$/);
  });

  test("a new title and pass mark are kept", async ({ page }) => {
    const details = page.getByRole("form", { name: "Module details" });
    await page.getByRole("button", { name: "Edit module details" }).click();
    await details.getByLabel("Title").fill("Shop Orientation 2027");
    await details.getByLabel("Pass mark (%)").fill("90");
    await details.getByRole("button", { name: "Save module details" }).click();
    await expect(page.getByText("Module details saved.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shop Orientation 2027");

    // The fixture UI keeps its data in the page, so move around inside the app.
    await page.getByRole("link", { name: "← Modules" }).click();
    await page.getByRole("link", { name: "Shop Orientation 2027", exact: true }).click();
    await page.getByRole("button", { name: "Edit module details" }).click();
    await expect(details.getByLabel("Title")).toHaveValue("Shop Orientation 2027");
    await expect(details.getByLabel("Pass mark (%)")).toHaveValue("90");
  });

  test("rewording a choose-all-that-apply question keeps every right answer", async ({ page }) => {
    const row = page.getByRole("listitem").filter({ hasText: QUESTION });
    await row.getByRole("button", { name: /Which of these should you remove or secure/ }).click();
    const ticks = row.getByRole("checkbox", { name: /is a right answer/ });
    await expect(ticks).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) await expect(ticks.nth(i)).toBeChecked();

    await row.getByLabel("Question").fill("Reworded: which of these are true?");
    await row.getByRole("button", { name: "Save question" }).click();
    await expect(page.getByText("Question saved.")).toBeVisible();

    const saved = page
      .getByRole("listitem")
      .filter({ hasText: "Reworded: which of these are true?" });
    await expect(saved.getByText(/^Right answers: /)).toBeVisible();
    await saved.getByRole("button", { name: /Reworded/ }).click();
    const kept = saved.getByRole("checkbox", { name: /is a right answer/ });
    for (let i = 0; i < 4; i += 1) await expect(kept.nth(i)).toBeChecked();
  });
});

