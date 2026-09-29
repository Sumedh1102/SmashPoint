import "server-only";
import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { db, type DbOrTx, type Transaction } from "@/server/db";
import {
  batches,
  bookingEvents,
  bookingSeries,
  bookings,
  courtBlocks,
  courts,
  memberships,
  membershipPlans,
  sports,
  students,
  type Booking,
  type BookingSeries,
  type BookingStatus,
  type Court,
} from "@/server/db/schema";
import { ACTIVE_BOOKING_STATUSES, applyDiscount, computeAvailability, courtHours, priceForRange, type OccupiedRange, type BlockRange } from "@/lib/booking/engine";
import { summarizeDay, type DaySummary } from "@/lib/booking/calendar";
import { lastBookableDate, releaseInfo } from "@/lib/booking/release";
import { seriesDates, seriesEndDate, type RecurringType } from "@/lib/booking/recurring";
import type { BookingSettings } from "@/lib/settings-types";
import { dateRange, dayOfWeek, endOfMonth, isValidISODate, nowMinutesInTz, rangesOverlap, todayInTz } from "@/lib/time";
import { formatDate, formatTimeRange } from "@/lib/format";
import { getBookingSettings } from "@/server/settings";
import { DomainError, isExclusionViolation, isUniqueViolation } from "@/server/errors";
import { randomCode } from "@/server/security";
import { resolveCoupon } from "./coupons";
import { cancelRentals, moveRentals, quoteEquipment, reserveEquipment, type EquipmentRequest } from "./equipment";

/* ────────────────────────────────────────────────────────────────────────── */
/* Occupancy                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** Active = currently occupying the slot. Unpaid holds stop counting once they expire. */
function occupyingBookingFilter(now = new Date()) {
  return or(
    inArray(bookings.status, ["PAID", "CONFIRMED"]),
    and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), or(isNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, now))),
  );
}

function nowMinuteFor(date: string, settings: BookingSettings): number | null {
  const today = todayInTz(settings.timezone);
  if (date < today) return Number.POSITIVE_INFINITY;
  if (date === today) return nowMinutesInTz(settings.timezone);
  return null;
}

type RangeOccupancy = {
  bookings: (OccupiedRange & { date: string })[];
  blocks: (BlockRange & { startDate: string; endDate: string })[];
  batches: { courtId: string; startMinute: number; endMinute: number; label: string; daysOfWeek: number[]; startDate: string }[];
};

/** Bookings, blocks and training batches for courts over a date range (inclusive). */
async function loadOccupancy(
  conn: DbOrTx,
  range: { from: string; to: string },
  opts: { courtIds?: string[]; excludeBookingIds?: string[] } = {},
): Promise<RangeOccupancy> {
  const courtFilter = (col: typeof bookings.courtId | typeof courtBlocks.courtId) => (opts.courtIds ? inArray(col, opts.courtIds) : undefined);
  const [rangeBookings, rangeBlocks, activeBatches] = await Promise.all([
    conn
      .select({ date: bookings.date, courtId: bookings.courtId, startMinute: bookings.startMinute, endMinute: bookings.endMinute })
      .from(bookings)
      .where(
        and(
          gte(bookings.date, range.from),
          lte(bookings.date, range.to),
          occupyingBookingFilter(),
          courtFilter(bookings.courtId),
          opts.excludeBookingIds?.length ? notInArray(bookings.id, opts.excludeBookingIds) : undefined,
        ),
      ),
    conn
      .select({
        courtId: courtBlocks.courtId,
        type: courtBlocks.type,
        startMinute: courtBlocks.startMinute,
        endMinute: courtBlocks.endMinute,
        reason: courtBlocks.reason,
        startDate: courtBlocks.startDate,
        endDate: courtBlocks.endDate,
      })
      .from(courtBlocks)
      .where(and(lte(courtBlocks.startDate, range.to), gte(courtBlocks.endDate, range.from), courtFilter(courtBlocks.courtId))),
    conn
      .select({
        courtId: batches.courtId,
        startMinute: batches.startMinute,
        endMinute: batches.endMinute,
        label: batches.name,
        daysOfWeek: batches.daysOfWeek,
        startDate: batches.startDate,
      })
      .from(batches)
      .where(and(eq(batches.isActive, true), lte(batches.startDate, range.to), opts.courtIds ? inArray(batches.courtId, opts.courtIds) : sql`${batches.courtId} IS NOT NULL`)),
  ]);
  return {
    bookings: rangeBookings,
    blocks: rangeBlocks,
    batches: activeBatches.filter((b): b is typeof b & { courtId: string } => !!b.courtId),
  };
}

