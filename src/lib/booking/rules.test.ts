import { describe, expect, it } from "vitest";
import { computeAvailability, slotTimes } from "./engine";
import { lastBookableDate, releaseInfo } from "./release";
import { quoteSeries, seriesDates, seriesEndDate } from "./recurring";
import { availableUnits, rentalCharge } from "./equipment";
import { summarizeDay } from "./calendar";

const MONTH = { mode: "MONTH" as const, daysBeforeMonth: 3 };

describe("release rule (monthly)", () => {
  it("keeps the current month open", () => {
    expect(releaseInfo("2026-09-30", "2026-09-10", MONTH, 30)).toEqual({ released: true, opensOn: null });
  });

  it("opens next month 3 days before it starts", () => {
    expect(releaseInfo("2026-10-15", "2026-09-27", MONTH, 30)).toEqual({ released: false, opensOn: "2026-09-28" });
    expect(releaseInfo("2026-10-15", "2026-09-28", MONTH, 30)).toEqual({ released: true, opensOn: null });
  });

  it("keeps later months closed and says when they open", () => {
    expect(releaseInfo("2026-11-02", "2026-09-29", MONTH, 30)).toEqual({ released: false, opensOn: "2026-10-29" });
  });

  it("computes the last bookable date", () => {
    expect(lastBookableDate("2026-09-27", MONTH, 30)).toBe("2026-09-30");
    expect(lastBookableDate("2026-09-28", MONTH, 30)).toBe("2026-10-31");
    expect(lastBookableDate("2026-12-29", MONTH, 30)).toBe("2027-01-31");
  });

  it("supports a rolling window", () => {
    const rolling = { mode: "ROLLING" as const, daysBeforeMonth: 0 };
    expect(releaseInfo("2026-10-09", "2026-09-29", rolling, 10)).toEqual({ released: true, opensOn: null });
    expect(releaseInfo("2026-10-10", "2026-09-29", rolling, 10)).toEqual({ released: false, opensOn: "2026-09-30" });
    expect(lastBookableDate("2026-09-29", rolling, 10)).toBe("2026-10-09");
  });
});

describe("recurring bookings", () => {
  it("ends a monthly period the day before the same date next month", () => {
    expect(seriesEndDate("2026-10-01", "MONTHLY")).toBe("2026-10-31");
    expect(seriesEndDate("2026-10-12", "MONTHLY")).toBe("2026-11-11");
    expect(seriesEndDate("2026-10-01", "QUARTERLY")).toBe("2026-12-31");
  });

  it("lists sessions on the chosen weekdays", () => {
    // October 2026: Mondays 5,12,19,26 and Wednesdays 7,14,21,28
    const dates = seriesDates("2026-10-01", "2026-10-31", [1, 3]);
    expect(dates).toEqual(["2026-10-05", "2026-10-07", "2026-10-12", "2026-10-14", "2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"]);
  });

  it("prices every session and applies the plan discount", () => {
    const q = quoteSeries({
      court: { hourlyRate: 40000, peakHourlyRate: 60000 },
      peakWindows: [{ label: "Eve", startMinute: 1020, endMinute: 1320, days: [] }],
      dates: ["2026-10-05", "2026-10-07"],
      startMinute: 1020,
      endMinute: 1140,
      discountPercent: 10,
    });
    expect(q.sessions).toEqual([
      { date: "2026-10-05", price: 120000 },
      { date: "2026-10-07", price: 120000 },
    ]);
    expect(q.subtotal).toBe(240000);
    expect(q.discount).toBe(24000);
    expect(q.total).toBe(216000);
  });
});

describe("equipment", () => {
  it("charges per booking or per started hour", () => {
    expect(rentalCharge({ rentalPrice: 10000, pricing: "PER_BOOKING" }, 2, 120)).toBe(20000);
    expect(rentalCharge({ rentalPrice: 5000, pricing: "PER_HOUR" }, 1, 90)).toBe(10000);
  });

  it("never offers damaged or already-reserved units", () => {
    expect(availableUnits({ totalQuantity: 10, damagedQuantity: 2 }, 5)).toBe(3);
    expect(availableUnits({ totalQuantity: 4, damagedQuantity: 1 }, 5)).toBe(0);
  });
});

