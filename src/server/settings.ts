import "server-only";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import {
  DEFAULT_BOOKING_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  type BookingSettings,
  type NotificationSettings,
} from "@/lib/settings-types";
import { clamp } from "@/lib/utils";

type SettingsMap = {
  booking: BookingSettings;
  notifications: NotificationSettings;
};

const DEFAULTS: SettingsMap = {
  booking: DEFAULT_BOOKING_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
};

/** Reads a settings document merged over its defaults (memoised per request). */
export const getSetting = cache(async <K extends keyof SettingsMap>(key: K): Promise<SettingsMap[K]> => {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key)).limit(1);
  return { ...DEFAULTS[key], ...((row?.value as Partial<SettingsMap[K]>) ?? {}) };
});

/** Booking settings with values kept inside safe bounds (the row is plain JSON). */
export const getBookingSettings = cache(async (): Promise<BookingSettings> => {
  const s = await getSetting("booking");
  return {
    timezone: DEFAULT_BOOKING_SETTINGS.timezone,
    holdMinutes: clamp(Math.round(Number(s.holdMinutes) || DEFAULT_BOOKING_SETTINGS.holdMinutes), 5, 30),
    advanceDays: clamp(Math.round(Number(s.advanceDays) || DEFAULT_BOOKING_SETTINGS.advanceDays), 1, 90),
    peakWindows: Array.isArray(s.peakWindows) ? s.peakWindows : DEFAULT_BOOKING_SETTINGS.peakWindows,
  };
});
