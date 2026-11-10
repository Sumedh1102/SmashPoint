"use client";

import { ArrowRight, Layers } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useBookingSelection } from "@/components/booking/selection-context";
import { SportIcon } from "@/components/booking/sport-icon";
import { LiveDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMinutes, formatMoney } from "@/lib/format";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { PublicCourt } from "@/server/queries/public";
import { courtImage, courtImageAlt } from "./court-images";

const SPORT_ORDER = ["badminton", "pickleball", "basketball"];

/** Plain-language live availability from the real booking data. */
function availabilityText(court: PublicCourt, today: string) {
  if (court.status === "MAINTENANCE") return { live: false, tone: "muted" as const, text: "Closed for maintenance" };
  if (court.freeToday > 0 && court.next?.date === today) {
    return { live: true, tone: "live" as const, text: `${court.freeToday} ${court.freeToday === 1 ? "hour" : "hours"} free today · next ${formatMinutes(court.next.startMinute)}` };
  }
  if (court.next) {
    const day = court.next.date === addDays(today, 1) ? "tomorrow" : formatDate(court.next.date, "weekday");
    const todayText = court.remainingToday === 0 ? "No more slots today" : "Fully booked today";
    return { live: true, tone: "soon" as const, text: `${todayText} · next free ${day}, ${formatMinutes(court.next.startMinute)}` };
  }
  return { live: false, tone: "muted" as const, text: "No free slots today or tomorrow" };
}

export function CourtCard({ court, today, index }: { court: PublicCourt; today: string; index: number }) {
  const { bookCourt } = useBookingSelection();
  const availability = availabilityText(court, today);
  const number = court.name.match(/(\d+)$/)?.[1];
  return (
    <article
      data-reveal
      style={{ ["--reveal-delay" as string]: `${(index % 3) * 90}ms` }}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm transition-[box-shadow,transform,border-color] duration-500 ease-out hover:-translate-y-1 hover:border-royal/30 hover:shadow-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-ink">
        <Image
          src={courtImage(court.slug, court.sport.slug)}
          alt={courtImageAlt(court.name, court.slug, court.sport.slug)}
          fill
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
          placeholder="blur"
          className="object-cover object-[center_80%] transition-transform duration-[1200ms] ease-out group-hover:scale-[1.045]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/75 to-transparent" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/80 py-1.5 pr-3 pl-2 text-[0.68rem] font-semibold tracking-[0.14em] text-white uppercase backdrop-blur">
          <SportIcon sport={court.sport.slug} className="size-4 text-gold" />
          {court.sport.name}
        </span>
        {number ? (
          <span aria-hidden className="display absolute right-4 bottom-2 text-[3.2rem] leading-none text-white/85">
            {number.padStart(2, "0")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="display text-[1.75rem]">{court.name}</h3>
        {court.surface ? (
          <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-royal-50 px-2.5 py-1 text-xs font-semibold text-royal-700">
            <Layers aria-hidden className="size-3.5" />
            {court.surface}
          </p>
        ) : null}
        {court.description ? <p className="mt-2.5 text-sm leading-relaxed text-muted">{court.description}</p> : null}

        <p className="mt-4 flex items-start gap-2.5 text-sm">
          <span className="sr-only">Availability: </span>
          <LiveDot live={availability.live} className="mt-1.5 ml-0.5" />
          <span className={availability.tone === "muted" ? "text-muted" : "text-ink"}>{availability.text}</span>
        </p>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6">
          <dl className="flex gap-5 text-sm">
            <div>
              <dt className="text-xs text-subtle">1 hour</dt>
              <dd className="tabular text-lg font-bold text-ink">{formatMoney(court.price1h)}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">2 hours</dt>
              <dd className="tabular text-lg font-bold text-ink">{formatMoney(court.price2h)}</dd>
            </div>
          </dl>
          <Button variant="dark" onClick={() => bookCourt(court.slug)} disabled={court.status !== "ACTIVE"} aria-label={`Book ${court.name}`}>
            Book this court <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function CourtListing({ courts, today }: { courts: PublicCourt[]; today: string }) {
  const [filter, setFilter] = useState<string>("all");
  const sports = SPORT_ORDER.map((slug) => ({ slug, name: courts.find((c) => c.sport.slug === slug)?.sport.name ?? slug, has: courts.some((c) => c.sport.slug === slug) })).filter((s) => s.has);
  const shown = filter === "all" ? courts : courts.filter((c) => c.sport.slug === filter);

  return (
    <div>
      <div role="group" aria-label="Filter courts by sport" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {[{ slug: "all", name: "All sports" }, ...sports].map((s) => (
          <button
            key={s.slug}
            type="button"
            aria-pressed={filter === s.slug}
            onClick={() => setFilter(s.slug)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
              filter === s.slug ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-ink hover:border-ink",
            )}
          >
            {s.slug !== "all" ? <SportIcon sport={s.slug} className={cn("size-4", filter === s.slug ? "text-gold" : "text-royal")} /> : null}
            {s.name}
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {shown.map((court, i) => (
            <CourtCard key={court.id} court={court} today={today} index={i} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-line-strong p-8 text-center text-muted">No courts are open for booking right now.</p>
      )}
    </div>
  );
}
