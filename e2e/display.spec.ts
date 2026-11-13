import { test, expect } from "@playwright/test";
import { switchUser } from "./helpers";

const TOKEN = "dev-display-token-change-me";

test.describe("Lobby display", () => {
  test("feed returns 401 without token and 200 with token", async ({
    request,
  }) => {
    const denied = await request.get("/api/display/feed");
    expect(denied.status()).toBe(401);

    const bad = await request.get("/api/display/feed?token=wrong");
    expect(bad.status()).toBe(401);

    const ok = await request.get(
      `/api/display/feed?token=${encodeURIComponent(TOKEN)}`,
    );
    expect(ok.status()).toBe(200);
    const feed = await ok.json();
    expect(feed.config).toBeTruthy();
    expect(Array.isArray(feed.machines)).toBe(true);
    expect(Array.isArray(feed.promos)).toBe(true);
    expect(Array.isArray(feed.bounties)).toBe(true);
    expect(feed.bounties.some((b: { status: string }) => b.status === "open")).toBe(
      true,
    );
  });

  test("expired promos are not included in the feed", async ({ request }) => {
    const ok = await request.get(
      `/api/display/feed?token=${encodeURIComponent(TOKEN)}`,
    );
    const feed = await ok.json();
    const ids = (feed.promos as { id: string }[]).map((p) => p.id);
    expect(ids).not.toContain("promo-expired-summer");
    expect(ids).not.toContain("promo-expired-old");
    expect(ids).not.toContain("promo-future-holiday");
    expect(ids).toContain("promo-welcome");
  });

  test("display page renders with token", async ({ page }) => {
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(page.getByText("The Box").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText(/Open now|Closed/).first(),
    ).toBeVisible();
  });

  test("membership panel appears every third rotation", async ({ page }) => {
    // Panels change every 12 s and Membership joins one rotation in three, so
    // drive the page's timers instead of waiting minutes of real time.
    await page.clock.install();
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(page.getByText("The Box").first()).toBeVisible({
      timeout: 15_000,
    });

    const membership = page.getByText("Membership", { exact: true }).first();
    let seen = false;
    for (let step = 0; step < 40 && !seen; step++) {
      // Give React a moment of real time to paint the panel it switched to.
      seen = await membership
        .waitFor({ state: "visible", timeout: 400 })
        .then(() => true, () => false);
      if (!seen) await page.clock.runFor(12_000);
    }
    expect(seen).toBe(true);
  });

  test("reader authorize updates machine status on display", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/join");
    await switchUser(page, "Avery Admin");

    await page.goto("/dev/reader");
    await expect(page.getByRole("button", { name: "Authorize" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Authorize" }).click();
    await expect(page.getByText(/Allow|Deny/).first()).toBeVisible({
      timeout: 10_000,
    });

    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(page.getByText("The Box").first()).toBeVisible({
      timeout: 15_000,
    });
    // Machine panel rotates in; wait for status grid copy.
    const deadline = Date.now() + 40_000;
    let sawStatus = false;
    while (Date.now() < deadline) {
      if (
        await page
          .getByRole("heading", { name: "Machine status" })
          .isVisible()
          .catch(() => false)
      ) {
        sawStatus = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(sawStatus).toBe(true);
  });
});
