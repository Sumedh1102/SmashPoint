"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/auth/password";
import { assertAdmin } from "@/server/auth/guards";
import { createSession, destroySession, getSession } from "@/server/auth/session";
import { refreshPublicPages } from "@/server/cache";
import { DomainError } from "@/server/errors";
import { rateLimit } from "@/server/security";
import { cancelBooking, createBlock, deleteBlock, refundCancelledBooking, updateBookingHours, updateCourt } from "@/server/services/admin";
import { formatMinutes } from "@/lib/format";
import { emailSchema, isoDate, uuid } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sign in / out                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200) });

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const input = loginSchema.parse(formObject(formData));
    const ip = await clientIp();
    const [byIp, byAccount] = await Promise.all([rateLimit(`admin-login-ip:${ip}`, 20, 15 * 60_000), rateLimit(`admin-login:${input.email}`, 6, 15 * 60_000)]);
    if (!byIp.ok || !byAccount.ok) throw new DomainError("Too many sign-in attempts. Please wait 15 minutes and try again.", "RATE_LIMITED", 429);

    const [user] = await db.select().from(users).where(eq(sql`lower(${users.email})`, input.email)).limit(1);
    // Always run the hash comparison so response time doesn't reveal whether the account exists.
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid || user.role !== "ADMIN" || !user.isActive) throw new DomainError("That email and password don't match an administrator account.");
    await createSession(user);
  } catch (err) {
    return toActionError(err);
  }
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(12, "Use at least 12 characters").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

export async function changePassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const input = passwordSchema.parse(formObject(formData));
    const [user] = await db.select().from(users).where(eq(users.id, admin.id)).limit(1);
    if (!user?.passwordHash || !(await verifyPassword(input.current, user.passwordHash))) {
      return { ok: false, error: "Your current password is incorrect.", fieldErrors: { current: ["Incorrect password"] } };
    }
    await db.update(users).set({ passwordHash: await hashPassword(input.password) }).where(eq(users.id, admin.id));
    // Sign out every other session.
    const session = await getSession();
    await db.delete(sessions).where(and(eq(sessions.userId, admin.id), session ? ne(sessions.id, session.sessionId) : undefined));
    return { ok: true, message: "Password changed. Other sessions were signed out." };
  } catch (err) {
    return toActionError(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Bookings                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const cancelSchema = z.object({
  bookingId: uuid,
  reason: z.string().trim().min(3, "Give a short reason (it's shown to the customer)").max(200),
  refund: z.enum(["yes", "no"]),
});

export async function cancelBookingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let target: string;
  try {
    const admin = await assertAdmin();
    const input = cancelSchema.parse(formObject(formData));
    const code = await cancelBooking(input.bookingId, { reason: input.reason, refund: input.refund === "yes", actorId: admin.id });
    revalidatePath("/admin", "layout");
    refreshPublicPages();
    target = `/admin/bookings/${code}?notice=${input.refund === "yes" ? "cancelled-refunded" : "cancelled"}`;
  } catch (err) {
    return toActionError(err);
  }
  redirect(target);
}

const refundSchema = z.object({ bookingId: uuid, reason: z.string().trim().min(3, "Give a short reason").max(200) });

export async function refundBookingAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let target: string;
  try {
    const admin = await assertAdmin();
    const input = refundSchema.parse(formObject(formData));
    const code = await refundCancelledBooking(input.bookingId, { reason: input.reason, actorId: admin.id });
    revalidatePath("/admin", "layout");
    target = `/admin/bookings/${code}?notice=refunded`;
  } catch (err) {
    return toActionError(err);
  }
  redirect(target);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Courts                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const minuteOrNull = z.preprocess((v) => (v === "" || v === undefined ? null : Number(v)), z.number().int().min(0).max(1440).nullable());

const blockSchema = z
  .object({
    courtId: uuid,
    type: z.enum(["MAINTENANCE", "BLOCKED"]),
    startDate: isoDate,
    endDate: isoDate,
    wholeDay: z.enum(["yes", "no"]).default("no"),
    startMinute: minuteOrNull,
    endMinute: minuteOrNull,
    reason: z.string().trim().min(2, "Add a short reason").max(200),
  })
  .refine((v) => v.wholeDay === "yes" || (v.startMinute !== null && v.endMinute !== null), { path: ["startMinute"], message: "Choose a time range or the whole day" });

export async function createBlockAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const input = blockSchema.parse(formObject(formData));
    const whole = input.wholeDay === "yes";
    await createBlock(
      {
        courtId: input.courtId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        startMinute: whole ? null : input.startMinute,
        endMinute: whole ? null : input.endMinute,
        reason: input.reason,
      },
      admin.id,
    );
    revalidatePath("/admin", "layout");
    refreshPublicPages();
    return { ok: true, message: "Court blocked. Those slots can no longer be booked." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteBlockAction(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  const id = uuid.parse(formData.get("blockId"));
  await deleteBlock(id, admin.id);
  revalidatePath("/admin", "layout");
  refreshPublicPages();
}

/** Hourly prices: at least ₹1 (Razorpay's minimum), whole rupees. */
const hourlyPrice = z.coerce
  .number({ error: "Enter an amount" })
  .int("Use whole rupees")
  .min(1, "Must be at least ₹1")
  .max(100000, "That's too high")
  .transform((v) => v * 100);

/** Monthly plan prices: optional (blank = plan not offered), whole rupees. */
const monthlyPrice = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const cleaned = v.replace(/[,\s₹]/g, "");
    if (!cleaned) return null;
    const n = Number(cleaned);
    if (!Number.isInteger(n) || n < 1 || n > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter whole rupees (at least ₹1), or leave blank" });
      return z.NEVER;
    }
    return n * 100;
  });

const optionalLine = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const courtSchema = z.object({
  courtId: uuid,
  description: optionalLine(400),
  surface: optionalLine(80),
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
  price1h: hourlyPrice,
  price2h: hourlyPrice,
  monthlyPrice1m: monthlyPrice,
  monthlyPrice3m: monthlyPrice,
  monthlyPrice6m: monthlyPrice,
  monthlyPrice12m: monthlyPrice,
});

export async function updateCourtAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const { courtId, ...patch } = courtSchema.parse(formObject(formData));
    await updateCourt(courtId, patch, admin.id);
    revalidatePath("/admin", "layout");
    refreshPublicPages();
    return { ok: true, message: "Court updated." };
  } catch (err) {
    return toActionError(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Booking hours                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

const minuteOfDay = z.coerce.number().int().min(0).max(24 * 60);
const hoursSchema = z
  .object({ openMinute: minuteOfDay, closeMinute: minuteOfDay })
  .refine((h) => h.closeMinute - h.openMinute >= 60, { message: "Closing must be at least one hour after opening", path: ["closeMinute"] });

export async function updateBookingHoursAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const input = hoursSchema.parse(formObject(formData));
    const { hours, outsideCodes } = await updateBookingHours(input, admin.id);
    revalidatePath("/admin", "layout");
    refreshPublicPages();
    const range = `${formatMinutes(hours.openMinute)} – ${formatMinutes(hours.closeMinute % (24 * 60))}`;
    return {
      ok: true,
      message: outsideCodes.length
        ? `Booking hours set to ${range}. ${outsideCodes.length} confirmed upcoming ${outsideCodes.length === 1 ? "booking falls" : "bookings fall"} outside them and stay valid: ${outsideCodes.slice(0, 5).join(", ")}${outsideCodes.length > 5 ? ", …" : ""}.`
        : `Booking hours set to ${range}.`,
    };
  } catch (err) {
    return toActionError(err);
  }
}
