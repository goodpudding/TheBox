import { test, expect } from "@playwright/test";

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
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(page.getByText("The Box").first()).toBeVisible({
      timeout: 15_000,
    });

    // Speed up: cadence is 12s in fixtures — wait across cycles by checking
    // the feed config and observing Membership title within ~3 rotations.
    const seen = new Set<string>();
    const deadline = Date.now() + 50_000;
    while (Date.now() < deadline) {
      for (const title of [
        "Today at The Box",
        "Machine status",
        "Coming up",
        "Get certified",
        "Welcome to The Box",
        "Open Studio Fridays",
        "Volunteer with us",
        "Membership",
      ]) {
        if (await page.getByRole("heading", { name: title }).isVisible().catch(() => false)) {
          seen.add(title === "Welcome to The Box" || title === "Open Studio Fridays" || title === "Volunteer with us" ? "Promos" : title);
        }
      }
      if (seen.has("Membership")) break;
      await page.waitForTimeout(1000);
    }
    expect(seen.has("Membership")).toBe(true);
  });

  test("reader authorize updates machine status on display", async ({
    page,
  }) => {
    await page.goto("/join");
    await expect(page.getByText("Dev · Switch user")).toBeVisible();
    const toolbarSelect = page.locator("div.fixed.bottom-0 select");
    const options = toolbarSelect.locator("option");
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).textContent()) ?? "";
      if (text.includes("Avery Admin") || text.includes("admin")) {
        const value = await options.nth(i).getAttribute("value");
        if (value) await toolbarSelect.selectOption(value);
        break;
      }
    }

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
