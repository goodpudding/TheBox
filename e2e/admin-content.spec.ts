import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

test.describe("staff edit the words on the site", () => {
  test("a changed policy is what members read, and a new page joins the list", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/content");

    await page.getByRole("button", { name: "Edit Member Expectations" }).click();
    const text = page.getByRole("textbox", { name: "Text" });
    await expect(text).toContainText("Members treat people", { timeout: 15_000 });
    await text.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Clean up before you leave. Ask before you borrow.");
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByRole("status")).toContainText("Saved “Member Expectations”.");

    // The fixture UI keeps its data in the page, so stay inside the app
    // (links and Back) where a member would have loaded it fresh.
    const row = (title: string) =>
      page.getByRole("listitem").filter({ hasText: title });
    await row("Member Expectations").getByRole("link", { name: "View" }).click();
    await expect(page.getByText("Clean up before you leave.")).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: "New page" }).click();
    await page.getByLabel("Title").fill("Parking & Loading");
    await page.getByRole("textbox", { name: "Text" }).click();
    await page.keyboard.type("Park on SW 153rd.");
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByRole("status")).toContainText("Saved “Parking & Loading”.");

    await row("Parking & Loading").getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/policies\/parking-loading$/);
    await expect(page.getByText("Park on SW 153rd.")).toBeVisible();
  });

  test("a new waiver version warns staff that everyone signs again", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/content");
    await page.getByRole("button", { name: /Edit Liability Waiver/ }).click();
    await expect(page.getByText(/asks every member/)).toHaveCount(0);
    await page.getByLabel("Version").fill("2026.9");
    await expect(
      page.getByText("Saving the waiver as version 2026.9 asks every member to sign it again"),
    ).toBeVisible();
  });
});

test.describe("staff edit the explanatory text on a page", () => {
  test("new directions show on the Join page, and going back restores the built-in ones", async ({
    page,
  }) => {
    await page.goto("/join");
    await expect(page.getByText("Look for the orange Maker Space doors.")).toBeVisible();
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/content");

    await page.getByRole("button", { name: "Edit Join page: directions" }).click();
    const text = page.getByRole("textbox", { name: "Text" });
    await expect(text).toContainText("orange Maker Space doors", { timeout: 15_000 });
    await text.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Come in by the alley door on SW 153rd.");
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByRole("status")).toContainText("Saved “Join page: directions”.");

    // Stay inside the app: the fixture UI keeps its data in the page.
    await page.getByRole("link", { name: "Join", exact: true }).first().click();
    await expect(page).toHaveURL(/\/join$/);
    await expect(page.getByText("Come in by the alley door on SW 153rd.")).toBeVisible();
    await expect(page.getByText("Look for the orange Maker Space doors.")).toHaveCount(0);
    // A block nobody touched still shows its built-in words.
    await expect(page.getByText("Checkout stays on Zeffy.")).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: "Edit Join page: directions" }).click();
    await page.getByRole("button", { name: "Go back to the built-in text" }).click();
    await expect(page.getByRole("status")).toContainText("is back to the built-in text.");
    await page.getByRole("link", { name: "Join", exact: true }).first().click();
    await expect(page.getByText("Look for the orange Maker Space doors.")).toBeVisible();
  });
});
