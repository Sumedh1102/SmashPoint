import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getImageProps } from "next/image";
import Link from "next/link";
import heroCourt from "@/assets/images/hero-court.webp";
import heroCourtPortrait from "@/assets/images/hero-court-portrait.webp";
import { BookLink } from "@/components/booking/selection-context";
import { buttonClass } from "@/components/ui/button";
import { site } from "@/content/site";
import { SPORTS_CONTENT } from "@/content/sports";
import { describeHours, type BookingHours } from "@/lib/booking/rules";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Art-directed backdrop: the wide hall on desktop, a portrait crop on phones. */
function Backdrop() {
  const common = { alt: "", sizes: "100vw", quality: 75 } as const;
  const { props: wide } = getImageProps({ ...common, src: heroCourt });
  const { props: tall } = getImageProps({ ...common, src: heroCourtPortrait });
  return (
    <picture>
      <source media="(min-width: 768px)" srcSet={wide.srcSet} sizes="100vw" />
      <img {...tall} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover object-[60%_center] md:object-center" />
    </picture>
  );
}

/**
 * First impression: the facility, the headline, and the three sports side by side with equal
 * weight along the bottom — each one books that sport.
 */
export function SportsHero({ fromPrices, hours }: { fromPrices: Record<string, number>; hours: BookingHours }) {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-white">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Backdrop />
        {/* Legibility: darken behind the type and fade into the next section. */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_8_8/0.94)_0%,rgb(8_8_8/0.78)_38%,rgb(8_8_8/0.3)_72%,rgb(8_8_8/0.45)_100%)] max-md:bg-[linear-gradient(180deg,rgb(8_8_8/0.62)_0%,rgb(8_8_8/0.4)_30%,rgb(8_8_8/0.92)_62%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pt-28 pb-10 sm:px-6 sm:pb-14 lg:px-8 lg:pb-16">
        <p className="eyebrow text-neon">Badminton · Pickleball · Basketball</p>
        <h1 id="hero-title" className="display mt-5 text-[clamp(3.6rem,13vw,10.5rem)] leading-[0.84]">
          <span className="block">Your game.</span>
          <span className="block text-neon">Your court.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
          Rent a badminton, pickleball or basketball court at {site.name}. Check live availability, book one or two hours and pay online — or take a monthly plan.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="#book" className={buttonClass({ variant: "primary", size: "lg" }, "uppercase tracking-wide")}>
            Book a court <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link href="#pricing" className={buttonClass({ variant: "ghostLight", size: "lg" }, "uppercase tracking-wide")}>
            View rates
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-3 border-t border-white/15 sm:mt-14 sm:grid-cols-4">
          <ul aria-label="Our sports" className="col-span-3 grid grid-cols-3">
            {SPORTS_CONTENT.map((sport, i) => {
              const from = fromPrices[sport.slug];
              return (
                <li key={sport.slug} className={cn(i > 0 && "border-l border-white/15")}>
                  <BookLink
                    sport={sport.slug}
                    aria-label={`Book ${sport.name}${from ? ` — from ${formatMoney(from)} an hour` : ""}`}
                    className={cn("group block pt-4 pr-1 pb-1 sm:pt-6 sm:pr-4", i > 0 && "pl-2.5 sm:pl-6")}
                  >
                    <span className="display block text-[clamp(1.05rem,5.2vw,1.5rem)] leading-none transition-colors group-hover:text-neon sm:text-[1.25rem] md:text-[1.55rem] lg:text-[2.1rem] xl:text-[2.6rem]">{sport.name}</span>
                    <span className="eyebrow mt-2 flex items-center gap-1 text-[0.56rem] tracking-[0.08em] whitespace-nowrap text-ink-muted sm:text-[0.68rem] sm:tracking-[0.18em]">
                      {from ? `From ${formatMoney(from)}/hr` : "Book now"}
                      <ArrowUpRight aria-hidden className="size-3.5 shrink-0 max-sm:hidden transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon" />
                    </span>
                  </BookLink>
                </li>
              );
            })}
          </ul>
          <div className="col-span-3 mt-4 border-t border-white/15 pt-4 sm:col-span-1 sm:mt-0 sm:border-t-0 sm:border-l sm:pt-6 sm:pl-6">
            <p className="flex items-center gap-2.5 text-sm text-ink-muted sm:hidden">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-neon" />
              Live availability · {describeHours(hours)}
            </p>
            <p className="max-sm:hidden">
              <span className="display block text-[1.25rem] leading-none md:text-[1.55rem] lg:text-[2.1rem] xl:text-[2.6rem]">Live</span>
              <span className="eyebrow mt-2 block text-[0.68rem] text-ink-muted">Availability · {describeHours(hours)}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
