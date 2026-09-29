import { z } from "zod";
import { createSession } from "@/server/auth/session";
import { FirebaseTokenError, verifyFirebaseIdToken } from "@/server/auth/firebase";
import { resolveFirebaseUser } from "@/server/auth/identity";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/server/http";
import { rateLimit } from "@/server/security";
import { nameSchema, phoneSchema } from "@/lib/validation";
import { isFirebaseConfigured } from "@/lib/firebase/config";

const schema = z.object({
  idToken: z.string().min(20).max(4096),
  name: nameSchema.optional(),
  phone: z.union([z.literal(""), phoneSchema]).optional(),
  next: z.string().max(300).optional(),
});

/** Only same-site relative redirects after sign-in. */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}

/**
 * Exchanges a Firebase ID token (from email/password or Google sign-in in the browser) for
 * the app's own session cookie. The token is verified server-side; the role comes from the
 * database, never from the client.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!isFirebaseConfigured) throw new DomainError("Sign-in isn't configured on this site yet.", "FORBIDDEN", 503);
    if (!(await rateLimit(`auth-session:${clientIp(req)}`, 30, 15 * 60_000)).ok) {
      throw new DomainError("Too many sign-in attempts. Please wait a few minutes.", "INVALID_INPUT", 429);
    }
    const input = schema.parse(await readJson(req, 8192));
    const identity = await verifyFirebaseIdToken(input.idToken);
    const user = await resolveFirebaseUser(identity, { name: input.name, phone: input.phone || null });
    await createSession(user);
    return json({ ok: true, redirect: safeNext(input.next) });
  } catch (err) {
    if (err instanceof FirebaseTokenError) return json({ error: err.message, code: "INVALID_TOKEN" }, { status: 401 });
    return errorResponse(err);
  }
}
