"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { students, users } from "@/server/db/schema";
import { assertUser } from "@/server/auth/guards";
import { getSession, revokeOtherSessions } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { deleteAssets, imageFromForm } from "@/server/storage/media";
import { nameSchema, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const optionalPhone = z.union([z.literal(""), phoneSchema]).optional().transform((v) => v || null);

export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const input = z
      .object({
        name: nameSchema,
        phone: optionalPhone,
        emergencyContactName: z.string().trim().max(120).optional().transform((v) => v || null),
        emergencyContactPhone: optionalPhone,
      })
      .parse(formObject(formData));
    // The email address belongs to the sign-in account (Firebase) and isn't edited here.
    await db.update(users).set(input).where(eq(users.id, user.id));
    // Keep the linked student record's emergency contact in sync.
    if (input.emergencyContactName || input.emergencyContactPhone) {
      await db
        .update(students)
        .set({ emergencyContactName: input.emergencyContactName, emergencyContactPhone: input.emergencyContactPhone })
        .where(eq(students.userId, user.id));
    }
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Profile updated" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateAvatar(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const [current] = await db.select({ avatarUrl: users.avatarUrl }).from(users).where(eq(users.id, user.id));
    const image = await imageFromForm(formData, "avatar", { url: current?.avatarUrl ?? null });
    if (!image.changed) return { ok: true, message: "No changes" };
    await db.update(users).set({ avatarUrl: image.url }).where(eq(users.id, user.id));
    await db.update(students).set({ photoUrl: image.url }).where(eq(students.userId, user.id));
    await deleteAssets(image.stale);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: image.url ? "Profile photo updated" : "Profile photo removed" };
  } catch (err) {
    return toActionError(err);
  }
}

/** Signs out every other device (e.g. after changing the password in Firebase). */
export async function signOutOtherDevices(): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const session = await getSession();
    await revokeOtherSessions(user.id, session?.sessionId);
    await audit(user.id, "user.revoke_sessions", "user", user.id);
    return { ok: true, message: "Other devices were signed out" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updatePreferences(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await assertUser();
    const on = (k: string) => formData.get(k) === "on";
    await db
      .update(users)
      .set({
        preferences: {
          emailNotifications: on("emailNotifications"),
          smsNotifications: on("smsNotifications"),
          whatsappNotifications: on("whatsappNotifications"),
          bookingReminders: on("bookingReminders"),
          classReminders: on("classReminders"),
          marketing: on("marketing"),
        },
      })
      .where(eq(users.id, user.id));
    return { ok: true, message: "Preferences saved" };
  } catch (err) {
    return toActionError(err);
  }
}
