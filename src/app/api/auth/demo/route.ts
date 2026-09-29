import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { createSession } from "@/server/auth/session";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/server/http";
import { rateLimit } from "@/server/security";
import { DEMO_EMAILS } from "@/lib/demo";
import { demoSignInEnabled } from "@/server/auth/demo";

const schema = z.object({ email: z.string().email() });

/** One-click sign-in as a seeded demo account (no password; demo/dev only). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!demoSignInEnabled()) throw new DomainError("Not found.", "NOT_FOUND", 404);
    if (!(await rateLimit(`auth-demo:${clientIp(req)}`, 60, 15 * 60_000)).ok) throw new DomainError("Too many attempts.", "INVALID_INPUT", 429);
    const { email } = schema.parse(await readJson(req));
    if (!DEMO_EMAILS.includes(email.toLowerCase())) throw new DomainError("That isn't a demo account.", "FORBIDDEN", 403);
    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, email.toLowerCase())).limit(1);
    if (!user || !user.isActive) throw new DomainError("Demo data isn't loaded. Run the seed first.", "NOT_FOUND", 404);
    await createSession(user);
    return json({ ok: true, redirect: "/dashboard" });
  } catch (err) {
    return errorResponse(err);
  }
}
