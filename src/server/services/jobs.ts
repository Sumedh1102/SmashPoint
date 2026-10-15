import "server-only";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courts, rateLimits, sessions } from "@/server/db/schema";
import { formatDate, formatTimeRange } from "@/lib/format";
import { site } from "@/content/site";
import { sendEmail } from "@/server/email";
import { bookingReceiptPath, reconcilePayments } from "@/server/payments/service";
import { getSetting } from "@/server/settings";
import { expireStaleHolds } from "./bookings";

/** Idempotent housekeeping, reconciliation and reminders. Safe to run as often as every few minutes. */
export async function runScheduledJobs() {
  const notif = await getSetting("notifications");
  const result = { expiredHolds: 0, payments: { checked: 0, confirmed: 0, refundsUpdated: 0, errors: 0 }, bookingReminders: 0 };

  result.expiredHolds = await expireStaleHolds(db);
  result.payments = await reconcilePayments();

  if (notif.bookingReminderHours > 0) {
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
      .limit(200);
    for (const { b, court } of due) {
      // Claim first so overlapping runs never send the same reminder twice.
      const [claimed] = await db
        .update(bookings)
        .set({ reminderSentAt: new Date() })
        .where(and(eq(bookings.id, b.id), isNull(bookings.reminderSentAt)))
        .returning({ id: bookings.id });
      if (!claimed) continue;
      await sendEmail({
        to: b.customerEmail,
        subject: `Reminder · ${court} at ${formatTimeRange(b.startMinute, b.endMinute)}`,
        text: `Hi ${b.customerName},\n\nThis is a reminder of your booking ${b.code}: ${court}, ${formatDate(b.date, "long")}, ${formatTimeRange(b.startMinute, b.endMinute)}.\n\nBooking details: ${site.url}${bookingReceiptPath(b.code)}\n\n${site.name}`,
      });
      result.bookingReminders++;
    }
  }

  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
  return result;
}
