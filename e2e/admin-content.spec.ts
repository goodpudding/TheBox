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
