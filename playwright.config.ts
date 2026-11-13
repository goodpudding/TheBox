import { defineConfig, devices } from "@playwright/test";

// E2E_PORT lets two checkouts run the suite at once without sharing a server.
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Sandboxes that ship their own Chromium point at it here.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}`,
    // Auth.js refuses to start without a secret. This one only signs local
    // test sessions.
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-only-secret-not-for-production",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
