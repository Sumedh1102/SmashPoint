# Deploying On The Sol Sports Academy

The app is a standard Next.js server backed by PostgreSQL. Every deploy runs one release step,
`npm run db:deploy`, which:

1. applies pending database migrations (safe to run from several instances at once), then
2. fills in anything missing: default settings, the three sports and five courts
   (`scripts/lib/catalogue.ts`, matched by slug) and an administrator from `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`. It never deletes anything and never touches bookings, payments or
   passwords that already exist. When the catalogue has a newer `CATALOGUE_REVISION` than the
   database (settings key `catalogue`), it applies the catalogue's rate card (prices, monthly
   plans, surfaces, descriptions) to the catalogue courts **once**, by slug — see
   [Rate card upgrade](#rate-card-upgrade-catalogue-revision-2). Later admin edits are kept.
3. With `SEED_DEMO_DATA=true` **and an empty (or demo) database**, it loads the demo facility
   instead: the five courts and a demo admin, no bookings.

In production the server checks its configuration on startup and refuses to boot with an unsafe
setup (missing/weak `AUTH_SECRET`, half-configured or malformed Razorpay keys). Missing Razorpay
keys are allowed: the site runs, and online booking shows as unavailable until keys are added.

## Upgrading a database from the earlier academy app

Migration `0004_court_booking_focus` turns the old academy-management database into the
court-booking schema **without deleting data**:

- bookings and payments stay where they are;
- tables of removed features (students, parents, coaches, programs, batches, attendance,
  performance, memberships, events, coupons, equipment, gallery/café content, notifications,
  enquiries, uploads) move to the `legacy_archive` schema, together with the links kept rows had
  to them (`legacy_archive.booking_links`, `payment_links`, `user_profiles`, …);
- non-admin accounts (coaches, customers, managers, reception) are deactivated, not deleted.

Take a backup first (`pg_dump`), deploy, and check the site. Existing courts keep working; the
setup step adds any of the five standard courts that are missing and logs any *other* active
courts — set those to **Inactive** in `/admin/courts` if they no longer exist. When you no longer
need the archive: `DROP SCHEMA legacy_archive CASCADE;`.

## Rate card upgrade (catalogue revision 2)

The academy's published rate card replaced the earlier demo pricing (off-peak/peak hourly
rates). Migration `0005_rental_pricing` and catalogue revision 2 together:

- give every court an exact **1-hour** and **2-hour** price (`price_1h`, `price_2h`; the
  two-hour price is a package price, not twice the hourly price) and optional **monthly plan**
  prices (1, 3, 6, 12 months) plus a playing-surface label. There is no peak surcharge;
- copy the old `hourly_rate` / `peak_hourly_rate` of every court to
  `legacy_archive.court_rates` before dropping those columns. Courts outside the catalogue keep
  their previous off-peak price (1 h = old hourly rate, 2 h = twice that) until an admin edits
  them;
- set the five catalogue courts (matched by slug) to the rate card once:

  | Court | 1 h | 2 h | 1 month | 3 months | 6 months | 12 months |
  | --- | ---: | ---: | ---: | ---: | ---: | ---: |
  | `badminton-court-1` — Green Mat (5 mm) | ₹500 | ₹900 | ₹7,000 | ₹19,500 | ₹37,500 | ₹72,000 |
  | `badminton-court-2` — Wooden Finish (2.5 mm) | ₹400 | ₹700 | ₹6,000 | ₹16,500 | ₹31,500 | ₹60,000 |
  | `pickleball-court-1`, `pickleball-court-2` | ₹400 | ₹700 | ₹5,500 | ₹15,000 | ₹27,500 | ₹50,000 |
  | `basketball-court-1` | ₹700 | ₹1,300 | ₹7,000 | ₹19,500 | ₹37,500 | ₹72,000 |

- remove the hard-coded badminton closure (5–7 PM) from the database rules trigger and the app,
  since the facility hasn't confirmed it. If it is confirmed, create it as a recurring block on
  each badminton court in `/admin/courts` (date range + hours);
- make the online booking hours a setting (`booking` settings row, `openMinute`/`closeMinute`,
  default 7 AM – 10 PM, editable in `/admin/courts`). The trigger reads the same row.

Existing bookings and payments are untouched: a booking keeps the amount that was charged.
Nothing is reset or truncated. The demo (`SEED_DEMO_DATA=true`) is reloaded because
`DEMO_VERSION` moved to 4.

## Razorpay

1. In the Razorpay Dashboard → **Account & Settings → API Keys**, generate keys. Start with
   **Test mode** (`rzp_test_…`); switch to live keys only after a full test booking.
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the server. The key secret is used only
   on the server (order creation, signature checks, refunds); only the key id reaches browsers.
3. **Webhook:** Dashboard → **Account & Settings → Webhooks → Add new webhook**
   - URL: `https://<your-domain>/api/payments/webhook/razorpay`
   - Secret: a random string — put the same value in `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`,
     `refund.processed`, `refund.failed`
4. **Payment capture:** automatic capture (the Razorpay default) is recommended. If your account
   is set to manual capture, the server captures authorized payments itself after verifying them.
5. **Test the whole flow** in test mode: book a slot, pay with a Razorpay test card/UPI ID, check
   the confirmation page, the booking in `/admin`, and that the webhook shows as delivered in the
   Razorpay dashboard. Then try a cancel-and-refund from `/admin`.

