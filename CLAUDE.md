# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- Local Postgres: `docker compose up -d`, then `cp .env.example .env` (set `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`), `npm run db:deploy`, `npm run dev`. Admin at `/admin/login`.
- Checks before pushing: `npm run typecheck && npm test && npm run build`. CI (`.github/workflows/ci.yml`) also runs the integration suite, `npm run db:deploy` with `SEED_DEMO_DATA=true` on a fresh Postgres, and a Playwright E2E job. There is no lint script.
- Single test file: `npx vitest run src/lib/booking/engine.test.ts`; single test: `npx vitest run -t "name"`. Unit tests live next to code as `src/**/*.test.ts` (pure logic only).
- Integration tests: `TEST_DATABASE_URL=postgres://…/smashpoint_test npm run test:integration` (resets that DB; its name must contain "test"). E2E: `E2E_DATABASE_URL=postgres://…/smashpoint_e2e_test npx playwright test` (starts `next dev` on :3100). Both use `tests/fake-razorpay.ts` via `RAZORPAY_API_BASE_URL`, which the app ignores in production builds. In this sandbox, prefix Next/Playwright commands with `NODE_USE_ENV_PROXY=1` so `next/font` can reach Google Fonts.
- Schema change: edit `src/server/db/schema.ts`, `npm run db:generate`, commit the new `drizzle/` file. Hand-written SQL: `drizzle/0001_booking_constraints.sql` (EXCLUDE constraint) and `drizzle/0004_court_booking_focus.sql` (rules trigger, legacy archive). If drizzle-kit prompts for renames non-interactively, write the SQL by hand and build the snapshot with `generateDrizzleJson` from `drizzle-kit/api`.
- Scripts that import `src/server/*` modules marked `server-only` must run with `tsx --conditions=react-server`, as `db:seed` / `db:deploy` / `admin` do.
- Demo admin after `db:seed`: `admin@example.com` / `SmashPoint@123`.

## Architecture

Next.js 16 App Router + Drizzle/node-postgres. `src/proxy.ts` (Next 16's middleware) only does an optimistic JWT check on `/admin/*`; the authoritative check is `getSession()` in `src/server/auth/session.ts` (signed cookie `sp_session`, path `/admin`, + a `sessions` row, so sessions are revocable; only active ADMIN users).

Public flow: `src/app/(site)/page.tsx` (force-dynamic; live availability) renders the hero, court cards and `BookingWizard`. The wizard calls `GET /api/availability`, then `POST /api/bookings` (validates, holds the slot as a PENDING booking under a court row lock, creates the Razorpay order, returns Checkout params), opens Razorpay Checkout, and posts the result to `POST /api/payments/verify`. Customers get a signed link `/booking/[code]?t=…` (HMAC of the code with `AUTH_SECRET`).

Layers under `src/server/`:
- `services/bookings.ts`: availability, `createBookingHold`, hold expiry/release, `transitionBooking`. `services/admin.ts`: cancel (with/without refund), blocks, court updates. `services/jobs.ts`: what `/api/cron/reminders` runs (expire holds, `reconcilePayments`, reminders, cleanup).
- `payments/razorpay.ts`: REST client (orders, payments, capture, refunds), signature checks, webhook parsing. `payments/service.ts`: lifecycle `startCheckout` → `verifyCheckout` / webhook / reconciliation → `recordCapture` (idempotent; the only place a booking becomes PAID→CONFIRMED) → `refundPayment` (payment becomes REFUNDED only when Razorpay reports the refund processed).
- `queries/public.ts`, `queries/admin.ts`: read models. `actions/admin.ts`: admin server actions. `email.ts`: optional Resend email, logged in `notification_deliveries`.

Booking status flow: PENDING → PAYMENT_INITIATED → PAID → CONFIRMED (+ CANCELLED / REFUNDED / EXPIRED). Settings (hold minutes, advance days, peak windows, email toggle) are JSON rows in `settings`, read via `server/settings.ts`, typed by `lib/settings-types.ts`; opening hours, durations and the badminton closure are fixed rules, not settings.

`src/instrumentation.ts` runs `lib/env-check.ts` at startup: in production the server refuses to boot with a short/placeholder `AUTH_SECRET` or half-configured/malformed Razorpay keys; missing keys only disable online booking. Check this first when a deployment 500s everywhere.

Facility copy (name, contact placeholders, hours) is in `src/content/site.ts`; `site.url` falls back to Vercel's production URL when `NEXT_PUBLIC_SITE_URL` is unset. Imagery in `src/assets/images` are illustrative 3D renders.

## Deployment

See `docs/DEPLOYMENT.md`. The public demo is deployed by `.github/workflows/deploy-demo.yml` → `.github/scripts/deploy-vercel-demo.sh` (needs repo secrets `VERCEL_TOKEN`, `DATABASE_URL`; optional Razorpay *test* keys; it manages the Vercel project's env vars and picks the function region from the DB host). `probe-demo.yml` fetches the live site plus env var metadata and runtime logs from GitHub's network. Vercel builds run `vercel-build` = `db:deploy && next build`; the Docker image runs a bundled `deploy.cjs` before `server.js`. The nightly demo reset (`db:seed`) refuses any database without the `demo_data` settings marker, so never point the demo workflow at a real database.
