/** Monthly and quarterly bookings: the same court and time on chosen weekdays, paid up front. */
import type { PeakWindow } from "@/lib/settings-types";
import { addDays, addMonths, dateRange, dayOfWeek } from "@/lib/time";
import { applyDiscount, priceForRange } from "./engine";

export const RECURRING_TYPES = ["MONTHLY", "QUARTERLY"] as const;
export type RecurringType = (typeof RECURRING_TYPES)[number];

const MONTHS: Record<RecurringType, number> = { MONTHLY: 1, QUARTERLY: 3 };

export const BOOKING_TYPE_LABELS = { SINGLE: "Single booking", MONTHLY: "Monthly", QUARTERLY: "Quarterly" } as const;

/** Last day of a period that starts on `startDate` (e.g. 12 Oct → 11 Nov for monthly). */
export function seriesEndDate(startDate: string, type: RecurringType): string {
  return addDays(addMonths(startDate, MONTHS[type]), -1);
}

/** Every date between start and end (inclusive) that falls on one of the weekdays. */
export function seriesDates(startDate: string, endDate: string, daysOfWeek: number[]): string[] {
  const days = new Set(daysOfWeek);
  return dateRange(startDate, endDate).filter((d) => days.has(dayOfWeek(d)));
}

export type SeriesQuote = {
  sessions: { date: string; price: number }[];
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
};

export function quoteSeries(input: {
  court: { hourlyRate: number; peakHourlyRate: number };
  peakWindows: PeakWindow[];
  dates: string[];
  startMinute: number;
  endMinute: number;
  discountPercent: number;
}): SeriesQuote {
  const sessions = input.dates.map((date) => ({
    date,
    price: priceForRange(input.court, input.peakWindows, date, input.startMinute, input.endMinute).price,
  }));
  const subtotal = sessions.reduce((a, s) => a + s.price, 0);
  const { discount, total } = applyDiscount(subtotal, input.discountPercent > 0 ? { type: "PERCENT", value: input.discountPercent } : null);
  return { sessions, subtotal, discountPercent: input.discountPercent, discount, total };
}
