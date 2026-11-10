# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- Local Postgres: `docker compose up -d`, then `cp .env.example .env` (set `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`), `npm run db:deploy`, `npm run dev`. Admin at `/admin/login`.
- Checks before pushing: `npm run typecheck && npm test && npm run build`. CI (`.github/workflows/ci.yml`) also runs the integration suite, `npm run db:deploy` with `SEED_DEMO_DATA=true` on a fresh Postgres, and a Playwright E2E job. There is no lint script.
- `npm run build` needs `DATABASE_URL` set (the db module throws at import while Next collects route config) but never connects, so any `postgres://` URL works.
- Single test file: `npx vitest run src/lib/booking/engine.test.ts`; single test: `npx vitest run -t "name"`. Unit tests live next to code as `src/**/*.test.ts` (pure logic only).
- Integration tests: `TEST_DATABASE_URL=postgres://…/smashpoint_test npm run test:integration`. E2E: `E2E_DATABASE_URL=postgres://…/smashpoint_e2e_test npx playwright test` (starts `next dev` on :3100; `playwright.config.ts` honours `PLAYWRIGHT_CHROMIUM_PATH` for a preinstalled Chromium). Both drop and re-migrate their database, so its name must contain "test". Both use `tests/fake-razorpay.ts` via `RAZORPAY_API_BASE_URL`, which the app ignores in production builds. In this sandbox, prefix Next/Playwright commands with `NODE_USE_ENV_PROXY=1` so `next/font` can reach Google Fonts.
- Integration tests truncate the booking, payment and block tables before each test but keep courts, sports, settings and users: restore anything a test changes there (the existing tests do it in `finally` blocks).
- Schema change: edit `src/server/db/schema.ts`, `npm run db:generate`, commit the new `drizzle/` file. Hand-written SQL: `drizzle/0001_booking_constraints.sql` (EXCLUDE constraint), `drizzle/0004_court_booking_focus.sql` (legacy archive) and `drizzle/0005_rental_pricing.sql` (rate-card columns, current rules trigger). If drizzle-kit prompts for renames non-interactively, write the SQL by hand, add its entry to `drizzle/meta/_journal.json`, and write `drizzle/meta/NNNN_snapshot.json` with `generateDrizzleJson(schema, <previous snapshot's id>)` from `drizzle-kit/api` (run that script from inside the repo so the import resolves).
- Scripts that import `src/server/*` modules marked `server-only` must run with `tsx --conditions=react-server`, as `db:seed` / `db:deploy` / `admin` do.
- `npm run db:reset` drops every schema (it refuses only when `NODE_ENV=production`); development databases only.
- Demo admin after `db:seed`: `admin@example.com` / `onthesol@123`. Admin sign-in is rate-limited (6 attempts per account / 20 per IP per 15 min, in the shared `rate_limits` table): scripted logins against a dev database can lock you out — clear that table.

## Architecture

Next.js 16 App Router + Drizzle/node-postgres. `src/lib/*` is pure and shared with client components (booking rules and engine, pricing, formatting, validation); `src/server/*` modules import `server-only` (Vitest aliases it to a stub). `src/proxy.ts` (Next 16's middleware) only does an optimistic JWT check on `/admin/*`; the authoritative check is `getSession()` in `src/server/auth/session.ts` (signed cookie `sp_session`, path `/admin`, + a `sessions` row, so sessions are revocable; only active ADMIN users). Public POST routes call `assertSameOrigin` (`src/server/http.ts`: a browser `Origin` must match the host; requests without one pass) and `rateLimit` (`src/server/security.ts`).

Public flow: `src/app/(site)/page.tsx` (force-dynamic; live availability) renders hero, sports, court cards, rate card (`components/home/rental-pricing.tsx`), about (with the `#coaching` strip), `BookingWizard` and contact. "Book" links pre-select a sport/court through `BookingSelectionProvider` (`components/booking/selection-context.tsx`, wraps the site layout) or `?sport=`/`?court=`. The wizard calls `GET /api/availability`, then `POST /api/bookings` (validates, holds the slot as a PENDING booking under a court row lock, creates the Razorpay order, returns Checkout params), opens Razorpay Checkout, and posts the result to `POST /api/payments/verify`. Customers get a signed link `/booking/[code]?t=…` (HMAC of the code with `AUTH_SECRET`).

Layers under `src/server/`:
- `services/bookings.ts`: availability, `createBookingHold`, hold expiry/release, `transitionBooking`. `services/admin.ts`: cancel (with/without refund), blocks, court updates, booking hours. `services/jobs.ts`: what `/api/cron/reminders` runs (expire holds, `reconcilePayments`, reminders, cleanup). That route needs `Authorization: Bearer $CRON_SECRET` (the placeholder `change-me` is refused) and is called daily by Vercel Cron (`vercel.json`) and every 30 min by `.github/workflows/scheduler.yml` (secrets `APP_URL`, `CRON_SECRET`). Slot correctness doesn't depend on it: expired holds stop occupying slots by their `hold_expires_at`, and `createBookingHold` expires them for its court and date.
- `payments/razorpay.ts`: REST client (orders, payments, capture, refunds), signature checks, webhook parsing. `payments/service.ts`: lifecycle `startCheckout` → `verifyCheckout` / webhook / reconciliation → `recordCapture` (idempotent; the only place a booking becomes PAID→CONFIRMED) → `refundPayment` (payment becomes REFUNDED only when Razorpay reports the refund processed).
- `queries/public.ts`, `queries/admin.ts`: read models. `actions/admin.ts`: admin server actions. `email.ts`: optional Resend email, logged in `notification_deliveries`.

Booking status flow: PENDING → PAYMENT_INITIATED → PAID → CONFIRMED (+ CANCELLED / REFUNDED / EXPIRED). Settings (hold minutes, advance days, booking hours, email toggle) are JSON rows in `settings`, read via `server/settings.ts`, typed by `lib/settings-types.ts`; durations are fixed rules. Prices live on `courts` (`price_1h`, `price_2h`, `monthly_price_*`), not in settings.

`src/instrumentation.ts` runs `lib/env-check.ts` at startup: in production the server refuses to boot with a short/placeholder `AUTH_SECRET` or half-configured/malformed Razorpay keys; missing keys only disable online booking. Check this first when a deployment 500s everywhere.

Facility copy (name, contact placeholders, opening-hours placeholder) is in `src/content/site.ts`, sport copy in `src/content/sports.ts`; `site.url` falls back to Vercel's production URL when `NEXT_PUBLIC_SITE_URL` is unset. Imagery in `src/assets/images` are illustrative 3D renders; the logo emblem is `src/assets/brand/on-the-sol-emblem.png`.

Theme: the public site is dark (black/white with a neon accent); the admin keeps a light content area inside `.surface-light` — see the theme note in AGENTS.md. There are no scroll-reveal animations.

## Deployment

See `docs/DEPLOYMENT.md`. The public demo is deployed by `.github/workflows/deploy-demo.yml` → `.github/scripts/deploy-vercel-demo.sh` (needs repo secrets `VERCEL_TOKEN`, `DATABASE_URL`; optional Razorpay *test* keys; it manages the Vercel project's env vars and picks the function region from the DB host). `probe-demo.yml` fetches the live site plus env var metadata and runtime logs from GitHub's network. Vercel builds run `vercel-build` = `db:deploy && next build`; the Docker image runs a bundled `deploy.cjs` before `server.js`. The nightly demo reset (`db:seed`) refuses any database without the `demo_data` settings marker, so never point the demo workflow at a real database.
