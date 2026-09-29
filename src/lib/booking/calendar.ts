/** Month calendar: one status per day for a court and duration. */
import type { CourtAvailability } from "./engine";
import type { ReleaseInfo } from "./release";

export type DayState = "AVAILABLE" | "LIMITED" | "FULL" | "NOT_RELEASED" | "MAINTENANCE" | "UNAVAILABLE";

export type DaySummary = { date: string; state: DayState; available: number; total: number; opensOn: string | null };

export const DAY_STATE_LABELS: Record<DayState, string> = {
  AVAILABLE: "Available",
  LIMITED: "Few slots left",
  FULL: "Fully booked",
  NOT_RELEASED: "Not released",
  MAINTENANCE: "Maintenance",
  UNAVAILABLE: "Unavailable",
};

/**
 * @param court availability of the court on that date (undefined when the court is inactive)
 * @param isPast the whole day is before today
 */
export function summarizeDay(date: string, court: CourtAvailability | undefined, release: ReleaseInfo, isPast: boolean): DaySummary {
  const base = { date, available: 0, total: 0, opensOn: null as string | null };
  if (isPast || !court) return { ...base, state: "UNAVAILABLE" };
  if (!release.released) return { ...base, state: "NOT_RELEASED", opensOn: release.opensOn };

  const bookable = court.slots.filter((s) => s.state !== "PAST");
  const total = bookable.length;
  const available = court.availableCount;
  if (total === 0) return { ...base, state: "UNAVAILABLE" };
  if (bookable.every((s) => s.state === "MAINTENANCE")) return { ...base, total, state: "MAINTENANCE" };
  if (available === 0) return { ...base, total, state: "FULL" };
  return { ...base, total, available, state: available <= Math.max(1, Math.floor(total / 5)) ? "LIMITED" : "AVAILABLE" };
}
