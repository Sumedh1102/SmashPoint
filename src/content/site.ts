/**
 * Facility details shown on the website, in emails, on Razorpay Checkout and in calendar files.
 *
 * Phone numbers, address and opening hours are the academy's own. Values in [square brackets]
 * are still placeholders (the email address): replace them with the real information. Until
 * then they are shown as-is (and never turned into email or map links) so they are easy to spot.
 *
 * Prices are not here: each court's rate card (1 h, 2 h, monthly plans) lives in the database
 * and is managed from /admin/courts. Online booking hours are a booking setting (also in
 * /admin/courts); `openingHours` below is the facility's published opening-hours text.
 */

export const site = {
  name: "On The Sol Sports Academy",
  /** The two lines of the logo lockup. */
  brand: { primary: "On The Sol", secondary: "Sports Academy" },
  /** The motto on the academy's logo. */
  motto: "Sol To Success!",
  /** Shown under the wordmark and in page titles. */
  descriptor: "Badminton · Pickleball · Basketball",
  description:
    "Badminton, pickleball and basketball court rentals at On The Sol Sports Academy. Book a court by the hour online with live availability and secure Razorpay checkout, or ask about monthly rental plans.",
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  /** Registered business name used in the legal pages. */
  legalName: "[Registered business name]",
  contact: {
    /** Both numbers are shown and dialable; the first is the primary one (structured data, enquiry links). */
    phones: ["+91 70218 35019", "+91 80076 55554"],
    phone: "+91 70218 35019",
    email: "[Academy email address]",
    addressLines: ["Ram Wadi, behind Bharat Petrol Pump", "Patel Pada, Dahanu, Maharashtra 401602"],
    /** Google Maps search text for the "Get directions" link; leave as a placeholder to hide it. */
    mapQuery: "Ram Wadi, behind Bharat Petrol Pump, Patel Pada, Dahanu, Maharashtra 401602, India",
  },
  /**
   * The facility's opening hours. (The online booking window is separate: a booking setting,
   * 7 AM – 10 PM by default, shown on the site as "online booking hours" — set it in
   * /admin/courts to match.) `days` uses schema.org day names for the structured data.
   */
  openingHours: [
    { label: "Mon – Tue, Thu – Sat", days: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"], opens: "06:00", closes: "23:30", text: "6:00 AM – 11:30 PM" },
    { label: "Wednesday", days: ["Wednesday"], opens: "06:00", closes: "23:00", text: "6:00 AM – 11:00 PM" },
    { label: "Sunday", days: ["Sunday"], opens: "10:00", closes: "23:30", text: "10:00 AM – 11:30 PM" },
  ],
} as const;

/** True for a value that still holds its [placeholder] text. */
export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || /^\[.*\]$/.test(value.trim());
}

export function telHref(phone: string) {
  return isPlaceholder(phone) ? null : `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function mailHref(email: string, subject?: string) {
  if (isPlaceholder(email)) return null;
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}

export function mapHref(query: string) {
  return isPlaceholder(query) ? null : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
