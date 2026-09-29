"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { eventRegistrations, events, users } from "@/server/db/schema";
import { assertPermission } from "@/server/auth/guards";
import { audit } from "@/server/audit";
import { invalidate, TAGS } from "@/server/cache";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { notifyUsers } from "@/server/notifications";
import { formatDate } from "@/lib/format";
import { hhmmToMinutes } from "@/lib/time";
import { slugify } from "@/lib/utils";
import { isoDate } from "@/lib/validation";
import { formObject, toActionError, type ActionResult } from "./result";

const optionalDate = z.union([z.literal(""), isoDate]).optional().transform((v) => v || null);
const optionalTime = z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]).optional().transform((v) => (v ? hhmmToMinutes(v) : null));

const eventSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    category: z.enum(["TOURNAMENT", "WORKSHOP", "CAMP", "SOCIAL", "TRIAL"]),
    summary: z.string().trim().max(240).default(""),
    description: z.string().trim().min(10, "Add a description").max(5000),
    date: isoDate,
    endDate: optionalDate,
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time"),
    endTime: optionalTime,
    venue: z.string().trim().min(3).max(160),
    fee: z.coerce.number().min(0).max(100000).transform((v) => Math.round(v * 100)),
    registrationLimit: z.union([z.literal(""), z.coerce.number().int().min(1).max(5000)]).optional().transform((v) => (v === "" || v === undefined ? null : v)),
    registrationDeadline: optionalDate,
    divisions: z
      .string()
      .optional()
      .transform((v) => (v ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 20)),
    format: z.union([z.literal(""), z.enum(["KNOCKOUT", "ROUND_ROBIN", "LEAGUE"])]).optional().transform((v) => v || null),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.date) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date can't be before the start date" });
    if (v.registrationDeadline && v.registrationDeadline > (v.endDate ?? v.date)) ctx.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Deadline must be before the event ends" });
  });

async function announceEvent(name: string, date: string, slug: string) {
  const members = await db.select({ id: users.id }).from(users).where(eq(users.role, "CUSTOMER"));
  await notifyUsers(
    members.map((m) => m.id),
    { type: "EVENT", title: `New event · ${name}`, body: `Registrations are open for ${name} on ${formatDate(date, "long")}.`, link: `/events/${slug}` },
  );
}

function refresh(id?: string) {
  revalidatePath("/dashboard/events");
  if (id) revalidatePath(`/dashboard/events/${id}`);
  invalidate(TAGS.events);
}

export async function createEvent(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let id: string;
  try {
    const actor = await assertPermission("events:manage");
    const { startTime, endTime, ...input } = eventSchema.parse(formObject(formData));
    const slug = `${slugify(input.name)}-${input.date.slice(0, 4)}`;
    const [row] = await db
      .insert(events)
      .values({ ...input, slug, startMinute: hhmmToMinutes(startTime), endMinute: endTime, createdById: actor.id })
      .returning({ id: events.id });
    id = row!.id;
    if (input.status === "PUBLISHED") await announceEvent(input.name, input.date, slug);
    await audit(actor.id, "event.create", "event", id, { name: input.name });
    refresh();
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "An event with this name and year already exists." };
    return toActionError(err);
  }
  redirect(`/dashboard/events/${id}?created=1`);
}

export async function updateEvent(eventId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    const actor = await assertPermission("events:manage");
    const { startTime, endTime, ...input } = eventSchema.parse(formObject(formData));
    const [before] = await db.select({ status: events.status, slug: events.slug }).from(events).where(eq(events.id, eventId));
    if (!before) throw new DomainError("Event not found.");
    await db.update(events).set({ ...input, startMinute: hhmmToMinutes(startTime), endMinute: endTime }).where(eq(events.id, eventId));
    if (before.status === "DRAFT" && input.status === "PUBLISHED") await announceEvent(input.name, input.date, before.slug);
    await audit(actor.id, "event.update", "event", eventId);
    refresh(eventId);
    return { ok: true, message: "Event saved" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function cancelRegistration(registrationId: string, eventId: string): Promise<ActionResult> {
  try {
    const actor = await assertPermission("events:manage");
    await db.update(eventRegistrations).set({ status: "CANCELLED" }).where(eq(eventRegistrations.id, registrationId));
    await audit(actor.id, "event.registration_cancel", "event_registration", registrationId);
    refresh(eventId);
    return { ok: true, message: "Registration cancelled (refund paid entries from Payments)" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function confirmRegistration(registrationId: string, eventId: string): Promise<ActionResult> {
  try {
    await assertPermission("events:manage");
    await db.update(eventRegistrations).set({ status: "CONFIRMED" }).where(eq(eventRegistrations.id, registrationId));
    refresh(eventId);
    return { ok: true, message: "Registration confirmed" };
  } catch (err) {
    return toActionError(err);
  }
}
