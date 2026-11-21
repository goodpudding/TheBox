import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

/** A datetime-local value some days from now, in the browser's own zone. */
function inDays(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

test.describe("staff run a class from the admin", () => {
  test("a description written on a class is what its public page says", async ({ page }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/classes/new");

    await page.getByLabel("Title").fill("Tapestry Weaving");
    await page.getByLabel("Starts").fill(inDays(7, 18));
    await page.getByLabel("Ends").fill(inDays(7, 20));
    await page.getByRole("textbox", { name: "Description" }).click();
    await page.keyboard.type("Weave a small wall hanging. Bring scissors.");
    await page.getByRole("button", { name: "Create class" }).click();

    // The fixture UI keeps its data in the page, so follow links from here.
    await expect(page).toHaveURL(/\/admin\/classes\/class-/);
    await expect(page.getByRole("textbox", { name: "Description" })).toContainText(
      "Weave a small wall hanging.",
    );
    await page.getByRole("link", { name: "View the public page →" }).click();
    await expect(page.getByRole("heading", { name: "Tapestry Weaving" })).toBeVisible();
    await expect(page.getByText("Weave a small wall hanging. Bring scissors.")).toBeVisible();
  });

  test("cancelling a class says who is booked and that no money moves, and can be undone", async ({
    page,
  }) => {
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/classes/new");
    await page.getByLabel("Title").fill("Spoon Carving");
    await page.getByLabel("Starts").fill(inDays(9, 18));
    await page.getByLabel("Ends").fill(inDays(9, 20));
    await page.getByRole("button", { name: "Create class" }).click();
    await expect(page).toHaveURL(/\/admin\/classes\/class-/);

    const picker = page.getByLabel("Add someone to this class");
    const maya = picker.locator("option", { hasText: "Maya Chen" });
    await expect(maya).toBeAttached();
    await picker.selectOption((await maya.getAttribute("value"))!);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cancel Maya Chen’s booking" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel this class" }).click();
    await expect(page.getByText("1 person is booked.")).toBeVisible();
    await expect(page.getByText(/Refund a Zeffy payment in Zeffy/)).toBeVisible();
    await page.getByRole("button", { name: "Yes, cancel the class" }).click();
    await expect(page.getByRole("heading", { name: "This class is cancelled" })).toBeVisible();

    await page.getByRole("link", { name: "← All classes" }).click();
    const row = page.getByRole("listitem").filter({ hasText: "Spoon Carving" });
    await expect(row.getByText("Cancelled")).toBeVisible();
    await row.getByRole("link", { name: "Spoon Carving" }).click();
    await page.getByRole("button", { name: "Restore this class" }).click();
    await expect(page.getByRole("heading", { name: "Cancel this class" })).toBeVisible();
  });
});
