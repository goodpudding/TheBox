import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("redemption codes", () => {
  test("staff make a credit code, a member redeems it once and sees the credit", async ({
    page,
  }) => {
    // The fixture UI keeps its data in the page, so everything after this
    // first load happens inside the app: the user switcher, menus and links.
    await page.goto("/admin/codes");
    await switchUser(page, "Avery Admin");

    await page.getByLabel("Amount ($)").fill("25");
    await page.getByLabel("Note (optional)").fill("Card 1042");
    await page.getByRole("button", { name: "Make codes" }).click();
    const made = page.locator("main").getByRole("status");
    await expect(made).toContainText("Made 1 code:", { timeout: 15_000 });
    const code = (await made.innerText()).match(/[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}/)?.[0];
    expect(code, "the new code is shown to staff").toBeTruthy();
    await expect(page.getByText("$25.00 shop credit").first()).toBeVisible();

    await switchUser(page, "Maya Chen");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: /^You/ })
      .click();
    await page.getByRole("menuitem", { name: "Redeem a code" }).click();
    await expect(page.getByRole("heading", { name: "Redeem a code" })).toBeVisible();

    // Typed the way people type: small letters, spaces for dashes.
    await page.getByLabel("Code").fill(code!.toLowerCase().replace(/-/g, " "));
    await page.getByRole("button", { name: "Check code" }).click();
    await expect(page.getByText("$25.00 of shop credit")).toBeVisible();
    await page.getByRole("button", { name: "Redeem", exact: true }).click();
    await expect(page.locator("main").getByRole("status")).toContainText(
      "$25.00 was added to your shop credit.",
    );

    // The same code again is refused, and nothing more is added.
    await page.getByLabel("Code").fill(code!);
    await page.getByRole("button", { name: "Check code" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("That code has already been used.");

    // Staff see who redeemed it.
    await switchUser(page, "Avery Admin");
    const primary = page.getByRole("navigation", { name: "Primary" });
    await primary.getByRole("link", { name: "Admin", exact: true }).click();
    await page.locator("main").getByRole("link", { name: "Codes", exact: true }).click();
    await page.getByLabel("Show").selectOption("redeemed");
    await expect(page.getByText(/Redeemed .* by/)).toContainText("Maya");
    await expect(page.getByText("Card 1042")).toBeVisible();
  });

  test("a made-up code tells the member nothing", async ({ page }) => {
    await page.goto("/redeem");
    await switchUser(page, "Maya Chen");
    await page.getByLabel("Code").fill("AAAAA-BBBBB-CCCCC");
    await page.getByRole("button", { name: "Check code" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code is not valid. Check it and try again, or ask staff.",
    );
  });
});
