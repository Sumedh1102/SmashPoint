import "dotenv/config";
import { Pool } from "pg";

/** Drops every table (public schema, legacy archive, drizzle migration journal). Development only. */
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS legacy_archive CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("🧹 Database reset");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
