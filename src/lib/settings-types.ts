/** Shapes of the JSON documents stored in the `settings` table, with defaults. */
import { DEFAULT_BOOKING_HOURS } from "@/lib/booking/rules";

/**
 * Configurable booking parameters. Durations (one or two hours, on the hour) are fixed rules
 * (lib/booking/rules.ts); prices live on each court (rate card), not here.
 */
export type BookingSettings = {
  timezone: string;
  /** How long an unpaid booking holds its slot while the customer pays. */
  holdMinutes: number;
  /** How many days ahead (including today) customers can book. */
  advanceDays: number;
  /**
   * Daily booking window, minutes from midnight. The database trigger reads these two keys
   * from the same row (see normalizeBookingHours). To be confirmed by the facility.
   */
  openMinute: number;
  closeMinute: number;
};

export type NotificationSettings = {
  /** Send booking confirmation / reminder / refund emails (needs RESEND_API_KEY). */
  email: boolean;
  /** Reminder email this many hours before a confirmed booking (0 = off). */
  bookingReminderHours: number;
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timezone: "Asia/Kolkata",
  holdMinutes: 10,
  advanceDays: 30,
  ...DEFAULT_BOOKING_HOURS,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  bookingReminderHours: 12,
};
