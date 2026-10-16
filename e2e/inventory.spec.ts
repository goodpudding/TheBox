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
        return;
      }
    }
  }
  throw new Error(`User option not found: ${label}`);
}

test.describe("shop inventory", () => {
  test("members see approved items and not pending ones", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Quinn Walsh");
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Orbital sander").first()).toBeVisible();
    await expect(page.getByText("BX-00001").first()).toBeVisible();
    await expect(page.getByText("Swing-away heat press")).toHaveCount(0);
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
    await expect(page.getByText("History")).toBeVisible();
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
});
