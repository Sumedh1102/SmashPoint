import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration tests: real PostgreSQL (TEST_DATABASE_URL, a disposable database whose name
 * contains "test" — it is reset) + the booking and payment services + a local fake of the
 * Razorpay API (tests/fake-razorpay.ts).
 *   TEST_DATABASE_URL=postgres://…/smashpoint_test npm run test:integration
 */
const FAKE_PORT = 4011;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      AUTH_SECRET: "integration-test-secret-0123456789abcdef",
      RAZORPAY_KEY_ID: "rzp_test_IntegrationKey",
      RAZORPAY_KEY_SECRET: "integration_key_secret",
      RAZORPAY_WEBHOOK_SECRET: "integration_webhook_secret",
      RAZORPAY_API_BASE_URL: `http://127.0.0.1:${FAKE_PORT}/v1`,
      FAKE_RAZORPAY_URL: `http://127.0.0.1:${FAKE_PORT}`,
    },
  },
});
