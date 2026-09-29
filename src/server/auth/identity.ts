import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { audit } from "@/server/audit";
import type { FirebaseIdentity } from "./firebase";

export const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  smsNotifications: false,
  whatsappNotifications: true,
  bookingReminders: true,
  classReminders: true,
  marketing: false,
};

export type SignInProfile = { name?: string | null; phone?: string | null };

/**
 * Maps a verified Firebase identity to the application user (profile + role).
 *
 * - Known Firebase uid → that user.
 * - Unlinked account with the same email (staff invited by an admin, or a user who existed
 *   before Firebase) → linked, but only when Firebase has verified the email, so nobody can
 *   claim a staff account by registering its address first.
 * - Otherwise → a new customer account.
 *
 * Roles are never taken from the client.
 */
export async function resolveFirebaseUser(identity: FirebaseIdentity, profile: SignInProfile = {}): Promise<User> {
  const [byUid] = await db.select().from(users).where(eq(users.firebaseUid, identity.uid)).limit(1);
  if (byUid) {
    if (!byUid.isActive) throw new DomainError("This account has been deactivated. Please contact the facility.", "FORBIDDEN", 403);
    return byUid;
  }
  if (!identity.email) throw new DomainError("Your sign-in method didn't share an email address. Please use email or Google sign-in.");

  const [byEmail] = await db.select().from(users).where(eq(sql`lower(${users.email})`, identity.email)).limit(1);
  if (byEmail) {
    if (byEmail.firebaseUid) throw new DomainError("This email is already linked to another sign-in. Use the method you signed up with.", "CONFLICT", 409);
    if (!identity.emailVerified) {
      throw new DomainError("Please verify your email address first. We've sent you a verification link.", "EMAIL_NOT_VERIFIED", 403);
    }
    if (!byEmail.isActive) throw new DomainError("This account has been deactivated. Please contact the facility.", "FORBIDDEN", 403);
    const [linked] = await db
      .update(users)
      .set({ firebaseUid: identity.uid, avatarUrl: byEmail.avatarUrl ?? identity.picture })
      .where(eq(users.id, byEmail.id))
      .returning();
    await audit(linked!.id, "auth.link_firebase", "user", linked!.id, { provider: identity.provider });
    return linked!;
  }

  const name = (profile.name?.trim() || identity.name?.trim() || identity.email.split("@")[0]!).slice(0, 120);
  const [created] = await db
    .insert(users)
    .values({
      name,
      email: identity.email,
      phone: profile.phone?.trim() || null,
      firebaseUid: identity.uid,
      role: "CUSTOMER",
      avatarUrl: identity.picture,
      preferences: DEFAULT_PREFERENCES,
    })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    // Two tabs racing on first sign-in: the other request created the row.
    const [again] = await db.select().from(users).where(eq(users.firebaseUid, identity.uid)).limit(1);
    if (again) return again;
    throw new DomainError("Could not create your account. Please try again.");
  }
  await audit(created.id, "auth.register", "user", created.id, { provider: identity.provider });
  return created;
}
