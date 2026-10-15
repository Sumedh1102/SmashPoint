import type { StaticImageData } from "next/image";
import badminton1 from "@/assets/images/court-badminton-court-1.webp";
import badminton2 from "@/assets/images/court-badminton-court-2.webp";
import pickleball1 from "@/assets/images/court-pickleball-court-1.webp";
import pickleball2 from "@/assets/images/court-pickleball-court-2.webp";
import basketball1 from "@/assets/images/court-basketball-court-1.webp";

const BY_SLUG: Record<string, StaticImageData> = {
  "badminton-court-1": badminton1,
  "badminton-court-2": badminton2,
  "pickleball-court-1": pickleball1,
  "pickleball-court-2": pickleball2,
  "basketball-court-1": basketball1,
};

const BY_SPORT: Record<string, StaticImageData> = { badminton: badminton1, pickleball: pickleball1, basketball: basketball1 };

export function courtImage(courtSlug: string, sportSlug: string): StaticImageData {
  return BY_SLUG[courtSlug] ?? BY_SPORT[sportSlug] ?? badminton1;
}

const ALT_BY_SLUG: Record<string, string> = {
  "badminton-court-1": "a low view along an indoor badminton court towards the net, with a racket and shuttlecocks on the green court",
  "badminton-court-2": "a side view of indoor badminton courts with nets and white court lines",
  "pickleball-court-1": "a low view across a blue indoor pickleball court towards the net, with a paddle and pickleballs",
  "pickleball-court-2": "an elevated view of indoor pickleball courts with nets and kitchen lines",
  "basketball-court-1": "an indoor basketball court with a hardwood floor, painted key, hoop and a basketball",
};

/** Illustrative 3D renders, described for screen readers. */
export function courtImageAlt(courtName: string, courtSlug: string, sportSlug: string) {
  const what = ALT_BY_SLUG[courtSlug] ?? `an indoor ${sportSlug} court`;
  return `${courtName} (illustration): ${what}, under arena lights`;
}
