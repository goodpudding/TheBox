import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("lists that load again when something changes", () => {
  // Interest boards and certifications expire with time. The fixtures are
  // written for early September 2026, so the browser clock is set there.
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-09-08T12:00:00-07:00") });
  });

  test("member search narrows the table and a checkoff leaves the queue", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/members");

    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name: "Maya Chen" })).toBeVisible({
      timeout: 15_000,
    });

    const search = page.getByLabel("Search");
    await search.fill("quinn");
    await expect(table.getByRole("link", { name: "Quinn Walsh" })).toBeVisible();
    await expect(table.getByRole("link", { name: "Maya Chen" })).toHaveCount(0);
    await search.fill("nobody-by-this-name");
    await expect(page.getByText("No members match that search.")).toBeVisible();
    await search.fill("");
    await expect(table.getByRole("link", { name: "Maya Chen" })).toBeVisible();

    const queue = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Ready for checkoff" }) });
    const kai = queue.locator("li").filter({ hasText: "Kai Nakamura" });
    await expect(kai).toBeVisible();
    await kai.getByRole("button", { name: "Record checkoff" }).click();
    await expect(kai).toHaveCount(0);
    await expect(queue.locator("li").filter({ hasText: "Morgan Ellis" })).toBeVisible();
    await expect(queue.getByText("Loading checkoff queue…")).toHaveCount(0);
  });

  test("the inventory Review count follows who is signed in", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/inventory");
    const review = page.getByRole("link", { name: /^Review/ });
    // Maya stewards the woodshop, which has an item waiting.
    await expect(review).toHaveText(/^Review \(\d+\)$/, { timeout: 15_000 });

    // Same tab, a member who cannot review, then Maya again.
    await switchUser(page, "Quinn Walsh");
    await expect(review).toHaveCount(0);
    await switchUser(page, "Maya Chen");
    await expect(review).toHaveText(/^Review \(\d+\)$/);
  });

  test("an interest list opens with its signups and closes again", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/interest");

    // The pending idea has nobody on it yet.
    await page
      .getByRole("button", { name: "Interest list" })
      .first()
      .click({ timeout: 15_000 });
    await expect(page.getByText("No signups yet.")).toBeVisible();
    await page.getByRole("button", { name: "Hide list" }).click();
    await expect(page.getByText("No signups yet.")).toHaveCount(0);

    // An open board lists who signed up.
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await page.getByRole("button", { name: "Interest list" }).first().click();
    await expect(page.getByRole("table").locator("tbody tr")).not.toHaveCount(0);
    await expect(page.getByText("No signups yet.")).toHaveCount(0);
  });

  test("a learning module opens on its first lesson and switches lessons", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/learn/shop-orientation");
    await expect(
      page.getByRole("heading", { name: "Shop Orientation", level: 1 }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^Shop layout, hours, sign-in/)).toBeVisible();

    await page.getByRole("button", { name: /When something goes wrong/ }).click();
    await expect(page.getByText(/^Shop layout, hours, sign-in/)).toHaveCount(0);
  });
});
