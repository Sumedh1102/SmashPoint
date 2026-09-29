import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, bookingSeries } from "@/server/db/schema";
import { can } from "@/lib/rbac";
import { getCurrentUser } from "@/server/auth/guards";
import { verifyBookingAccess } from "@/server/security";

/** Monthly/quarterly bookings use "SPR-" references; single bookings "SP-". */
export const isSeriesCode = (code: string) => code.toUpperCase().startsWith("SPR-");

async function hasAccess(code: string, token: string | null | undefined, ownerId: string | null) {
  if (verifyBookingAccess(code, token)) return { access: true, viaToken: true };
  const user = await getCurrentUser();
  if (user && ((ownerId && ownerId === user.id) || can(user.role, "bookings:manage"))) return { access: true, viaToken: false };
  return { access: false, viaToken: false };
}

/**
 * A booking is visible to: its signed-in owner, staff with bookings permission, or anyone
 * holding the signed capability link sent at checkout (for guest bookings). Booking codes
 * alone are never enough, so receipts can't be enumerated.
 */
export async function findAccessibleBooking(code: string, token: string | null | undefined) {
  const normalized = code.toUpperCase();
  const [booking] = await db.query.bookings.findMany({
    where: eq(bookings.code, normalized),
    with: {
      court: true,
      sport: true,
      rentals: { with: { item: true } },
      events: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
      payments: { orderBy: (p, { desc }) => [desc(p.createdAt)] },
    },
    limit: 1,
  });
  if (!booking) return { booking: null, access: false as const, viaToken: false };
  const { access, viaToken } = await hasAccess(normalized, token, booking.userId);
  return access ? { booking, access: true as const, viaToken } : { booking: null, access: false as const, viaToken: false };
}

/** Same rules for a monthly/quarterly booking and its sessions. */
export async function findAccessibleSeries(code: string, token: string | null | undefined) {
  const normalized = code.toUpperCase();
  const [series] = await db.query.bookingSeries.findMany({
    where: eq(bookingSeries.code, normalized),
    with: {
      court: true,
      sport: true,
      bookings: { orderBy: (b, { asc }) => [asc(b.date)], with: { rentals: { with: { item: true } } } },
      payments: { orderBy: (p, { desc }) => [desc(p.createdAt)] },
    },
    limit: 1,
  });
  if (!series) return { series: null, access: false as const, viaToken: false };
  const { access, viaToken } = await hasAccess(normalized, token, series.userId);
  return access ? { series, access: true as const, viaToken } : { series: null, access: false as const, viaToken: false };
}
