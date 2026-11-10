import { ArrowRight, Check, Info } from "lucide-react";
import Image from "next/image";
import { BookLink } from "@/components/booking/selection-context";
import { SportIcon } from "@/components/booking/sport-icon";
import { buttonClass } from "@/components/ui/button";
import { SPORTS_CONTENT } from "@/content/sports";
import { formatMoney } from "@/lib/format";
import { shortCourtName } from "@/lib/pricing";
import type { PublicCourt } from "@/server/queries/public";
import { SectionHeading } from "./section-heading";

/** Lowest one-hour and two-hour prices among a sport's courts. */
function fromPrices(courts: PublicCourt[]) {
  if (!courts.length) return null;
  return { h1: Math.min(...courts.map((c) => c.price1h)), h2: Math.min(...courts.map((c) => c.price2h)) };
}

export function SportsOverview({ courts }: { courts: PublicCourt[] }) {
  return (
    <section id="sports" aria-labelledby="sports-title" className="scroll-mt-16 bg-paper py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="sports-title"
          eyebrow="Our sports"
          title={
            <>
              Find your <span className="text-royal">sport.</span>
            </>
          }
          intro="Badminton, pickleball and basketball — each with its own courts, hourly bookings and monthly rental plans."
        />

        <ul className="mt-12 grid gap-6 md:grid-cols-3 lg:gap-7">
          {SPORTS_CONTENT.map((sport, i) => {
            const list = courts.filter((c) => c.sport.slug === sport.slug);
            const prices = fromPrices(list);
            const surfaces = list.filter((c) => c.surface).map((c) => `${shortCourtName(c.name, c.sport.name)} – ${c.surface}`);
            const bullets = [...surfaces, ...sport.highlights];
            return (
              <li
                key={sport.slug}
                id={`sport-${sport.slug}`}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${i * 90}ms` }}
                className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm transition-[box-shadow,transform,border-color] duration-500 ease-out hover:-translate-y-1 hover:border-royal/30 hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-ink">
                  <Image
                    src={sport.image}
                    alt={sport.imageAlt}
                    fill
                    sizes="(min-width: 768px) 32vw, 100vw"
                    placeholder="blur"
                    style={{ objectPosition: sport.focus }}
                    className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.05]"
                  />
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
                  <span className="absolute bottom-4 left-4 flex items-center gap-2.5">
                    <span className="grid size-11 place-items-center rounded-full bg-gold text-ink shadow-md">
                      <SportIcon sport={sport.slug} className="size-6" />
                    </span>
                    <h3 className="display text-[1.9rem] text-white">{sport.name}</h3>
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <p className="font-display text-lg font-bold text-ink">{sport.headline}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{sport.summary}</p>

                  {bullets.length ? (
                    <ul className="mt-5 space-y-2.5 text-sm">
                      {bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5">
                          <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-royal-50 text-royal">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          <span className="font-medium text-ink">{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {sport.notice ? (
                    <p className="mt-5 flex gap-2.5 rounded-xl border border-gold/40 bg-gold-50 px-3.5 py-3 text-sm font-medium text-ink">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
                      {sport.notice}
                    </p>
                  ) : null}

                  <div className="mt-auto pt-6">
                    {prices ? (
                      <p className="flex items-baseline justify-between gap-3 border-t border-line pt-4 text-sm text-muted">
                        <span>
                          1 hour from <span className="tabular text-base font-bold text-ink">{formatMoney(prices.h1)}</span>
                        </span>
                        <span>
                          2 hours from <span className="tabular text-base font-bold text-ink">{formatMoney(prices.h2)}</span>
                        </span>
                      </p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <a href="#pricing" className={buttonClass({ variant: "outline", size: "md" })}>
                        View pricing
                      </a>
                      <BookLink sport={sport.slug} className={buttonClass({ variant: "dark", size: "md" })} aria-label={`Book ${sport.name} now`}>
                        Book now <ArrowRight aria-hidden className="size-4" />
                      </BookLink>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-xs text-subtle">Court images are illustrative 3D renders.</p>
      </div>
    </section>
  );
}
