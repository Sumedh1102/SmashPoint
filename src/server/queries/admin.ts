import "server-only";
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNull, lte, or, sql, sum, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { bookingEvents, bookings, courtBlocks, courts, payments, sports, users, type BookingStatus, type PaymentStatus } from "@/server/db/schema";
import { closureOverlapping, CLOSE_MINUTE, OPEN_MINUTE } from "@/lib/booking/rules";
import { addDays, nowMinutesInTz, rangesOverlap } from "@/lib/time";
import { bookingWindow } from "@/server/services/bookings";
import { getBookingSettings } from "@/server/settings";

export const PAGE_SIZE = 25;

/** Bookings that hold their slot right now (paid, or unpaid with a running hold). */
const occupying = () =>
  or(inArray(bookings.status, ["PAID", "CONFIRMED"]), and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), or(isNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, new Date()))));

/** The most recent payment of each booking (for the payment-status column). */
const latestPayment = db
  .selectDistinctOn([payments.bookingId], {
    bookingId: payments.bookingId,
    status: payments.status,
    refundStatus: payments.refundStatus,
    providerPaymentId: payments.providerPaymentId,
  })
  .from(payments)
  .orderBy(payments.bookingId, desc(payments.createdAt))
  .as("latest_payment");

/* ────────────────────────────────────────────────────────────────────────── */
/* Overview                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export async function getOverview() {
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  const nowMin = nowMinutesInTz(settings.timezone);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const confirmed = inArray(bookings.status, ["PAID", "CONFIRMED"]);

  const [[todayRow], [upcomingRow], [confirmed30], [pendingRow], [cancelled30], [revenue30], attention] = await Promise.all([
    db.select({ n: count() }).from(bookings).where(and(confirmed, eq(bookings.date, today))),
    db
      .select({ n: count() })
      .from(bookings)
      .where(and(confirmed, or(gt(bookings.date, today), and(eq(bookings.date, today), gt(bookings.startMinute, nowMin))))),
    db.select({ n: count() }).from(bookings).where(and(confirmed, gte(bookings.confirmedAt, since))),
    db
      .select({ n: count() })
      .from(bookings)
      .where(and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), gt(bookings.holdExpiresAt, new Date()))),
    db.select({ n: count() }).from(bookings).where(and(inArray(bookings.status, ["CANCELLED", "REFUNDED"]), gte(bookings.cancelledAt, since))),
    db
      .select({ total: sum(payments.amount), n: count() })
      .from(payments)
      .where(and(eq(payments.status, "PAID"), gte(payments.paidAt, since))),
    db
      .select({ id: payments.id, receiptNumber: payments.receiptNumber, refundStatus: payments.refundStatus, failureReason: payments.failureReason, code: bookings.code })
      .from(payments)
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(or(eq(payments.refundStatus, "failed"), sql`${payments.failureReason} like '%needs review%'`))
      .limit(10),
  ]);

  const [todaySchedule, recent] = await Promise.all([getScheduleForDate(today), listBookings({ page: 1, pageSize: 8 })]);
  return {
    today,
    stats: {
      today: todayRow?.n ?? 0,
      upcoming: upcomingRow?.n ?? 0,
      confirmed30: confirmed30?.n ?? 0,
      pendingPayments: pendingRow?.n ?? 0,
      cancelled30: cancelled30?.n ?? 0,
      revenue30: Number(revenue30?.total ?? 0),
      payments30: revenue30?.n ?? 0,
    },
    attention,
    schedule: todaySchedule,
    recent: recent.rows,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Schedules                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export type ScheduleCell =
  | { kind: "free" }
  | { kind: "booking"; code: string; customer: string; status: BookingStatus; startMinute: number; endMinute: number }
  | { kind: "block"; type: "MAINTENANCE" | "BLOCKED"; reason: string | null }
  | { kind: "closure"; label: string };

/** Hour-by-hour grid (7 AM – 10 PM) of every court on a date: bookings, holds, blocks and closures. */
export async function getScheduleForDate(date: string, courtId?: string) {
  const courtRows = await db
    .select({ court: courts, sport: { slug: sports.slug, name: sports.name } })
    .from(courts)
    .innerJoin(sports, eq(sports.id, courts.sportId))
    .where(courtId ? eq(courts.id, courtId) : sql`${courts.status} <> 'INACTIVE'`)
    .orderBy(asc(sports.sortOrder), asc(courts.sortOrder));
  const ids = courtRows.map((r) => r.court.id);
  if (!ids.length) return { date, hours: [] as number[], courts: [] };
  const [dayBookings, dayBlocks] = await Promise.all([
    db
      .select({ courtId: bookings.courtId, code: bookings.code, customer: bookings.customerName, status: bookings.status, startMinute: bookings.startMinute, endMinute: bookings.endMinute })
      .from(bookings)
      .where(and(eq(bookings.date, date), inArray(bookings.courtId, ids), occupying()))
      .orderBy(asc(bookings.startMinute)),
    db
      .select()
      .from(courtBlocks)
      .where(and(inArray(courtBlocks.courtId, ids), lte(courtBlocks.startDate, date), gte(courtBlocks.endDate, date))),
  ]);

  const hours: number[] = [];
  for (let m = OPEN_MINUTE; m < CLOSE_MINUTE; m += 60) hours.push(m);
  return {
    date,
    hours,
    courts: courtRows.map(({ court, sport }) => ({
      id: court.id,
      slug: court.slug,
      name: court.name,
      status: court.status,
      sport,
      bookingCount: dayBookings.filter((b) => b.courtId === court.id && (b.status === "PAID" || b.status === "CONFIRMED")).length,
      cells: hours.map<ScheduleCell>((h) => {
        if (court.status === "MAINTENANCE") return { kind: "block", type: "MAINTENANCE", reason: "Court in maintenance" };
        const block = dayBlocks.find((b) => b.courtId === court.id && (b.startMinute === null || b.endMinute === null || rangesOverlap(h, h + 60, b.startMinute, b.endMinute)));
        if (block) return { kind: "block", type: block.type, reason: block.reason };
        const b = dayBookings.find((x) => x.courtId === court.id && rangesOverlap(h, h + 60, x.startMinute, x.endMinute));
        if (b) return { kind: "booking", ...b };
        const closure = closureOverlapping(sport.slug, h, h + 60);
        if (closure) return { kind: "closure", label: closure.label };
        return { kind: "free" };
      }),
    })),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Bookings                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type BookingFilters = { q?: string; status?: string; sport?: string; from?: string; to?: string; page?: number; pageSize?: number };

const STATUS_GROUPS: Record<string, BookingStatus[]> = {
  confirmed: ["PAID", "CONFIRMED"],
  pending: ["PENDING", "PAYMENT_INITIATED"],
  cancelled: ["CANCELLED", "REFUNDED"],
  expired: ["EXPIRED"],
};

export async function listBookings(f: BookingFilters) {
  const pageSize = f.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, f.page ?? 1);
  const conds: (SQL | undefined)[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const digits = q.replace(/\D/g, "");
    conds.push(
      or(
        ilike(bookings.code, like),
        ilike(bookings.customerName, like),
        ilike(bookings.customerEmail, like),
        digits.length >= 4 ? ilike(bookings.customerPhone, `%${digits}%`) : undefined,
      ),
    );
  }
  if (f.status && STATUS_GROUPS[f.status]) conds.push(inArray(bookings.status, STATUS_GROUPS[f.status]!));
  if (f.sport) conds.push(eq(sports.slug, f.sport));
  if (f.from) conds.push(gte(bookings.date, f.from));
  if (f.to) conds.push(lte(bookings.date, f.to));
  const where = and(...conds);

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        customerName: bookings.customerName,
        customerPhone: bookings.customerPhone,
        customerEmail: bookings.customerEmail,
        date: bookings.date,
        startMinute: bookings.startMinute,
        endMinute: bookings.endMinute,
        status: bookings.status,
        total: bookings.total,
        holdExpiresAt: bookings.holdExpiresAt,
        createdAt: bookings.createdAt,
        court: courts.name,
        sport: sports.name,
        paymentStatus: latestPayment.status,
        refundStatus: latestPayment.refundStatus,
      })
      .from(bookings)
      .innerJoin(courts, eq(courts.id, bookings.courtId))
      .innerJoin(sports, eq(sports.id, bookings.sportId))
      .leftJoin(latestPayment, eq(latestPayment.bookingId, bookings.id))
      .where(where)
      .orderBy(desc(bookings.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: count() })
      .from(bookings)
      .innerJoin(sports, eq(sports.id, bookings.sportId))
      .where(where),
  ]);
  return { rows, total: total?.n ?? 0, page, pageSize };
}

