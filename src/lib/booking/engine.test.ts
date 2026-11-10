import { describe, expect, it } from "vitest";
import { COURTS } from "../../../scripts/lib/catalogue";
import { computeAvailability, priceForDuration, twoHourSaving, type CourtForAvailability } from "./engine";
import { checkSlotRules, DEFAULT_BOOKING_HOURS, hourMarks, normalizeBookingHours, startTimes } from "./rules";

const H = 60;

/** The five catalogue courts, as the engine sees them (prices straight from the rate card). */
const courts: CourtForAvailability[] = COURTS.map((c) => ({
  id: c.slug,
  slug: c.slug,
  name: c.name,
  sportSlug: c.sport,
  status: "ACTIVE",
  price1h: c.price1h,
  price2h: c.price2h,
}));
const court = (slug: string) => courts.find((c) => c.slug === slug)!;

const base = { date: "2026-10-20", courts, bookings: [], blocks: [], nowMinute: null };
const slotOf = (result: ReturnType<typeof computeAvailability>, courtId: string, start: number) =>
  result.courts.find((c) => c.courtId === courtId)!.slots.find((s) => s.startMinute === start)!;

describe("priceForDuration — exact rate-card prices (paise)", () => {
  const expected: [string, number, number][] = [
    ["badminton-court-1", 50_000, 90_000], // Green Mat 5 mm: ₹500 / ₹900
    ["badminton-court-2", 40_000, 70_000], // Wooden Finish 2.5 mm: ₹400 / ₹700
    ["pickleball-court-1", 40_000, 70_000], // ₹400 / ₹700
    ["pickleball-court-2", 40_000, 70_000], // same published tariff
    ["basketball-court-1", 70_000, 130_000], // ₹700 / ₹1,300
  ];
  for (const [slug, oneHour, twoHours] of expected) {
    it(`${slug}: ₹${oneHour / 100} for 1 hour, ₹${twoHours / 100} for 2 hours`, () => {
      expect(priceForDuration(court(slug), 60)).toBe(oneHour);
      expect(priceForDuration(court(slug), 120)).toBe(twoHours);
    });
  }

  it("two-hour prices are package prices, not twice the hourly price", () => {
    for (const c of courts) expect(priceForDuration(c, 120)).toBeLessThan(priceForDuration(c, 60) * 2);
    expect(twoHourSaving(court("badminton-court-1"))).toBe(10_000);
    expect(twoHourSaving(court("basketball-court-1"))).toBe(10_000);
    expect(twoHourSaving({ price1h: 50_000, price2h: 120_000 })).toBe(0);
  });
});

describe("computeAvailability — prices", () => {
  it("charges the same price at every hour of the day (no peak surcharge)", () => {
    for (const duration of [60, 120] as const) {
      const result = computeAvailability({ ...base, duration });
      for (const c of result.courts) {
        const prices = new Set(c.slots.map((s) => s.price));
        expect(prices.size).toBe(1);
        expect([...prices][0]).toBe(priceForDuration(court(c.courtSlug), duration));
      }
    }
  });

  it("evening and weekend slots cost the same as morning ones", () => {
    for (const date of ["2026-10-17", "2026-10-18", "2026-10-20"]) {
      const result = computeAvailability({ ...base, date, duration: 60 });
      expect(slotOf(result, "basketball-court-1", 7 * H).price).toBe(70_000);
      expect(slotOf(result, "basketball-court-1", 19 * H).price).toBe(70_000);
      expect(slotOf(result, "badminton-court-1", 18 * H).price).toBe(50_000);
    }
  });

  it("does not expose a peak flag on slots", () => {
    const result = computeAvailability({ ...base, duration: 60 });
    expect(Object.keys(slotOf(result, "pickleball-court-1", 18 * H))).not.toContain("isPeak");
  });
});

