import { describe, expect, it } from "vitest";
import { computeAvailability, priceForRange, type CourtForAvailability } from "./engine";
import { checkSlotRules, closureOverlapping, startTimes } from "./rules";

const H = 60;
const peakWindows = [{ label: "Evening", startMinute: 17 * H, endMinute: 22 * H, days: [] }];

const court = (id: string, sportSlug: string, extra: Partial<CourtForAvailability> = {}): CourtForAvailability => ({
  id,
  slug: id,
  name: id,
  sportSlug,
  status: "ACTIVE",
  hourlyRate: 50_000,
  peakHourlyRate: 70_000,
  ...extra,
});

const courts = [
  court("badminton-1", "badminton"),
  court("badminton-2", "badminton"),
  court("pickleball-1", "pickleball"),
  court("pickleball-2", "pickleball"),
  court("basketball-1", "basketball"),
];

const base = { date: "2026-10-20", peakWindows, courts, bookings: [], blocks: [], nowMinute: null };
const slotOf = (result: ReturnType<typeof computeAvailability>, courtId: string, start: number) =>
  result.courts.find((c) => c.courtId === courtId)!.slots.find((s) => s.startMinute === start)!;

describe("startTimes", () => {
  it("offers hourly one-hour slots from 7 AM, the last one ending at 10 PM", () => {
    const times = startTimes(60);
    expect(times[0]).toBe(7 * H);
    expect(times.at(-1)).toBe(21 * H);
    expect(times).toHaveLength(15);
  });

  it("offers two-hour slots that never run past 10 PM", () => {
    const times = startTimes(120);
    expect(times[0]).toBe(7 * H);
    expect(times.at(-1)).toBe(20 * H);
    expect(times.every((s) => s + 120 <= 22 * H)).toBe(true);
  });
});

describe("checkSlotRules — opening hours and durations", () => {
  it("allows 7–8 AM and 9–10 PM", () => {
    expect(checkSlotRules("pickleball", 7 * H, 60)).toBeNull();
    expect(checkSlotRules("pickleball", 21 * H, 60)).toBeNull();
  });

  it("rejects anything before 7 AM or ending after 10 PM", () => {
    expect(checkSlotRules("pickleball", 6 * H, 60)?.code).toBe("OUTSIDE_HOURS");
    expect(checkSlotRules("basketball", 21 * H, 120)?.code).toBe("OUTSIDE_HOURS");
    expect(checkSlotRules("basketball", 22 * H, 60)?.code).toBe("OUTSIDE_HOURS");
  });

  it("only accepts one- or two-hour bookings starting on the hour", () => {
    expect(checkSlotRules("pickleball", 9 * H, 90)?.code).toBe("INVALID_DURATION");
    expect(checkSlotRules("pickleball", 9 * H, 30)?.code).toBe("INVALID_DURATION");
    expect(checkSlotRules("pickleball", 9 * H + 30, 60)?.code).toBe("MISALIGNED");
    expect(checkSlotRules("pickleball", 9 * H, 120)).toBeNull();
  });
});

describe("checkSlotRules — badminton academy closure (5–7 PM)", () => {
  const cases: [string, number, number, boolean][] = [
    ["3–4 PM", 15 * H, 60, true],
    ["4–5 PM", 16 * H, 60, true],
    ["5–6 PM", 17 * H, 60, false],
    ["6–7 PM", 18 * H, 60, false],
    ["4–6 PM (overlaps the closure)", 16 * H, 120, false],
    ["5–7 PM", 17 * H, 120, false],
    ["6–8 PM (overlaps the closure)", 18 * H, 120, false],
    ["3–5 PM (ends as it starts)", 15 * H, 120, true],
    ["7–8 PM", 19 * H, 60, true],
    ["7–9 PM", 19 * H, 120, true],
  ];
  for (const [label, start, duration, allowed] of cases) {
    it(`${allowed ? "allows" : "rejects"} badminton ${label}`, () => {
      const result = checkSlotRules("badminton", start, duration);
      if (allowed) expect(result).toBeNull();
      else expect(result?.code).toBe("SPORT_CLOSURE");
    });
  }

  it("does not apply to pickleball or basketball", () => {
    for (const sport of ["pickleball", "basketball"]) {
      expect(checkSlotRules(sport, 17 * H, 60)).toBeNull();
      expect(checkSlotRules(sport, 18 * H, 60)).toBeNull();
      expect(checkSlotRules(sport, 16 * H, 120)).toBeNull();
      expect(closureOverlapping(sport, 17 * H, 19 * H)).toBeNull();
    }
  });
});

describe("priceForRange", () => {
  it("charges the off-peak rate before 5 PM and the peak rate after", () => {
    expect(priceForRange(courts[2]!, peakWindows, "2026-10-20", 10 * H, 11 * H)).toEqual({ price: 50_000, isPeak: false });
    expect(priceForRange(courts[2]!, peakWindows, "2026-10-20", 18 * H, 19 * H)).toEqual({ price: 70_000, isPeak: true });
  });

  it("bills each hour of a two-hour booking at its own rate", () => {
    // 4–6 PM: one off-peak hour + one peak hour
    expect(priceForRange(courts[2]!, peakWindows, "2026-10-20", 16 * H, 18 * H).price).toBe(120_000);
  });

  it("respects weekday-specific windows", () => {
    const weekend = [{ label: "Weekend", startMinute: 7 * H, endMinute: 22 * H, days: [0, 6] }];
    expect(priceForRange(courts[0]!, weekend, "2026-10-17", 10 * H, 11 * H).isPeak).toBe(true); // Saturday
    expect(priceForRange(courts[0]!, weekend, "2026-10-20", 10 * H, 11 * H).isPeak).toBe(false); // Tuesday
  });
});

