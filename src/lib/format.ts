import { WEEKDAYS_SHORT, parseISODate } from "./time";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Indian digit grouping (12,34,567) without Intl, so server and browser output always match. */
function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

/** Formats minor units (paise) as rupees: 40000 → "₹400", 123450 → "₹1,234.50". */
export function formatMoney(minor: number, opts: { precise?: boolean } = {}): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minor));
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  const frac = opts.precise || paise ? `.${String(paise).padStart(2, "0")}` : "";
  return `${sign}₹${groupIndian(rupees)}${frac}`;
}

/** 1050 → "5:30 PM" */
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** 1050, 1110 → "5:30 – 6:30 PM" */
export function formatTimeRange(start: number, end: number): string {
  const a = formatMinutes(start);
  const b = formatMinutes(end);
  const [aTime, aSuffix] = a.split(" ");
  const [, bSuffix] = b.split(" ");
  return aSuffix === bSuffix ? `${aTime} – ${b}` : `${a} – ${b}`;
}

/** 1050 → "17:30" (compact 24h label for grids) */
export function formatMinutes24(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 540 → "9 AM", 1050 → "5:30 PM" (compact, for chips and axes). */
export function formatHour(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h24 >= 12 ? "PM" : "AM"}`;
}

/** Pieces of an ISO date for date pickers: { weekday: "Tue", day: 15, month: "Oct" }. */
export function dateParts(iso: string) {
  const d = parseISODate(iso);
  return { weekday: WEEKDAYS_SHORT[d.getUTCDay()]!, day: d.getUTCDate(), month: MONTHS_SHORT[d.getUTCMonth()]! };
}

type DateStyle = "short" | "medium" | "long" | "weekday" | "dayMonth";

/** Formats an ISO calendar date (YYYY-MM-DD) deterministically (no locale data, no timezone drift). */
export function formatDate(iso: string | null | undefined, style: DateStyle = "medium"): string {
  if (!iso) return "—";
  const d = parseISODate(iso.slice(0, 10));
  const day = d.getUTCDate();
  const m = d.getUTCMonth();
  const y = d.getUTCFullYear();
  const wd = d.getUTCDay();
  switch (style) {
    case "short":
    case "dayMonth":
      return `${day} ${MONTHS_SHORT[m]}`;
    case "long":
      return `${WEEKDAYS_FULL[wd]}, ${day} ${MONTHS_LONG[m]} ${y}`;
    case "weekday":
      return `${WEEKDAYS_SHORT[wd]}, ${day} ${MONTHS_SHORT[m]}`;
    default:
      return `${day} ${MONTHS_SHORT[m]} ${y}`;
  }
}

/** Formats an instant in the academy timezone. */
export function formatDateTime(value: Date | string | null | undefined, tz = "Asia/Kolkata"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} hour${h > 1 ? "s" : ""}`;
}
