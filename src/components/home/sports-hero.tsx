import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookLink } from "@/components/booking/selection-context";
import { SportIcon } from "@/components/booking/sport-icon";
import { buttonClass } from "@/components/ui/button";
import { SPORTS_CONTENT } from "@/content/sports";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PROOF = ["State-certified coaches", "Hourly & monthly court rentals", "Secure online booking"];

/**
 * First impression: the three sports side by side with equal weight — badminton (racket and
 * shuttles), pickleball (paddle and balls) and basketball (hoop and ball) — next to the
 * headline. Each panel books that sport.
 */
export function SportsHero({ fromPrices }: { fromPrices: Record<string, number> }) {
  return (
    <section id="top" aria-labelledby="hero-title" className="surface-dark relative isolate overflow-hidden bg-ink text-white">
      <div aria-hidden className="court-lines absolute inset-0 -z-10 [mask-image:linear-gradient(180deg,black,transparent_85%)]" />
      <div aria-hidden className="absolute -top-40 right-[-10%] -z-10 size-[42rem] rounded-full bg-royal/25 blur-[120px]" />
      <div aria-hidden className="absolute bottom-[-12rem] left-[-8rem] -z-10 size-[28rem] rounded-full bg-gold/10 blur-[110px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-28 pb-14 sm:px-6 sm:pt-32 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:pt-36 lg:pb-24">
        <div>
          <p className="eyebrow inline-flex animate-rise items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1.5 pr-4 pl-2 text-[0.68rem] text-white/85" style={{ animationDelay: "60ms" }}>
            <span className="grid size-5 place-items-center rounded-full bg-gold text-[0.6rem] text-ink">★</span>
            On The Sol Sports Academy
          </p>
          <h1 id="hero-title" className="display mt-6 text-[clamp(2.75rem,7.4vw,5.6rem)] leading-[0.92]">
            <span className="block animate-rise" style={{ animationDelay: "140ms" }}>
              One destination.
            </span>
            <span className="block animate-rise text-gold" style={{ animationDelay: "220ms" }}>
              Three ways to play.
            </span>
          </h1>
          <p className="mt-6 max-w-xl animate-rise text-base leading-relaxed text-white/80 sm:text-lg" style={{ animationDelay: "300ms" }}>
            Experience badminton, pickleball and basketball at On The Sol Sports Academy. Find your sport, reserve your court and take your game to the next level.
          </p>
          <div className="mt-8 flex animate-rise flex-col gap-3 sm:flex-row" style={{ animationDelay: "380ms" }}>
            <Link href="#book" className={buttonClass({ variant: "primary", size: "lg" }, "uppercase tracking-wide")}>
              Book a court <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link href="#sports" className={buttonClass({ variant: "ghostLight", size: "lg" }, "uppercase tracking-wide")}>
              Explore our sports
            </Link>
          </div>
          <ul className="mt-9 flex animate-rise flex-wrap gap-x-5 gap-y-2 text-sm text-white/70" style={{ animationDelay: "460ms" }}>
            {PROOF.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-gold" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Three sports, equal weight. */}
        <ul aria-label="Our sports" className="grid animate-rise grid-cols-3 gap-2.5 sm:gap-4 lg:pb-8" style={{ animationDelay: "240ms" }}>
          {SPORTS_CONTENT.map((sport, i) => (
            <li key={sport.slug} className={cn(i === 1 && "lg:translate-y-8")}>
              <BookLink
                sport={sport.slug}
                aria-label={`Book ${sport.name}${fromPrices[sport.slug] ? ` — from ${formatMoney(fromPrices[sport.slug]!)} an hour` : ""}`}
                className="group relative flex aspect-[3/4.4] flex-col justify-between overflow-hidden rounded-2xl bg-ink-2 ring-1 ring-white/10 transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.7)] hover:ring-gold/60 sm:rounded-3xl lg:aspect-[3/5]"
              >
                <Image
                  src={sport.image}
                  alt={sport.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 15vw, 32vw"
                  quality={75}
                  preload={i === 0}
                  placeholder="blur"
                  style={{ objectPosition: sport.focus }}
                  className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
                />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgb(7_27_58/0.85)_0%,rgb(7_27_58/0.35)_38%,rgb(7_27_58/0)_55%,rgb(7_27_58/0)_80%,rgb(7_27_58/0.55)_100%)]" />
                <span className="relative p-2.5 sm:p-4">
                  <span className="grid size-8 place-items-center rounded-full bg-gold text-ink sm:size-10">
                    <SportIcon sport={sport.slug} className="size-5 sm:size-6" />
                  </span>
                  <span className="display mt-2 block text-[0.98rem] leading-none sm:mt-3 sm:text-[1.5rem]">{sport.name}</span>
                  {fromPrices[sport.slug] ? (
                    <span className="mt-1 block text-[0.68rem] text-white/75 sm:text-xs">
                      From <span className="font-semibold text-white">{formatMoney(fromPrices[sport.slug]!)}</span>/hr
                    </span>
                  ) : null}
                </span>
                <span className="relative m-2.5 hidden items-center gap-1 self-start rounded-full bg-ink/80 px-3 py-1.5 text-xs font-semibold text-gold backdrop-blur sm:m-4 sm:inline-flex">
                  Book now <ArrowUpRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </BookLink>
            </li>
          ))}
        </ul>
      </div>
      <p className="sr-only">Images are illustrative renders.</p>
    </section>
  );
}
