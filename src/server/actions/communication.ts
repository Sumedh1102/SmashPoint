"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { announcements, enquiries, users } from "@/server/db/schema";
import { assertPermission, assertUser } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { invalidate, TAGS } from "@/server/cache";
import { markNotificationsRead, notifyUsers } from "@/server/notifications";
import { formObject, toActionError, type ActionResult } from "./result";

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(5).max(2000),
  audience: z.enum(["EVERYONE", "STUDENTS", "STAFF"]),
  isPinned: z.string().optional().transform((v) => v === "on"),
  showOnWebsite: z.string().optional().transform((v) => v === "on"),
  notify: z.string().optional().transform((v) => v === "on"),
  expiresOn: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
});

export async function createAnnouncement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("announcements:manage");
    const input = announcementSchema.parse(formObject(formData));
    const [row] = await db
      .insert(announcements)
      .values({
        title: input.title,
        body: input.body,
        audience: input.audience,
        isPinned: input.isPinned,
        showOnWebsite: input.showOnWebsite && input.audience === "EVERYONE",
        expiresAt: input.expiresOn ? new Date(`${input.expiresOn}T23:59:59+05:30`) : null,
        createdById: actor.id,
      })
      .returning({ id: announcements.id });
    let sent = 0;
    if (input.notify) {
      const roles = input.audience === "STUDENTS" ? ["CUSTOMER" as const] : input.audience === "STAFF" ? (["ADMIN", "MANAGER", "COACH", "RECEPTION"] as const) : (["ADMIN", "MANAGER", "COACH", "RECEPTION", "CUSTOMER"] as const);
      const recipients = await db.select({ id: users.id }).from(users).where(inArray(users.role, [...roles]));
      sent = await notifyUsers(
        recipients.map((r) => r.id).filter((id) => id !== actor.id),
        { type: "ANNOUNCEMENT", title: input.title, body: input.body, link: "/dashboard/notifications" },
      );
    }
    await audit(actor.id, "announcement.create", "announcement", row!.id, { title: input.title });
    revalidatePath("/dashboard/announcements");
    invalidate(TAGS.announcements);
    return { ok: true, message: sent ? `Published and sent to ${sent} people` : "Announcement published" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("announcements:manage");
    await db.delete(announcements).where(eq(announcements.id, id));
    await audit(actor.id, "announcement.delete", "announcement", id);
    revalidatePath("/dashboard/announcements");
    invalidate(TAGS.announcements);
    return { ok: true, message: "Announcement removed" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function setEnquiryStatus(id: string, status: "NEW" | "IN_PROGRESS" | "CLOSED"): Promise<ActionResult> {
  try {
    await assertPermission("enquiries:view");
    await db.update(enquiries).set({ status }).where(eq(enquiries.id, id));
    revalidatePath("/dashboard/enquiries");
    return { ok: true, message: "Enquiry updated" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const user = await assertUser();
    await markNotificationsRead(user.id);
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "All caught up" };
  } catch (err) {
    return toActionError(err);
  }
}
