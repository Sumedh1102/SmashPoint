"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { coaches, users } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { invalidate, TAGS } from "@/server/cache";
import { DomainError } from "@/server/errors";
import { deleteAssets, imageFromForm } from "@/server/storage/media";
import { slugify } from "@/lib/utils";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const lines = z
  .string()
  .optional()
  .transform((v) => (v ?? "").split(/\n|,(?=\s*[A-Z])/).map((s) => s.trim()).filter(Boolean).slice(0, 12));

const profileSchema = z.object({
  title: z.string().trim().min(2).max(120),
  experienceYears: z.coerce.number().int().min(0).max(60),
  specialization: z.string().trim().min(3).max(200),
  certifications: lines,
  achievements: lines,
  bio: z.string().trim().max(2000).default(""),
  isPublic: z.string().optional().transform((v) => v === "on"),
  sortOrder: z.coerce.number().int().min(0).max(99).default(0),
});

const createSchema = profileSchema.extend({ name: nameSchema, email: emailSchema, phone: phoneSchema });

function refresh(id?: string) {
  revalidatePath("/dashboard/coaches");
  if (id) revalidatePath(`/dashboard/coaches/${id}`);
  invalidate(TAGS.coaches);
}

export async function createCoach(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const actor = await assertPermission("coaches:manage");
    const input = createSchema.parse(formObject(formData));
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
    if (existing) return { ok: false, error: "That email is already in use.", fieldErrors: { email: ["Already in use"] } };
    // No password: the coach signs in with Firebase (Google, or email + password) using this
    // address, and the account links once their email is verified.
    id = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ name: input.name, email: input.email, phone: input.phone, role: "COACH" }).returning({ id: users.id });
      let slug = slugify(input.name);
      const [clash] = await tx.select({ id: coaches.id }).from(coaches).where(eq(coaches.slug, slug));
      if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
      const [coach] = await tx
        .insert(coaches)
        .values({
          userId: user!.id,
          slug,
          title: input.title,
          experienceYears: input.experienceYears,
          specialization: input.specialization,
          certifications: input.certifications,
          achievements: input.achievements,
          bio: input.bio,
          isPublic: input.isPublic,
          sortOrder: input.sortOrder,
        })
        .returning({ id: coaches.id });
      return coach!.id;
    });
    await audit(actor.id, "coach.create", "coach", id, { email: input.email });
    refresh();
  } catch (err) {
    return toActionError(err);
  }
  redirect(`/dashboard/coaches/${id}?created=1`);
}

export async function updateCoach(coachId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("coaches:manage");
    const input = profileSchema.extend({ name: nameSchema, phone: phoneSchema }).parse(formObject(formData));
    const [coach] = await db.select({ userId: coaches.userId }).from(coaches).where(eq(coaches.id, coachId));
    if (!coach) throw new DomainError("Coach not found.");
    await db.transaction(async (tx) => {
      await tx.update(users).set({ name: input.name, phone: input.phone }).where(eq(users.id, coach.userId));
      await tx
        .update(coaches)
        .set({
          title: input.title,
          experienceYears: input.experienceYears,
          specialization: input.specialization,
          certifications: input.certifications,
          achievements: input.achievements,
          bio: input.bio,
          isPublic: input.isPublic,
          sortOrder: input.sortOrder,
        })
        .where(eq(coaches.id, coachId));
    });
    await audit(actor.id, "coach.update", "coach", coachId);
    refresh(coachId);
    return { ok: true, message: "Coach profile saved" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function uploadCoachPhoto(coachId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await assertPermission("coaches:manage");
    const [current] = await db.select({ photoUrl: coaches.photoUrl }).from(coaches).where(eq(coaches.id, coachId));
    if (!current) throw new DomainError("Coach not found.", "NOT_FOUND", 404);
    const image = await imageFromForm(formData, "photo", { url: current.photoUrl });
    if (!image.changed) return { ok: true, message: "No changes" };
    await db.update(coaches).set({ photoUrl: image.url }).where(eq(coaches.id, coachId));
    await deleteAssets(image.stale);
    refresh(coachId);
    return { ok: true, message: "Photo updated" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setCoachActive(coachId: string, active: boolean): Promise<ActionResult> {
  try {
    const actor = await assertPermission("coaches:manage");
    const [coach] = await db.select({ userId: coaches.userId }).from(coaches).where(eq(coaches.id, coachId));
    if (!coach) throw new DomainError("Coach not found.");
    await db.update(users).set({ isActive: active }).where(eq(users.id, coach.userId));
    await audit(actor.id, active ? "coach.activate" : "coach.deactivate", "coach", coachId);
    refresh(coachId);
    return { ok: true, message: active ? "Coach reactivated" : "Coach deactivated — they can no longer sign in" };
  } catch (err) {
    return toActionError(err);
  }
}
