/**
 * Production configuration checks, run once when the server starts (src/instrumentation.ts).
 * Errors stop the server from booting with an unsafe configuration; warnings are logged.
 * Pure function so it can be unit-tested.
 */
type Env = Record<string, string | undefined>;

const PLACEHOLDER_SECRETS = new Set(["change-me", "change-me-to-a-long-random-string-of-at-least-32-chars"]);

export function checkProductionEnv(env: Env): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.DATABASE_URL) errors.push("DATABASE_URL is not set.");

  const secret = env.AUTH_SECRET ?? "";
  if (secret.length < 32 || PLACEHOLDER_SECRETS.has(secret)) {
    errors.push("AUTH_SECRET must be a random string of at least 32 characters (generate one with `openssl rand -base64 32`).");
  }

  // Razorpay: all-or-nothing. Without keys the site runs but online booking is switched off.
  const keyId = env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim() ?? "";
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? "";
  if (!keyId && !keySecret) {
    warnings.push("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set: online booking is disabled until they are.");
  } else {
    if (!keyId || !keySecret) errors.push("Set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (or neither).");
    if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) errors.push("RAZORPAY_KEY_ID doesn't look like a Razorpay key id (rzp_live_… or rzp_test_…).");
    if (keyId.startsWith("rzp_test_")) warnings.push("Razorpay is in TEST mode (rzp_test_ key): no real money is collected.");
    if (!webhookSecret) {
      warnings.push("RAZORPAY_WEBHOOK_SECRET is not set: webhooks are rejected, so payments are confirmed only by the browser callback and the scheduled reconciliation job.");
    }
  }

  const siteUrl = env.NEXT_PUBLIC_SITE_URL || (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "");
  if (!siteUrl) warnings.push("NEXT_PUBLIC_SITE_URL is not set; links in emails and the sitemap will point at localhost.");
  else if (!siteUrl.startsWith("https://")) warnings.push(`NEXT_PUBLIC_SITE_URL (${siteUrl}) is not https.`);

  const cron = env.CRON_SECRET ?? "";
  if (!cron || PLACEHOLDER_SECRETS.has(cron)) warnings.push("CRON_SECRET is not set; hold expiry, payment reconciliation and reminders won't run on a schedule.");
  if (!env.RESEND_API_KEY) warnings.push("RESEND_API_KEY is not set; booking confirmation emails will not be sent.");
  if (env.DEMO_MODE === "true") warnings.push("DEMO_MODE is on: the demo admin login is shown on /admin/login.");

  return { errors, warnings };
}
