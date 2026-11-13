import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("shop inventory", () => {
  test("members see approved items and not pending ones", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Quinn Walsh");
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({
      timeout: 15_000,
    });
    // The list renders twice (table and phone cards); name the visible one.
    await expect(
      page.getByRole("link", { name: "Orbital sander" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "BX-00001" }).first()).toBeVisible();
    await expect(page.getByText("Swing-away heat press")).toHaveCount(0);
  });

  test("a plain member gets the item page without serial or notes", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Drew Santos");
    await page.goto("/inventory");
    await expect(
      page.getByRole("link", { name: "Orbital sander" }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await page.goto("/inventory/BX-00001");
    await expect(page.getByRole("heading", { name: "Orbital sander" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Woodshop · Bay A shelf")).toBeVisible();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Report issue" })).toBeVisible();
    await expect(page.getByText("DW6423-88421")).toHaveCount(0);
    await expect(page.getByText(/Hook-and-loop pad/)).toHaveCount(0);
    await expect(page.getByText("Serial", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Notes", { exact: true })).toHaveCount(0);
  });

  test("the area's steward still sees serial and notes", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/inventory/BX-00001");
    await expect(page.getByRole("heading", { name: "Orbital sander" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("DW6423-88421")).toBeVisible();
    await expect(page.getByText(/Hook-and-loop pad/)).toBeVisible();
  });

  test("woodshop steward sees the pending jigsaw in review", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/inventory/review");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Jigsaw")).toBeVisible();
    await expect(page.getByText("Swing-away heat press")).toHaveCount(0);
  });

  test("QR short link opens the item page", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/i/BX-00001");
    await expect(page).toHaveURL(/\/inventory\/BX-00001/i);
    await expect(page.getByRole("heading", { name: "Orbital sander" })).toBeVisible({
      timeout: 15_000,
    });
    // "History" is also a site nav link, so ask for the item's section heading.
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  });

  test("staff can open labels and import", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/inventory/labels");
    await expect(
      page.getByRole("heading", { name: /Print QR labels/i }),
    ).toBeVisible({ timeout: 15_000 });
    await page.goto("/inventory/import");
    await expect(
      page.getByRole("heading", { name: /Import from Google Form/i }),
    ).toBeVisible();
  });

  test("the add-item form reopens on the draft kept in this tab", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    // A draft left on the Details step.
    await page.evaluate(() =>
      window.sessionStorage.setItem(
        "thebox.inventory.wizard.v1",
        JSON.stringify({ step: 3, name: "Bench vise" }),
      ),
    );
    await page.goto("/inventory/new");
    const name = page.getByLabel("Item name");
    await expect(name).toHaveValue("Bench vise", { timeout: 15_000 });

    // Edits are kept as they are typed.
    await name.fill("Bench vise, 6 inch");
    await page.reload();
    await expect(name).toHaveValue("Bench vise, 6 inch", { timeout: 15_000 });
  });
});
