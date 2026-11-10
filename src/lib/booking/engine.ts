/**
 * Pure booking engine: slot states and prices for one date. Shared by the server
 * (authoritative checks and the amount charged) and the client (instant feedback).
 *
 * Prices come straight from the court's rate card: one price for a one-hour booking and one
 * for a two-hour booking (a package price — not twice the hourly price). They are the same at
 * every time of day; there is no peak surcharge.
 */
import { rangesOverlap } from "@/lib/time";
import { DEFAULT_BOOKING_HOURS, startTimes, type BookingHours, type Duration } from "./rules";

export type SlotState =
  /** Free to book. */
  | "AVAILABLE"
  /** Paid / confirmed by another customer. */
  | "BOOKED"
  /** Someone is paying for it right now; frees up if their payment window runs out. */
  | "HELD"
  | "MAINTENANCE"
  /** Closed by the facility for this slot. */
  | "BLOCKED"
  /** Already started. */
  | "PAST";

/** A court's hourly rate card (minor units). */
export type CourtRates = { price1h: number; price2h: number };

export type CourtForAvailability = CourtRates & {
  id: string;
  slug: string;
  name: string;
  sportSlug: string;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
};

export type OccupiedRange = { courtId: string; startMinute: number; endMinute: number; held: boolean };
export type BlockRange = {
  courtId: string;
  type: "MAINTENANCE" | "BLOCKED";
  startMinute: number | null;
  endMinute: number | null;
  reason?: string | null;
};

export type Slot = {
  startMinute: number;
  endMinute: number;
  state: SlotState;
  price: number;
  label?: string;
};

export type CourtAvailability = {
  courtId: string;
  courtSlug: string;
  courtName: string;
  sportSlug: string;
  courtStatus: CourtForAvailability["status"];
  slots: Slot[];
  availableCount: number;
};

export type AvailabilityInput = {
  date: string;
  duration: Duration;
  hours?: BookingHours;
  courts: CourtForAvailability[];
  bookings: OccupiedRange[];
  blocks: BlockRange[];
  /**
   * Minutes since midnight "now" when `date` is today; `Infinity` for past dates;
   * `null` for future dates.
   */
  nowMinute: number | null;
};

/**
 * Price (minor units) of booking a court for a duration: exactly the rate card's one-hour or
 * two-hour price, whatever the date or time.
 */
export function priceForDuration(court: CourtRates, duration: Duration): number {
  return duration === 120 ? court.price2h : court.price1h;
}

/** How much a two-hour booking saves compared with two separate one-hour bookings (0 if none). */
export function twoHourSaving(court: CourtRates): number {
  return Math.max(0, court.price1h * 2 - court.price2h);
}

/** The state of one slot on one court, in priority order. */
function slotState(
  court: CourtForAvailability,
  start: number,
  end: number,
  bookings: OccupiedRange[],
  blocks: BlockRange[],
  nowMinute: number | null,
): { state: SlotState; label?: string } {
  if (court.status === "MAINTENANCE") return { state: "MAINTENANCE", label: "Maintenance" };
  if (nowMinute !== null && start <= nowMinute) return { state: "PAST", label: "Started" };

  const block = blocks.find((b) => b.startMinute === null || b.endMinute === null || rangesOverlap(start, end, b.startMinute, b.endMinute));
  if (block?.type === "MAINTENANCE") return { state: "MAINTENANCE", label: block.reason || "Maintenance" };
  if (block) return { state: "BLOCKED", label: block.reason || "Unavailable" };

  const overlapping = bookings.filter((b) => rangesOverlap(start, end, b.startMinute, b.endMinute));
  if (overlapping.some((b) => !b.held)) return { state: "BOOKED", label: "Booked" };
  if (overlapping.length) return { state: "HELD", label: "On hold" };
  return { state: "AVAILABLE" };
}

export function computeAvailability(input: AvailabilityInput) {
  const hours = input.hours ?? DEFAULT_BOOKING_HOURS;
  const times = startTimes(input.duration, hours).map((s) => ({ startMinute: s, endMinute: s + input.duration }));
  const courts = input.courts
    .filter((c) => c.status !== "INACTIVE")
    .map<CourtAvailability>((court) => {
      const bookings = input.bookings.filter((b) => b.courtId === court.id);
      const blocks = input.blocks.filter((b) => b.courtId === court.id);
      const price = priceForDuration(court, input.duration);
      const slots = times.map<Slot>(({ startMinute, endMinute }) => ({
        startMinute,
        endMinute,
        price,
        ...slotState(court, startMinute, endMinute, bookings, blocks, input.nowMinute),
      }));
      return {
        courtId: court.id,
        courtSlug: court.slug,
        courtName: court.name,
        sportSlug: court.sportSlug,
        courtStatus: court.status,
        slots,
        availableCount: slots.filter((s) => s.state === "AVAILABLE").length,
      };
    });
  return { date: input.date, duration: input.duration, hours, times, courts };
}

export type AvailabilityResult = ReturnType<typeof computeAvailability>;

/** Statuses that occupy a slot (unpaid holds only until they expire). */
export const ACTIVE_BOOKING_STATUSES = ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"] as const;
