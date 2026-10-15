/**
 * The facility's booking rules. Pure and shared: the booking service enforces them (with the
 * database trigger in drizzle/0004_court_booking_focus.sql as a backstop) and the booking UI
 * uses them for instant feedback. Keep the two in sync if a rule ever changes.
 */

/** 7:00 AM, in minutes from midnight (Asia/Kolkata). */
export const OPEN_MINUTE = 7 * 60;
/** 10:00 PM. Every booking must end by this time. */
export const CLOSE_MINUTE = 22 * 60;
/** Bookings start on the hour. */
export const SLOT_STEP_MINUTES = 60;
/** One-hour and two-hour bookings. */
export const DURATIONS = [60, 120] as const;
export type Duration = (typeof DURATIONS)[number];

export const SPORT_SLUGS = ["badminton", "pickleball", "basketball"] as const;
export type SportSlug = (typeof SPORT_SLUGS)[number];

/** A daily period when every court of a sport is closed to public booking. */
export type SportClosure = { startMinute: number; endMinute: number; label: string; message: string };

/**
 * Badminton academy sessions use both badminton courts every day from 5:00 PM to 7:00 PM.
 * Pickleball and basketball have no closure.
 */
export const SPORT_CLOSURES: Readonly<Record<string, readonly SportClosure[]>> = {
  badminton: [
    {
      startMinute: 17 * 60,
      endMinute: 19 * 60,
      label: "Academy session",
      message: "Badminton courts are reserved for academy sessions from 5:00 PM to 7:00 PM.",
    },
  ],
};

export function isDuration(value: number): value is Duration {
  return (DURATIONS as readonly number[]).includes(value);
}

export function closuresFor(sportSlug: string): readonly SportClosure[] {
  return SPORT_CLOSURES[sportSlug] ?? [];
}

/** The closure that [start, end) overlaps for a sport, if any. */
export function closureOverlapping(sportSlug: string, startMinute: number, endMinute: number): SportClosure | null {
  return closuresFor(sportSlug).find((c) => startMinute < c.endMinute && c.startMinute < endMinute) ?? null;
}

/** Every start time offered for a duration: on the hour, finishing by closing time. */
export function startTimes(duration: Duration): number[] {
  const out: number[] = [];
  for (let s = OPEN_MINUTE; s + duration <= CLOSE_MINUTE; s += SLOT_STEP_MINUTES) out.push(s);
  return out;
}

export type RuleViolation =
  | { code: "INVALID_DURATION"; message: string }
  | { code: "OUTSIDE_HOURS"; message: string }
  | { code: "MISALIGNED"; message: string }
  | { code: "SPORT_CLOSURE"; message: string };

/**
 * Checks the fixed rules for a slot (not availability, dates or prices). Returns the first
 * rule the slot breaks, or null when it is allowed.
 */
export function checkSlotRules(sportSlug: string, startMinute: number, duration: number): RuleViolation | null {
  if (!Number.isInteger(startMinute) || !isDuration(duration)) {
    return { code: "INVALID_DURATION", message: "Bookings are for one or two hours." };
  }
  const endMinute = startMinute + duration;
  if (startMinute < OPEN_MINUTE || endMinute > CLOSE_MINUTE) {
    return { code: "OUTSIDE_HOURS", message: "Courts can be booked between 7:00 AM and 10:00 PM, and every booking must end by 10:00 PM." };
  }
  if (startMinute % SLOT_STEP_MINUTES !== 0) {
    return { code: "MISALIGNED", message: "Bookings start on the hour." };
  }
  const closure = closureOverlapping(sportSlug, startMinute, endMinute);
  if (closure) return { code: "SPORT_CLOSURE", message: closure.message };
  return null;
}