How payment confirmation works: the browser's Checkout success callback is verified on the
server (HMAC signature, then the payment is fetched from Razorpay to check order, amount,
currency and status). Webhooks and the scheduled reconciliation job confirm payments whose
callback never arrived (closed tab, network drop). All three paths are idempotent, so a payment
is never applied twice; a second payment on the same order is refunded automatically, as is a
payment that arrives after its slot was released and taken by someone else.

## Option A: Vercel + Neon (recommended)

1. **Database.** In Vercel → Storage add **Neon** (or create a project at neon.tech) in
   *AWS Asia Pacific (Mumbai)*. Use the **pooled** connection string as `DATABASE_URL`.
2. **Project.** Vercel → Add New → Project → import this repository. The build runs
   `vercel-build`, which applies migrations before building.
3. **Environment variables** (Production):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the pooled Neon URL |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | your first administrator (password ≥ 12 characters) |
   | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | see Razorpay above |
   | `CRON_SECRET` | `openssl rand -hex 24` (Vercel Cron sends it automatically) |
   | `RESEND_API_KEY`, `EMAIL_FROM` | recommended, for confirmation emails |
   | `NEXT_PUBLIC_SITE_URL` | once you add a custom domain, e.g. `https://courts.example.com` |

4. **Deploy.** The build log shows `✅ Database schema is up to date` and what was set up.
5. **Custom domain.** Add it under Project → Domains, set `NEXT_PUBLIC_SITE_URL` and redeploy.

`vercel.json` pins functions to Mumbai (`bom1`) and runs the scheduled job once a day (the Hobby
plan limit). For more frequent reconciliation and reminders use the GitHub scheduler below, or
Vercel Pro with a shorter schedule.

## Option B: Docker (Railway, Render, Fly.io, Cloud Run, a VPS)

The `Dockerfile` builds a standalone image. On start it runs the release step, then the server.
It listens on `$PORT` (default 3000) with a health check at `/api/health`.

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://courts.example.com -t smashpoint .
docker run -p 3000:3000 --env-file .env.production smashpoint
```

Or the whole stack locally with Postgres: `docker compose --profile app up --build`.

## Scheduled jobs

`GET /api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` releases expired payment
holds, reconciles recent unfinished Razorpay orders and pending refunds, sends reminder emails
for upcoming bookings and cleans up old sessions. It is idempotent.

- **Vercel:** already scheduled in `vercel.json` (daily on Hobby).
- **Anywhere:** `.github/workflows/scheduler.yml` calls it every 30 minutes. Add repository
  secrets `APP_URL` and `CRON_SECRET`. GitHub runs scheduled workflows from the default branch.

Holds are also released on demand whenever someone tries to book the same court, so an expired
hold never blocks a slot even if the job hasn't run.

## Public demo, deployed by GitHub Actions

`.github/workflows/deploy-demo.yml` deploys a demo to Vercel: it creates the project if needed,
sets the environment (generating `AUTH_SECRET` and `CRON_SECRET` once), deploys and smoke-tests
the live URL.

1. Create a Postgres database **only for the demo** and copy its pooled connection string.
2. Create a Vercel access token.
3. Add repository secrets `DATABASE_URL` and `VERCEL_TOKEN`. Optionally add Razorpay **test**
   keys as `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (and `RAZORPAY_WEBHOOK_SECRET`) to enable
   checkout on the demo; live keys are refused.
4. Run the **Deploy demo** workflow. Every push to the branch redeploys.

The demo admin is `admin@example.com` / `SmashPoint@123` at `/admin/login`. A nightly job
reloads the demo data; it refuses to touch a database that wasn't created as a demo, so never
point the demo workflow at a real database.

## After the first deploy

- [ ] Sign in at `/admin/login` and change the password (Account).
- [ ] Replace every `[placeholder]` in `src/content/site.ts` (phone, email, address, legal name)
      and complete the bracketed sections of the policy pages (`src/app/(site)/{privacy,terms,cancellation-policy}`).
- [ ] Check court prices (1 h, 2 h, monthly plans), surfaces, descriptions and status in `/admin/courts`.
- [ ] Confirm the online booking hours with the academy and set them in `/admin/courts`
      (defaults to 7 AM – 10 PM), and set `openingHours` in `src/content/site.ts`.
- [ ] Confirm the number of pickleball courts before advertising it (the system has two).
- [ ] Complete the Razorpay steps above and make a test booking end to end.
- [ ] Email: verify your sending domain in Resend and set `EMAIL_FROM` to an address on it.
- [ ] Point an uptime monitor at `https://<your-domain>/api/health`.
- [ ] Turn on automated backups / point-in-time restore for the database.

## Operations

- **Administrators:** `npm run admin -- create <email> "Name"`, `npm run admin -- password <email>`,
  `npm run admin -- deactivate <email>`, `npm run admin -- list` (reads `DATABASE_URL`; the
  password comes from `ADMIN_PASSWORD` or is prompted for).
- **Logs:** configuration problems are logged with `[config]` at startup; unexpected errors with
  `[api]`, `[action]`, `[webhook]` or `[payments]`.
- **Schema changes:** edit `src/server/db/schema.ts`, run `npm run db:generate`, commit the new
  file in `drizzle/`. The next deploy applies it.
- **Rotating `AUTH_SECRET`** signs every administrator out and invalidates customers' booking
  links (they are signed with it).
- **Never run `npm run db:seed` against production.** It wipes tables, and refuses to run on a
  database that holds real data unless forced.
