import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests: the real UI and API on a Next.js dev server, a disposable database
 * (E2E_DATABASE_URL — its name must contain "test"; it is reset) and a local fake of
 * Razorpay's API and Checkout script (tests/fake-razorpay.ts, tests/e2e/fixtures.ts).
 *   E2E_DATABASE_URL=postgres://…/smashpoint_e2e_test npx playwright test
 * These verify the integration logic; they are not a substitute for a test-mode payment with
 * real Razorpay keys.
 */
const PORT = 3100;
export const E2E = {
  baseURL: `http://localhost:${PORT}`,
  fakeRazorpay: "http://127.0.0.1:4012",
  keyId: "rzp_test_E2EKey",
  keySecret: "e2e_key_secret",
  webhookSecret: "e2e_webhook_secret",
  admin: { email: "admin@e2e.test", password: "e2e-admin-password-123" },
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: E2E.baseURL,
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    // Reduced motion keeps scrolling instant, so taps land where Playwright expects them.
    { name: "mobile", use: { ...devices["Pixel 7"], contextOptions: { reducedMotion: "reduce" } }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `${E2E.baseURL}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      AUTH_SECRET: "e2e-auth-secret-0123456789-abcdefghijkl",
      NEXT_PUBLIC_SITE_URL: E2E.baseURL,
      RAZORPAY_KEY_ID: E2E.keyId,
      RAZORPAY_KEY_SECRET: E2E.keySecret,
      RAZORPAY_WEBHOOK_SECRET: E2E.webhookSecret,
      RAZORPAY_API_BASE_URL: `${E2E.fakeRazorpay}/v1`,
    },
  },
});
