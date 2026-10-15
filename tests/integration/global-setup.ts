import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../src/server/db/schema";
import { runMigrations } from "../../scripts/lib/migrate";
import { ensureCatalogue } from "../../scripts/lib/setup";
import { startFakeRazorpay } from "../fake-razorpay";

/** Resets the test database, applies every migration, loads the five courts and starts the fake Razorpay API. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Set TEST_DATABASE_URL to a disposable PostgreSQL database (its name must contain 'test').");
  if (!/test/i.test(new URL(url).pathname)) throw new Error(`Refusing to reset ${new URL(url).pathname}: the test database's name must contain "test".`);

  const pool = new Pool({ connectionString: url, max: 2 });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS legacy_archive CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await runMigrations(pool);
  await ensureCatalogue(drizzle(pool, { schema }));
  const fake = await startFakeRazorpay({ port: 4011, keyId: "rzp_test_IntegrationKey", keySecret: "integration_key_secret" });

  return async () => {
    await fake.close();
    await pool.end();
  };
}
