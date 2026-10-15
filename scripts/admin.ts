/**
 * Administrator accounts from the command line (there is no public sign-up).
 *
 *   npm run admin -- create <email> "<name>"     create an administrator
 *   npm run admin -- password <email>            set a new password (signs out their sessions)
 *   npm run admin -- deactivate <email>          block sign-in
 *   npm run admin -- list
 *
 * The password is read from ADMIN_PASSWORD, or asked for when run in a terminal.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { MIN_ADMIN_PASSWORD } from "./lib/setup";

async function askPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) throw new Error("Set ADMIN_PASSWORD or run in a terminal.");
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
  let muted = false;
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => (muted ? undefined : write(s));
  const answer = await new Promise<string>((resolve) => {
    rl.question(`New password (min ${MIN_ADMIN_PASSWORD} characters): `, resolve);
    muted = true;
  });
  rl.close();
  process.stdout.write("\n");
  return answer;
}

async function main() {
  const [command, emailArg, name] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle(pool, { schema });
  const byEmail = (email: string) => eq(sql`lower(${schema.users.email})`, email.trim().toLowerCase());
  try {
    if (command === "list") {
      const rows = await db.select({ email: schema.users.email, name: schema.users.name, active: schema.users.isActive, lastLoginAt: schema.users.lastLoginAt }).from(schema.users).where(eq(schema.users.role, "ADMIN"));
      console.table(rows);
      return;
    }
    if (!emailArg || !["create", "password", "deactivate"].includes(command ?? "")) {
      throw new Error('Usage: npm run admin -- create <email> "<name>" | password <email> | deactivate <email> | list');
    }
    const email = emailArg.trim().toLowerCase();
    const [existing] = await db.select().from(schema.users).where(byEmail(email)).limit(1);

    if (command === "deactivate") {
      if (!existing) throw new Error(`No account for ${email}.`);
      await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, existing.id));
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, existing.id));
      console.log(`✅ ${email} can no longer sign in.`);
      return;
    }

    const password = await askPassword();
    if (password.length < MIN_ADMIN_PASSWORD) throw new Error(`The password must be at least ${MIN_ADMIN_PASSWORD} characters.`);
    const passwordHash = await hashPassword(password);
    if (command === "create") {
      if (existing) throw new Error(`${email} already exists. Use "password" to change its password.`);
      await db.insert(schema.users).values({ email, name: name?.trim() || "Administrator", passwordHash, role: "ADMIN" });
      console.log(`✅ Administrator ${email} created. Sign in at /admin/login.`);
    } else {
      if (!existing) throw new Error(`No account for ${email}.`);
      await db.update(schema.users).set({ passwordHash, role: "ADMIN", isActive: true }).where(eq(schema.users.id, existing.id));
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, existing.id));
      console.log(`✅ Password updated for ${email}; existing sessions were signed out.`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(`❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
