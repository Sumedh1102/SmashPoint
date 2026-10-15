<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes (SmashPoint)

- Commands: `npm run dev`, `npm run typecheck` (runs `next typegen` first so `PageProps<"/route">` types exist), `npm test` (Vitest, pure logic), `npm run test:integration` (needs `TEST_DATABASE_URL`), `npx playwright test` (needs `E2E_DATABASE_URL`), `npm run db:migrate`, `npm run db:seed`, `npm run db:reset`, `npm run admin -- …`.
- Units: money is integer paise; dates are `YYYY-MM-DD` strings in Asia/Kolkata (`src/lib/time.ts`); times of day are minutes from midnight.
- Booking rules (7 AM–10 PM, 1–2 h on the hour, badminton closed 5–7 PM) live in `src/lib/booking/rules.ts` and are duplicated in the `enforce_booking_rules` trigger (`drizzle/0004_court_booking_focus.sql`); change both together.
- Formatting in client components must go through `src/lib/format.ts` (deterministic, no `Intl`) to avoid hydration mismatches.
- Admin server actions live in `src/server/actions/admin.ts`, return `ActionResult`, and start with `assertAdmin()`; admin pages use `requireAdmin()` from `src/server/auth/guards.ts`. Only ADMIN accounts can sign in; there are no customer accounts.
- Only export async actions from `"use server"` files; shared helpers go in `src/server/*`.
- Booking overlap is enforced by the `bookings_no_overlap` EXCLUDE constraint (`drizzle/0001_booking_constraints.sql`) as well as the court row lock in `createBookingHold`; keep both.
- A booking is confirmed only in `recordCapture` (`src/server/payments/service.ts`) from a payment verified with Razorpay; never mark bookings PAID/CONFIRMED elsewhere.
- Client forms dispatch server actions via `submitWithoutReset` (`src/components/forms/submit-without-reset.ts`); a plain `<form action={fn}>` makes React 19 wipe the fields whenever the action returns an error.
- Release step: `npm run db:deploy` (`scripts/deploy.ts`) runs migrations then first-run setup. The five courts are in `scripts/lib/catalogue.ts`; demo data in `scripts/lib/demo-seed.ts`. Deployment guide: `docs/DEPLOYMENT.md`.
