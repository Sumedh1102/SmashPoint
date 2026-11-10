import "server-only";
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courtBlocks, courts, payments, settings as settingsTable, type CourtStatus } from "@/server/db/schema";
import { describeHours, normalizeBookingHours, type BookingHours } from "@/lib/booking/rules";
import { formatDate, formatTimeRange } from "@/lib/format";
import { addDays, diffDays, isValidISODate, rangesOverlap } from "@/lib/time";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";
import { refundPayment } from "@/server/payments/service";
import { getBookingSettings, hoursOf } from "@/server/settings";
import { bookingWindow, expireStaleHolds, lockCourt, transitionBooking } from "./bookings";

/* ────────────────────────────────────────────────────────────────────────── */
/* Cancellation                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Cancels a booking. With `refund`, the booking's verified Razorpay payment is refunded in
 * full (the booking is cancelled only if Razorpay accepts the refund). Without it, the booking
 * is cancelled and any payment is left untouched — it can still be refunded later.
 */
export async function cancelBooking(bookingId: string, opts: { reason: string; refund: boolean; actorId: string }) {
  const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (!["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(booking.status)) {
    throw new DomainError("Only active bookings can be cancelled.", "CONFLICT", 409);
  }

  const [paid] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, booking.id), eq(payments.status, "PAID")))
    .orderBy(desc(payments.paidAt))
    .limit(1);

  if (opts.refund) {
    if (!paid) throw new DomainError("This booking has no verified online payment to refund.", "CONFLICT", 409);
    await refundPayment(paid.id, { reason: opts.reason, actorId: opts.actorId, cancelBooking: true });
  } else {
    await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(bookings).where(eq(bookings.id, booking.id)).for("update");
      if (!locked || !["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(locked.status)) {
        throw new DomainError("Only active bookings can be cancelled.", "CONFLICT", 409);
      }
      await transitionBooking(tx, booking.id, "CANCELLED", {
        note: `${opts.reason}${paid ? " · no refund issued" : ""}`,
        actorId: opts.actorId,
        patch: { cancelledAt: new Date(), cancelReason: opts.reason.slice(0, 300), holdExpiresAt: null },
      });
    });
  }
  await audit(opts.actorId, opts.refund ? "booking.cancel_refund" : "booking.cancel", "booking", booking.id, { code: booking.code, reason: opts.reason });
  return booking.code;
}

/** Refunds the paid payment of an already-cancelled booking. */
export async function refundCancelledBooking(bookingId: string, opts: { reason: string; actorId: string }) {
  const [paid] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, bookingId), eq(payments.status, "PAID")))
    .orderBy(desc(payments.paidAt))
    .limit(1);
  if (!paid) throw new DomainError("There is no paid payment to refund for this booking.", "CONFLICT", 409);
  await refundPayment(paid.id, { reason: opts.reason, actorId: opts.actorId, cancelBooking: true });
  await audit(opts.actorId, "booking.refund", "booking", bookingId, { reason: opts.reason });
  const [row] = await db.select({ code: bookings.code }).from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  return row!.code;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Court blocks                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export type BlockInput = {
  courtId: string;
  type: "MAINTENANCE" | "BLOCKED";
  startDate: string;
  endDate: string;
  /** Both null = the whole day. */
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
};

/**
 * Closes a court for maintenance or another reason. Refuses to cover existing bookings: those
 * must be cancelled (and refunded) explicitly first, so a block never silently overrides a
 * paid reservation.
 */
