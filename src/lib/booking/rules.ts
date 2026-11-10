/**
 * The facility's booking rules. Pure and shared: the booking service enforces them (with the
 * database trigger in drizzle/0005_rental_pricing.sql as a backstop) and the booking UI uses
 * them for instant feedback. Keep the two in sync if a rule ever changes.
 *
 * - Bookings last one or two hours and start on the hour (the rate card has a one-hour and a
 *   two-hour price).
 * - Bookings lie within the booking hours. These are a setting (`booking` settings row,
 *   editable in /admin/courts), defaulting to 7:00 AM – 10:00 PM. The facility still has to
 *   confirm its hours before launch.
 * - There is no sport-specific closure. (An earlier demo closed badminton 5–7 PM for academy
 *   sessions; the facility hasn't confirmed that. Recurring closures are court blocks in
 *   /admin/courts.)
 */
import { formatMinutes } from "@/lib/format";

/** Bookings start on the hour. */
export const SLOT_STEP_MINUTES = 60;
/** One-hour and two-hour bookings. */
export const DURATIONS = [60, 120] as const;
export type Duration = (typeof DURATIONS)[number];

export const SPORT_SLUGS = ["badminton", "pickleball", "basketball"] as const;
export type SportSlug = (typeof SPORT_SLUGS)[number];

/** The daily window in which courts can be booked (minutes from midnight, Asia/Kolkata). */
export type BookingHours = { openMinute: number; closeMinute: number };

/** 7:00 AM – 10:00 PM. To be confirmed by the facility before launch. */
export const DEFAULT_BOOKING_HOURS: BookingHours = { openMinute: 7 * 60, closeMinute: 22 * 60 };

/**
 * Booking hours from a stored settings document, or the defaults when they are missing or
 * invalid. Valid = whole hours, open < close, at least one hour apart, within one day.
 * The database trigger (enforce_booking_rules) applies exactly the same check to the same row,
 * so the application and the database never disagree about the hours.
 */
export function normalizeBookingHours(raw: { openMinute?: unknown; closeMinute?: unknown } | null | undefined): BookingHours {
  const open = raw?.openMinute === undefined ? DEFAULT_BOOKING_HOURS.openMinute : raw.openMinute;
  const close = raw?.closeMinute === undefined ? DEFAULT_BOOKING_HOURS.closeMinute : raw.closeMinute;
  if (
    typeof open === "number" &&
    typeof close === "number" &&
    Number.isInteger(open) &&
    Number.isInteger(close) &&
    open >= 0 &&
    close <= 24 * 60 &&
    open % 60 === 0 &&
    close % 60 === 0 &&
    close - open >= 60
  ) {
    return { openMinute: open, closeMinute: close };
  }
  return { ...DEFAULT_BOOKING_HOURS };
}

export function isDuration(value: number): value is Duration {
  return (DURATIONS as readonly number[]).includes(value);
}

/** Every start time offered for a duration: on the hour, finishing by closing time. */
export function startTimes(duration: Duration, hours: BookingHours = DEFAULT_BOOKING_HOURS): number[] {
  const out: number[] = [];
  for (let s = hours.openMinute; s + duration <= hours.closeMinute; s += SLOT_STEP_MINUTES) out.push(s);
  return out;
}

/** The hour marks of a day's booking window, e.g. 7 AM … 9 PM for 7 AM – 10 PM. */
export function hourMarks(hours: BookingHours = DEFAULT_BOOKING_HOURS): number[] {
  const out: number[] = [];
  for (let m = hours.openMinute; m < hours.closeMinute; m += 60) out.push(m);
  return out;
}

export function describeHours(hours: BookingHours): string {
  return `${formatMinutes(hours.openMinute)} – ${formatMinutes(hours.closeMinute % (24 * 60))}`;
}

export type RuleViolation =
  | { code: "INVALID_DURATION"; message: string }
  | { code: "OUTSIDE_HOURS"; message: string }
  | { code: "MISALIGNED"; message: string };

/**
 * Checks the fixed rules for a slot (not availability, dates or prices). Returns the first
 * rule the slot breaks, or null when it is allowed.
 */
export function checkSlotRules(startMinute: number, duration: number, hours: BookingHours = DEFAULT_BOOKING_HOURS): RuleViolation | null {
  if (!Number.isInteger(startMinute) || !isDuration(duration)) {
    return { code: "INVALID_DURATION", message: "Bookings are for one or two hours." };
  }
  const endMinute = startMinute + duration;
  if (startMinute < hours.openMinute || endMinute > hours.closeMinute) {
    return {
      code: "OUTSIDE_HOURS",
      message: `Courts can be booked between ${describeHours(hours).replace(" – ", " and ")}, and every booking must end by ${formatMinutes(hours.closeMinute % (24 * 60))}.`,
    };
  }
  if (startMinute % SLOT_STEP_MINUTES !== 0) {
    return { code: "MISALIGNED", message: "Bookings start on the hour." };
  }
  return null;
}
