"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { dateParts, formatDate } from "@/lib/format";
import { dateRange } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Horizontal strip of bookable dates (today → the last date open for booking). Past dates never appear. */
export function DateSelector({ value, onChange, today, lastDate }: { value: string; onChange: (date: string) => void; today: string; lastDate: string }) {
  const dates = useMemo(() => dateRange(today, lastDate), [today, lastDate]);
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the selected date in view (e.g. when it is pre-selected or chosen far along the strip).
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-date="${value}"]`);
    if (!el || !scroller.current) return;
    const s = scroller.current;
    const left = el.offsetLeft - s.offsetLeft;
    if (left < s.scrollLeft || left + el.offsetWidth > s.scrollLeft + s.clientWidth) s.scrollTo({ left: left - 16, behavior: "smooth" });
  }, [value]);

  const page = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{formatDate(value, "long")}</p>
        <div className="hidden gap-1 sm:flex">
          <button type="button" onClick={() => page(-1)} aria-label="Earlier dates" className="grid size-9 place-items-center rounded-full border border-ink-line-strong text-white transition-colors hover:border-white">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => page(1)} aria-label="Later dates" className="grid size-9 place-items-center rounded-full border border-ink-line-strong text-white transition-colors hover:border-white">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div ref={scroller} role="group" aria-label="Choose a date" className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:px-0">
        {dates.map((d, i) => {
          const p = dateParts(d);
          const selected = d === value;
          const label = i === 0 ? "Today" : i === 1 ? "Tmrw" : p.weekday;
          return (
            <button
              key={d}
              type="button"
              data-date={d}
              aria-pressed={selected}
              aria-label={`${i === 0 ? "Today, " : i === 1 ? "Tomorrow, " : ""}${formatDate(d, "long")}`}
              onClick={() => onChange(d)}
              className={cn(
                "flex w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-[var(--radius-control)] border py-2.5 transition-[background-color,border-color,color] duration-200",
                selected ? "border-white bg-white text-ink" : "border-ink-line bg-ink-3 text-white hover:border-ink-line-strong",
              )}
            >
              <span className={cn("text-[0.68rem] font-semibold tracking-[0.12em] uppercase", selected ? "text-ink/60" : "text-ink-subtle")}>{label}</span>
              <span className="display mt-1 text-[1.65rem] leading-none">{p.day}</span>
              <span className={cn("mt-1 text-[0.7rem] font-medium", selected ? "text-ink/70" : "text-ink-muted")}>{p.month}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
