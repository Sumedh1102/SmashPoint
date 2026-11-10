import { ArrowRight, CalendarRange, LayoutGrid, Layers, ShieldCheck } from "lucide-react";
import Image from "next/image";
import facilityHall from "@/assets/images/facility-hall.webp";
import { buttonClass } from "@/components/ui/button";
import { site } from "@/content/site";
import { enquiryHref } from "./rental-pricing";

/** Only what the rate card states or the booking system does — no invented amenities. */
const HIGHLIGHTS = [
  { icon: LayoutGrid, title: "Three sports, one academy", body: "Badminton, pickleball and basketball courts in one place — bring the whole group." },
  { icon: Layers, title: "Two badminton surfaces", body: "Play on a 5 mm green mat on Court 1 or a 2.5 mm wooden finish on Court 2." },
  { icon: CalendarRange, title: "Hourly or monthly", body: "Book one or two hours online, or take a 1, 3, 6 or 12-month plan (Monday to Saturday)." },
  { icon: ShieldCheck, title: "Live, secure booking", body: "See which slots are free right now and pay with Razorpay. Your court is confirmed once the payment is verified." },
];

/**
 * About the academy, what sets it apart, and its coaching — as stated on the rate card: "All our
 * coaches are state certified and highly experienced in training players for states and
 * nationals." No coach names, certificates or results are shown; none have been provided.
 */
export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="relative isolate scroll-mt-16 overflow-hidden bg-ink py-24 text-white sm:py-28">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image src={facilityHall} alt="" fill sizes="100vw" quality={70} placeholder="blur" className="object-cover opacity-50" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--color-ink)_0%,rgb(8_8_8/0.55)_35%,rgb(8_8_8/0.8)_70%,var(--color-ink)_100%)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow text-neon">About us</p>
            <h2 id="about-title" className="display mt-4 text-[clamp(2.75rem,6.5vw,5rem)]">
              Three sports.
              <br />
              One academy.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-relaxed text-white/80 sm:text-lg lg:justify-self-end">
            {site.name} brings badminton, pickleball and basketball together in one place. Rent a court by the hour for a game with friends, take a monthly plan for
            regular play, or train with our coaches.
          </p>
        </div>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-ink p-6 sm:p-7">
              <Icon aria-hidden className="size-6 text-neon" strokeWidth={1.75} />
              <h3 className="display mt-6 text-[1.55rem]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </li>
          ))}
        </ul>

        <div
          id="coaching"
          className="mt-6 flex scroll-mt-24 flex-col gap-4 rounded-[var(--radius-card)] border border-neon/30 bg-neon/[0.05] px-5 py-5 sm:px-6 md:flex-row md:items-center md:gap-6"
        >
          <h3 className="eyebrow shrink-0 text-neon">Coaching</h3>
          <p className="flex-1 leading-relaxed text-white/85">
            All our coaches are state certified and highly experienced in training players for state and national competitions.
          </p>
          <a href={enquiryHref("Coaching enquiry")} className={buttonClass({ variant: "light", size: "md" }, "shrink-0 self-start md:self-auto")}>
            Enquire about coaching <ArrowRight aria-hidden className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
