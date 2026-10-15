/**
 * The facility's courts: exactly two badminton, two pickleball and one basketball court.
 * Used by the production first-run setup and the demo seed. Prices and descriptions can be
 * changed later from /admin/courts; slugs are stable identifiers (keep them).
 */
import type { courts, sports } from "../../src/server/db/schema";

const rupees = (n: number) => n * 100;

export const SPORTS: (typeof sports.$inferInsert)[] = [
  {
    slug: "badminton",
    name: "Badminton",
    sortOrder: 1,
    tagline: "Two indoor badminton courts.",
    description: "Open for booking 7 AM – 5 PM and 7 PM – 10 PM; academy sessions use both courts from 5 to 7 PM.",
  },
  {
    slug: "pickleball",
    name: "Pickleball",
    sortOrder: 2,
    tagline: "Two indoor pickleball courts.",
    description: "Bookable from 7 AM to 10 PM for singles or doubles.",
  },
  {
    slug: "basketball",
    name: "Basketball",
    sortOrder: 3,
    tagline: "One indoor basketball court.",
    description: "Bookable from 7 AM to 10 PM for pickup games and practice.",
  },
];

/** Courts reference their sport by slug; setup resolves it to the sport id. */
export const COURTS: (Omit<typeof courts.$inferInsert, "sportId"> & { sport: string })[] = [
  { sport: "badminton", slug: "badminton-court-1", name: "Badminton Court 1", sortOrder: 1, description: "Indoor badminton court for singles and doubles.", hourlyRate: rupees(500), peakHourlyRate: rupees(700) },
  { sport: "badminton", slug: "badminton-court-2", name: "Badminton Court 2", sortOrder: 2, description: "Indoor badminton court for singles and doubles.", hourlyRate: rupees(500), peakHourlyRate: rupees(700) },
  { sport: "pickleball", slug: "pickleball-court-1", name: "Pickleball Court 1", sortOrder: 3, description: "Indoor pickleball court for singles and doubles.", hourlyRate: rupees(600), peakHourlyRate: rupees(800) },
  { sport: "pickleball", slug: "pickleball-court-2", name: "Pickleball Court 2", sortOrder: 4, description: "Indoor pickleball court for singles and doubles.", hourlyRate: rupees(600), peakHourlyRate: rupees(800) },
  { sport: "basketball", slug: "basketball-court-1", name: "Basketball Court 1", sortOrder: 5, description: "Indoor basketball court for games and practice.", hourlyRate: rupees(1500), peakHourlyRate: rupees(2000) },
];
