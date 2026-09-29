# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- Local Postgres: `docker compose up -d`, then `cp .env.example .env` (set `AUTH_SECRET`), `npm run db:migrate && npm run db:seed`, `npm run dev`.
- Checks before pushing: `npm run typecheck && npm test && npm run build` (CI in `.github/workflows/ci.yml` also runs `npm run db:deploy` with `SEED_DEMO_DATA=true` on a fresh Postgres). There is no lint script.
- Single test file: `npx vitest run src/lib/booking/engine.test.ts`; single test: `npx vitest run -t "name"`. Tests live next to code as `src/**/*.test.ts` (pure logic only; nothing hits the DB).
- Schema change: edit `src/server/db/schema.ts`, `npm run db:generate`, commit the new `drizzle/` file. Hand-written SQL (the booking EXCLUDE constraint) lives in `drizzle/0001_booking_constraints.sql`.
- Scripts that import `src/server/*` must run with `tsx --conditions=react-server` (because of `server-only`), as the `db:seed` / `db:deploy` scripts do.
- Demo accounts after seeding: `admin@ / manager@ / coach@ / reception@ / student@ / parent@smashpoint.in`, password `SmashPoint@123`.

## Architecture

Next.js 16 App Router + Drizzle/node-postgres. `src/proxy.ts` (Next 16's middleware) only does an optimistic JWT check on `/dashboard/*`; the authoritative check is `getSession()` in `src/server/auth/session.ts` (signed cookie `sp_session` + a `sessions` row, so sessions are revocable).

Layers under `src/server/`:
- `queries/*`: read models for pages. Public ones (`public.ts`) are wrapped in `unstable_cache` with tags from `cache.ts`; DB-backed public pages are `force-dynamic` so `next build` needs no database.
- `services/*`: domain logic with transactions. `bookings.ts` (availability, quote, `createBooking` with court row lock, reschedule, hold expiry), `booking-lifecycle.ts`, `attendance.ts` (QR check-in), `jobs.ts` (everything `/api/cron/reminders` runs), `password-reset.ts`.
- `actions/*`: `"use server"` entry points returning `ActionResult` (`actions/result.ts`); JSON API routes in `src/app/api/*` use `server/http.ts` (`assertSameOrigin`, `errorResponse`).
- `payments/`: provider-agnostic. `PaymentProvider` (`types.ts`) implemented by `providers/mock.ts` (sandbox, only allowed with `DEMO_MODE=true` in production) and `providers/razorpay.ts`; `service.ts` owns the lifecycle (`startPayment` → `capturePayment`/`failPayment` → fulfilment → `refundPayment`), idempotent across the client verify call and the webhook (`api/payments/webhook/[provider]`).
- `notifications/`: `notify()` writes an in-app notification and fans out to Email (Resend) / SMS / WhatsApp adapters (the last two are stubs), logging each attempt in `notification_deliveries`.

Booking pricing/availability is pure and unit-tested in `src/lib/booking/engine.ts`; booking status flow is PENDING → PAYMENT_INITIATED → PAID → CONFIRMED (+ CANCELLED/REFUNDED/EXPIRED). Settings (hours, peak windows, durations, notification toggles) are JSON rows in the `settings` table read via `server/settings.ts`, typed by `lib/settings-types.ts`.

`src/instrumentation.ts` runs `lib/env-check.ts` at startup: in production the server refuses to boot (500 on every route) with a short/placeholder `AUTH_SECRET`, `PAYMENT_PROVIDER=mock` without `DEMO_MODE=true`, or Razorpay without its three keys. Check this first when a deployment 500s everywhere.

Academy copy (name, contact, stats, FAQ) is in `src/content/site.ts`; `site.url` falls back to Vercel's production URL when `NEXT_PUBLIC_SITE_URL` is unset.

## Deployment

See `docs/DEPLOYMENT.md`. The public demo is deployed by `.github/workflows/deploy-demo.yml` → `.github/scripts/deploy-vercel-demo.sh` (needs repo secrets `VERCEL_TOKEN`, `DATABASE_URL`; it manages the Vercel project's env vars and picks the function region from the DB host). `probe-demo.yml` fetches the live site plus env var metadata and runtime logs from GitHub's network, which is the way to debug the deployment when this environment can't reach Vercel. Vercel builds run `vercel-build` = `db:deploy && next build`; the Docker image runs a bundled `deploy.cjs` before `server.js`. The nightly demo reset (`db:seed`) refuses any database without the `demo_data` settings marker, so never point the demo workflow at a real academy database.