export type BookingListRow = Awaited<ReturnType<typeof listBookings>>["rows"][number];

export async function getBookingDetail(code: string) {
  const [row] = await db
    .select({ booking: bookings, court: { id: courts.id, name: courts.name, slug: courts.slug }, sport: { name: sports.name, slug: sports.slug } })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .innerJoin(sports, eq(sports.id, bookings.sportId))
    .where(eq(bookings.code, code))
    .limit(1);
  if (!row) return null;
  const [paymentRows, events] = await Promise.all([
    db.select().from(payments).where(eq(payments.bookingId, row.booking.id)).orderBy(desc(payments.createdAt)),
    db
      .select({ id: bookingEvents.id, status: bookingEvents.status, note: bookingEvents.note, createdAt: bookingEvents.createdAt, actor: users.name })
      .from(bookingEvents)
      .leftJoin(users, eq(users.id, bookingEvents.actorId))
      .where(eq(bookingEvents.bookingId, row.booking.id))
      .orderBy(asc(bookingEvents.createdAt)),
  ]);
  return { ...row, payments: paymentRows, events };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Courts                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export async function listCourtsAdmin() {
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  const rows = await db
    .select({ court: courts, sport: { slug: sports.slug, name: sports.name } })
    .from(courts)
    .innerJoin(sports, eq(sports.id, courts.sportId))
    .orderBy(asc(sports.sortOrder), asc(courts.sortOrder));
  const upcoming = await db
    .select({ courtId: bookings.courtId, n: count() })
    .from(bookings)
    .where(and(inArray(bookings.status, ["PAID", "CONFIRMED"]), gte(bookings.date, today), lte(bookings.date, addDays(today, 30))))
    .groupBy(bookings.courtId);
  const activeBlocks = await db
    .select({ courtId: courtBlocks.courtId, n: count() })
    .from(courtBlocks)
    .where(gte(courtBlocks.endDate, today))
    .groupBy(courtBlocks.courtId);
  return rows.map((r) => ({
    ...r,
    upcoming30: upcoming.find((u) => u.courtId === r.court.id)?.n ?? 0,
    blocks: activeBlocks.find((b) => b.courtId === r.court.id)?.n ?? 0,
  }));
}

export async function getCourtAdmin(slug: string) {
  const [row] = await db
    .select({ court: courts, sport: { slug: sports.slug, name: sports.name } })
    .from(courts)
    .innerJoin(sports, eq(sports.id, courts.sportId))
    .where(eq(courts.slug, slug))
    .limit(1);
  if (!row) return null;
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  const blocks = await db
    .select({ block: courtBlocks, createdBy: users.name })
    .from(courtBlocks)
    .leftJoin(users, eq(users.id, courtBlocks.createdById))
    .where(and(eq(courtBlocks.courtId, row.court.id), gte(courtBlocks.endDate, today)))
    .orderBy(asc(courtBlocks.startDate), asc(courtBlocks.startMinute));
  return { ...row, blocks, today };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Payments                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export async function listPayments(f: { q?: string; status?: string; page?: number }) {
  const page = Math.max(1, f.page ?? 1);
  const conds: (SQL | undefined)[] = [];
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(or(ilike(payments.receiptNumber, like), ilike(payments.providerOrderId, like), ilike(payments.providerPaymentId, like), ilike(payments.payerName, like), ilike(bookings.code, like)));
  }
  if (f.status === "refund-pending") conds.push(inArray(payments.refundStatus, ["requested", "pending"]));
  else if (f.status && ["CREATED", "INITIATED", "PAID", "FAILED", "REFUNDED"].includes(f.status)) conds.push(eq(payments.status, f.status as PaymentStatus));
  const where = and(...conds);
  const [rows, [total]] = await Promise.all([
    db
      .select({ payment: payments, bookingCode: bookings.code })
      .from(payments)
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(where)
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ n: count() }).from(payments).leftJoin(bookings, eq(bookings.id, payments.bookingId)).where(where),
  ]);
  return { rows, total: total?.n ?? 0, page, pageSize: PAGE_SIZE };
}