function occupancyOn(occ: RangeOccupancy, date: string) {
  const dow = dayOfWeek(date);
  return {
    bookings: occ.bookings.filter((b) => b.date === date),
    blocks: occ.blocks.filter((b) => b.startDate <= date && b.endDate >= date),
    training: occ.batches
      .filter((b) => b.startDate <= date && b.daysOfWeek.includes(dow))
      .map((b) => ({ courtId: b.courtId, startMinute: b.startMinute, endMinute: b.endMinute, label: b.label })),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Courts                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export async function loadBookableCourts(conn: DbOrTx, filter: { sportId?: string; courtId?: string } = {}) {
  return conn
    .select({ court: courts, sport: { id: sports.id, slug: sports.slug, name: sports.name, isActive: sports.isActive } })
    .from(courts)
    .innerJoin(sports, eq(sports.id, courts.sportId))
    .where(
      and(
        ne(courts.status, "INACTIVE"),
        eq(sports.isActive, true),
        filter.sportId ? eq(courts.sportId, filter.sportId) : undefined,
        filter.courtId ? eq(courts.id, filter.courtId) : undefined,
      ),
    )
    .orderBy(asc(sports.sortOrder), asc(courts.sortOrder), asc(courts.name));
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Availability                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Slot grid for one date: every court of a sport (or one court) at a duration. */
export async function getDayAvailability(input: { date: string; duration: number; sportId?: string; courtId?: string }) {
  const settings = await getBookingSettings();
  if (!isValidISODate(input.date)) throw new DomainError("Invalid date.");
  const rows = (await loadBookableCourts(db, input)).filter((r) => r.court.durations.includes(input.duration));
  const occ = await loadOccupancy(db, { from: input.date, to: input.date }, { courtIds: rows.map((r) => r.court.id) });
  const day = occupancyOn(occ, input.date);
  const result = computeAvailability({
    date: input.date,
    duration: input.duration,
    settings,
    courts: rows.map((r) => r.court),
    bookings: day.bookings,
    blocks: day.blocks,
    training: day.training,
    nowMinute: nowMinuteFor(input.date, settings),
  });
  const today = todayInTz(settings.timezone);
  return {
    ...result,
    release: releaseInfo(input.date, today, settings.release, settings.advanceDays),
    isPast: input.date < today,
  };
}

/** One status per day of a month for a court and duration (the booking calendar). */
export async function getMonthCalendar(input: { courtId: string; month: string; duration: number }): Promise<{
  month: string;
  days: DaySummary[];
  lastBookableDate: string;
}> {
  const settings = await getBookingSettings();
  if (!/^\d{4}-\d{2}$/.test(input.month)) throw new DomainError("Invalid month.");
  const from = `${input.month}-01`;
  const to = endOfMonth(from);
  const [row] = await loadBookableCourts(db, { courtId: input.courtId });
  const today = todayInTz(settings.timezone);
  const occ = row ? await loadOccupancy(db, { from, to }, { courtIds: [row.court.id] }) : null;

  const days = dateRange(from, to).map((date) => {
    const release = releaseInfo(date, today, settings.release, settings.advanceDays);
    if (!row || !occ || !row.court.durations.includes(input.duration)) return summarizeDay(date, undefined, release, date < today);
    const day = occupancyOn(occ, date);
    const avail = computeAvailability({
      date,
      duration: input.duration,
      settings,
      courts: [row.court],
      ...day,
      nowMinute: nowMinuteFor(date, settings),
    });
    return summarizeDay(date, avail.courts[0], release, date < today);
  });
  return { month: input.month, days, lastBookableDate: lastBookableDate(today, settings.release, settings.advanceDays) };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Quotes                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type BookingQuote = {
  subtotal: number;
  memberDiscount: number;
  couponDiscount: number;
  discount: number;
  equipmentTotal: number;
  total: number;
  isPeak: boolean;
  couponId: string | null;
  couponMessage: string | null;
};

async function memberCourtDiscountPercent(conn: DbOrTx, userId: string | null | undefined, date: string): Promise<number> {
  if (!userId) return 0;
  const [row] = await conn
    .select({ pct: membershipPlans.courtDiscountPercent })
    .from(memberships)
    .innerJoin(membershipPlans, eq(membershipPlans.id, memberships.planId))
    .innerJoin(students, eq(students.id, memberships.studentId))
    .where(and(eq(students.userId, userId), eq(memberships.status, "ACTIVE"), lte(memberships.startDate, date), gte(memberships.endDate, date)))
    .orderBy(sql`${membershipPlans.courtDiscountPercent} DESC`)
    .limit(1);
  return row?.pct ?? 0;
}

/** Court price after member and coupon discounts (equipment is added separately). */
export async function quoteBooking(
  conn: DbOrTx,
  input: { court: { hourlyRate: number; peakHourlyRate: number }; date: string; startMinute: number; endMinute: number; userId?: string | null; couponCode?: string | null },
  settings: BookingSettings,
): Promise<BookingQuote> {
  const { price, isPeak } = priceForRange(input.court, settings.peakWindows, input.date, input.startMinute, input.endMinute);
  const pct = await memberCourtDiscountPercent(conn, input.userId, input.date);
  const member = applyDiscount(price, pct ? { type: "PERCENT", value: pct } : null);

  let couponDiscount = 0;
  let couponId: string | null = null;
  let couponMessage: string | null = null;
  if (input.couponCode?.trim()) {
    const result = await resolveCoupon(conn, input.couponCode, "BOOKING", member.total, input.date);
    if (result.ok) {
      couponDiscount = applyDiscount(member.total, result.coupon).discount;
      couponId = result.coupon.id;
      couponMessage = `${result.coupon.code} applied`;
    } else {
      couponMessage = result.message;
    }
  }
  const discount = member.discount + couponDiscount;
  return { subtotal: price, memberDiscount: member.discount, couponDiscount, discount, equipmentTotal: 0, total: price - discount, isPeak, couponId, couponMessage };
}

/** Everything the review step shows: court price, discounts, equipment and total. */
export async function quoteReservation(input: {
  courtId: string;
  date: string;
  startMinute: number;
  duration: number;
  userId?: string | null;
  couponCode?: string | null;
  equipment?: EquipmentRequest[];
}) {
  const settings = await getBookingSettings();
  const [row] = await loadBookableCourts(db, { courtId: input.courtId });
  if (!row) throw new DomainError("Court not found.", "NOT_FOUND", 404);
  const endMinute = input.startMinute + input.duration;
  const hours = courtHours(row.court, settings);
  if (input.startMinute < hours.openMinute || endMinute > hours.closeMinute) throw new DomainError("Outside opening hours.");
  const court = await quoteBooking(db, { court: row.court, date: input.date, startMinute: input.startMinute, endMinute, userId: input.userId, couponCode: input.couponCode }, settings);
  const equipment = await quoteEquipment(db, row.court.sportId, { date: input.date, startMinute: input.startMinute, endMinute }, input.equipment ?? []);
  return { ...court, equipmentTotal: equipment.total, total: court.total + equipment.total, equipment };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Lifecycle helpers                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export async function transitionBooking(
  tx: DbOrTx,
  bookingId: string,
  status: BookingStatus,
  opts: { note?: string; actorId?: string | null; patch?: Partial<typeof bookings.$inferInsert> } = {},
) {
  const [updated] = await tx.update(bookings).set({ status, ...opts.patch }).where(eq(bookings.id, bookingId)).returning();
  await tx.insert(bookingEvents).values({ bookingId, status, note: opts.note ?? null, actorId: opts.actorId ?? null });
  if (status === "CANCELLED" || status === "EXPIRED" || status === "REFUNDED") await cancelRentals(tx, [bookingId]);
  return updated!;
}

/** Releases unpaid holds (single bookings and monthly/quarterly series) whose timer ran out. */
export async function expireStaleHolds(conn: DbOrTx, scope: { courtId?: string; date?: string } = {}) {
  const now = new Date();
  const expired = await conn
    .update(bookings)
    .set({ status: "EXPIRED" })
    .where(
      and(
        inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]),
        lt(bookings.holdExpiresAt, now),
        scope.courtId ? eq(bookings.courtId, scope.courtId) : undefined,
        scope.date ? eq(bookings.date, scope.date) : undefined,
      ),
    )
    .returning({ id: bookings.id, seriesId: bookings.seriesId });
  if (expired.length) {
    await conn.insert(bookingEvents).values(expired.map((b) => ({ bookingId: b.id, status: "EXPIRED" as const, note: "Payment window elapsed" })));
    await cancelRentals(conn, expired.map((b) => b.id));
  }
  await conn
    .update(bookingSeries)
    .set({ status: "EXPIRED" })
    .where(
      and(
        inArray(bookingSeries.status, ["PENDING", "PAYMENT_INITIATED"]),
        lt(bookingSeries.holdExpiresAt, now),
        scope.courtId ? eq(bookingSeries.courtId, scope.courtId) : undefined,
      ),
    );
  return expired.length;
}

function describeConflict(kind: "block" | "maintenance" | "training" | "booking") {
  switch (kind) {
    case "maintenance":
      return "This court is under maintenance for the selected time.";
    case "block":
      return "This slot has been blocked by the facility.";
    case "training":
      return "This court is reserved for a training session at that time.";
    default:
      return "Sorry, that slot was just booked by someone else. Please pick another.";
  }
}

/** Why a range is not free on a day, or null. Uses occupancy loaded under the court lock. */
function conflictOn(occ: RangeOccupancy, date: string, courtId: string, startMinute: number, endMinute: number) {
  const day = occupancyOn(occ, date);
  const overlaps = (r: { courtId: string; startMinute: number | null; endMinute: number | null }) =>
    r.courtId === courtId && (r.startMinute === null || r.endMinute === null || rangesOverlap(startMinute, endMinute, r.startMinute, r.endMinute));
  const block = day.blocks.find(overlaps);
  if (block) return block.type === "MAINTENANCE" ? ("maintenance" as const) : ("block" as const);
  if (day.training.some(overlaps)) return "training" as const;
  if (day.bookings.some(overlaps)) return "booking" as const;
  return null;
}

async function lockCourt(tx: Transaction, courtId: string): Promise<Court> {
  const [court] = await tx.select().from(courts).where(eq(courts.id, courtId)).for("update");
  if (!court) throw new DomainError("Court not found.", "NOT_FOUND", 404);
  if (court.status !== "ACTIVE") throw new DomainError(`${court.name} is currently unavailable for booking.`, "SLOT_UNAVAILABLE", 409);
  const [sport] = await tx.select({ isActive: sports.isActive, name: sports.name }).from(sports).where(eq(sports.id, court.sportId));
  if (!sport?.isActive) throw new DomainError(`${sport?.name ?? "This sport"} is not open for booking right now.`, "SLOT_UNAVAILABLE", 409);
  return court;
}

function validateTimeWindow(
  settings: BookingSettings,
  court: Pick<Court, "openMinute" | "closeMinute">,
  input: { date: string; startMinute: number; endMinute: number },
  opts: { staff: boolean },
) {
  const today = todayInTz(settings.timezone);
  if (!isValidISODate(input.date)) throw new DomainError("Please choose a valid date.");
  if (input.date < today) throw new DomainError("You can't book a date in the past.");
  if (!opts.staff) {
    const release = releaseInfo(input.date, today, settings.release, settings.advanceDays);
    if (!release.released) throw new DomainError(`Bookings for this period open on ${formatDate(release.opensOn!, "long")}.`, "NOT_RELEASED", 409);
  }
  const hours = courtHours(court, settings);
  if (input.startMinute < hours.openMinute || input.endMinute > hours.closeMinute) throw new DomainError("That time is outside opening hours.");
  if (input.startMinute % 30 !== 0 || input.endMinute % 30 !== 0) throw new DomainError("Bookings start on the hour or half hour.");
  if (input.date === today && input.startMinute <= nowMinutesInTz(settings.timezone)) throw new DomainError("That slot has already started.");
}

function checkCourtRules(court: Court, type: "SINGLE" | RecurringType, duration: number, staff: boolean) {
  if (duration < 30 || duration > 480) throw new DomainError("Unsupported booking duration.");
  if (staff) return;
  if (!court.durations.includes(duration)) throw new DomainError(`${court.name} can be booked for ${court.durations.map((d) => `${d / 60} h`).join(" or ")}.`);
  if (!court.bookingTypes.includes(type)) throw new DomainError(`${court.name} doesn't accept ${type.toLowerCase()} bookings.`);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Create a single booking                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export type CreateBookingInput = {
  courtId: string;
  date: string;
  startMinute: number;
  duration: number;
  customer: { name: string; phone: string; email?: string | null };
  userId?: string | null;
  couponCode?: string | null;
  notes?: string | null;
  equipment?: EquipmentRequest[];
  source?: "ONLINE" | "WALK_IN" | "ADMIN";
  actorId?: string | null;
  /** Staff bookings may skip the release window and court duration/type rules. */
  staff?: boolean;
};

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const settings = await getBookingSettings();
  const staff = !!input.staff;
  const endMinute = input.startMinute + input.duration;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const court = await lockCourt(tx, input.courtId);
        checkCourtRules(court, "SINGLE", input.duration, staff);
        validateTimeWindow(settings, court, { date: input.date, startMinute: input.startMinute, endMinute }, { staff });
        await expireStaleHolds(tx, { courtId: court.id, date: input.date });
        const occ = await loadOccupancy(tx, { from: input.date, to: input.date }, { courtIds: [court.id] });
        const conflict = conflictOn(occ, input.date, court.id, input.startMinute, endMinute);
        if (conflict) throw new DomainError(describeConflict(conflict), "SLOT_UNAVAILABLE", 409);

        const quote = await quoteBooking(tx, { court, date: input.date, startMinute: input.startMinute, endMinute, userId: input.userId, couponCode: input.couponCode }, settings);
        if (input.couponCode?.trim() && !quote.couponId) throw new DomainError(quote.couponMessage ?? "Invalid coupon.");

        const [booking] = await tx
          .insert(bookings)
          .values({
            code: randomCode("SP"),
            sportId: court.sportId,
            courtId: court.id,
            userId: input.userId ?? null,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email || null,
            date: input.date,
            startMinute: input.startMinute,
            endMinute,
            subtotal: quote.subtotal,
            discount: quote.discount,
            total: quote.total,
            couponId: quote.couponId,
            status: "PENDING",
            source: input.source ?? "ONLINE",
            notes: input.notes || null,
            holdExpiresAt: new Date(Date.now() + settings.holdMinutes * 60_000),
            createdById: input.actorId ?? input.userId ?? null,
          })
          .returning();

        const rentals = await reserveEquipment(
          tx,
          { id: booking!.id, sportId: court.sportId, date: input.date, startMinute: input.startMinute, endMinute, userId: input.userId, customerName: input.customer.name },
          input.equipment ?? [],
          input.actorId,
        );
        let saved = booking!;
        if (rentals.total > 0) {
          [saved] = await tx
            .update(bookings)
            .set({ equipmentTotal: rentals.total, total: quote.total + rentals.total })
            .where(eq(bookings.id, booking!.id))
            .returning() as [Booking];
        }

        await tx.insert(bookingEvents).values({
          bookingId: saved.id,
          status: "PENDING",
          note: `${court.name} · ${formatDate(input.date)} · ${formatTimeRange(input.startMinute, endMinute)}${rentals.lines.length ? ` · ${rentals.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}` : ""}`,
          actorId: input.actorId ?? input.userId ?? null,
        });
        return saved;
      });
    } catch (err) {
      if (isExclusionViolation(err)) throw new DomainError(describeConflict("booking"), "SLOT_UNAVAILABLE", 409);
      // Extremely unlikely booking-code collision: retry with a fresh code.
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new DomainError("Could not create booking, please try again.");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Monthly / quarterly bookings                                              */
/* ────────────────────────────────────────────────────────────────────────── */

const MAX_SERIES_SESSIONS = 120;

export type SeriesPlanInput = {
  courtId: string;
  type: RecurringType;
  startDate: string;
  daysOfWeek: number[];
  startMinute: number;
  duration: number;
};

function planDates(input: SeriesPlanInput) {
  const days = [...new Set(input.daysOfWeek)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!days.length) throw new DomainError("Choose at least one day of the week.");
  const endDate = seriesEndDate(input.startDate, input.type);
  const dates = seriesDates(input.startDate, endDate, days);
  if (!dates.length) throw new DomainError("None of the chosen days fall inside this period.");
  if (dates.length > MAX_SERIES_SESSIONS) throw new DomainError("That's too many sessions for one booking.");
  return { days, endDate, dates };
}

/** Sessions, price and conflicts for a monthly/quarterly plan (the review step). */
export async function quoteSeriesPlan(input: SeriesPlanInput & { userId?: string | null; equipment?: EquipmentRequest[] }) {
  const settings = await getBookingSettings();
  const [row] = await loadBookableCourts(db, { courtId: input.courtId });
  if (!row) throw new DomainError("Court not found.", "NOT_FOUND", 404);
  const { days, endDate, dates } = planDates(input);
  const endMinute = input.startMinute + input.duration;
  const occ = await loadOccupancy(db, { from: input.startDate, to: endDate }, { courtIds: [row.court.id] });
  const pct = input.type === "MONTHLY" ? settings.recurring.monthlyDiscountPercent : settings.recurring.quarterlyDiscountPercent;
  let subtotal = 0;
  let discount = 0;
  let equipmentTotal = 0;
  const sessions = [] as { date: string; price: number; conflict: string | null }[];
  for (const date of dates) {
    const price = priceForRange(row.court, settings.peakWindows, date, input.startMinute, endMinute).price;
    const conflict = conflictOn(occ, date, row.court.id, input.startMinute, endMinute);
    sessions.push({ date, price, conflict: conflict ? describeConflict(conflict) : null });
    subtotal += price;
    discount += Math.round((price * pct) / 100);
  }
  if (input.equipment?.length) {
    const first = await quoteEquipment(db, row.court.sportId, { date: dates[0]!, startMinute: input.startMinute, endMinute }, input.equipment);
    equipmentTotal = first.total * dates.length;
  }
  return {
    type: input.type,
    startDate: input.startDate,
    endDate,
    daysOfWeek: days,
    sessions,
    conflicts: sessions.filter((s) => s.conflict).map((s) => s.date),
    subtotal,
    discountPercent: pct,
    discount,
    equipmentTotal,
    total: subtotal - discount + equipmentTotal,
  };
}

export type CreateSeriesInput = SeriesPlanInput & {
  customer: { name: string; phone: string; email?: string | null };
  userId?: string | null;
  notes?: string | null;
  equipment?: EquipmentRequest[];
  source?: "ONLINE" | "WALK_IN" | "ADMIN";
  actorId?: string | null;
  staff?: boolean;
};

/**
 * Creates every session of a monthly/quarterly booking in one transaction under the court
 * lock. Any conflict aborts the whole series; the EXCLUDE constraint backs every insert.
 */
export async function createSeries(input: CreateSeriesInput): Promise<BookingSeries> {
  const settings = await getBookingSettings();
  const staff = !!input.staff;
  const today = todayInTz(settings.timezone);
  if (!isValidISODate(input.startDate)) throw new DomainError("Please choose a valid start date.");
  if (input.startDate <= today) throw new DomainError("Recurring bookings start from tomorrow at the earliest.");
  const { days, endDate, dates } = planDates(input);
  const endMinute = input.startMinute + input.duration;
  const pct = input.type === "MONTHLY" ? settings.recurring.monthlyDiscountPercent : settings.recurring.quarterlyDiscountPercent;

  try {
    return await db.transaction(async (tx) => {
      const court = await lockCourt(tx, input.courtId);
      checkCourtRules(court, input.type, input.duration, staff);
      // The period opens as a whole: its first day must be released.
      validateTimeWindow(settings, court, { date: input.startDate, startMinute: input.startMinute, endMinute }, { staff });
      await expireStaleHolds(tx, { courtId: court.id });

      const occ = await loadOccupancy(tx, { from: input.startDate, to: endDate }, { courtIds: [court.id] });
      const conflicts = dates.filter((d) => conflictOn(occ, d, court.id, input.startMinute, endMinute));
      if (conflicts.length) {
        const list = conflicts.slice(0, 4).map((d) => formatDate(d, "dayMonth")).join(", ");
        throw new DomainError(
          `${court.name} isn't free at ${formatTimeRange(input.startMinute, endMinute)} on ${list}${conflicts.length > 4 ? ` and ${conflicts.length - 4} more` : ""}. Try another time or day.`,
          "SLOT_UNAVAILABLE",
          409,
        );
      }

      const holdExpiresAt = new Date(Date.now() + settings.holdMinutes * 60_000);
      const priced = dates.map((date) => {
        const price = priceForRange(court, settings.peakWindows, date, input.startMinute, endMinute).price;
        const discount = Math.round((price * pct) / 100);
        return { date, price, discount };
      });
      const subtotal = priced.reduce((a, p) => a + p.price, 0);
      const discount = priced.reduce((a, p) => a + p.discount, 0);

      const [series] = await tx
        .insert(bookingSeries)
        .values({
          code: randomCode("SPR"),
          type: input.type,
          sportId: court.sportId,
          courtId: court.id,
          userId: input.userId ?? null,
          customerName: input.customer.name,
          customerPhone: input.customer.phone,
          customerEmail: input.customer.email || null,
          startDate: input.startDate,
          endDate,
          daysOfWeek: days,
          startMinute: input.startMinute,
          endMinute,
          sessionCount: dates.length,
          subtotal,
          discount,
          total: subtotal - discount,
          status: "PENDING",
          source: input.source ?? "ONLINE",
          notes: input.notes || null,
          holdExpiresAt,
          createdById: input.actorId ?? input.userId ?? null,
        })
        .returning();

      const sessionRows = await tx
        .insert(bookings)
        .values(
          priced.map((p) => ({
            code: randomCode("SP"),
            sportId: court.sportId,
            courtId: court.id,
            seriesId: series!.id,
            userId: input.userId ?? null,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email || null,
            date: p.date,
            startMinute: input.startMinute,
            endMinute,
            subtotal: p.price,
            discount: p.discount,
            total: p.price - p.discount,
            status: "PENDING" as const,
            source: input.source ?? ("ONLINE" as const),
            holdExpiresAt,
            createdById: input.actorId ?? input.userId ?? null,
          })),
        )
        .returning();

      let equipmentTotal = 0;
      if (input.equipment?.length) {
        for (const session of sessionRows) {
          const rentals = await reserveEquipment(
            tx,
            { id: session.id, sportId: court.sportId, date: session.date, startMinute: session.startMinute, endMinute: session.endMinute, userId: input.userId, customerName: input.customer.name },
            input.equipment,
            input.actorId,
          );
          if (rentals.total) {
            await tx.update(bookings).set({ equipmentTotal: rentals.total, total: session.total + rentals.total }).where(eq(bookings.id, session.id));
            equipmentTotal += rentals.total;
          }
        }
      }
      await tx.insert(bookingEvents).values(
        sessionRows.map((b) => ({ bookingId: b.id, status: "PENDING" as const, note: `${input.type === "MONTHLY" ? "Monthly" : "Quarterly"} booking ${series!.code}`, actorId: input.actorId ?? input.userId ?? null })),
      );
      const [saved] = await tx
        .update(bookingSeries)
        .set({ equipmentTotal, total: subtotal - discount + equipmentTotal })
        .where(eq(bookingSeries.id, series!.id))
        .returning();
      return saved!;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new DomainError("One of those sessions was just booked by someone else. Please review and try again.", "SLOT_UNAVAILABLE", 409);
    throw err;
  }
}

/** Moves a series and all of its sessions through a status (payment, cancellation). */
export async function transitionSeries(
  tx: DbOrTx,
  seriesId: string,
  status: BookingStatus,
  opts: { note?: string; actorId?: string | null; fromStatuses?: BookingStatus[]; patch?: Partial<typeof bookingSeries.$inferInsert> } = {},
) {
  const [series] = await tx.update(bookingSeries).set({ status, ...opts.patch }).where(eq(bookingSeries.id, seriesId)).returning();
  const sessions = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.seriesId, seriesId), opts.fromStatuses ? inArray(bookings.status, opts.fromStatuses) : undefined));
  for (const s of sessions) {
    const patch: Partial<typeof bookings.$inferInsert> =
      status === "PAID" ? { paidAt: new Date(), holdExpiresAt: null } : status === "CONFIRMED" ? { confirmedAt: new Date() } : status === "CANCELLED" ? { cancelledAt: new Date(), cancelReason: opts.note ?? null, holdExpiresAt: null } : {};
    await transitionBooking(tx, s.id, status, { note: opts.note, actorId: opts.actorId, patch });
  }
  return series!;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cancel & reschedule                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export function canCustomerCancel(booking: Pick<Booking, "date" | "startMinute" | "status"> & { seriesId?: string | null }, settings: BookingSettings) {
  if (booking.seriesId) return false; // recurring bookings are changed at the desk
  if (!["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(booking.status)) return false;
  const today = todayInTz(settings.timezone);
  const minutesUntilStart =
    (new Date(`${booking.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 60_000 + booking.startMinute - nowMinutesInTz(settings.timezone);
  return minutesUntilStart >= settings.cancellationCutoffHours * 60;
}

export async function rescheduleBooking(bookingId: string, target: { courtId: string; date: string; startMinute: number }, actorId: string) {
  const settings = await getBookingSettings();
  const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!existing) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (!(ACTIVE_BOOKING_STATUSES as readonly string[]).includes(existing.status)) throw new DomainError("Only active bookings can be rescheduled.");
  const duration = existing.endMinute - existing.startMinute;
  const endMinute = target.startMinute + duration;

  try {
    return await db.transaction(async (tx) => {
      const court = await lockCourt(tx, target.courtId);
      if (court.sportId !== existing.sportId) throw new DomainError("A booking can only move to a court of the same sport.");
      validateTimeWindow(settings, court, { date: target.date, startMinute: target.startMinute, endMinute }, { staff: true });
      await expireStaleHolds(tx, { courtId: court.id, date: target.date });
      const occ = await loadOccupancy(tx, { from: target.date, to: target.date }, { courtIds: [court.id], excludeBookingIds: [bookingId] });
      const conflict = conflictOn(occ, target.date, court.id, target.startMinute, endMinute);
      if (conflict) throw new DomainError(describeConflict(conflict), "SLOT_UNAVAILABLE", 409);
      await moveRentals(tx, bookingId, { date: target.date, startMinute: target.startMinute, endMinute });
      const [updated] = await tx
        .update(bookings)
        .set({ courtId: court.id, date: target.date, startMinute: target.startMinute, endMinute, reminderSentAt: null })
        .where(eq(bookings.id, bookingId))
        .returning();
      await tx.insert(bookingEvents).values({
        bookingId,
        status: updated!.status,
        note: `Rescheduled to ${court.name} · ${formatDate(target.date)} · ${formatTimeRange(target.startMinute, endMinute)}`,
        actorId,
      });
      return updated!;
    });
  } catch (err) {
    if (isExclusionViolation(err)) throw new DomainError("That slot is already booked.", "SLOT_UNAVAILABLE", 409);
    throw err;
  }
}
