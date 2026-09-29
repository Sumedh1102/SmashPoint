import "server-only";
import { and, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  batchStudents,
  batches,
  bookings,
  courts,
  memberships,
  membershipPlans,
  notifications,
  parents,
  rateLimits,
  sessions,
  students,
} from "@/server/db/schema";
import { formatDate, formatTimeRange } from "@/lib/format";
import { addDays, dayOfWeek, todayInTz } from "@/lib/time";
import { notify } from "@/server/notifications";
import { getSetting } from "@/server/settings";
import { expireStaleHolds } from "./bookings";

/** Idempotent housekeeping + reminders. Safe to run every hour. */
export async function runScheduledJobs() {
  const today = todayInTz();
  const notif = await getSetting("notifications");
  const result = { expiredHolds: 0, expiredMemberships: 0, abandonedMemberships: 0, bookingReminders: 0, expiryReminders: 0, classReminders: 0 };

  result.expiredHolds = await expireStaleHolds(db);

  const expired = await db
    .update(memberships)
    .set({ status: "EXPIRED" })
    .where(and(eq(memberships.status, "ACTIVE"), lt(memberships.endDate, today)))
    .returning({ id: memberships.id });
  result.expiredMemberships = expired.length;

  const abandoned = await db
    .update(memberships)
    .set({ status: "CANCELLED", paymentStatus: "FAILED" })
    .where(and(eq(memberships.status, "PENDING"), inArray(memberships.paymentStatus, ["CREATED", "INITIATED"]), lt(memberships.createdAt, new Date(Date.now() - 2 * 86_400_000))))
    .returning({ id: memberships.id });
  result.abandonedMemberships = abandoned.length;

  // Booking reminders: confirmed slots starting within the reminder window.
  const startAt = sql`((${bookings.date} + make_interval(mins => ${bookings.startMinute}::int)) AT TIME ZONE 'Asia/Kolkata')`;
  const due = await db
    .select({ b: bookings, court: courts.name })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .where(
      and(
        eq(bookings.status, "CONFIRMED"),
        isNull(bookings.reminderSentAt),
        sql`${startAt} > now()`,
        sql`${startAt} <= now() + make_interval(hours => ${notif.bookingReminderHours}::int)`,
      ),
    )
    .limit(500);
  for (const { b, court } of due) {
    await notify({
      userId: b.userId,
      recipient: { name: b.customerName, email: b.customerEmail, phone: b.customerPhone },
      type: "BOOKING_REMINDER",
      title: `Reminder · ${court} at ${formatTimeRange(b.startMinute, b.endMinute)}`,
      body: `Your court booking ${b.code} is on ${formatDate(b.date, "long")}, ${formatTimeRange(b.startMinute, b.endMinute)}. Please arrive 10 minutes early.`,
      link: b.userId ? "/dashboard/bookings" : null,
    });
    await db.update(bookings).set({ reminderSentAt: new Date() }).where(eq(bookings.id, b.id));
    result.bookingReminders++;
  }

  // Membership expiry reminders (skipped when a renewal already exists).
  const expiring = await db
    .select({
      m: memberships,
      plan: membershipPlans.name,
      studentName: students.name,
      studentUser: students.userId,
      parentUser: parents.userId,
      email: sql<string | null>`coalesce(${students.email}, ${parents.email})`,
      phone: sql<string | null>`coalesce(${students.phone}, ${parents.phone}, ${students.emergencyContactPhone})`,
      contactName: sql<string>`coalesce(${parents.name}, ${students.name})`,
    })
    .from(memberships)
    .innerJoin(students, eq(students.id, memberships.studentId))
    .innerJoin(membershipPlans, eq(membershipPlans.id, memberships.planId))
    .leftJoin(parents, eq(parents.id, students.parentId))
    .where(
      and(
        eq(memberships.status, "ACTIVE"),
        isNull(memberships.expiryReminderSentAt),
        gte(memberships.endDate, today),
        lte(memberships.endDate, addDays(today, notif.membershipExpiryReminderDays)),
        sql`not exists (select 1 from ${memberships} r where r.student_id = ${memberships.studentId} and r.start_date > ${memberships.endDate} - 1 and r.status in ('ACTIVE','PENDING'))`,
      ),
    )
    .limit(500);
  for (const row of expiring) {
    // Account holders get an in-app notification too; everyone gets email/WhatsApp.
    await notify({
      userId: row.studentUser ?? row.parentUser,
      recipient: { name: row.contactName, email: row.email, phone: row.phone },
      type: "MEMBERSHIP_EXPIRY",
      title: `Membership expires ${formatDate(row.m.endDate, "dayMonth")}`,
      body: `${row.studentName}'s ${row.plan} membership ends on ${formatDate(row.m.endDate, "long")}. Renew now to keep the batch spot.`,
      link: "/dashboard/membership",
    });
    result.expiryReminders++;
    await db.update(memberships).set({ expiryReminderSentAt: new Date() }).where(eq(memberships.id, row.m.id));
  }

  // Class reminders for tomorrow's batches (once per user per day).
  const tomorrow = addDays(today, 1);
  const tomorrowBatches = await db
    .select({ id: batches.id, name: batches.name, startMinute: batches.startMinute, endMinute: batches.endMinute, court: courts.name })
    .from(batches)
    .leftJoin(courts, eq(courts.id, batches.courtId))
    .where(and(eq(batches.isActive, true), sql`${dayOfWeek(tomorrow)} = ANY(${batches.daysOfWeek})`));
  for (const batch of tomorrowBatches) {
    const members = await db
      .select({ userId: students.userId, parentUser: parents.userId })
      .from(batchStudents)
      .innerJoin(students, eq(students.id, batchStudents.studentId))
      .leftJoin(parents, eq(parents.id, students.parentId))
      .where(and(eq(batchStudents.batchId, batch.id), eq(batchStudents.isActive, true), eq(students.status, "ACTIVE")));
    for (const m of members) {
      const userId = m.userId ?? m.parentUser;
      if (!userId) continue;
      const [recent] = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.type, "CLASS_REMINDER"), gte(notifications.createdAt, new Date(Date.now() - 20 * 3600_000)), sql`${notifications.title} like ${`%${batch.name}%`}`))
        .limit(1);
      if (recent) continue;
      await notify({
        userId,
        type: "CLASS_REMINDER",
        title: `${batch.name} tomorrow`,
        body: `${formatDate(tomorrow, "long")} · ${formatTimeRange(batch.startMinute, batch.endMinute)}${batch.court ? ` on ${batch.court}` : ""}. Carry water and a spare grip.`,
        link: "/dashboard",
      });
      result.classReminders++;
    }
  }

  // Housekeeping: expired sessions and spent rate-limit windows.
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
  return result;
}
