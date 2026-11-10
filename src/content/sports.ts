/**
 * How each sport is presented on the website. Copy is limited to what the academy's rate card
 * states (surfaces, paddle/ball note, monthly plans Monday–Saturday) and what the booking
 * system does; court names, surfaces and prices come from the database (/admin/courts).
 * Images are illustrative 3D renders.
 */
import type { StaticImageData } from "next/image";
import badmintonImage from "@/assets/images/court-badminton-court-1.webp";
import basketballImage from "@/assets/images/court-basketball-court-1.webp";
import pickleballImage from "@/assets/images/court-pickleball-court-1.webp";

export type SportContent = {
  slug: "badminton" | "pickleball" | "basketball";
  name: string;
  /** One-line hook for cards. */
  headline: string;
  summary: string;
  /** Fixed details (court surfaces are added from the database; the notice is shown separately). */
  highlights: string[];
  /** A notice customers must see before booking, from the rate card. */
  notice: string | null;
  image: StaticImageData;
  imageAlt: string;
  /** CSS object-position that keeps the equipment in frame in portrait crops. */
  focus: string;
};

export const PICKLEBALL_NOTICE = "Paddle included. Ball needs to be purchased separately.";

export const SPORTS_CONTENT: readonly SportContent[] = [
  {
    slug: "badminton",
    name: "Badminton",
    headline: "Two surfaces. Your choice.",
    summary: "Pick the court that suits your game: a 5 mm green mat on Court 1 or a 2.5 mm wooden finish on Court 2. Book by the hour or take a monthly plan.",
    highlights: [],
    notice: null,
    image: badmintonImage,
    imageAlt: "Illustration of a badminton court with a racket and shuttlecocks on the court",
    focus: "30% 50%",
  },
  {
    slug: "pickleball",
    name: "Pickleball",
    headline: "Grab a paddle and play.",
    summary: "Paddles are included with your court rental, so you can turn up and play. Book an hour, two hours, or a monthly plan.",
    highlights: [],
    notice: PICKLEBALL_NOTICE,
    image: pickleballImage,
    imageAlt: "Illustration of a pickleball court with a paddle and pickleballs in front of the net",
    focus: "64% 50%",
  },
  {
    slug: "basketball",
    name: "Basketball",
    headline: "Run your game.",
    summary: "A dedicated basketball court for shooting practice, pickup games and team sessions. Book by the hour or take a monthly plan.",
    highlights: ["Dedicated basketball court"],
    notice: null,
    image: basketballImage,
    imageAlt: "Illustration of a basketball court with a hoop and a basketball on the floor",
    focus: "46% 50%",
  },
];

export function sportContent(slug: string): SportContent | undefined {
  return SPORTS_CONTENT.find((s) => s.slug === slug);
}
