/**
 * Facility details shown on the website, in emails, on Razorpay Checkout and in calendar files.
 *
 * EDIT ME: values in [square brackets] are placeholders. The rate card the site is based on
 * has no contact details, address or opening hours, so none have been made up — replace each
 * placeholder with the academy's real information. Until then, placeholders are shown as-is
 * (and never turned into phone, email or map links) so they are easy to spot.
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
    phone: "[Academy phone number]",
    email: "[Academy email address]",
    addressLines: ["[Street address]", "[City, State, PIN code]"],
    /** Google Maps search text for the "Get directions" link; leave as a placeholder to hide it. */
    mapQuery: "[Map search text, e.g. academy name and city]",
  },
  /**
   * The facility's opening hours as the academy publishes them. CLIENT TO CONFIRM: not on the
   * rate card. (The online booking window is separate: a booking setting, 7 AM – 10 PM by
   * default, shown on the site as "online booking hours".)
   */
  openingHours: "[Opening hours — to be confirmed]",
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
