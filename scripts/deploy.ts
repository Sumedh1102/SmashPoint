/**
 * Release step, run on every deploy before the new version serves traffic
 * (`npm run db:deploy`; the Vercel build and the Docker entrypoint call it):
 *   1. apply pending migrations (serialised with an advisory lock)
 *   2. with SEED_DEMO_DATA=true, load the demo facility into an empty database, or reload it
 *      when the database holds an older version of the demo data (never real data);
 *      otherwise run the idempotent production setup (catalogue + admin from env).
 */
import "dotenv/config";
import { count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { DEMO_MARKER, DEMO_VERSION, seedDemo } from "./lib/demo-seed";
import { runMigrations } from "./lib/migrate";
import { setupProduction } from "./lib/setup";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const db = drizzle(pool, { schema });
  try {
    console.log("⏳ Applying migrations…");
    await runMigrations(pool);
    console.log("✅ Database schema is up to date");

    const [{ n: users } = { n: 0 }] = await db.select({ n: count() }).from(schema.users);
    const [marker] = await db.select().from(schema.settings).where(eq(schema.settings.key, DEMO_MARKER)).limit(1);
    const demoVersion = (marker?.value as { version?: number } | undefined)?.version ?? 1;
    if (process.env.SEED_DEMO_DATA === "true" && (users === 0 || (marker && demoVersion < DEMO_VERSION))) {
      if (users > 0) console.log(`♻️  Demo data is version ${demoVersion}; reloading version ${DEMO_VERSION}`);
      await seedDemo(db);
    } else {
      const done = await setupProduction(db, process.env);
      console.log(done.length ? `✅ Set up: ${done.join(", ")}` : "✅ Nothing to set up");
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Deploy step failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
