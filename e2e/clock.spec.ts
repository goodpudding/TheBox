import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

// Fixture dates never move, so each test sets the browser clock next to the
// fixture it reads instead of depending on today's date. Times on screen are
// in the browser's zone; pin it to the shop's.
test.use({ timezoneId: "America/Los_Angeles" });

test.describe("labels that depend on the time of day", () => {
  test("a reservation turns to Happening now, and loses Cancel, when it starts", async ({
    page,
  }) => {
    // Maya holds the laser 5–7 PM on Sep 8 and a printer the day after.
    await page.clock.install({ time: new Date("2026-09-08T16:58:30-07:00") });
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/reserve");

    const reservations = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Your reservations" }) });
    const laser = reservations
      .locator("li")
      .filter({ hasText: "Epilog Fusion Pro 32 (80W)" });
    const printer = reservations
      .locator("li")
      .filter({ hasText: "Prusa i3 MK3S" });

    await expect(laser).toBeVisible({ timeout: 15_000 });
    await expect(laser.getByText("Happening now")).toHaveCount(0);
    await expect(laser.getByRole("button", { name: "Cancel" })).toBeVisible();

    // Nobody touches the page; the clock alone passes 5 PM.
    await page.clock.fastForward("02:00");
    await expect(laser.getByText("Happening now")).toBeVisible();
    await expect(laser.getByRole("button", { name: "Cancel" })).toHaveCount(0);
    await expect(printer.getByText("Happening now")).toHaveCount(0);
    await expect(printer.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("the day timeline says when a hold gets under way", async ({ page }) => {
    // One minute before the 6 PM slot, which Maya's laser hold covers.
    await page.clock.install({ time: new Date("2026-09-08T17:59:00-07:00") });
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/reserve/m-laser-co2");
    await expect(
      page.getByText("1 booked block on this day.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await page.clock.fastForward("02:00");
    await expect(
      page.getByText(
        "1 booked block on this day · including a hold happening now.",
        { exact: true },
      ),
    ).toBeVisible();

    // Another day: the old slots go away while the new ones load.
    await page.getByLabel("Date").fill("2026-09-09");
    await expect(page.getByText("No reservations on this day yet.")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("picking a start time offers lengths, and changing the day drops the pick", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-09-08T09:00:00-07:00") });
    await page.goto("/join");
    await switchUser(page, "Maya Chen");
    await page.goto("/reserve/m-prusa-mk4");

    await page
      .getByRole("button", { name: "Start 4:00 PM", exact: true })
      .click({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "How long?" })).toBeVisible();
    // An hour to begin with; a shorter length can be chosen.
    await expect(page.getByText("Hold: 4:00 PM – 5:00 PM")).toBeVisible();
    await page.getByRole("button", { name: "30 min", exact: true }).click();
    await expect(page.getByText("Hold: 4:00 PM – 4:30 PM")).toBeVisible();

    await page.getByLabel("Date").fill("2026-09-10");
    await expect(page.getByRole("heading", { name: "How long?" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Start / }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Back on the first day the 4 PM slot is offered again, but not picked:
    // the earlier choice was dropped, not just hidden while it had no slot.
    await page.getByLabel("Date").fill("2026-09-08");
    await expect(
      page.getByRole("button", { name: "Start 4:00 PM", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "How long?" })).toHaveCount(0);
  });

  test("the events list leaves out sessions that have started", async ({
    page,
  }) => {
    // 2 PM on Nov 4: the morning lab is over, Community Make Night is tonight.
    await page.clock.install({ time: new Date("2026-11-04T14:00:00-08:00") });
    await page.goto("/events");
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Community Make Night" }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /Homeschool STEAM Lab · wk 1:/ }),
    ).toHaveCount(0);
  });

  test("admin classes marks a session under way as Past", async ({ page }) => {
    // Open shop runs 1–5 PM on Nov 4.
    await page.clock.install({ time: new Date("2026-11-04T14:00:00-08:00") });
    await page.goto("/join");
    await switchUser(page, "Avery Admin");
    await page.goto("/admin/classes");
    const underWay = page
      .locator("li")
      .filter({ has: page.locator('a[href="/admin/classes/class-w26-003"]') });
    await expect(underWay).toBeVisible({ timeout: 15_000 });
    await expect(underWay.getByText("Past", { exact: true })).toBeVisible();
    await expect(page.getByText("Upcoming", { exact: true }).first()).toBeVisible();
  });
});