export async function createBlock(input: BlockInput, actorId: string) {
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  if (!isValidISODate(input.startDate) || !isValidISODate(input.endDate)) throw new DomainError("Choose valid dates.");
  if (input.startDate < today) throw new DomainError("Blocks can't start in the past.");
  if (input.endDate < input.startDate) throw new DomainError("The end date must be on or after the start date.");
  if (diffDays(input.startDate, input.endDate) > 365) throw new DomainError("A block can cover at most one year.");
  const wholeDay = input.startMinute === null || input.endMinute === null;
  if (!wholeDay) {
    const s = input.startMinute!;
    const e = input.endMinute!;
    const hours = hoursOf(settings);
    if (s < hours.openMinute || e > hours.closeMinute || e <= s || s % 60 !== 0 || e % 60 !== 0) {
      throw new DomainError(`Choose whole hours within the booking hours (${describeHours(hours)}), with the end after the start.`);
    }
  }

  const block = await db.transaction(async (tx) => {
    const { court } = await lockCourt(tx, input.courtId);
    await expireStaleHolds(tx, { courtId: court.id });
    const active = await tx
      .select({ code: bookings.code, date: bookings.date, startMinute: bookings.startMinute, endMinute: bookings.endMinute })
      .from(bookings)
      .where(
        and(
          eq(bookings.courtId, court.id),
          gte(bookings.date, input.startDate),
          lte(bookings.date, input.endDate),
          or(
            inArray(bookings.status, ["PAID", "CONFIRMED"]),
            and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), or(isNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, new Date()))),
          ),
        ),
      )
      .orderBy(asc(bookings.date), asc(bookings.startMinute));
    const conflicts = wholeDay ? active : active.filter((b) => rangesOverlap(b.startMinute, b.endMinute, input.startMinute!, input.endMinute!));
    if (conflicts.length) {
      const list = conflicts
        .slice(0, 3)
        .map((b) => `${b.code} (${formatDate(b.date, "dayMonth")}, ${formatTimeRange(b.startMinute, b.endMinute)})`)
        .join(", ");
      throw new DomainError(
        `${court.name} has ${conflicts.length} booking${conflicts.length === 1 ? "" : "s"} in that period: ${list}${conflicts.length > 3 ? ", …" : ""}. Cancel ${conflicts.length === 1 ? "it" : "them"} first.`,
        "CONFLICT",
        409,
      );
    }
    const [row] = await tx
      .insert(courtBlocks)
      .values({
        courtId: court.id,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        startMinute: wholeDay ? null : input.startMinute,
        endMinute: wholeDay ? null : input.endMinute,
        reason: input.reason.slice(0, 200) || null,
        createdById: actorId,
      })
      .returning();
    return row!;
  });
  await audit(actorId, "court.block", "court", input.courtId, { blockId: block.id, ...input });
  return block;
}

export async function deleteBlock(blockId: string, actorId: string) {
  const [row] = await db.delete(courtBlocks).where(eq(courtBlocks.id, blockId)).returning();
  if (!row) throw new DomainError("That block no longer exists.", "NOT_FOUND", 404);
  await audit(actorId, "court.unblock", "court", row.courtId, { blockId, startDate: row.startDate, endDate: row.endDate });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Courts                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type CourtPatch = {
  description: string | null;
  surface: string | null;
  status: CourtStatus;
  /** Rate card (minor units): exact one-hour and two-hour prices, optional monthly plans. */
  price1h: number;
  price2h: number;
  monthlyPrice1m: number | null;
  monthlyPrice3m: number | null;
  monthlyPrice6m: number | null;
  monthlyPrice12m: number | null;
};

/**
 * Updates a court's status, copy and rate card. New prices apply to bookings made from now on
 * (the booking service reads them when it holds a slot); existing bookings keep the amount
 * that was charged.
 */
export async function updateCourt(courtId: string, patch: CourtPatch, actorId: string) {
  if (patch.price1h < 100 || patch.price2h < 100) throw new DomainError("Hourly prices must be at least ₹1 (online payments can't be smaller).");
  const [row] = await db.update(courts).set(patch).where(eq(courts.id, courtId)).returning();
  if (!row) throw new DomainError("Court not found.", "NOT_FOUND", 404);
  await audit(actorId, "court.update", "court", courtId, patch);
  return row;
}

/** Upcoming active bookings on a court (shown before taking it out of service). */
export async function upcomingBookingCount(courtId: string) {
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.courtId, courtId), gte(bookings.date, today), lte(bookings.date, addDays(today, 400)), inArray(bookings.status, ["PAID", "CONFIRMED"])));
  return rows.length;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Booking hours                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Changes the daily booking window (stored in the `booking` settings row, which the database
 * trigger reads too). Applies to new bookings only: existing bookings outside the new hours
 * stay valid, and are reported so the facility can contact those customers.
 */
export async function updateBookingHours(hours: BookingHours, actorId: string) {
  const normalized = normalizeBookingHours(hours);
  if (normalized.openMinute !== hours.openMinute || normalized.closeMinute !== hours.closeMinute) {
    throw new DomainError("Choose whole hours, with closing at least one hour after opening.");
  }
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  const outside = await db
    .select({ code: bookings.code })
    .from(bookings)
    .where(
      and(
        gte(bookings.date, today),
        inArray(bookings.status, ["PAID", "CONFIRMED"]),
        or(lt(bookings.startMinute, normalized.openMinute), gt(bookings.endMinute, normalized.closeMinute)),
      ),
    );
  await db
    .insert(settingsTable)
    .values({ key: "booking", value: normalized, updatedById: actorId })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: sql`${settingsTable.value} || ${JSON.stringify(normalized)}::jsonb`, updatedById: actorId } });
  await audit(actorId, "settings.booking_hours", "settings", "booking", { ...normalized, outside: outside.length });
  return { hours: normalized, outsideCodes: outside.map((b) => b.code) };
}
