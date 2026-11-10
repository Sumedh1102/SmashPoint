import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courts, payments, sports } from "@/server/db/schema";
import { verifyBookingAccess } from "@/server/security";
import type { MonthlyPrices, RateCardCourt } from "@/lib/pricing";
import { getBookingSettings, hoursOf } from "@/server/settings";
import { bookingWindow, getCourtSnapshots, loadCourts } from "@/server/services/bookings";
import { paymentsEnabled } from "@/server/payments/service";

export type PublicCourt = RateCardCourt & {
  description: string | null;
  /** Live: free one-hour slots left today and the next free slot. */
  freeToday: number;
  /** One-hour slots today that haven't started yet (free or not). */
  remainingToday: number;
  next: { date: string; startMinute: number } | null;
};

/** Everything the home page needs: the courts (rate card + live availability), booking window and hours. */
export async function getHomeData() {
  const [rows, snapshots, settings] = await Promise.all([loadCourts(db), getCourtSnapshots(), getBookingSettings()]);
  const courtList: PublicCourt[] = rows.map(({ court, sport }) => {
    const snap = snapshots.get(court.id);
    const monthly: MonthlyPrices = {
      monthlyPrice1m: court.monthlyPrice1m,
      monthlyPrice3m: court.monthlyPrice3m,
      monthlyPrice6m: court.monthlyPrice6m,
      monthlyPrice12m: court.monthlyPrice12m,
    };
    return {
      id: court.id,
      slug: court.slug,
      name: court.name,
      description: court.description,
      surface: court.surface,
      status: court.status,
      price1h: court.price1h,
      price2h: court.price2h,
      monthly,
      sport: { slug: sport.slug, name: sport.name },
      freeToday: snap?.freeToday ?? 0,
      remainingToday: snap?.remainingToday ?? 0,
      next: snap?.next ?? null,
    };
  });
  return {
    courts: courtList,
    window: bookingWindow(settings),
    holdMinutes: settings.holdMinutes,
    hours: hoursOf(settings),
    paymentsEnabled: paymentsEnabled(),
  };
}

/** A booking for its customer: requires the signed access token from the booking link. */
export async function findCustomerBooking(code: string, token: string | null | undefined) {
  if (!verifyBookingAccess(code, token)) return null;
  const [row] = await db
    .select({ booking: bookings, court: { name: courts.name, slug: courts.slug, surface: courts.surface }, sport: { name: sports.name, slug: sports.slug } })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .innerJoin(sports, eq(sports.id, bookings.sportId))
    .where(eq(bookings.code, code))
    .limit(1);
  if (!row) return null;
  const [payment] = await db
    .select({
      receiptNumber: payments.receiptNumber,
      status: payments.status,
      amount: payments.amount,
      providerPaymentId: payments.providerPaymentId,
      paidAt: payments.paidAt,
      refundStatus: payments.refundStatus,
      refundReference: payments.refundReference,
    })
    .from(payments)
    .where(eq(payments.bookingId, row.booking.id))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return { ...row, payment: payment ?? null };
}
