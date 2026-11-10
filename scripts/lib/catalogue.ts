/**
 * The facility's sports and courts, with the published rental prices of On The Sol Sports
 * Academy's rate card ("Court Rental Detail Sheet"). Used by the production first-run setup,
 * the catalogue upgrade and the demo seed. Prices and descriptions can be changed later from
 * /admin/courts; slugs are stable identifiers (keep them).
 *
 * Rate card (₹)                         1 Month  3 Months  6 Months  12 Months  1 Hour  2 Hours
 *   Badminton Court 1 – Green Mat 5 mm     7,000    19,500    37,500     72,000     500      900
 *   Badminton Court 2 – Wooden 2.5 mm      6,000    16,500    31,500     60,000     400      700
 *   Pickleball (paddle included)           5,500    15,000    27,500     50,000     400      700
 *   Basketball                             7,000    19,500    37,500     72,000     700    1,300
 * Monthly rentals are valid Monday to Saturday. Two-hour prices are package prices. No peak
 * surcharge. The rate card has one pickleball row; it applies to both pickleball courts.
 *
 * CLIENT TO CONFIRM before publishing marketing claims: the number of pickleball courts (the
 * booking system has two; the rate card doesn't say).
 */
import type { courts, sports } from "../../src/server/db/schema";

const rupees = (n: number) => n * 100;

/**
 * Bump when the catalogue's prices or copy change: `ensureCatalogue` then applies the new
 * values to existing databases once (matched by slug), and later admin edits are kept.
 *   1 — original demo catalogue (hourly + peak rates)
 *   2 — On The Sol rate card: exact 1 h / 2 h prices, monthly plans, badminton surfaces
 */
export const CATALOGUE_REVISION = 2;

export const SPORTS: (typeof sports.$inferInsert)[] = [
  {
    slug: "badminton",
    name: "Badminton",
    sortOrder: 1,
    tagline: "Court 1 – Green Mat (5 mm) · Court 2 – Wooden Finish (2.5 mm)",
    description: "Badminton court rental by the hour or on a monthly plan.",
  },
  {
    slug: "pickleball",
    name: "Pickleball",
    sortOrder: 2,
    tagline: "Paddle included. Ball needs to be purchased separately.",
    description: "Pickleball court rental by the hour or on a monthly plan.",
  },
  {
    slug: "basketball",
    name: "Basketball",
    sortOrder: 3,
    tagline: "Dedicated basketball court.",
    description: "Basketball court rental by the hour or on a monthly plan.",
  },
];

type Rates = Pick<typeof courts.$inferInsert, "price1h" | "price2h" | "monthlyPrice1m" | "monthlyPrice3m" | "monthlyPrice6m" | "monthlyPrice12m">;

const rates = (hour1: number, hours2: number, m1: number, m3: number, m6: number, m12: number): Rates => ({
  price1h: rupees(hour1),
  price2h: rupees(hours2),
  monthlyPrice1m: rupees(m1),
  monthlyPrice3m: rupees(m3),
  monthlyPrice6m: rupees(m6),
  monthlyPrice12m: rupees(m12),
});

/** The rate card's rows. */
export const RATE_CARD = {
  badmintonCourt1: rates(500, 900, 7_000, 19_500, 37_500, 72_000),
  badmintonCourt2: rates(400, 700, 6_000, 16_500, 31_500, 60_000),
  pickleball: rates(400, 700, 5_500, 15_000, 27_500, 50_000),
  basketball: rates(700, 1_300, 7_000, 19_500, 37_500, 72_000),
} as const;

/** Courts reference their sport by slug; setup resolves it to the sport id. */
export const COURTS: (Omit<typeof courts.$inferInsert, "sportId"> & { sport: string })[] = [
  {
    sport: "badminton",
    slug: "badminton-court-1",
    name: "Badminton Court 1",
    sortOrder: 1,
    surface: "Green Mat (5 mm)",
    description: "Badminton court with a 5 mm green mat surface.",
    ...RATE_CARD.badmintonCourt1,
  },
  {
    sport: "badminton",
    slug: "badminton-court-2",
    name: "Badminton Court 2",
    sortOrder: 2,
    surface: "Wooden Finish (2.5 mm)",
    description: "Badminton court with a 2.5 mm wooden finish.",
    ...RATE_CARD.badmintonCourt2,
  },
  {
    sport: "pickleball",
    slug: "pickleball-court-1",
    name: "Pickleball Court 1",
    sortOrder: 3,
    surface: null,
    description: "Pickleball court. Paddle included; the ball needs to be purchased separately.",
    ...RATE_CARD.pickleball,
  },
  {
    sport: "pickleball",
    slug: "pickleball-court-2",
    name: "Pickleball Court 2",
    sortOrder: 4,
    surface: null,
    description: "Pickleball court. Paddle included; the ball needs to be purchased separately.",
    ...RATE_CARD.pickleball,
  },
  {
    sport: "basketball",
    slug: "basketball-court-1",
    name: "Basketball Court 1",
    sortOrder: 5,
    surface: null,
    description: "Dedicated basketball court for games and practice.",
    ...RATE_CARD.basketball,
  },
];
