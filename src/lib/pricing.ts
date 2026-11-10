/**
 * The public rate card, built from the courts' own prices so the website always shows what the
 * booking system charges. Pure and shared by the server (JSON-LD) and the client (pricing UI).
 *
 * Courts of a sport with identical prices and surface share one row — e.g. both pickleball
 * courts are one "Pickleball" row, as on the facility's rate card — while courts with their
 * own prices get their own row ("Badminton · Court 1 – Green Mat (5 mm)").
 */
import { SPORT_SLUGS } from "@/lib/booking/rules";

export const MONTHLY_TERMS = [
  { key: "monthlyPrice1m", months: 1, label: "1 Month" },
  { key: "monthlyPrice3m", months: 3, label: "3 Months" },
  { key: "monthlyPrice6m", months: 6, label: "6 Months" },
  { key: "monthlyPrice12m", months: 12, label: "12 Months" },
] as const;

export type MonthlyKey = (typeof MONTHLY_TERMS)[number]["key"];
export type MonthlyPrices = Record<MonthlyKey, number | null>;

export const HOURLY_TERMS = [
  { key: "price1h", minutes: 60, label: "1 Hour" },
  { key: "price2h", minutes: 120, label: "2 Hours" },
] as const;

export type RateCardCourt = {
  id: string;
  slug: string;
  name: string;
  surface: string | null;
  status: "ACTIVE" | "MAINTENANCE" | "INACTIVE";
  sport: { slug: string; name: string };
  price1h: number;
  price2h: number;
  monthly: MonthlyPrices;
};

export type TariffRow = {
  /** Stable key: sport slug plus the first court's slug. */
  key: string;
  sportSlug: string;
  sportName: string;
  /** "Court 1" when a sport's courts are priced differently, else null (the row is the sport). */
  courtLabel: string | null;
  surface: string | null;
  courts: { id: string; slug: string; name: string; bookable: boolean }[];
  price1h: number;
  price2h: number;
  monthly: MonthlyPrices;
};

/** "Badminton Court 1" → "Court 1" (drops the sport name the row already shows). */
export function shortCourtName(courtName: string, sportName: string): string {
  const trimmed = courtName.replace(new RegExp(`^${sportName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "").trim();
  return trimmed || courtName;
}

/** "Badminton Court 1 – Green Mat (5 mm)" style label for one court. */
export function courtDisplayName(court: { name: string; surface: string | null }): string {
  return court.surface ? `${court.name} – ${court.surface}` : court.name;
}

function signature(c: RateCardCourt) {
  return JSON.stringify([c.price1h, c.price2h, c.monthly.monthlyPrice1m, c.monthly.monthlyPrice3m, c.monthly.monthlyPrice6m, c.monthly.monthlyPrice12m, c.surface ?? ""]);
}

function sportRank(slug: string) {
  const i = (SPORT_SLUGS as readonly string[]).indexOf(slug);
  return i === -1 ? SPORT_SLUGS.length : i;
}

/** Rate-card rows for the courts shown on the website (inactive courts are left out). */
export function tariffRows(courts: RateCardCourt[]): TariffRow[] {
  const visible = courts.filter((c) => c.status !== "INACTIVE");
  const sports = [...new Set(visible.map((c) => c.sport.slug))].sort((a, b) => sportRank(a) - sportRank(b));
  const rows: TariffRow[] = [];
  for (const sportSlug of sports) {
    const list = visible.filter((c) => c.sport.slug === sportSlug);
    const groups = new Map<string, RateCardCourt[]>();
    for (const c of list) groups.set(signature(c), [...(groups.get(signature(c)) ?? []), c]);
    const split = groups.size > 1;
    for (const group of groups.values()) {
      const first = group[0]!;
      rows.push({
        key: `${sportSlug}:${first.slug}`,
        sportSlug,
        sportName: first.sport.name,
        courtLabel: split ? group.map((c) => shortCourtName(c.name, c.sport.name)).join(" & ") : null,
        surface: first.surface,
        courts: group.map((c) => ({ id: c.id, slug: c.slug, name: c.name, bookable: c.status === "ACTIVE" })),
        price1h: first.price1h,
        price2h: first.price2h,
        monthly: { ...first.monthly },
      });
    }
  }
  return rows;
}

/** Lowest one-hour price per sport, for "from ₹… / hour" labels. */
export function lowestHourlyBySport(courts: Pick<RateCardCourt, "status" | "sport" | "price1h">[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of courts) {
    if (c.status === "INACTIVE") continue;
    out[c.sport.slug] = Math.min(out[c.sport.slug] ?? Number.POSITIVE_INFINITY, c.price1h);
  }
  return out;
}

/** True when at least one monthly plan price is set on the row. */
export function hasMonthlyPlans(row: Pick<TariffRow, "monthly">): boolean {
  return MONTHLY_TERMS.some((t) => row.monthly[t.key] !== null);
}
