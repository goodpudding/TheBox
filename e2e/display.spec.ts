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
    // Only promos that ended in the past: these can never start failing as
    // the calendar moves on. Start and end dates are checked with a pinned
    // clock in src/lib/data/display-feed.test.ts.
    expect(ids).not.toContain("promo-expired-summer");
    expect(ids).not.toContain("promo-expired-old");
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

  test("shows a photo beside the slide", async ({ page }) => {
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    const photo = page.getByTestId("display-photo").locator("img").first();
    await expect(photo).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("display-brand-panel")).toHaveCount(0);
  });

  test("shows the brand panel, not a broken image, when a photo will not load", async ({
    page,
  }) => {
    await page.route("**/images/projects/**", (route) => route.abort());
    await page.route("**/api/display/photos/**", (route) => route.abort());
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(page.getByTestId("display-brand-panel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Imagine. Design. Create.")).toBeVisible();
    await expect(page.getByTestId("display-photo").locator("img")).toHaveCount(0);
  });

  test("shows the brand panel when there are no photos at all", async ({
    page,
  }) => {
    await page.route("**/api/display/feed*", async (route) => {
      const feed = await (await route.fetch()).json();
      await route.fulfill({ json: { ...feed, photos: [] } });
    });
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(page.getByTestId("display-brand-panel")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("a promo with its own picture puts that picture beside the slide", async ({
    page,
  }) => {
    await page.route("**/api/display/feed*", async (route) => {
      const feed = await (await route.fetch()).json();
      feed.promos = [
        {
          ...feed.promos[0],
          title: "Holiday market",
          imageUrl: "/images/the-box-doors.jpg",
        },
      ];
      feed.config.panelOrder = ["promos"];
      feed.config.pinnedPanel = null;
      await route.fulfill({ json: feed });
    });
    await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
    await expect(
      page.getByRole("heading", { name: "Holiday market" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByTestId("display-photo").locator('img[src="/images/the-box-doors.jpg"]'),
    ).toBeVisible();
  });

  // Every panel, stuffed with more and longer content than a normal week,
  // must stay inside a 1080p screen: the TV cannot scroll.
  const LONG =
    "Introduction to Hand-Cut Dovetails and Traditional Joinery for Absolute Beginners";
  const PANELS = [
    ["today", "Today at The Box"],
    ["machines", "Machine status"],
    ["upcoming", "Coming up"],
    ["certs", "Get certified"],
    ["bounties", "Bounty board"],
    ["promos", LONG],
    ["membership", "Membership"],
  ] as const;

  for (const [panel, heading] of PANELS) {
    test(`the ${panel} panel fits a 1080p screen when it is full`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.route("**/api/display/feed*", async (route) => {
        const feed = await (await route.fetch()).json();
        const many = <T,>(rows: T[], n: number, patch: (row: T, i: number) => T) =>
          rows.length === 0
            ? rows
            : Array.from({ length: n }, (_, i) => patch(rows[i % rows.length]!, i));
        feed.todaySessions = many(feed.todaySessions, 8, (r: object, i) => ({
          ...r,
          id: `t${i}`,
          title: LONG,
        }));
        feed.todayReservations = many(feed.todayReservations, 12, (r: object, i) => ({
          ...r,
          machineId: `m${i}`,
          machineName: `Epilog Fusion Pro 32 (80W) number ${i}`,
          displayName: "Bartholomew",
        }));
        feed.machines = many(feed.machines, 40, (r: object, i) => ({
          ...r,
          id: `m${i}`,
          name: `Epilog Fusion Pro 32 (80W) number ${i}`,
          attendedOperationRequired: true,
        }));
        feed.upcoming = many(feed.upcoming, 14, (r: object, i) => ({
          ...r,
          id: `u${i}`,
          title: LONG,
        }));
        feed.checkoffs = many(feed.checkoffs, 8, (r: object, i) => ({
          ...r,
          id: `c${i}`,
          title: LONG,
        }));
        feed.onlineCerts = Array.from({ length: 24 }, (_, i) => ({
          certificationId: `cert${i}`,
          name: `Advanced Resin Printing Safety ${i}`,
          moduleSlug: `m${i}`,
        }));
        feed.bounties = many(feed.bounties, 12, (r: object, i) => ({
          ...r,
          id: `b${i}`,
          title: LONG,
          businessName: "Burien Neighborhood Hardware and Garden Supply Co.",
        }));
        feed.promos = [
          { ...feed.promos[0], title: LONG, body: `${LONG}. `.repeat(12) },
        ];
        feed.membership.products = many(
          feed.membership.products,
          9,
          (r: object, i) => ({ ...r, id: `p${i}`, summary: `${LONG}. `.repeat(4) }),
        );
        feed.config.panelOrder = [panel];
        feed.config.pinnedPanel = null;
        feed.config.membershipEveryNRotations = 1;
        await route.fulfill({ json: feed });
      });
      await page.goto(`/display?token=${encodeURIComponent(TOKEN)}`);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible({
        timeout: 15_000,
      });

      // Nothing inside the slide may reach past the slide's own box.
      const overflow = await page.getByTestId("display-content").evaluate((el) => {
        const box = el.getBoundingClientRect();
        let worst = 0;
        for (const node of el.querySelectorAll("*")) {
          const r = node.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          worst = Math.max(worst, r.bottom - box.bottom, r.right - box.right);
        }
        return {
          worst,
          bottom: box.bottom,
          right: box.right,
          width: window.innerWidth,
          height: window.innerHeight,
        };
      });
      expect(overflow.worst).toBeLessThanOrEqual(1);
      expect(overflow.bottom).toBeLessThanOrEqual(overflow.height);
      expect(overflow.right).toBeLessThanOrEqual(overflow.width);
    });
  }
});
