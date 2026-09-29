/**
 * Production first-run setup. Idempotent and non-destructive: it only fills what is missing.
 *  - default booking / notification / attendance settings
 *  - the starting catalogue (sports, courts, equipment, amenities, café menu, coaching adverts,
 *    programs, membership plans) — each only when its table is empty
 *  - an admin account for ADMIN_EMAIL (no password: the admin signs in with Firebase using
 *    that address, and the account links once the email is verified)
 */
import { count, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../src/server/db/schema";
import { DEFAULT_ATTENDANCE_SETTINGS, DEFAULT_BOOKING_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS } from "../../src/lib/settings-types";
import { COACHING_ADS, COURTS, EQUIPMENT, FACILITIES, FOOD_ITEMS, MEMBERSHIP_PLANS, PROGRAMS, SPORTS } from "./catalogue";

type Db = NodePgDatabase<typeof schema>;
type Env = Record<string, string | undefined>;

const isEmpty = async (db: Db, table: PgTable) => ((await db.select({ n: count() }).from(table))[0]?.n ?? 0) === 0;

export async function setupProduction(db: Db, env: Env) {
  const done: string[] = [];

  const inserted = await db
    .insert(schema.settings)
    .values([
      { key: "booking", value: DEFAULT_BOOKING_SETTINGS },
      { key: "notifications", value: DEFAULT_NOTIFICATION_SETTINGS },
      { key: "attendance", value: DEFAULT_ATTENDANCE_SETTINGS },
    ])
    .onConflictDoNothing()
    .returning({ key: schema.settings.key });
  if (inserted.length) done.push(`settings (${inserted.map((r) => r.key).join(", ")})`);

  if (await isEmpty(db, schema.sports)) {
    await db.insert(schema.sports).values(SPORTS);
    done.push(`${SPORTS.length} sports`);
  }
  const sportRows = await db.select({ id: schema.sports.id, slug: schema.sports.slug }).from(schema.sports);
  const sportId = (slug: string) => sportRows.find((r) => r.slug === slug)?.id;

  if (await isEmpty(db, schema.courts)) {
    const rows = COURTS.filter((c) => sportId(c.sport)).map(({ sport, ...c }) => ({ ...c, sportId: sportId(sport)! }));
    if (rows.length) await db.insert(schema.courts).values(rows);
    done.push(`${rows.length} courts`);
  }
  if (await isEmpty(db, schema.equipmentItems)) {
    const rows = EQUIPMENT.filter((e) => !e.sport || sportId(e.sport)).map(({ sport, ...e }) => ({ ...e, sportId: sport ? sportId(sport)! : null }));
    await db.insert(schema.equipmentItems).values(rows);
    done.push(`${rows.length} equipment items`);
  }
  if (await isEmpty(db, schema.facilities)) {
    await db.insert(schema.facilities).values(FACILITIES);
    done.push(`${FACILITIES.length} facilities`);
  }
  if (await isEmpty(db, schema.foodItems)) {
    await db.insert(schema.foodItems).values(FOOD_ITEMS);
    done.push(`${FOOD_ITEMS.length} café items`);
  }
  if (await isEmpty(db, schema.coachingAds)) {
    const rows = COACHING_ADS.map(({ sport, coachSlug: _coach, ...a }) => ({ ...a, sportId: sportId(sport) ?? null, coachId: null }));
    await db.insert(schema.coachingAds).values(rows);
    done.push(`${rows.length} coaching adverts`);
  }
  if (await isEmpty(db, schema.programs)) {
    await db.insert(schema.programs).values(PROGRAMS.map(({ coachSlug: _coach, ...p }) => ({ ...p, coachId: null })));
    done.push(`${PROGRAMS.length} programs`);
  }
  if (await isEmpty(db, schema.membershipPlans)) {
    await db.insert(schema.membershipPlans).values(MEMBERSHIP_PLANS);
    done.push(`${MEMBERSHIP_PLANS.length} membership plans`);
  }

  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const [{ n: adminCount } = { n: 0 }] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.role, "ADMIN"));
  if (email) {
    const [existing] = await db.select({ id: schema.users.id, role: schema.users.role }).from(schema.users).where(eq(sql`lower(${schema.users.email})`, email)).limit(1);
    if (!existing) {
      await db.insert(schema.users).values({ name: env.ADMIN_NAME?.trim() || "Facility Admin", email, phone: env.ADMIN_PHONE?.trim() || null, role: "ADMIN" });
      done.push(`admin account ${email} (sign in with Firebase using this email)`);
    } else if (existing.role !== "ADMIN" && adminCount === 0) {
      // Bootstrap: the owner registered before the first deploy with ADMIN_EMAIL set.
      await db.update(schema.users).set({ role: "ADMIN" }).where(eq(schema.users.id, existing.id));
      done.push(`promoted ${email} to admin`);
    }
  } else if (adminCount === 0) {
    console.warn("⚠️  No admin account exists. Set ADMIN_EMAIL and deploy again, then sign in with that email.");
  }

  return done;
}
