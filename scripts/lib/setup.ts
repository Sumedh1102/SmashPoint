/**
 * Production first-run setup, run by `npm run db:deploy` after migrations. Idempotent and
 * non-destructive: it only adds what is missing and never changes prices, courts or
 * passwords that already exist.
 *  - default booking and notification settings
 *  - the three sports and five courts (matched by slug)
 *  - an administrator for ADMIN_EMAIL with ADMIN_PASSWORD (only if that account doesn't exist
 *    yet, or exists without a password)
 */
import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../src/server/db/schema";
import { hashPassword } from "../../src/server/auth/password";
import { DEFAULT_BOOKING_SETTINGS, DEFAULT_NOTIFICATION_SETTINGS } from "../../src/lib/settings-types";
import { COURTS, SPORTS } from "./catalogue";

type Db = NodePgDatabase<typeof schema>;
type Env = Record<string, string | undefined>;

export const MIN_ADMIN_PASSWORD = 12;

export async function ensureCatalogue(db: Db) {
  const done: string[] = [];
  const inserted = await db
    .insert(schema.settings)
    .values([
      { key: "booking", value: DEFAULT_BOOKING_SETTINGS },
      { key: "notifications", value: DEFAULT_NOTIFICATION_SETTINGS },
    ])
    .onConflictDoNothing()
    .returning({ key: schema.settings.key });
  if (inserted.length) done.push(`settings (${inserted.map((r) => r.key).join(", ")})`);

  const newSports = await db.insert(schema.sports).values(SPORTS).onConflictDoNothing({ target: schema.sports.slug }).returning({ slug: schema.sports.slug });
  if (newSports.length) done.push(`sports: ${newSports.map((s) => s.slug).join(", ")}`);

  const sportRows = await db.select({ id: schema.sports.id, slug: schema.sports.slug }).from(schema.sports);
  const sportId = (slug: string) => sportRows.find((r) => r.slug === slug)!.id;
  const newCourts = await db
    .insert(schema.courts)
    .values(COURTS.map(({ sport, ...c }) => ({ ...c, sportId: sportId(sport) })))
    .onConflictDoNothing({ target: schema.courts.slug })
    .returning({ name: schema.courts.name });
  if (newCourts.length) done.push(`courts: ${newCourts.map((c) => c.name).join(", ")}`);

  // Courts from an earlier setup that aren't part of the five stay visible until an admin
  // deactivates them; point that out instead of guessing.
  const extra = await db
    .select({ name: schema.courts.name })
    .from(schema.courts)
    .where(and(notInArray(schema.courts.slug, COURTS.map((c) => c.slug)), ne(schema.courts.status, "INACTIVE")));
  if (extra.length) {
    console.warn(`⚠️  Courts outside the standard five are still bookable: ${extra.map((c) => c.name).join(", ")}. Set them to Inactive in /admin/courts if they no longer exist.`);
  }
  return done;
}

export async function ensureAdmin(db: Db, env: Env) {
  const done: string[] = [];
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD ?? "";
  if (email) {
    const [existing] = await db.select().from(schema.users).where(eq(sql`lower(${schema.users.email})`, email)).limit(1);
    if (!existing || !existing.passwordHash) {
      if (password.length < MIN_ADMIN_PASSWORD) {
        console.warn(`⚠️  ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD} characters; admin ${email} was not ${existing ? "updated" : "created"}.`);
      } else if (!existing) {
        await db.insert(schema.users).values({ name: env.ADMIN_NAME?.trim() || "Administrator", email, passwordHash: await hashPassword(password), role: "ADMIN" });
        done.push(`admin account ${email}`);
      } else {
        await db.update(schema.users).set({ passwordHash: await hashPassword(password), role: "ADMIN", isActive: true }).where(eq(schema.users.id, existing.id));
        done.push(`password set for admin ${email}`);
      }
    }
  }
  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.role, "ADMIN"), eq(schema.users.isActive, true), sql`${schema.users.passwordHash} IS NOT NULL`))
    .limit(1);
  if (!admin) console.warn("⚠️  No administrator can sign in yet. Set ADMIN_EMAIL and ADMIN_PASSWORD and deploy again, or run `npm run admin -- create`.");
  return done;
}

export async function setupProduction(db: Db, env: Env) {
  return [...(await ensureCatalogue(db)), ...(await ensureAdmin(db, env))];
}
