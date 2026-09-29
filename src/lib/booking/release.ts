/**
 * Booking release rule: when a future date opens for booking. Pure; used by the server for
 * enforcement and by the UI to show "Opens on …" instead of hiding unreleased dates.
 */
import type { ReleaseRule } from "@/lib/settings-types";
import { addDays, addMonths, endOfMonth, startOfMonth } from "@/lib/time";

export type ReleaseInfo = { released: boolean; opensOn: string | null };

/** The date on which `date` becomes bookable. */
export function releaseDateFor(date: string, rule: ReleaseRule, advanceDays: number): string {
  if (rule.mode === "ROLLING") return addDays(date, -advanceDays);
  return addDays(startOfMonth(date), -rule.daysBeforeMonth);
}

export function releaseInfo(date: string, today: string, rule: ReleaseRule, advanceDays: number): ReleaseInfo {
  // The current month is always open under the monthly rule.
  if (rule.mode === "MONTH" && startOfMonth(date) <= startOfMonth(today)) return { released: true, opensOn: null };
  const opensOn = releaseDateFor(date, rule, advanceDays);
  return opensOn <= today ? { released: true, opensOn: null } : { released: false, opensOn };
}

/** The last date that is currently open for booking. */
export function lastBookableDate(today: string, rule: ReleaseRule, advanceDays: number): string {
  if (rule.mode === "ROLLING") return addDays(today, advanceDays);
  let month = startOfMonth(today);
  for (let i = 0; i < 24; i++) {
    const next = addMonths(month, 1);
    if (addDays(next, -rule.daysBeforeMonth) > today) break;
    month = next;
  }
  return endOfMonth(month);
}

export function describeRule(rule: ReleaseRule, advanceDays: number): string {
  if (rule.mode === "ROLLING") return `Bookings open ${advanceDays} days in advance`;
  return rule.daysBeforeMonth === 0
    ? "Each month opens for booking on the 1st"
    : `Each month opens for booking ${rule.daysBeforeMonth} day${rule.daysBeforeMonth === 1 ? "" : "s"} before it starts`;
}