describe("availability with per-court hours and hourly starts", () => {
  const settings = { openMinute: 360, closeMinute: 1320, peakWindows: [], slotStepMinutes: 60 };

  it("starts 2-hour slots every hour", () => {
    const times = slotTimes(360, 600, 120, 60);
    expect(times.map((t) => t.startMinute)).toEqual([360, 420, 480]);
  });

  it("uses a court's own hours and merges the time columns", () => {
    const result = computeAvailability({
      date: "2026-10-05",
      duration: 60,
      settings,
      courts: [
        { id: "a", name: "A", status: "ACTIVE", hourlyRate: 100, peakHourlyRate: 100 },
        { id: "b", name: "B", status: "ACTIVE", hourlyRate: 100, peakHourlyRate: 100, openMinute: 480, closeMinute: 600 },
      ],
      bookings: [{ courtId: "b", startMinute: 480, endMinute: 540 }],
      blocks: [],
      training: [],
      nowMinute: null,
    });
    const b = result.courts.find((c) => c.courtId === "b")!;
    expect(b.slots.map((s) => [s.startMinute, s.state])).toEqual([
      [480, "BOOKED"],
      [540, "AVAILABLE"],
    ]);
    expect(result.times).toHaveLength(16);
  });

  it("blocks a 2-hour slot when any part overlaps a booking", () => {
    const result = computeAvailability({
      date: "2026-10-05",
      duration: 120,
      settings,
      courts: [{ id: "a", name: "A", status: "ACTIVE", hourlyRate: 100, peakHourlyRate: 100, openMinute: 360, closeMinute: 600 }],
      bookings: [{ courtId: "a", startMinute: 420, endMinute: 480 }],
      blocks: [],
      training: [],
      nowMinute: null,
    });
    expect(result.courts[0]!.slots.map((s) => [s.startMinute, s.state])).toEqual([
      [360, "BOOKED"],
      [420, "BOOKED"],
      [480, "AVAILABLE"],
    ]);
  });
});

describe("month calendar", () => {
  const court = (states: string[]) => ({
    courtId: "a",
    courtName: "A",
    courtStatus: "ACTIVE" as const,
    slots: states.map((state, i) => ({ startMinute: i * 60, endMinute: i * 60 + 60, state: state as never, price: 0, isPeak: false })),
    availableCount: states.filter((s) => s === "AVAILABLE").length,
  });
  const open = { released: true, opensOn: null };

  it("reports availability states", () => {
    expect(summarizeDay("d", court(["AVAILABLE", "AVAILABLE", "BOOKED", "BOOKED", "BOOKED"]), open, false).state).toBe("AVAILABLE");
    expect(summarizeDay("d", court(["AVAILABLE", "BOOKED", "BOOKED", "BOOKED", "BOOKED", "BOOKED"]), open, false).state).toBe("LIMITED");
    expect(summarizeDay("d", court(["BOOKED", "BLOCKED"]), open, false).state).toBe("FULL");
    expect(summarizeDay("d", court(["MAINTENANCE", "MAINTENANCE"]), open, false).state).toBe("MAINTENANCE");
  });

  it("shows unreleased and past days distinctly", () => {
    expect(summarizeDay("d", court(["AVAILABLE"]), { released: false, opensOn: "2026-10-29" }, false)).toMatchObject({ state: "NOT_RELEASED", opensOn: "2026-10-29" });
    expect(summarizeDay("d", court(["AVAILABLE"]), open, true).state).toBe("UNAVAILABLE");
    expect(summarizeDay("d", undefined, open, false).state).toBe("UNAVAILABLE");
  });
});
