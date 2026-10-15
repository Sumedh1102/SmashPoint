import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courts, payments, sports } from "@/server/db/schema";
import { verifyBookingAccess } from "@/server/security";
import { getBookingSettings } from "@/server/settings";
import { bookingWindow, getCourtSnapshots, loadCourts } from "@/server/services/bookings";
import { paymentsEnabled } from "@/server/payments/service";

export type PublicCourt = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  hourlyRate: number;
  peakHourlyRate: number;
  sport: { slug: string; name: string };
  /** Live: free one-hour slots left today and the next free slot. */
  freeToday: number;
  next: { date: string; startMinute: number } | null;
};

/** Everything the home page needs: the courts with live availability and the booking window. */
export async function getHomeData() {
  const [rows, snapshots, settings] = await Promise.all([loadCourts(db), getCourtSnapshots(), getBookingSettings()]);
  const courtList: PublicCourt[] = rows.map(({ court, sport }) => {
    const snap = snapshots.get(court.id);
    return {
      id: court.id,
      slug: court.slug,
      name: court.name,
      description: court.description,
      status: court.status,
      hourlyRate: court.hourlyRate,
      peakHourlyRate: court.peakHourlyRate,
      sport: { slug: sport.slug, name: sport.name },
      freeToday: snap?.freeToday ?? 0,
      next: snap?.next ?? null,
    };
  });
  return {
    courts: courtList,
    window: bookingWindow(settings),
    holdMinutes: settings.holdMinutes,
    peakWindows: settings.peakWindows,
    paymentsEnabled: paymentsEnabled(),
  };
}

/** A booking for its customer: requires the signed access token from the booking link. */
export async function findCustomerBooking(code: string, token: string | null | undefined) {
  if (!verifyBookingAccess(code, token)) return null;
  const [row] = await db
    .select({ booking: bookings, court: { name: courts.name, slug: courts.slug }, sport: { name: sports.name, slug: sports.slug } })
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
