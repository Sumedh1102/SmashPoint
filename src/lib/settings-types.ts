/** Shapes of the JSON documents stored in the `settings` table, with defaults. */

export type PeakWindow = {
  label: string;
  startMinute: number;
  endMinute: number;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
};

/**
 * When future dates open for booking.
 * - MONTH: a calendar month opens `daysBeforeMonth` days before it starts (the current month is always open).
 * - ROLLING: the next `advanceDays` days are open.
 */
export type ReleaseRule = { mode: "MONTH" | "ROLLING"; daysBeforeMonth: number };

export type RecurringSettings = {
  /** Discount on the court price of a monthly booking (percent). */
  monthlyDiscountPercent: number;
  quarterlyDiscountPercent: number;
};

export type BookingSettings = {
  timezone: string;
  /** Academy-wide opening hours; a court can override them. */
  openMinute: number;
  closeMinute: number;
  /** Default durations for new courts (each court has its own list). */
  durations: number[];
  defaultDuration: number;
  /** Slots start every N minutes (60 = on the hour). */
  slotStepMinutes: number;
  peakWindows: PeakWindow[];
  /** How long an unpaid booking holds its slot. */
  holdMinutes: number;
  /** How many days ahead customers can book online (ROLLING release). */
  advanceDays: number;
  release: ReleaseRule;
  recurring: RecurringSettings;
  /** Customers may cancel online until this many hours before start. */
  cancellationCutoffHours: number;
  /** Allow bookings without an account (name + phone + email). */
  allowGuestBooking: boolean;
};

export type AcademySettings = {
  name: string;
  shortName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  mapQuery: string;
  openingHours: string;
  socials: { instagram: string; youtube: string; facebook: string; x: string };
};

export type NotificationSettings = {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  bookingReminderHours: number;
  membershipExpiryReminderDays: number;
};

export type AttendanceSettings = {
  /** Minutes after batch start when a QR check-in is marked LATE. */
  lateAfterMinutes: number;
  qrEnabled: boolean;
};

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timezone: "Asia/Kolkata",
  openMinute: 6 * 60,
  closeMinute: 22 * 60,
  durations: [60, 120],
  defaultDuration: 60,
  slotStepMinutes: 60,
  peakWindows: [{ label: "Evening peak", startMinute: 17 * 60, endMinute: 22 * 60, days: [0, 1, 2, 3, 4, 5, 6] }],
  holdMinutes: 10,
  advanceDays: 30,
  release: { mode: "MONTH", daysBeforeMonth: 3 },
  recurring: { monthlyDiscountPercent: 5, quarterlyDiscountPercent: 10 },
  cancellationCutoffHours: 6,
  allowGuestBooking: true,
};

export const DEFAULT_ACADEMY_SETTINGS: AcademySettings = {
  name: "SmashPoint Badminton Academy",
  shortName: "SmashPoint",
  tagline: "Train sharper. Play faster. Book in seconds.",
  phone: "+91 98220 41190",
  whatsapp: "+91 98220 41190",
  email: "hello@smashpoint.in",
  addressLine: "Plot 14, Mahim Road, near Hutatma Stambh",
  city: "Palghar",
  state: "Maharashtra",
  postalCode: "401404",
  mapQuery: "Mahim Road, Palghar, Maharashtra 401404",
  openingHours: "Mon – Sun · 4:00 AM – 7:00 PM",
  socials: {
    instagram: "https://instagram.com/smashpoint.academy",
    youtube: "https://youtube.com/@smashpointacademy",
    facebook: "https://facebook.com/smashpointacademy",
    x: "https://x.com/smashpointhq",
  },
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  sms: false,
  whatsapp: false,
  bookingReminderHours: 12,
  membershipExpiryReminderDays: 7,
};

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  lateAfterMinutes: 10,
  qrEnabled: true,
};
