import { describe, expect, it } from "vitest";
import { checkProductionEnv } from "./env-check";

const base = {
  DATABASE_URL: "postgres://u:p@db/app",
  AUTH_SECRET: "x".repeat(44),
  RAZORPAY_KEY_ID: "rzp_live_AbC123",
  RAZORPAY_KEY_SECRET: "s",
  RAZORPAY_WEBHOOK_SECRET: "w",
  NEXT_PUBLIC_SITE_URL: "https://courts.example.com",
  CRON_SECRET: "c".repeat(32),
  RESEND_API_KEY: "re_x",
};

describe("checkProductionEnv", () => {
  it("accepts a complete production config", () => {
    expect(checkProductionEnv(base)).toEqual({ errors: [], warnings: [] });
  });

  it("rejects missing or placeholder secrets", () => {
    expect(checkProductionEnv({ ...base, DATABASE_URL: undefined }).errors).toHaveLength(1);
    expect(checkProductionEnv({ ...base, AUTH_SECRET: "short" }).errors[0]).toMatch(/AUTH_SECRET/);
    expect(checkProductionEnv({ ...base, AUTH_SECRET: "change-me-to-a-long-random-string-of-at-least-32-chars" }).errors[0]).toMatch(/AUTH_SECRET/);
  });

  it("runs without Razorpay keys but warns that online booking is off", () => {
    const result = checkProductionEnv({ ...base, RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "", RAZORPAY_WEBHOOK_SECRET: "" });
    expect(result.errors).toEqual([]);
    expect(result.warnings.join()).toMatch(/online booking is disabled/);
  });

  it("refuses half-configured or malformed Razorpay keys", () => {
    expect(checkProductionEnv({ ...base, RAZORPAY_KEY_SECRET: "" }).errors.join()).toMatch(/both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET/);
    expect(checkProductionEnv({ ...base, RAZORPAY_KEY_ID: "pk_live_123" }).errors.join()).toMatch(/doesn't look like/);
  });

  it("warns about test mode and a missing webhook secret", () => {
    expect(checkProductionEnv({ ...base, RAZORPAY_KEY_ID: "rzp_test_123" }).warnings.join()).toMatch(/TEST mode/);
    expect(checkProductionEnv({ ...base, RAZORPAY_WEBHOOK_SECRET: "" }).warnings.join()).toMatch(/RAZORPAY_WEBHOOK_SECRET/);
  });

  it("falls back to the Vercel production URL and warns on non-https URLs", () => {
    expect(checkProductionEnv({ ...base, NEXT_PUBLIC_SITE_URL: undefined, NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "courts.vercel.app" }).warnings).toEqual([]);
    expect(checkProductionEnv({ ...base, NEXT_PUBLIC_SITE_URL: "http://x.in" }).warnings[0]).toMatch(/https/);
  });
});
