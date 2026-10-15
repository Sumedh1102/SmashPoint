/** Shapes of the JSON documents stored in the `settings` table, with defaults. */

export type PeakWindow = {
  label: string;
  startMinute: number;
  endMinute: number;
  /** 0 = Sunday … 6 = Saturday; empty = every day. */
  days: number[];
};

/**
 * Configurable booking parameters. Opening hours, durations and the badminton academy
 * closure are fixed business rules (lib/booking/rules.ts), not settings.
 */
export type BookingSettings = {
  timezone: string;
  /** How long an unpaid booking holds its slot while the customer pays. */
  holdMinutes: number;
  /** How many days ahead (including today) customers can book. */
  advanceDays: number;
  /** Peak-price windows; each court has an off-peak and a peak hourly rate. */
  peakWindows: PeakWindow[];
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
  peakWindows: [{ label: "Evening", startMinute: 17 * 60, endMinute: 22 * 60, days: [] }],
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  bookingReminderHours: 12,
};
