import "server-only";
import { and, asc, eq, gt, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import { db, type DbOrTx, type Transaction } from "@/server/db";
import { bookingEvents, bookings, courtBlocks, courts, sports, type Booking, type BookingStatus, type Court } from "@/server/db/schema";
import { computeAvailability, priceForRange, type BlockRange, type CourtForAvailability, type OccupiedRange } from "@/lib/booking/engine";
import { checkSlotRules, isDuration, type Duration } from "@/lib/booking/rules";
import type { BookingSettings } from "@/lib/settings-types";
import { addDays, isValidISODate, nowMinutesInTz, rangesOverlap, todayInTz } from "@/lib/time";
import { formatDate, formatTimeRange } from "@/lib/format";
import { getBookingSettings } from "@/server/settings";
import { bookingRuleViolation, DomainError, isExclusionViolation, isUniqueViolation } from "@/server/errors";
import { randomCode } from "@/server/security";

/* ────────────────────────────────────────────────────────────────────────── */
/* Courts                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type CourtRow = { court: Court; sport: { id: string; slug: string; name: string; isActive: boolean } };

/** Courts open to the public (not INACTIVE, sport active), in display order. */
export async function loadCourts(conn: DbOrTx, filter: { sportSlug?: string; courtId?: string; courtSlug?: string } = {}): Promise<CourtRow[]> {
  return conn
    .select({ court: courts, sport: { id: sports.id, slug: sports.slug, name: sports.name, isActive: sports.isActive } })
    .from(courts)
    .innerJoin(sports, eq(sports.id, courts.sportId))
    .where(
      and(
        ne(courts.status, "INACTIVE"),
        eq(sports.isActive, true),
        filter.sportSlug ? eq(sports.slug, filter.sportSlug) : undefined,
        filter.courtId ? eq(courts.id, filter.courtId) : undefined,
        filter.courtSlug ? eq(courts.slug, filter.courtSlug) : undefined,
      ),
    )
    .orderBy(asc(sports.sortOrder), asc(courts.sortOrder), asc(courts.name));
}

function engineCourt(row: CourtRow): CourtForAvailability {
  return {
    id: row.court.id,
    slug: row.court.slug,
    name: row.court.name,
    sportSlug: row.sport.slug,
    status: row.court.status,
    hourlyRate: row.court.hourlyRate,
    peakHourlyRate: row.court.peakHourlyRate,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Occupancy                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

/** A booking occupies its slot when paid/confirmed, or while its unpaid hold is still running. */
function occupyingFilter(now: Date) {
  return or(
    inArray(bookings.status, ["PAID", "CONFIRMED"]),
    and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), or(isNull(bookings.holdExpiresAt), gt(bookings.holdExpiresAt, now))),
  );
}

/** Active bookings and closures for courts on one date. */
async function loadDay(conn: DbOrTx, date: string, courtIds: string[], opts: { excludeBookingId?: string } = {}) {
  if (!courtIds.length) return { bookings: [] as OccupiedRange[], blocks: [] as BlockRange[] };
  const now = new Date();
  const [rows, blockRows] = await Promise.all([
    conn
      .select({ id: bookings.id, courtId: bookings.courtId, startMinute: bookings.startMinute, endMinute: bookings.endMinute, status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.date, date), inArray(bookings.courtId, courtIds), occupyingFilter(now))),
    conn
      .select({ courtId: courtBlocks.courtId, type: courtBlocks.type, startMinute: courtBlocks.startMinute, endMinute: courtBlocks.endMinute, reason: courtBlocks.reason })
      .from(courtBlocks)
      .where(and(inArray(courtBlocks.courtId, courtIds), lte(courtBlocks.startDate, date), gte(courtBlocks.endDate, date))),
  ]);
  return {
    bookings: rows
      .filter((b) => b.id !== opts.excludeBookingId)
      .map<OccupiedRange>((b) => ({ courtId: b.courtId, startMinute: b.startMinute, endMinute: b.endMinute, held: b.status === "PENDING" || b.status === "PAYMENT_INITIATED" })),
    blocks: blockRows as BlockRange[],
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Dates                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** The dates customers can book: today through today + advanceDays − 1. */
export function bookingWindow(settings: Pick<BookingSettings, "timezone" | "advanceDays">, now = new Date()) {
  const today = todayInTz(settings.timezone, now);
  return { today, lastDate: addDays(today, settings.advanceDays - 1) };
}

function nowMinuteFor(date: string, today: string, timezone: string): number | null {
  if (date < today) return Number.POSITIVE_INFINITY;
  if (date === today) return nowMinutesInTz(timezone);
  return null;
}

function assertBookableDate(date: string, settings: BookingSettings) {
  if (!isValidISODate(date)) throw new DomainError("Please choose a valid date.");
  const { today, lastDate } = bookingWindow(settings);
  if (date < today) throw new DomainError("That date has already passed. Please choose today or a later date.", "RULE_VIOLATION", 422);
  if (date > lastDate) throw new DomainError(`Courts can be booked up to ${settings.advanceDays} days ahead.`, "RULE_VIOLATION", 422);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Availability                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

/** Slot grid for one date: one court, every court of a sport, or all courts. */
export async function getAvailability(input: { date: string; duration: number; sportSlug?: string; courtId?: string; courtSlug?: string }) {
  const settings = await getBookingSettings();
  if (!isDuration(input.duration)) throw new DomainError("Bookings are for one or two hours.");
  assertBookableDate(input.date, settings);
  const { today } = bookingWindow(settings);
  const rows = await loadCourts(db, input);
  const day = await loadDay(db, input.date, rows.map((r) => r.court.id));
  return computeAvailability({
    date: input.date,
    duration: input.duration,
    peakWindows: settings.peakWindows,
    courts: rows.map(engineCourt),
    bookings: day.bookings,
    blocks: day.blocks,
    nowMinute: nowMinuteFor(input.date, today, settings.timezone),
  });
}

export type CourtSnapshot = {
  courtId: string;
  /** Free one-hour slots left today. */
  freeToday: number;
  /** One-hour slots today that haven't started yet. */
  remainingToday: number;
  /** The next free one-hour slot, today or tomorrow. */
  next: { date: string; startMinute: number } | null;
};

/** Live availability summary for the court cards: today's free hours and the next free slot. */
export async function getCourtSnapshots(): Promise<Map<string, CourtSnapshot>> {
  const settings = await getBookingSettings();
  const { today } = bookingWindow(settings);
  const tomorrow = addDays(today, 1);
  const rows = await loadCourts(db);
  const ids = rows.map((r) => r.court.id);
  const [dayToday, dayTomorrow] = await Promise.all([loadDay(db, today, ids), loadDay(db, tomorrow, ids)]);
  const base = { duration: 60 as Duration, peakWindows: settings.peakWindows, courts: rows.map(engineCourt) };
  const a = computeAvailability({ ...base, date: today, ...dayToday, nowMinute: nowMinuteFor(today, today, settings.timezone) });
  const b = settings.advanceDays > 1 ? computeAvailability({ ...base, date: tomorrow, ...dayTomorrow, nowMinute: null }) : null;

  const out = new Map<string, CourtSnapshot>();
  for (const court of a.courts) {
    const firstToday = court.slots.find((s) => s.state === "AVAILABLE");
    const firstTomorrow = b?.courts.find((c) => c.courtId === court.courtId)?.slots.find((s) => s.state === "AVAILABLE");
    out.set(court.courtId, {
      courtId: court.courtId,
      freeToday: court.availableCount,
      remainingToday: court.slots.filter((s) => s.state !== "PAST").length,
      next: firstToday ? { date: today, startMinute: firstToday.startMinute } : firstTomorrow ? { date: tomorrow, startMinute: firstTomorrow.startMinute } : null,
    });
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Lifecycle helpers                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export async function transitionBooking(
  tx: DbOrTx,
  bookingId: string,
  status: BookingStatus,
  opts: { note?: string; actorId?: string | null; patch?: Partial<typeof bookings.$inferInsert> } = {},
): Promise<Booking> {
  const [updated] = await tx.update(bookings).set({ status, ...opts.patch }).where(eq(bookings.id, bookingId)).returning();
  await tx.insert(bookingEvents).values({ bookingId, status, note: opts.note?.slice(0, 300) ?? null, actorId: opts.actorId ?? null });
  return updated!;
}

/** Marks unpaid holds whose timer ran out as EXPIRED, so they stop blocking their slot. */
export async function expireStaleHolds(conn: DbOrTx, scope: { courtId?: string; date?: string } = {}) {
  const expired = await conn
    .update(bookings)
    .set({ status: "EXPIRED" })
    .where(
      and(
        inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]),
        lt(bookings.holdExpiresAt, new Date()),
        scope.courtId ? eq(bookings.courtId, scope.courtId) : undefined,
        scope.date ? eq(bookings.date, scope.date) : undefined,
      ),
    )
    .returning({ id: bookings.id });
  if (expired.length) {
    await conn.insert(bookingEvents).values(expired.map((b) => ({ bookingId: b.id, status: "EXPIRED" as const, note: "Payment window elapsed; slot released" })));
  }
  return expired.length;
}

/** Locks the court row for the rest of the transaction; concurrent bookings of it queue here. */
export async function lockCourt(tx: Transaction, courtId: string): Promise<CourtRow> {
  const [court] = await tx.select().from(courts).where(eq(courts.id, courtId)).for("update");
  if (!court) throw new DomainError("Court not found.", "NOT_FOUND", 404);
  const [sport] = await tx.select({ id: sports.id, slug: sports.slug, name: sports.name, isActive: sports.isActive }).from(sports).where(eq(sports.id, court.sportId));
  return { court, sport: sport! };
}

function describeConflict(kind: "maintenance" | "blocked" | "booking") {
  if (kind === "maintenance") return "This court is closed for maintenance at that time.";
  if (kind === "blocked") return "This slot has been closed by the facility. Please choose another time.";
  return "Sorry, that slot was just booked by someone else. Please pick another time.";
}

/** Why [start, end) is not free on a court, given the day's occupancy, or null. */
function conflictIn(day: Awaited<ReturnType<typeof loadDay>>, courtId: string, start: number, end: number) {
  const block = day.blocks.find(
    (b) => b.courtId === courtId && (b.startMinute === null || b.endMinute === null || rangesOverlap(start, end, b.startMinute, b.endMinute)),
  );
  if (block) return block.type === "MAINTENANCE" ? ("maintenance" as const) : ("blocked" as const);
  if (day.bookings.some((b) => b.courtId === courtId && rangesOverlap(start, end, b.startMinute, b.endMinute))) return "booking" as const;
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Create a booking hold                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export type CreateHoldInput = {
  courtId: string;
  date: string;
  startMinute: number;
  duration: number;
  customer: { name: string; phone: string; email: string };
  notes?: string | null;
};

/**
 * Validates a requested slot against every rule and reserves it as an unpaid PENDING hold.
 * Price, end time and hold expiry are computed here; nothing from the browser is trusted
 * beyond the court, date, start time and duration. The court row lock serialises concurrent
 * requests for the same court, and the database's EXCLUDE constraint and rules trigger reject
 * anything that slips past.
 */
export async function createBookingHold(input: CreateHoldInput): Promise<Booking & { courtName: string; sportName: string }> {
  const settings = await getBookingSettings();
  assertBookableDate(input.date, settings);
  const endMinute = input.startMinute + input.duration;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const { court, sport } = await lockCourt(tx, input.courtId);
        if (court.status === "INACTIVE" || !sport.isActive) throw new DomainError("That court isn't available for booking.", "NOT_FOUND", 404);
        if (court.status === "MAINTENANCE") throw new DomainError(`${court.name} is closed for maintenance.`, "SLOT_UNAVAILABLE", 409);

        const violation = checkSlotRules(sport.slug, input.startMinute, input.duration);
        if (violation) throw new DomainError(violation.message, "RULE_VIOLATION", 422);
        const { today } = bookingWindow(settings);
        if (input.date === today && input.startMinute <= nowMinutesInTz(settings.timezone)) {
          throw new DomainError("That slot has already started. Please choose a later time.", "RULE_VIOLATION", 422);
        }

        await expireStaleHolds(tx, { courtId: court.id, date: input.date });
        const day = await loadDay(tx, input.date, [court.id]);
        const conflict = conflictIn(day, court.id, input.startMinute, endMinute);
        if (conflict) throw new DomainError(describeConflict(conflict), "SLOT_UNAVAILABLE", 409);

        const { price } = priceForRange(court, settings.peakWindows, input.date, input.startMinute, endMinute);
        const [booking] = await tx
          .insert(bookings)
          .values({
            code: randomCode("SP"),
            sportId: court.sportId,
            courtId: court.id,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email,
            date: input.date,
            startMinute: input.startMinute,
            endMinute,
            subtotal: price,
            discount: 0,
            total: price,
            status: "PENDING",
            source: "ONLINE",
            notes: input.notes || null,
            holdExpiresAt: new Date(Date.now() + settings.holdMinutes * 60_000),
          })
          .returning();
        await tx.insert(bookingEvents).values({
          bookingId: booking!.id,
          status: "PENDING",
          note: `Slot held: ${court.name} · ${formatDate(input.date)} · ${formatTimeRange(input.startMinute, endMinute)}`,
        });
        return { ...booking!, courtName: court.name, sportName: sport.name };
      });
    } catch (err) {
      if (isExclusionViolation(err)) throw new DomainError(describeConflict("booking"), "SLOT_UNAVAILABLE", 409);
      const rule = bookingRuleViolation(err);
      if (rule) throw new DomainError(rule, "RULE_VIOLATION", 422);
      // Extremely unlikely booking-code collision: retry with a fresh code.
      if (isUniqueViolation(err) && attempt < 2) continue;
      throw err;
    }
  }
  throw new DomainError("We couldn't reserve that slot. Please try again.");
}

/**
 * The customer gave up on paying (closed checkout and chose another slot): free the slot now
 * instead of waiting for the hold to run out. A payment that still completes later is handled
 * by the payment service (re-activated if the slot is still free, refunded otherwise).
 */
export async function releaseHold(code: string) {
  await db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.code, code)).for("update");
    if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    if (booking.status !== "PENDING" && booking.status !== "PAYMENT_INITIATED") return;
    await transitionBooking(tx, booking.id, "EXPIRED", { note: "Checkout abandoned; slot released", patch: { holdExpiresAt: null } });
  });
}
