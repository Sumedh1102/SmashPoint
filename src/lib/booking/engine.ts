/**
 * Pure booking engine: slot generation, availability states and pricing.
 * Shared by the server (authoritative checks) and the client (instant feedback).
 */
import type { BookingSettings, PeakWindow } from "@/lib/settings-types";
import { dayOfWeek, rangesOverlap } from "@/lib/time";

export type SlotState = "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "BLOCKED" | "TRAINING" | "PAST";

export type CourtForAvailability = {
  id: string;
  name: string;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  hourlyRate: number;
  peakHourlyRate: number;
  /** Per-court opening hours; null/undefined uses the academy-wide hours. */
  openMinute?: number | null;
  closeMinute?: number | null;
};

export type OccupiedRange = { courtId: string; startMinute: number; endMinute: number; label?: string };
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
  courtName: string;
  courtStatus: CourtForAvailability["status"];
  slots: Slot[];
  availableCount: number;
};

export type AvailabilityResult = {
  date: string;
  duration: number;
  times: { startMinute: number; endMinute: number }[];
  courts: CourtAvailability[];
};

export type AvailabilityInput = {
  date: string;
  duration: number;
  settings: Pick<BookingSettings, "openMinute" | "closeMinute" | "peakWindows"> & { slotStepMinutes?: number };
  courts: CourtForAvailability[];
  bookings: OccupiedRange[];
  blocks: BlockRange[];
  training: OccupiedRange[];
  /**
   * Minutes since midnight "now" when `date` is today; `Infinity` for past dates;
   * `null` for future dates.
   */
  nowMinute: number | null;
};

/**
 * Slot start times for a duration, aligned to opening time. Slots start every `step` minutes
 * (default: back-to-back), so a 2-hour booking can start on any hour when step = 60.
 */
export function slotTimes(openMinute: number, closeMinute: number, duration: number, step = duration) {
  const times: { startMinute: number; endMinute: number }[] = [];
  for (let s = openMinute; s + duration <= closeMinute; s += Math.max(step, 15)) {
    times.push({ startMinute: s, endMinute: s + duration });
  }
  return times;
}

/** Opening hours that apply to a court. */
export function courtHours(court: Pick<CourtForAvailability, "openMinute" | "closeMinute">, settings: Pick<BookingSettings, "openMinute" | "closeMinute">) {
  return court.openMinute != null && court.closeMinute != null
    ? { openMinute: court.openMinute, closeMinute: court.closeMinute }
    : { openMinute: settings.openMinute, closeMinute: settings.closeMinute };
}

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
 * Price (minor units) of playing on a court from start to end on a date. Peak and non-peak
 * minutes are billed at their respective hourly rate; the result is rounded to whole rupees.
 */
export function priceForRange(
  court: Pick<CourtForAvailability, "hourlyRate" | "peakHourlyRate">,
  peakWindows: PeakWindow[],
  date: string,
  start: number,
  end: number,
): { price: number; isPeak: boolean } {
  const dow = dayOfWeek(date);
  const peak = peakMinutes(peakWindows, dow, start, end);
  const offPeak = end - start - peak;
  const raw = (peak * court.peakHourlyRate + offPeak * court.hourlyRate) / 60;
  return { price: Math.round(raw / 100) * 100, isPeak: peak > 0 };
}

export function computeAvailability(input: AvailabilityInput): AvailabilityResult {
  const { date, duration, settings, nowMinute } = input;
  const step = settings.slotStepMinutes ?? duration;
  const allTimes = new Map<number, { startMinute: number; endMinute: number }>();

  const courts = input.courts
    .filter((c) => c.status !== "INACTIVE")
    .map<CourtAvailability>((court) => {
      const bookings = input.bookings.filter((b) => b.courtId === court.id);
      const blocks = input.blocks.filter((b) => b.courtId === court.id);
      const training = input.training.filter((t) => t.courtId === court.id);
      const hours = courtHours(court, settings);
      const times = slotTimes(hours.openMinute, hours.closeMinute, duration, step);
      for (const t of times) allTimes.set(t.startMinute, t);

      const slots = times.map<Slot>(({ startMinute, endMinute }) => {
        const { price, isPeak } = priceForRange(court, settings.peakWindows, date, startMinute, endMinute);
        const base = { startMinute, endMinute, price, isPeak };

        if (court.status === "MAINTENANCE") return { ...base, state: "MAINTENANCE", label: "Maintenance" };

        const block = blocks.find(
          (b) => b.startMinute === null || b.endMinute === null || rangesOverlap(startMinute, endMinute, b.startMinute, b.endMinute),
        );
        if (block?.type === "MAINTENANCE") return { ...base, state: "MAINTENANCE", label: block.reason ?? "Maintenance" };
        if (block) return { ...base, state: "BLOCKED", label: block.reason ?? "Unavailable" };

        if (nowMinute !== null && startMinute <= nowMinute) return { ...base, state: "PAST", label: "Closed" };

        const session = training.find((t) => rangesOverlap(startMinute, endMinute, t.startMinute, t.endMinute));
        if (session) return { ...base, state: "TRAINING", label: session.label ?? "Training" };

        if (bookings.some((b) => rangesOverlap(startMinute, endMinute, b.startMinute, b.endMinute))) {
          return { ...base, state: "BOOKED", label: "Booked" };
        }
        return { ...base, state: "AVAILABLE" };
      });

      return {
        courtId: court.id,
        courtName: court.name,
        courtStatus: court.status,
        slots,
        availableCount: slots.filter((s) => s.state === "AVAILABLE").length,
      };
    });

  const times = [...allTimes.values()].sort((a, b) => a.startMinute - b.startMinute);
  return { date, duration, times, courts };
}

export type Discount = { type: "PERCENT" | "FLAT"; value: number; maxDiscount?: number | null };

/** Applies a discount to an amount (minor units); never returns a negative total. */
export function applyDiscount(amount: number, discount: Discount | null): { discount: number; total: number } {
  if (!discount) return { discount: 0, total: amount };
  let off = discount.type === "PERCENT" ? Math.round((amount * discount.value) / 100) : discount.value;
  if (discount.maxDiscount != null) off = Math.min(off, discount.maxDiscount);
  off = Math.min(off, amount);
  return { discount: off, total: amount - off };
}

export const ACTIVE_BOOKING_STATUSES = ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"] as const;
