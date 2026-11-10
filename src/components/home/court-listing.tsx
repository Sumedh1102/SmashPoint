"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useBookingSelection } from "@/components/booking/selection-context";
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
  if (court.status === "MAINTENANCE") return { live: false, text: "Closed for maintenance" };
  if (court.freeToday > 0 && court.next?.date === today) {
    return { live: true, text: `${court.freeToday} ${court.freeToday === 1 ? "hour" : "hours"} free today · next ${formatMinutes(court.next.startMinute)}` };
  }
  if (court.next) {
    const day = court.next.date === addDays(today, 1) ? "tomorrow" : formatDate(court.next.date, "weekday");
    const todayText = court.remainingToday === 0 ? "No more slots today" : "Fully booked today";
    return { live: true, text: `${todayText} · next free ${day}, ${formatMinutes(court.next.startMinute)}` };
  }
  return { live: false, text: "No free slots today or tomorrow" };
}

export function CourtCard({ court, today }: { court: PublicCourt; today: string }) {
  const { bookCourt } = useBookingSelection();
  const availability = availabilityText(court, today);
  const number = court.name.match(/(\d+)$/)?.[1];
  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-ink-3 transition-colors duration-300 hover:border-ink-line-strong">
      <div className="relative aspect-[16/9] overflow-hidden bg-ink">
        <Image
          src={courtImage(court.slug, court.sport.slug)}
          alt={courtImageAlt(court.name, court.slug, court.sport.slug)}
          fill
          sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 100vw"
          placeholder="blur"
          className="object-cover object-[center_80%] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
        <span className="eyebrow absolute top-3 left-3 rounded-full bg-ink/85 px-3 py-1.5 text-[0.65rem] text-white">{court.sport.name}</span>
        {number ? (
          <span aria-hidden className="display absolute right-4 bottom-2 text-[3.4rem] leading-none text-white/90">
            {number.padStart(2, "0")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="display text-[1.9rem]">{court.name}</h3>
        {court.surface ? <p className="mt-1.5 text-sm font-semibold">{court.surface}</p> : null}
        {court.description ? <p className="mt-2 text-sm leading-relaxed text-ink-muted">{court.description}</p> : null}

        <p className="mt-5 flex items-start gap-2.5 text-sm">
          <span className="sr-only">Availability: </span>
          <LiveDot live={availability.live} className="mt-1.5" />
          <span className={availability.live ? "text-white" : "text-ink-subtle"}>{availability.text}</span>
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-ink-line pt-5">
            <dl className="flex gap-6 text-sm">
              <div>
                <dt className="text-xs text-ink-subtle">1 hour</dt>
                <dd className="tabular text-lg font-bold">{formatMoney(court.price1h)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-subtle">2 hours</dt>
                <dd className="tabular text-lg font-bold">{formatMoney(court.price2h)}</dd>
              </div>
            </dl>
            <Button variant="light" onClick={() => bookCourt(court.slug)} disabled={court.status !== "ACTIVE"} aria-label={`Book ${court.name}`}>
              Book this court <ArrowRight aria-hidden className="size-4" />
            </Button>
          </div>
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
        {[{ slug: "all", name: "All courts" }, ...sports].map((s) => (
          <button
            key={s.slug}
            type="button"
            aria-pressed={filter === s.slug}
            onClick={() => setFilter(s.slug)}
            className={cn(
              "flex h-10 shrink-0 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
              filter === s.slug ? "border-white bg-white text-ink" : "border-ink-line text-white hover:border-ink-line-strong",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>

      {shown.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {shown.map((court) => (
            <CourtCard key={court.id} court={court} today={today} />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-[var(--radius-card)] border border-dashed border-ink-line p-8 text-center text-ink-muted">No courts are open for booking right now.</p>
      )}
    </div>
  );
}
