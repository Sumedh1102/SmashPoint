/**
 * Loads the demo facility (five courts + demo admin). DESTRUCTIVE: wipes every application
 * table first, so it refuses to run on a database that holds anything other than earlier demo
 * data (pass --force to override).
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { DEMO_MARKER, seedDemo } from "./lib/demo-seed";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  try {
    const [{ n: users } = { n: 0 }] = await db.select({ n: count() }).from(schema.users);
    const [marker] = await db.select().from(schema.settings).where(eq(schema.settings.key, DEMO_MARKER)).limit(1);
    if (users > 0 && !marker && !process.argv.includes("--force")) {
      throw new Error("This database has real (non-demo) data. Refusing to wipe it. Re-run with --force if you really mean it.");
    }
    await seedDemo(db);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
