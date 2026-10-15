import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/server/db/schema";
import { runMigrations } from "../../scripts/lib/migrate";
import { ensureAdmin, ensureCatalogue } from "../../scripts/lib/setup";
import { startFakeRazorpay } from "../fake-razorpay";
import { E2E } from "../../playwright.config";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL to a disposable PostgreSQL database (its name must contain 'test').");
  if (!/test/i.test(new URL(url).pathname)) throw new Error(`Refusing to reset ${new URL(url).pathname}: the E2E database's name must contain "test".`);
  const pool = new Pool({ connectionString: url, max: 2 });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS legacy_archive CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations(pool);
  const db = drizzle(pool, { schema });
  await ensureCatalogue(db);
  await ensureAdmin(db, { ADMIN_EMAIL: E2E.admin.email, ADMIN_PASSWORD: E2E.admin.password, ADMIN_NAME: "E2E Admin" });
  await pool.end();
  const fake = await startFakeRazorpay({ port: 4012, keyId: E2E.keyId, keySecret: E2E.keySecret });
  return async () => fake.close();
}
