"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { coupons, sessions, users } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { saveSetting } from "@/server/settings";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const on = (v: FormDataEntryValue | null) => v === "on";

export async function saveNotificationSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("settings:manage");
    const input = z
      .object({ bookingReminderHours: z.coerce.number().int().min(1).max(72), membershipExpiryReminderDays: z.coerce.number().int().min(1).max(30) })
      .parse(formObject(formData));
    await saveSetting("notifications", { email: on(formData.get("email")), sms: on(formData.get("sms")), whatsapp: on(formData.get("whatsapp")), ...input }, actor.id);
    await audit(actor.id, "settings.notifications", "settings", "notifications");
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Notification settings saved" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function saveAttendanceSettings(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("settings:manage");
    const lateAfterMinutes = z.coerce.number().int().min(0).max(60).parse(formData.get("lateAfterMinutes"));
    await saveSetting("attendance", { lateAfterMinutes, qrEnabled: on(formData.get("qrEnabled")) }, actor.id);
    await audit(actor.id, "settings.attendance", "settings", "attendance");
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "Attendance settings saved" };
  } catch (err) {
    return toActionError(err);
  }
}

const couponSchema = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, "3–20 letters or numbers"),
    description: z.string().trim().max(200).optional(),
    type: z.enum(["PERCENT", "FLAT"]),
    value: z.coerce.number().positive(),
    scope: z.enum(["ALL", "BOOKING", "MEMBERSHIP", "EVENT"]),
    minAmount: z.coerce.number().min(0).default(0),
    maxDiscount: z.union([z.literal(""), z.coerce.number().positive()]).optional(),
    maxUses: z.union([z.literal(""), z.coerce.number().int().positive()]).optional(),
    validUntil: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  })
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, { path: ["value"], message: "Percent must be ≤ 100" });

export async function createCoupon(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("settings:manage");
    const c = couponSchema.parse(formObject(formData));
    await db.insert(coupons).values({
      code: c.code,
      description: c.description || null,
      type: c.type,
      value: c.type === "PERCENT" ? Math.round(c.value) : Math.round(c.value * 100),
      scope: c.scope,
      minAmount: Math.round(c.minAmount * 100),
      maxDiscount: c.maxDiscount ? Math.round(Number(c.maxDiscount) * 100) : null,
      maxUses: c.maxUses ? Number(c.maxUses) : null,
      validUntil: c.validUntil || null,
    });
    await audit(actor.id, "coupon.create", "coupon", c.code);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: `Coupon ${c.code} created` };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "That code already exists.", fieldErrors: { code: ["Already exists"] } };
    return toActionError(err);
  }
}

export async function toggleCoupon(id: string, active: boolean): Promise<ActionResult> {
  try {
    const actor = await assertPermission("settings:manage");
    await db.update(coupons).set({ isActive: active }).where(eq(coupons.id, id));
    await audit(actor.id, active ? "coupon.enable" : "coupon.disable", "coupon", id);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: active ? "Coupon enabled" : "Coupon disabled" };
  } catch (err) {
    return toActionError(err);
  }
}

