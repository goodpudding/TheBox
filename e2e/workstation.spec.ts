import { randomBytes } from "node:crypto";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  KIOSK_DEVICE_ID,
  KIOSK_MEMBER,
  KIOSK_PIN,
  KIOSK_RESET_MEMBER,
  KIOSK_STAFF,
  KIOSK_TYPO_MEMBER,
} from "./kiosk-fixtures";

// The kiosk APIs read the database directly, so these tests need the local
// D1 that `npm run e2e:db` builds. E2E_WORKSTATION=1 (set in CI) runs them
// and fails when the database is missing. E2E_WORKSTATION=0 skips them. With
// neither, they run when the seeded desk answers and skip when it does not.
const mode = process.env.E2E_WORKSTATION;
const NO_DATABASE =
  "No kiosk database. Stop the dev server, run `npm run e2e:db`, then run the tests again";
const STALE_DATABASE =
  "A 429 here means earlier runs today used up this member's wrong PINs. Stop the dev server and run `npm run e2e:db`";

const WRONG_PIN = "9753";
const MISMATCH = "Email or PIN didn't match";
const LOCKED = /Too many attempts/;

async function openDesk(page: Page) {
  await page.goto(`/workstation?device=${KIOSK_DEVICE_ID}`);
  await expect(page.getByRole("heading", { name: /Sign in to this desk/i })).toBeVisible({
    timeout: 20_000,
  });
}

/** Submit the PIN form and wait for the server's answer, so attempts can be counted. */
async function submitPin(page: Page, email: string, pin: string): Promise<number> {
  await page.getByLabel("Email on your membership").fill(email);
  await page.getByLabel("PIN", { exact: true }).fill(pin);
  const answered = page.waitForResponse(
    (res) =>
      res.request().method() === "POST" &&
      new URL(res.url()).pathname === "/api/workstation/login",
  );
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  return (await answered).status();
}

/** Desk sign-in for the member the reset tests use, without the page. */
function signIn(request: APIRequestContext, pin: string) {
  return request.post("/api/workstation/login", {
    data: { workstationId: KIOSK_DEVICE_ID, email: KIOSK_RESET_MEMBER.email, pin },
  });
}

/**
 * Staff give the member a new PIN. The dev server takes the acting user from
 * this header, as the staff pages do locally. The new PIN is the same one, so
 * every run starts from the same member.
 */
function staffReset(request: APIRequestContext) {
  return request.post(`/api/admin/members/${KIOSK_RESET_MEMBER.id}/kiosk-pin`, {
    headers: { "x-box-user-id": KIOSK_STAFF.id },
    data: { temporaryPin: KIOSK_PIN },
  });
}

// Next adds its own role="alert" route announcer, so look inside the form.
function formError(page: Page) {
  return page.locator("form").getByRole("alert");
}

