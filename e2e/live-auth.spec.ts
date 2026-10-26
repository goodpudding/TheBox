import { test, expect } from "@playwright/test";

const live = process.env.E2E_LIVE === "1";

test.describe("live session", () => {
  test.skip(!live, "Set E2E_LIVE=1 and E2E_SESSION_COOKIE after seeding a Session row");

  test("header shows the member and account renders their profile", async ({
    page,
    context,
  }) => {
    const cookie = process.env.E2E_SESSION_COOKIE;
    const name = process.env.E2E_MEMBER_NAME;
    test.skip(!cookie || !name, "E2E_SESSION_COOKIE and E2E_MEMBER_NAME are required");
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: cookie!,
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
      },
    ]);
    await page.goto("/");
    await expect(page.getByRole("button", { name: new RegExp(name!) })).toBeVisible();
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: /membership/i })).toBeVisible();
    await expect(page.getByLabel("First name")).not.toHaveValue("");
  });
});