describe("booking hours", () => {
  it("defaults to 7 AM – 10 PM", () => {
    expect(DEFAULT_BOOKING_HOURS).toEqual({ openMinute: 7 * H, closeMinute: 22 * H });
    expect(hourMarks()).toHaveLength(15);
  });

  it("offers hourly one-hour slots from opening, the last one ending at closing", () => {
    const times = startTimes(60);
    expect(times[0]).toBe(7 * H);
    expect(times.at(-1)).toBe(21 * H);
    expect(times).toHaveLength(15);
  });

  it("offers two-hour slots that never run past closing", () => {
    const times = startTimes(120);
    expect(times[0]).toBe(7 * H);
    expect(times.at(-1)).toBe(20 * H);
    expect(times.every((s) => s + 120 <= 22 * H)).toBe(true);
  });

  it("follows configured hours", () => {
    const hours = { openMinute: 6 * H, closeMinute: 23 * H };
    expect(startTimes(60, hours)[0]).toBe(6 * H);
    expect(startTimes(120, hours).at(-1)).toBe(21 * H);
    expect(checkSlotRules(6 * H, 60, hours)).toBeNull();
    expect(checkSlotRules(22 * H, 60, hours)).toBeNull();
    expect(checkSlotRules(6 * H, 60)?.code).toBe("OUTSIDE_HOURS");
    const result = computeAvailability({ ...base, duration: 60, hours });
    expect(result.courts[0]!.slots).toHaveLength(17);
  });

  it("normalizes stored hours exactly like the database trigger (invalid → defaults)", () => {
    expect(normalizeBookingHours({ openMinute: 360, closeMinute: 1380 })).toEqual({ openMinute: 360, closeMinute: 1380 });
    expect(normalizeBookingHours({ openMinute: 0, closeMinute: 1440 })).toEqual({ openMinute: 0, closeMinute: 1440 });
    expect(normalizeBookingHours({})).toEqual(DEFAULT_BOOKING_HOURS);
    expect(normalizeBookingHours(null)).toEqual(DEFAULT_BOOKING_HOURS);
    expect(normalizeBookingHours({ openMinute: 480 })).toEqual({ openMinute: 480, closeMinute: 1320 }); // missing key → its default
    for (const bad of [
      { openMinute: 450, closeMinute: 1320 }, // not on the hour
      { openMinute: 1320, closeMinute: 420 }, // closes before opening
      { openMinute: 600, closeMinute: 600 }, // empty
      { openMinute: -60, closeMinute: 600 },
      { openMinute: 420, closeMinute: 1500 },
      { openMinute: "420", closeMinute: 1320 },
      { openMinute: null, closeMinute: 1320 },
      { openMinute: 420.5, closeMinute: 1320 },
    ]) {
      expect(normalizeBookingHours(bad)).toEqual(DEFAULT_BOOKING_HOURS);
    }
  });
});

describe("checkSlotRules — durations and alignment", () => {
  it("allows the first and last hour of the day", () => {
    expect(checkSlotRules(7 * H, 60)).toBeNull();
    expect(checkSlotRules(21 * H, 60)).toBeNull();
  });

  it("rejects anything before opening or ending after closing", () => {
    expect(checkSlotRules(6 * H, 60)?.code).toBe("OUTSIDE_HOURS");
    expect(checkSlotRules(21 * H, 120)?.code).toBe("OUTSIDE_HOURS");
    expect(checkSlotRules(22 * H, 60)?.code).toBe("OUTSIDE_HOURS");
  });

  it("only accepts one- or two-hour bookings starting on the hour", () => {
    expect(checkSlotRules(9 * H, 90)?.code).toBe("INVALID_DURATION");
    expect(checkSlotRules(9 * H, 30)?.code).toBe("INVALID_DURATION");
    expect(checkSlotRules(9 * H, 180)?.code).toBe("INVALID_DURATION");
    expect(checkSlotRules(9 * H + 30, 60)?.code).toBe("MISALIGNED");
    expect(checkSlotRules(9 * H, 120)).toBeNull();
  });
});

