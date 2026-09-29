"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { coaches, sessions, users } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { DEFAULT_PREFERENCES } from "@/server/auth/identity";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";
import { can, ROLES, ROLE_LABELS, type Role } from "@/lib/rbac";
import { slugify } from "@/lib/utils";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const optionalPhone = z.union([z.literal(""), phoneSchema]).optional().transform((v) => v || null);

function refresh() {
  revalidatePath("/dashboard/users");
}

/** Every coach account needs a coach profile for schedules and coaching adverts. */
async function ensureCoachProfile(userId: string, name: string) {
  const [existing] = await db.select({ id: coaches.id }).from(coaches).where(eq(coaches.userId, userId)).limit(1);
  if (existing) return;
  let slug = slugify(name);
  const [clash] = await db.select({ id: coaches.id }).from(coaches).where(eq(coaches.slug, slug));
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  await db.insert(coaches).values({ userId, slug, title: "Coach", specialization: "Coaching", isPublic: false });
}

/**
 * Adds a person by email with a role. There is no password: they sign in with Firebase
 * (Google, or email + password) using this address, and the account links to this record
 * once Firebase has verified the email. Only admins may grant staff roles.
 */
export async function inviteUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("users:manage");
    const input = z.object({ name: nameSchema, email: emailSchema, phone: optionalPhone, role: z.enum(ROLES) }).parse(formObject(formData));
    if (input.role !== "CUSTOMER" && !can(actor.role, "staff:manage")) throw new DomainError("Only an admin can add staff accounts.");
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
    if (exists) return { ok: false, error: "Someone with that email already has an account.", fieldErrors: { email: ["Already in use"] } };
    const [user] = await db.insert(users).values({ ...input, preferences: DEFAULT_PREFERENCES }).returning({ id: users.id });
    if (input.role === "COACH") await ensureCoachProfile(user!.id, input.name);
    await audit(actor.id, "user.invite", "user", user!.id, { role: input.role });
    refresh();
    return { ok: true, message: `${input.name} was added as ${ROLE_LABELS[input.role]}. They can sign in with ${input.email} using Google or email and password.` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateUserDetails(userId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("users:manage");
    const input = z.object({ name: nameSchema, phone: optionalPhone }).parse(formObject(formData));
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw new DomainError("User not found.", "NOT_FOUND", 404);
    if (target.role !== "CUSTOMER" && !can(actor.role, "staff:manage") && userId !== actor.id) throw new DomainError("Only an admin can edit staff accounts.");
    await db.update(users).set(input).where(eq(users.id, userId));
    await audit(actor.id, "user.update", "user", userId);
    refresh();
    return { ok: true, message: "Details saved" };
  } catch (err) {
    return toActionError(err);
  }
}

/** Admins change roles; nobody can change their own. */
export async function setUserRole(userId: string, role: Role): Promise<ActionResult> {
  try {
    const actor = await assertPermission("staff:manage");
    if (!ROLES.includes(role)) throw new DomainError("Unknown role.");
    if (userId === actor.id) throw new DomainError("You can't change your own role.");
    const [target] = await db.select({ name: users.name, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw new DomainError("User not found.", "NOT_FOUND", 404);
    if (target.role === role) return { ok: true, message: "No change" };
    await db.update(users).set({ role }).where(eq(users.id, userId));
    if (role === "COACH") await ensureCoachProfile(userId, target.name);
    // Permissions are read from the session row's user on every request, but sign them out
    // anyway so no page rendered with the old role lingers.
    await db.delete(sessions).where(eq(sessions.userId, userId));
    await audit(actor.id, "user.role_change", "user", userId, { from: target.role, to: role });
    refresh();
    return { ok: true, message: `${target.name} is now ${ROLE_LABELS[role]}` };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  try {
    const actor = await assertPermission("users:manage");
    if (userId === actor.id) throw new DomainError("You can't deactivate your own account.");
    const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!target) throw new DomainError("User not found.", "NOT_FOUND", 404);
    if (target.role !== "CUSTOMER" && !can(actor.role, "staff:manage")) throw new DomainError("Only an admin can deactivate staff accounts.");
    await db.update(users).set({ isActive: active }).where(eq(users.id, userId));
    if (!active) await db.delete(sessions).where(eq(sessions.userId, userId));
    await audit(actor.id, active ? "user.activate" : "user.deactivate", "user", userId);
    refresh();
    return { ok: true, message: active ? "Account reactivated" : "Account deactivated and signed out" };
  } catch (err) {
    return toActionError(err);
  }
}
