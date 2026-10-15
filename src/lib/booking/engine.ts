/**
 * Pure booking engine: slot states and pricing for one date. Shared by the server
 * (authoritative checks) and the client (instant feedback).
 */
import type { PeakWindow } from "@/lib/settings-types";
import { dayOfWeek, rangesOverlap } from "@/lib/time";
import { closureOverlapping, startTimes, type Duration } from "./rules";

export type SlotState =
  /** Free to book. */
  | "AVAILABLE"
  /** Paid / confirmed by another customer. */
  | "BOOKED"
  /** Someone is paying for it right now; frees up if their payment window runs out. */
  | "HELD"
  /** A fixed closure for the sport (badminton academy sessions, 5–7 PM). */
  | "RESTRICTED"
  | "MAINTENANCE"
  /** Closed by the facility for this slot. */
  | "BLOCKED"
  /** Already started. */
  | "PAST";

export type CourtForAvailability = {
  id: string;
  slug: string;
  name: string;
  sportSlug: string;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  hourlyRate: number;
  peakHourlyRate: number;
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
  isPeak: boolean;
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
  peakWindows: PeakWindow[];
  courts: CourtForAvailability[];
  bookings: OccupiedRange[];
  blocks: BlockRange[];
  /**
   * Minutes since midnight "now" when `date` is today; `Infinity` for past dates;
   * `null` for future dates.
   */
  nowMinute: number | null;
};

function windowApplies(window: PeakWindow, dow: number) {
  return window.days.length === 0 || window.days.includes(dow);
}

/** Number of minutes of [start, end) that fall inside a peak window on the given weekday. */
export function peakMinutes(peakWindows: PeakWindow[], dow: number, start: number, end: number): number {
  let total = 0;
  for (let m = start; m < end; m++) {
    if (peakWindows.some((w) => windowApplies(w, dow) && m >= w.startMinute && m < w.endMinute)) total++;
  }
  return total;
}

/**
 * Price (minor units) of playing on a court from start to end on a date. Peak and off-peak
 * minutes are billed at their own hourly rate; the result is rounded to whole rupees.
 */
export function priceForRange(
  court: Pick<CourtForAvailability, "hourlyRate" | "peakHourlyRate">,
  peakWindows: PeakWindow[],
  date: string,
  start: number,
  end: number,
): { price: number; isPeak: boolean } {
  const peak = peakMinutes(peakWindows, dayOfWeek(date), start, end);
  const offPeak = end - start - peak;
  const raw = (peak * court.peakHourlyRate + offPeak * court.hourlyRate) / 60;
  return { price: Math.round(raw / 100) * 100, isPeak: peak > 0 };
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
  if (nowMinute !== null && start <= nowMinute) return { state: "PAST", label: "Closed" };

  const block = blocks.find((b) => b.startMinute === null || b.endMinute === null || rangesOverlap(start, end, b.startMinute, b.endMinute));
  if (block?.type === "MAINTENANCE") return { state: "MAINTENANCE", label: block.reason || "Maintenance" };
  if (block) return { state: "BLOCKED", label: block.reason || "Unavailable" };

  const closure = closureOverlapping(court.sportSlug, start, end);
  if (closure) return { state: "RESTRICTED", label: closure.label };

  const overlapping = bookings.filter((b) => rangesOverlap(start, end, b.startMinute, b.endMinute));
  if (overlapping.some((b) => !b.held)) return { state: "BOOKED", label: "Booked" };
  if (overlapping.length) return { state: "HELD", label: "On hold" };
  return { state: "AVAILABLE" };
}

export function computeAvailability(input: AvailabilityInput) {
  const times = startTimes(input.duration).map((s) => ({ startMinute: s, endMinute: s + input.duration }));
  const courts = input.courts
    .filter((c) => c.status !== "INACTIVE")
    .map<CourtAvailability>((court) => {
      const bookings = input.bookings.filter((b) => b.courtId === court.id);
      const blocks = input.blocks.filter((b) => b.courtId === court.id);
      const slots = times.map<Slot>(({ startMinute, endMinute }) => {
        const { price, isPeak } = priceForRange(court, input.peakWindows, input.date, startMinute, endMinute);
        return { startMinute, endMinute, price, isPeak, ...slotState(court, startMinute, endMinute, bookings, blocks, input.nowMinute) };
      });
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
  return { date: input.date, duration: input.duration, times, courts };
}

export type AvailabilityResult = ReturnType<typeof computeAvailability>;

/** Statuses that occupy a slot (unpaid holds only until they expire). */
export const ACTIVE_BOOKING_STATUSES = ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"] as const;
