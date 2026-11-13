import { test, expect } from "@playwright/test";

// The kiosk APIs read the database directly, so this needs a migrated and
// seeded local D1 (see README). Set E2E_WORKSTATION=1 once that is in place.
const seeded = process.env.E2E_WORKSTATION === "1";

test.describe("Workstation kiosk", () => {
  test.skip(!seeded, "Set E2E_WORKSTATION=1 with a seeded local database");

  test("hides public chrome and signs in without billing desk time", async ({ page }) => {
    await page.goto("/workstation?device=BOX-PC-1");
    await expect(page.getByRole("heading", { name: /Sign in to this desk/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Dev · Switch user")).toHaveCount(0);
    await expect(page.getByText(/does not charge you/i).first()).toBeVisible();
    await expect(page.getByText(/Start billed session/i)).toHaveCount(0);

    await page.getByLabel("PIN").fill("2468");
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    await expect(page.getByRole("heading", { name: /Maya Chen/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Session clock")).toHaveCount(0);
    await expect(page.getByText("Estimated charge")).toHaveCount(0);
    await expect(page.getByText(/This login does not debit/i)).toBeVisible();
    await expect(page.getByText(/Filament used/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Send job/i })).toBeVisible();
    await expect(page.getByText(/Session clock/i)).toHaveCount(0);
    await expect(page.getByText(/Bambu Studio/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: /Sign in to this desk/i })).toBeVisible({
      timeout: 15_000,
    });
  });
});
