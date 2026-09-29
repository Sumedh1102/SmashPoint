import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { bookingSeries, bookings, courts, payments } from "@/server/db/schema";
import { formatDate, formatTimeRange } from "@/lib/format";
import { DomainError } from "@/server/errors";
import { notify } from "@/server/notifications";
import { refundPayment } from "@/server/payments/service";
import { transitionBooking, transitionSeries } from "./bookings";

/**
 * Cancels a booking. Paid bookings are refunded through the original provider
 * (Cancelled → Refunded); unpaid holds are simply released.
 */
export async function cancelBooking(bookingId: string, opts: { reason: string; actorId?: string | null; refund?: boolean }) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (!["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(booking.status)) {
    throw new DomainError("This booking is already closed.");
  }

  const [paid] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "PAID")))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (paid && opts.refund !== false) {
    // refundPayment moves the booking through Cancelled → Refunded atomically.
    await refundPayment(paid.id, { reason: opts.reason, actorId: opts.actorId });
  } else {
    await db.transaction(async (tx) => {
      await transitionBooking(tx, bookingId, "CANCELLED", {
        note: opts.reason,
        actorId: opts.actorId,
        patch: { cancelledAt: new Date(), cancelReason: opts.reason, holdExpiresAt: null },
      });
      await tx
        .update(payments)
        .set({ status: "FAILED", failureReason: "Booking cancelled" })
        .where(and(eq(payments.bookingId, bookingId), inArray(payments.status, ["CREATED", "INITIATED"])));
    });
  }

  const [court] = await db.select({ name: courts.name }).from(courts).where(eq(courts.id, booking.courtId));
  await notify({
    userId: booking.userId,
    recipient: { name: booking.customerName, email: booking.customerEmail, phone: booking.customerPhone },
    type: "BOOKING_CANCELLED",
    title: `Booking cancelled · ${booking.code}`,
    body: `${court?.name ?? "Court"} on ${formatDate(booking.date, "long")}, ${formatTimeRange(booking.startMinute, booking.endMinute)} has been cancelled.${paid && opts.refund !== false ? " A full refund has been initiated." : ""}`,
    link: booking.userId ? "/dashboard/bookings" : null,
  });
}

/**
 * Cancels a monthly/quarterly booking and all of its sessions. A paid series is refunded in
 * full through the original provider unless `refund` is false.
 */
export async function cancelSeries(seriesId: string, opts: { reason: string; actorId?: string | null; refund?: boolean }) {
  const [series] = await db.select().from(bookingSeries).where(eq(bookingSeries.id, seriesId)).limit(1);
  if (!series) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (!["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(series.status)) throw new DomainError("This booking is already closed.");
  const [paid] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.seriesId, seriesId), eq(payments.status, "PAID")))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  if (paid && opts.refund !== false) {
    await refundPayment(paid.id, { reason: opts.reason, actorId: opts.actorId });
  } else {
    await db.transaction(async (tx) => {
      await transitionSeries(tx, seriesId, "CANCELLED", {
        note: opts.reason,
        actorId: opts.actorId,
        fromStatuses: ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"],
        patch: { cancelledAt: new Date(), cancelReason: opts.reason, holdExpiresAt: null },
      });
      await tx
        .update(payments)
        .set({ status: "FAILED", failureReason: "Booking cancelled" })
        .where(and(eq(payments.seriesId, seriesId), inArray(payments.status, ["CREATED", "INITIATED"])));
    });
  }
  const [court] = await db.select({ name: courts.name }).from(courts).where(eq(courts.id, series.courtId));
  await notify({
    userId: series.userId,
    recipient: { name: series.customerName, email: series.customerEmail, phone: series.customerPhone },
    type: "BOOKING_CANCELLED",
    title: `Booking cancelled · ${series.code}`,
    body: `Your ${series.type === "MONTHLY" ? "monthly" : "quarterly"} booking of ${court?.name ?? "the court"} (${formatDate(series.startDate)} – ${formatDate(series.endDate)}, ${formatTimeRange(series.startMinute, series.endMinute)}) has been cancelled.${paid && opts.refund !== false ? " A full refund has been initiated." : ""}`,
    link: series.userId ? "/dashboard/bookings" : null,
  });
}
