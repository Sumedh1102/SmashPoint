/**
 * Facility details shown on the website, in emails and on Razorpay Checkout.
 *
 * EDIT ME: values in [square brackets] are placeholders. The project didn't contain verified
 * contact details, so none have been made up — replace each placeholder with the facility's
 * real information. Until then, placeholders are shown as-is (and never turned into phone or
 * email links) so they are easy to spot.
 *
 * Opening hours, durations and the badminton academy closure are booking rules
 * (src/lib/booking/rules.ts); court names, descriptions and prices live in the database and
 * are managed from /admin.
 */

export const site = {
  name: "SmashPoint",
  /** Shown under the wordmark and in page titles. */
  descriptor: "Badminton · Pickleball · Basketball",
  description:
    "Book premium indoor badminton, pickleball and basketball courts at SmashPoint. Choose your sport, see live availability and pay securely with Razorpay.",
  url: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, ""),
  /** Registered business name used in the legal pages. */
  legalName: "[Registered business name]",
  contact: {
    phone: "[Facility phone number]",
    email: "[Facility email address]",
    addressLines: ["[Street address]", "[City, State, PIN code]"],
    /** Google Maps search text for the "Get directions" link; leave as a placeholder to hide it. */
    mapQuery: "[Map search text, e.g. facility name and city]",
  },
  hours: "Every day · 7:00 AM – 10:00 PM",
} as const;

/** True for a value that still holds its [placeholder] text. */
export function isPlaceholder(value: string | null | undefined): boolean {
  return !value || /^\[.*\]$/.test(value.trim());
}

export function telHref(phone: string) {
  return isPlaceholder(phone) ? null : `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function mailHref(email: string) {
  return isPlaceholder(email) ? null : `mailto:${email}`;
}

export function mapHref(query: string) {
  return isPlaceholder(query) ? null : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
