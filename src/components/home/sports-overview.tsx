import { ArrowRight, Info } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookLink } from "@/components/booking/selection-context";
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

/** The three sports, one row each with the same structure, so none outranks the others. */
export function SportsOverview({ courts }: { courts: PublicCourt[] }) {
  return (
    <section id="sports" aria-labelledby="sports-title" className="scroll-mt-16 bg-ink py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="sports-title"
          eyebrow="Our sports"
          title="Choose your game."
          intro="Badminton, pickleball and basketball — each with its own courts, hourly bookings and monthly rental plans."
        />

        <ul className="mt-12 border-b border-ink-line">
          {SPORTS_CONTENT.map((sport, i) => {
            const list = courts.filter((c) => c.sport.slug === sport.slug && c.status !== "INACTIVE");
            const prices = fromPrices(list);
            const details = [...list.filter((c) => c.surface).map((c) => `${shortCourtName(c.name, c.sport.name)} – ${c.surface}`), ...sport.highlights];
            return (
              <li
                key={sport.slug}
                id={`sport-${sport.slug}`}
                className="grid scroll-mt-24 gap-6 border-t border-ink-line py-8 sm:py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10 lg:gap-14"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-[var(--radius-card)] bg-ink-3">
                  <Image
                    src={sport.image}
                    alt={sport.imageAlt}
                    fill
                    sizes="(min-width: 1280px) 520px, (min-width: 768px) 40vw, 100vw"
                    placeholder="blur"
                    style={{ objectPosition: sport.focus }}
                    className="object-cover"
                  />
                </div>

                <div className="flex min-w-0 flex-col">
                  <div className="flex items-baseline gap-4">
                    <span aria-hidden className="display tabular text-[1.35rem] text-neon">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="display text-[clamp(2.4rem,5vw,3.5rem)]">{sport.name}</h3>
                  </div>
                  <p className="mt-4 text-lg font-semibold">{sport.headline}</p>
                  <p className="mt-2 max-w-xl leading-relaxed text-ink-muted">{sport.summary}</p>

                  {details.length ? (
                    <ul className="mt-5 space-y-1.5 text-sm font-medium">
                      {details.map((d) => (
                        <li key={d} className="flex items-center gap-3">
                          <span aria-hidden className="h-px w-4 shrink-0 bg-neon" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {sport.notice ? (
                    <p className="mt-5 flex items-start gap-2.5 text-sm font-medium">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-neon" />
                      {sport.notice}
                    </p>
                  ) : null}

                  <div className="mt-7 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-t border-ink-line pt-5 md:mt-auto">
                    {prices ? (
                      <dl className="flex gap-8">
                        <div>
                          <dt className="eyebrow text-[0.66rem] text-ink-subtle">1 hour from</dt>
                          <dd className="tabular mt-1 text-2xl font-bold">{formatMoney(prices.h1)}</dd>
                        </div>
                        <div>
                          <dt className="eyebrow text-[0.66rem] text-ink-subtle">2 hours from</dt>
                          <dd className="tabular mt-1 text-2xl font-bold">{formatMoney(prices.h2)}</dd>
                        </div>
                      </dl>
                    ) : null}
                    <div className="flex items-center gap-5">
                      <Link href="#pricing" className="text-sm font-semibold text-ink-muted underline-offset-4 transition-colors hover:text-white hover:underline">
                        Monthly plans
                      </Link>
                      <BookLink sport={sport.slug} className={buttonClass({ variant: "light", size: "md" })} aria-label={`Book ${sport.name} now`}>
                        Book now <ArrowRight aria-hidden className="size-4" />
                      </BookLink>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-ink-subtle">Court images are illustrative 3D renders.</p>
      </div>
    </section>
  );
}
