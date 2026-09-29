"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, addMonths, dayOfWeek, endOfMonth, startOfMonth } from "@/lib/time";
import { formatDate } from "@/lib/format";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Month-view calendar with min/max bounds and keyboard support. */
export function Calendar({
  value,
  onChange,
  min,
  max,
  isDisabled,
  className,
}: {
  value: string | null;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  isDisabled?: (date: string) => boolean;
  className?: string;
}) {
  const [month, setMonth] = useState(startOfMonth(value ?? min ?? new Date().toISOString().slice(0, 10)));
  const first = startOfMonth(month);
  const lead = (dayOfWeek(first) + 6) % 7;
  const last = endOfMonth(month);
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);

  const disabled = (d: string) => (min && d < min) || (max && d > max) || isDisabled?.(d) || false;
  const canPrev = !min || startOfMonth(min) < first;
  const canNext = !max || startOfMonth(max) > first;

  return (
    <div className={cn("w-72 select-none", className)}>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" disabled={!canPrev} onClick={() => setMonth(addMonths(first, -1))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-paper hover:text-ink disabled:opacity-30" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-semibold">{MONTHS[Number(first.slice(5, 7)) - 1]} {first.slice(0, 4)}</p>
        <button type="button" disabled={!canNext} onClick={() => setMonth(addMonths(first, 1))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-paper hover:text-ink disabled:opacity-30" aria-label="Next month">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid">
        {WEEK.map((w) => (
          <span key={w} className="py-1 text-[11px] font-medium text-subtle">
            {w}
          </span>
        ))}
        {days.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              disabled={disabled(d)}
              onClick={() => onChange(d)}
              aria-pressed={d === value}
              aria-label={formatDate(d, "long")}
              className={cn(
                "grid h-9 place-items-center rounded-md text-sm tabular-nums transition",
                d === value ? "bg-brand font-medium text-white" : "hover:bg-paper-2",
                "disabled:cursor-not-allowed disabled:text-subtle/60 disabled:hover:bg-transparent",
              )}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`pad-${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

/** Button + popover date picker. Also renders a hidden input for plain <form> posts. */
export function DatePicker({
  value,
  onChange,
  name,
  min,
  max,
  placeholder = "Pick a date",
  className,
}: {
  value: string | null;
  onChange?: (date: string) => void;
  name?: string;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const current = onChange ? value : internal;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={current ?? ""} /> : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-left text-sm shadow-xs"
      >
        <CalendarDays className="size-4 shrink-0 text-muted" />
        <span className={cn(!current && "text-subtle")}>{current ? formatDate(current, "long") : placeholder}</span>
      </button>
      {open ? (
        <div role="dialog" aria-label="Choose date" className="animate-pop absolute left-0 z-50 mt-2 rounded-xl border border-line bg-white p-3 shadow-lg">
          <Calendar
            value={current}
            min={min}
            max={max}
            onChange={(d) => {
              if (onChange) onChange(d);
              else setInternal(d);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