describe("computeAvailability — slot states", () => {
  it("returns all five courts with 15 one-hour slots each", () => {
    const result = computeAvailability({ ...base, duration: 60 });
    expect(result.courts).toHaveLength(5);
    for (const c of result.courts) expect(c.slots).toHaveLength(15);
  });

  it("has no fixed badminton closure: 5–7 PM is bookable on every court", () => {
    for (const duration of [60, 120] as const) {
      const result = computeAvailability({ ...base, duration });
      for (const c of courts) {
        expect(slotOf(result, c.id, 17 * H).state).toBe("AVAILABLE");
        expect(slotOf(result, c.id, 18 * H).state).toBe("AVAILABLE");
      }
    }
  });

  it("blocks a slot only on the booked court", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      bookings: [{ courtId: "badminton-court-1", startMinute: 19 * H, endMinute: 20 * H, held: false }],
    });
    expect(slotOf(result, "badminton-court-1", 19 * H).state).toBe("BOOKED");
    expect(slotOf(result, "badminton-court-2", 19 * H).state).toBe("AVAILABLE");
  });

  it("needs both hours free for a two-hour booking", () => {
    const result = computeAvailability({
      ...base,
      duration: 120,
      bookings: [{ courtId: "pickleball-court-1", startMinute: 20 * H, endMinute: 21 * H, held: false }],
    });
    expect(slotOf(result, "pickleball-court-1", 19 * H).state).toBe("BOOKED"); // 7–9 overlaps 8–9
    expect(slotOf(result, "pickleball-court-1", 20 * H).state).toBe("BOOKED"); // 8–10
    expect(slotOf(result, "pickleball-court-1", 18 * H).state).toBe("AVAILABLE"); // 6–8
  });

  it("a two-hour booking occupies both of its one-hour slots", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      bookings: [{ courtId: "basketball-court-1", startMinute: 19 * H, endMinute: 21 * H, held: false }],
    });
    expect(slotOf(result, "basketball-court-1", 19 * H).state).toBe("BOOKED");
    expect(slotOf(result, "basketball-court-1", 20 * H).state).toBe("BOOKED");
    expect(slotOf(result, "basketball-court-1", 21 * H).state).toBe("AVAILABLE");
  });

  it("shows unpaid holds as HELD", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      bookings: [{ courtId: "pickleball-court-2", startMinute: 9 * H, endMinute: 10 * H, held: true }],
    });
    expect(slotOf(result, "pickleball-court-2", 9 * H).state).toBe("HELD");
  });

  it("applies maintenance and blocks, and hides inactive courts", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      courts: [...courts.slice(0, 4), { ...court("basketball-court-1"), status: "INACTIVE" }],
      blocks: [
        { courtId: "pickleball-court-1", type: "MAINTENANCE", startMinute: null, endMinute: null, reason: "Resurfacing" },
        { courtId: "badminton-court-2", type: "BLOCKED", startMinute: 8 * H, endMinute: 10 * H, reason: "Private event" },
      ],
    });
    expect(result.courts).toHaveLength(4);
    expect(slotOf(result, "pickleball-court-1", 12 * H)).toMatchObject({ state: "MAINTENANCE", label: "Resurfacing" });
    expect(slotOf(result, "badminton-court-2", 9 * H)).toMatchObject({ state: "BLOCKED", label: "Private event" });
    expect(slotOf(result, "badminton-court-2", 10 * H).state).toBe("AVAILABLE");
  });

  it("marks slots that have started as PAST on today's date", () => {
    const result = computeAvailability({ ...base, duration: 60, nowMinute: 9 * H + 5 });
    expect(slotOf(result, "basketball-court-1", 9 * H).state).toBe("PAST");
    expect(slotOf(result, "basketball-court-1", 10 * H).state).toBe("AVAILABLE");
  });
});