test.describe("Workstation kiosk", () => {
  test.skip(mode === "0", "Kiosk tests are switched off with E2E_WORKSTATION=0");

  test.beforeAll(async ({ request }) => {
    const desk = await request.get(`/api/workstations/${KIOSK_DEVICE_ID}/config`);
    if (mode === "1") expect(desk.ok(), NO_DATABASE).toBe(true);
    else test.skip(!desk.ok(), NO_DATABASE);
  });

  test("hides public chrome and signs in without billing desk time", async ({ page }) => {
    await openDesk(page);
    await expect(page.getByText("Dev · Switch user")).toHaveCount(0);
    await expect(page.getByText(/does not charge you/i).first()).toBeVisible();
    await expect(page.getByText(/Start billed session/i)).toHaveCount(0);

    expect(await submitPin(page, KIOSK_MEMBER.email, KIOSK_PIN)).toBe(200);

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

  test("a wrong PIN shows the mismatch message and the right PIN still signs in", async ({
    page,
  }) => {
    await openDesk(page);

    // Every run leaves one wrong PIN on this member, and 20 in a day lock the
    // email whatever comes after. Say how to start clean, not just "429".
    expect(await submitPin(page, KIOSK_TYPO_MEMBER.email, WRONG_PIN), STALE_DATABASE).toBe(401);
    await expect(formError(page)).toHaveText(MISMATCH);
    await expect(page.getByRole("heading", { name: /Sign in to this desk/i })).toBeVisible();

    expect(await submitPin(page, KIOSK_TYPO_MEMBER.email, KIOSK_PIN)).toBe(200);
    await expect(page.getByRole("heading", { name: /Jordan Lee/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(formError(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page.getByRole("heading", { name: /Sign in to this desk/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("five wrong PINs lock the email at the desk and for phone approval", async ({
    page,
    request,
  }) => {
    // The server answers an email nobody has exactly like a member's, and
    // counts it the same way. A new one each run means the lock an earlier
    // run left in the database (10 minutes) cannot fail this one.
    const email = `lockout-${randomBytes(6).toString("hex")}@example.com`;
    await openDesk(page);

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(await submitPin(page, email, WRONG_PIN), `attempt ${attempt}`).toBe(401);
      await expect(formError(page)).toHaveText(MISMATCH);
    }

    expect(await submitPin(page, email, WRONG_PIN)).toBe(429);
    await expect(formError(page)).toHaveText(LOCKED);

    // Phone approval only takes a PIN against a QR code a desk is showing.
    const noCode = await request.post("/api/workstation/qr/approve", {
      data: { challengeId: "none", email, pin: WRONG_PIN },
    });
    expect(noCode.status()).toBe(410);

    // Phone approval keeps its own count in memory and has seen no attempts,
    // so a lock here can only have been read from the database.
    const qr = await request.post("/api/workstation/qr/start", {
      data: { workstationId: KIOSK_DEVICE_ID },
    });
    const { challengeId } = (await qr.json()) as { challengeId: string };
    const phone = await request.post("/api/workstation/qr/approve", {
      data: { challengeId, email, pin: WRONG_PIN },
    });
    expect(phone.status()).toBe(429);
    expect(((await phone.json()) as { error?: string }).error).toMatch(LOCKED);
  });

  test("a staff PIN reset lets a locked-out member sign in again", async ({ request }) => {
    // Start from a clean count: a retry after a half-finished attempt would
    // otherwise meet the wrong PINs that attempt left behind.
    expect((await staffReset(request)).status()).toBe(200);

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await signIn(request, WRONG_PIN)).status(), `attempt ${attempt}`).toBe(401);
    }
    expect((await signIn(request, KIOSK_PIN)).status()).toBe(429);

    expect((await staffReset(request)).status()).toBe(200);

    const back = await signIn(request, KIOSK_PIN);
    expect(back.status()).toBe(200);
    expect(((await back.json()) as { mustChangePin?: boolean }).mustChangePin).toBe(true);
    await request.post("/api/workstation/logout");
  });

  test("a sign-in at the desk clears wrong PINs typed on the phone page", async ({ request }) => {
    // Start from a clean count whatever earlier runs left behind.
    expect((await staffReset(request)).status()).toBe(200);

    const qr = await request.post("/api/workstation/qr/start", {
      data: { workstationId: KIOSK_DEVICE_ID },
    });
    const { challengeId } = (await qr.json()) as { challengeId: string };
    for (let attempt = 1; attempt <= 4; attempt++) {
      const phone = await request.post("/api/workstation/qr/approve", {
        data: { challengeId, email: KIOSK_RESET_MEMBER.email, pin: WRONG_PIN },
      });
      expect(phone.status(), `attempt ${attempt}`).toBe(401);
    }

    // Without the sign-in in between, this fifth wrong PIN would lock the email.
    expect((await signIn(request, KIOSK_PIN)).status()).toBe(200);
    expect((await signIn(request, WRONG_PIN)).status()).toBe(401);
    expect((await signIn(request, KIOSK_PIN)).status()).toBe(200);
    await request.post("/api/workstation/logout");
  });

  test("locks an idle desk after 10 minutes and logs it out after 30", async ({
    page,
  }) => {
    // Drive the page's timers instead of waiting half an hour.
    await page.clock.install();
    await openDesk(page);
    expect(await submitPin(page, KIOSK_MEMBER.email, KIOSK_PIN)).toBe(200);
    await expect(page.getByRole("heading", { name: /Maya Chen/i })).toBeVisible({
      timeout: 20_000,
    });

    // A key press starts the idle time over, so 9 + 9 minutes is not idle.
    await page.clock.fastForward("09:00");
    await page.keyboard.press("Shift");
    await page.clock.fastForward("09:00");
    await expect(page.getByText("Idle lock")).toHaveCount(0);

    await page.clock.fastForward("01:01");
    await expect(
      page.getByRole("heading", { name: /Maya is still signed in/ }),
    ).toBeVisible();
    await page.locator("#lock-pin").fill(KIOSK_PIN);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("Idle lock")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Maya Chen/i })).toBeVisible();

    await page.clock.fastForward("30:01");
    await expect(page.getByRole("heading", { name: /Sign in to this desk/i })).toBeVisible({
      timeout: 20_000,
    });
  });
});
