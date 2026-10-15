"use client";

import { ArrowRight, Clock3 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useBookingSelection } from "@/components/booking/selection-context";
import { LiveDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { closuresFor } from "@/lib/booking/rules";
import { formatDate, formatMinutes, formatMoney } from "@/lib/format";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { PublicCourt } from "@/server/queries/public";
import { courtImage, courtImageAlt } from "./court-images";

const SPORT_ORDER = ["badminton", "pickleball", "basketball"];

function hoursFor(sportSlug: string) {
  const closures = closuresFor(sportSlug);
  if (!closures.length) return "7:00 AM – 10:00 PM";
  return "7 AM – 5 PM · 7 – 10 PM";
}

/** Plain-language live availability from the real booking data. */
function availabilityText(court: PublicCourt, today: string) {
  if (court.status === "MAINTENANCE") return { live: false, text: "Closed for maintenance" };
  if (court.freeToday > 0 && court.next?.date === today) {
    return { live: true, text: `${court.freeToday} ${court.freeToday === 1 ? "hour" : "hours"} free today · next ${formatMinutes(court.next.startMinute)}` };
  }
  if (court.next) {
    const day = court.next.date === addDays(today, 1) ? "tomorrow" : formatDate(court.next.date, "weekday");
    return { live: true, text: `Fully booked today · next free ${day}, ${formatMinutes(court.next.startMinute)}` };
  }
  return { live: false, text: "No free slots today or tomorrow" };
}

export function CourtCard({ court, today, index }: { court: PublicCourt; today: string; index: number }) {
  const { bookCourt } = useBookingSelection();
  const availability = availabilityText(court, today);
  const closure = closuresFor(court.sport.slug)[0];
  return (
    <article
      data-reveal
      style={{ ["--reveal-delay" as string]: `${(index % 3) * 90}ms` }}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm transition-[box-shadow,transform,border-color] duration-500 ease-out hover:-translate-y-1 hover:border-line-strong hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-ink">
        <Image
          src={courtImage(court.slug, court.sport.slug)}
          alt={courtImageAlt(court.name, court.slug, court.sport.slug)}
          fill
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
          placeholder="blur"
          className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.045]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/70 to-transparent" />
        <span className="eyebrow absolute top-3 left-3 rounded-full bg-ink/75 px-3 py-1.5 text-[0.65rem] text-white backdrop-blur">{court.sport.name}</span>
        {/\d+$/.test(court.name) ? (
          <span aria-hidden className="display absolute right-4 bottom-2 text-[3.4rem] leading-none text-white/85 [-webkit-text-stroke:1px_rgb(255_255_255/0.2)]">
            {court.name.match(/(\d+)$/)![1]!.padStart(2, "0")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="display text-[1.9rem]">{court.name}</h3>
        {court.description ? <p className="mt-2 text-sm leading-relaxed text-muted">{court.description}</p> : null}

        <dl className="mt-5 space-y-2.5 text-sm">
          <div className="flex items-start gap-2.5">
            <dt className="sr-only">Opening hours</dt>
            <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0 text-subtle" />
            <dd>
              {hoursFor(court.sport.slug)}
              {closure ? <span className="block text-xs text-subtle">Academy sessions 5 – 7 PM</span> : null}
            </dd>
          </div>
          <div className="flex items-start gap-2.5">
            <dt className="sr-only">Availability</dt>
            <LiveDot live={availability.live} className="mt-1.5 ml-1 mr-0.5" />
            <dd className={availability.live ? "text-ink" : "text-muted"}>{availability.text}</dd>
          </div>
        </dl>

        <div className="mt-auto flex items-end justify-between gap-4 pt-6">
          <p className="text-sm text-muted">
            From <span className="tabular text-lg font-semibold text-ink">{formatMoney(court.hourlyRate)}</span>
            <span className="text-subtle"> / hour</span>
          </p>
          <Button variant="dark" onClick={() => bookCourt(court.slug)} disabled={court.status !== "ACTIVE"} aria-label={`Book ${court.name}`}>
            Book This Court <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function CourtListing({ courts, today }: { courts: PublicCourt[]; today: string }) {
  const [filter, setFilter] = useState<string>("all");
  const sports = SPORT_ORDER.map((slug) => ({ slug, name: courts.find((c) => c.sport.slug === slug)?.sport.name ?? slug, count: courts.filter((c) => c.sport.slug === slug).length })).filter((s) => s.count);
  const shown = filter === "all" ? courts : courts.filter((c) => c.sport.slug === filter);

  return (
    <div>
      <div role="group" aria-label="Filter courts by sport" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {[{ slug: "all", name: "All courts", count: courts.length }, ...sports].map((s) => (
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
            {s.name}
            <span className={cn("tabular text-xs", filter === s.slug ? "text-lime" : "text-subtle")}>{String(s.count).padStart(2, "0")}</span>
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
