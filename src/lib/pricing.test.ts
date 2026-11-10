import { describe, expect, it } from "vitest";
import { CATALOGUE_REVISION, COURTS, RATE_CARD, SPORTS } from "../../scripts/lib/catalogue";
import { courtDisplayName, hasMonthlyPlans, lowestHourlyBySport, MONTHLY_TERMS, shortCourtName, tariffRows, type RateCardCourt } from "./pricing";

const rupees = (paise: number | null) => (paise === null ? null : paise / 100);

/** The catalogue courts as the website receives them. */
const catalogue: RateCardCourt[] = COURTS.map((c) => ({
  id: c.slug,
  slug: c.slug,
  name: c.name,
  surface: c.surface ?? null,
  status: "ACTIVE",
  sport: { slug: c.sport, name: SPORTS.find((s) => s.slug === c.sport)!.name },
  price1h: c.price1h,
  price2h: c.price2h,
  monthly: {
    monthlyPrice1m: c.monthlyPrice1m ?? null,
    monthlyPrice3m: c.monthlyPrice3m ?? null,
    monthlyPrice6m: c.monthlyPrice6m ?? null,
    monthlyPrice12m: c.monthlyPrice12m ?? null,
  },
}));

describe("catalogue — the published rate card", () => {
  it("is a newer revision than the original demo catalogue", () => {
    expect(CATALOGUE_REVISION).toBeGreaterThanOrEqual(2);
  });

  it("keeps the stable court slugs: 2 badminton, 2 pickleball, 1 basketball", () => {
    expect(COURTS.map((c) => [c.sport, c.slug])).toEqual([
      ["badminton", "badminton-court-1"],
      ["badminton", "badminton-court-2"],
      ["pickleball", "pickleball-court-1"],
      ["pickleball", "pickleball-court-2"],
      ["basketball", "basketball-court-1"],
    ]);
  });

  it("maps badminton Court 1 to the green mat and Court 2 to the wooden finish", () => {
    const [c1, c2] = COURTS;
    expect(c1).toMatchObject({ slug: "badminton-court-1", surface: "Green Mat (5 mm)" });
    expect(c2).toMatchObject({ slug: "badminton-court-2", surface: "Wooden Finish (2.5 mm)" });
  });

  const table: [string, (number | null)[]][] = [
    // slug: 1 month, 3 months, 6 months, 12 months, 1 hour, 2 hours (₹)
    ["badminton-court-1", [7_000, 19_500, 37_500, 72_000, 500, 900]],
    ["badminton-court-2", [6_000, 16_500, 31_500, 60_000, 400, 700]],
    ["pickleball-court-1", [5_500, 15_000, 27_500, 50_000, 400, 700]],
    ["pickleball-court-2", [5_500, 15_000, 27_500, 50_000, 400, 700]],
    ["basketball-court-1", [7_000, 19_500, 37_500, 72_000, 700, 1_300]],
  ];
  for (const [slug, prices] of table) {
    it(`${slug} has the exact published monthly and hourly prices`, () => {
      const c = COURTS.find((x) => x.slug === slug)!;
      expect([c.monthlyPrice1m, c.monthlyPrice3m, c.monthlyPrice6m, c.monthlyPrice12m, c.price1h, c.price2h].map((p) => rupees(p ?? null))).toEqual(prices);
    });
  }

  it("stores every amount as whole paise", () => {
    for (const card of Object.values(RATE_CARD)) for (const v of Object.values(card)) expect(Number.isInteger(v)).toBe(true);
  });

  it("states the pickleball paddle/ball note", () => {
    expect(SPORTS.find((s) => s.slug === "pickleball")!.tagline).toBe("Paddle included. Ball needs to be purchased separately.");
  });
});

describe("tariffRows", () => {
  const rows = tariffRows(catalogue);

  it("produces the rate card's four rows, in sport order", () => {
    expect(rows.map((r) => [r.sportName, r.courtLabel, r.surface])).toEqual([
      ["Badminton", "Court 1", "Green Mat (5 mm)"],
      ["Badminton", "Court 2", "Wooden Finish (2.5 mm)"],
      ["Pickleball", null, null],
      ["Basketball", null, null],
    ]);
  });

  it("groups both pickleball courts under one published tariff", () => {
    const pickleball = rows.find((r) => r.sportSlug === "pickleball")!;
    expect(pickleball.courts.map((c) => c.slug)).toEqual(["pickleball-court-1", "pickleball-court-2"]);
    expect([pickleball.price1h, pickleball.price2h]).toEqual([40_000, 70_000]);
    expect(MONTHLY_TERMS.map((t) => rupees(pickleball.monthly[t.key]))).toEqual([5_500, 15_000, 27_500, 50_000]);
  });

  it("splits a sport's row when an admin prices one court differently", () => {
    const edited = catalogue.map((c) => (c.slug === "pickleball-court-2" ? { ...c, price1h: 45_000 } : c));
    const pickle = tariffRows(edited).filter((r) => r.sportSlug === "pickleball");
    expect(pickle.map((r) => [r.courtLabel, r.price1h])).toEqual([
      ["Court 1", 40_000],
      ["Court 2", 45_000],
    ]);
  });

  it("leaves out inactive courts and marks maintenance courts as not bookable", () => {
    const changed = catalogue.map((c) =>
      c.slug === "basketball-court-1" ? { ...c, status: "INACTIVE" as const } : c.slug === "pickleball-court-2" ? { ...c, status: "MAINTENANCE" as const } : c,
    );
    const result = tariffRows(changed);
    expect(result.some((r) => r.sportSlug === "basketball")).toBe(false);
    expect(result.find((r) => r.sportSlug === "pickleball")!.courts.map((c) => c.bookable)).toEqual([true, false]);
  });

  it("knows when a row has monthly plans", () => {
    expect(rows.every(hasMonthlyPlans)).toBe(true);
    expect(hasMonthlyPlans({ monthly: { monthlyPrice1m: null, monthlyPrice3m: null, monthlyPrice6m: null, monthlyPrice12m: null } })).toBe(false);
  });
});

describe("labels", () => {
  it("shortens court names and adds the surface", () => {
    expect(shortCourtName("Badminton Court 1", "Badminton")).toBe("Court 1");
    expect(shortCourtName("Centre Court", "Badminton")).toBe("Centre Court");
    expect(courtDisplayName({ name: "Badminton Court 2", surface: "Wooden Finish (2.5 mm)" })).toBe("Badminton Court 2 – Wooden Finish (2.5 mm)");
    expect(courtDisplayName({ name: "Basketball Court 1", surface: null })).toBe("Basketball Court 1");
  });

  it("finds the lowest hourly price per sport", () => {
    expect(lowestHourlyBySport(catalogue)).toEqual({ badminton: 40_000, pickleball: 40_000, basketball: 70_000 });
  });
});
