import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("numbered gift cards", () => {
  test("staff make a numbered card and redeem it at the desk for a member, who sees the credit", async ({
    page,
  }) => {
    // The fixture UI keeps its data in the page, so everything after this
    // first load happens inside the app: the user switcher, menus and links.
    await page.goto("/admin/codes");
    await switchUser(page, "Avery Admin");

    await page.getByLabel("Amount ($)").fill("25");
    await page.getByLabel("Number these as gift cards").check();
    await expect(page.getByLabel("First card number")).toHaveAttribute("placeholder", "001");
    await page.getByRole("button", { name: "Make codes" }).click();
    const notice = page.locator("main").getByRole("status");
    await expect(notice).toContainText("Made card 001.", { timeout: 15_000 });

    // Staff find the card by the number printed on it.
    await page.getByLabel("Find a card").fill("1");
    await expect(page.getByText("Card 001", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Redeem card 001 for a member" }).click();

    await page.getByLabel("Who is it for").fill("jordan");
    await page.getByRole("button", { name: "Find", exact: true }).click();
    await page.getByRole("button", { name: "Choose Jordan Lee" }).click();
    await expect(page.getByText("Card 001 gives")).toContainText("$25.00 shop credit");
    await page.getByRole("button", { name: "Redeem for Jordan Lee" }).click();
    await expect(notice).toContainText("Card 001: $25.00 shop credit added for Jordan Lee.");

    // The card is used up: looking it up again shows who it went to.
    await page.getByLabel("Find a card").fill("001");
    await expect(page.getByText(/Redeemed .* by/)).toContainText("Jordan Lee");
    await expect(page.getByText(/at the desk by Avery/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Redeem card 001/ })).toHaveCount(0);

    // Jordan signs in and the credit is on the account.
    await switchUser(page, "Jordan Lee");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: /^You/ })
      .click();
    await page.getByRole("menuitem", { name: "Account" }).click();
    await expect(page.getByText("Gift card 001")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("$25.00").first()).toBeVisible();
  });

  test("a card number does nothing on the member's own redeem page", async ({ page }) => {
    await page.goto("/admin/codes");
    await switchUser(page, "Avery Admin");
    await page.getByLabel("Amount ($)").fill("25");
    await page.getByLabel("Number these as gift cards").check();
    await page.getByRole("button", { name: "Make codes" }).click();
    await expect(page.locator("main").getByRole("status")).toContainText("Made card 001.", {
      timeout: 15_000,
    });

    await switchUser(page, "Maya Chen");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: /^You/ })
      .click();
    await page.getByRole("menuitem", { name: "Redeem a code" }).click();
    await page.getByLabel("Code").fill("001");
    await page.getByRole("button", { name: "Check code" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code is not valid. Check it and try again, or ask staff.",
    );
  });
});
