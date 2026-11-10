/**
 * Public demo database: WIPES the application tables and loads the catalogue courts plus a demo
 * administrator. No customers, bookings or payments are invented — the demo shows real
 * activity only (bookings made on it with Razorpay test keys).
 * Used by `npm run db:seed` and by `npm run db:deploy` when SEED_DEMO_DATA=true.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../src/server/db/schema";
import { hashPassword } from "../../src/server/auth/password";
import { ensureCatalogue } from "./setup";

/** Settings key marking a database as a demo (the seed refuses to wipe anything else). */
export const DEMO_MARKER = "demo_data";
/**
 * Bump when the demo data changes shape; `db:deploy` re-seeds demo databases on an older version.
 * 4 — On The Sol rate card (exact 1 h / 2 h prices, monthly plans), no badminton closure.
 */
export const DEMO_VERSION = 4;

export const DEMO_ADMIN = { email: "admin@example.com", password: "onthesol@123", name: "Demo Admin" } as const;

export async function seedDemo(db: NodePgDatabase<typeof schema>) {
  console.log("🌱 Loading the demo facility (5 courts, demo admin; no bookings)…");
  await db.execute(sql`TRUNCATE TABLE
    audit_logs, settings, notification_deliveries, payment_webhook_events, payments, booking_events,
    bookings, court_blocks, courts, sports, sessions, rate_limits, users
    RESTART IDENTITY CASCADE`);
  // Earlier demo versions' data, archived by migration 0004. Demo databases only.
  await db.execute(sql`DROP SCHEMA IF EXISTS legacy_archive CASCADE`);

  await ensureCatalogue(db);
  await db.insert(schema.users).values({ name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, passwordHash: await hashPassword(DEMO_ADMIN.password), role: "ADMIN" });
  await db.insert(schema.settings).values({ key: DEMO_MARKER, value: { seededAt: new Date().toISOString(), version: DEMO_VERSION } });
  console.log(`✅ Demo ready. Admin: ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
}