describe("computeAvailability", () => {
  it("returns all five courts with 15 one-hour slots each", () => {
    const result = computeAvailability({ ...base, duration: 60 });
    expect(result.courts).toHaveLength(5);
    for (const c of result.courts) expect(c.slots).toHaveLength(15);
  });

  it("shows both badminton courts as RESTRICTED from 5 to 7 PM, other sports stay open", () => {
    const result = computeAvailability({ ...base, duration: 60 });
    for (const id of ["badminton-1", "badminton-2"]) {
      expect(slotOf(result, id, 16 * H).state).toBe("AVAILABLE");
      expect(slotOf(result, id, 17 * H).state).toBe("RESTRICTED");
      expect(slotOf(result, id, 18 * H).state).toBe("RESTRICTED");
      expect(slotOf(result, id, 19 * H).state).toBe("AVAILABLE");
    }
    for (const id of ["pickleball-1", "pickleball-2", "basketball-1"]) {
      expect(slotOf(result, id, 17 * H).state).toBe("AVAILABLE");
      expect(slotOf(result, id, 18 * H).state).toBe("AVAILABLE");
    }
  });

  it("restricts two-hour badminton slots that overlap the closure", () => {
    const result = computeAvailability({ ...base, duration: 120 });
    expect(slotOf(result, "badminton-1", 15 * H).state).toBe("AVAILABLE"); // 3–5
    expect(slotOf(result, "badminton-1", 16 * H).state).toBe("RESTRICTED"); // 4–6
    expect(slotOf(result, "badminton-1", 18 * H).state).toBe("RESTRICTED"); // 6–8
    expect(slotOf(result, "badminton-1", 19 * H).state).toBe("AVAILABLE"); // 7–9
  });

  it("blocks a slot only on the booked court", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      bookings: [{ courtId: "badminton-1", startMinute: 19 * H, endMinute: 20 * H, held: false }],
    });
    expect(slotOf(result, "badminton-1", 19 * H).state).toBe("BOOKED");
    expect(slotOf(result, "badminton-2", 19 * H).state).toBe("AVAILABLE");
  });

  it("needs both hours free for a two-hour booking", () => {
    const result = computeAvailability({
      ...base,
      duration: 120,
      bookings: [{ courtId: "pickleball-1", startMinute: 20 * H, endMinute: 21 * H, held: false }],
    });
    expect(slotOf(result, "pickleball-1", 19 * H).state).toBe("BOOKED"); // 7–9 overlaps 8–9
    expect(slotOf(result, "pickleball-1", 20 * H).state).toBe("BOOKED"); // 8–10
    expect(slotOf(result, "pickleball-1", 18 * H).state).toBe("AVAILABLE"); // 6–8
  });

  it("a two-hour booking occupies both of its one-hour slots", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      bookings: [{ courtId: "basketball-1", startMinute: 19 * H, endMinute: 21 * H, held: false }],
    });
    expect(slotOf(result, "basketball-1", 19 * H).state).toBe("BOOKED");
    expect(slotOf(result, "basketball-1", 20 * H).state).toBe("BOOKED");
    expect(slotOf(result, "basketball-1", 21 * H).state).toBe("AVAILABLE");
  });

  it("shows unpaid holds as HELD", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      bookings: [{ courtId: "pickleball-2", startMinute: 9 * H, endMinute: 10 * H, held: true }],
    });
    expect(slotOf(result, "pickleball-2", 9 * H).state).toBe("HELD");
  });

  it("applies maintenance and blocks, and hides inactive courts", () => {
    const result = computeAvailability({
      ...base,
      duration: 60,
      courts: [...courts.slice(0, 4), court("basketball-1", "basketball", { status: "INACTIVE" })],
      blocks: [
        { courtId: "pickleball-1", type: "MAINTENANCE", startMinute: null, endMinute: null, reason: "Resurfacing" },
        { courtId: "badminton-2", type: "BLOCKED", startMinute: 8 * H, endMinute: 10 * H, reason: "Private event" },
      ],
    });
    expect(result.courts).toHaveLength(4);
    expect(slotOf(result, "pickleball-1", 12 * H)).toMatchObject({ state: "MAINTENANCE", label: "Resurfacing" });
    expect(slotOf(result, "badminton-2", 9 * H)).toMatchObject({ state: "BLOCKED", label: "Private event" });
    expect(slotOf(result, "badminton-2", 10 * H).state).toBe("AVAILABLE");
  });

  it("marks slots that have started as PAST on today's date", () => {
    const result = computeAvailability({ ...base, duration: 60, nowMinute: 9 * H + 5 });
    expect(slotOf(result, "basketball-1", 9 * H).state).toBe("PAST");
    expect(slotOf(result, "basketball-1", 10 * H).state).toBe("AVAILABLE");
  });
});
