"use client";

import { Check } from "lucide-react";
import type { Slot } from "@/lib/booking/engine";
import { formatMinutes, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS = [
  { label: "Morning", from: 0, to: 12 * 60 },
  { label: "Afternoon", from: 12 * 60, to: 17 * 60 },
  { label: "Evening", from: 17 * 60, to: 24 * 60 },
];

const STATE_LABEL: Record<Slot["state"], string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  HELD: "On hold",
  MAINTENANCE: "Maintenance",
  BLOCKED: "Unavailable",
  PAST: "Started",
};

/**
 * Start times for the chosen court, date and duration. Only AVAILABLE slots can be selected;
 * every other state is shown (not hidden) with its reason, so the day reads at a glance.
 */
export function TimeSlotGrid({ slots, selected, onSelect, disabled }: { slots: Slot[]; selected: number | null; onSelect: (start: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-6">
      {PERIODS.map((period) => {
        const list = slots.filter((s) => s.startMinute >= period.from && s.startMinute < period.to);
        if (!list.length) return null;
        const free = list.filter((s) => s.state === "AVAILABLE").length;
        return (
          <fieldset key={period.label}>
            <legend className="mb-3 flex items-baseline gap-2">
              <span className="eyebrow text-ink-muted">{period.label}</span>
              <span className="text-xs text-ink-subtle">
                {free} of {list.length} free
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {list.map((slot) => {
                const available = slot.state === "AVAILABLE";
                const isSelected = selected === slot.startMinute && available;
                const reason = slot.label ?? STATE_LABEL[slot.state];
                return (
                  <button
                    key={slot.startMinute}
                    type="button"
                    disabled={!available || disabled}
                    aria-pressed={available ? isSelected : undefined}
                    aria-label={`${formatMinutes(slot.startMinute)} to ${formatMinutes(slot.endMinute)}, ${available ? `${formatMoney(slot.price)}, available` : reason}`}
                    onClick={() => onSelect(slot.startMinute)}
                    className={cn(
                      "relative flex min-h-[4.25rem] flex-col justify-center rounded-[var(--radius-control)] border px-3.5 py-2.5 text-left transition-[background-color,border-color,color] duration-150",
                      available && !isSelected && "border-ink-line-strong bg-ink-3 text-white hover:border-neon",
                      isSelected && "border-neon bg-neon text-ink",
                      !available && "cursor-not-allowed border-ink-line bg-transparent text-ink-subtle",
                      slot.state === "HELD" && "border-dashed",
                      (slot.state === "BLOCKED" || slot.state === "MAINTENANCE") && "hatched border-dashed",
                    )}
                  >
                    {isSelected ? <Check aria-hidden className="absolute top-2.5 right-2.5 size-4" strokeWidth={3} /> : null}
                    <span className={cn("tabular text-[1rem] font-semibold", !available && "line-through decoration-1")}>{formatMinutes(slot.startMinute)}</span>
                    <span className={cn("mt-0.5 truncate text-xs", isSelected ? "text-ink/75" : available ? "text-ink-muted" : "")}>
                      {available ? (
                        <>
                          until {formatMinutes(slot.endMinute)} · <span className={cn("font-semibold", isSelected ? "text-ink" : "text-white")}>{formatMoney(slot.price)}</span>
                        </>
                      ) : (
                        reason
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

/** What each kind of slot looks like, with a word on holds. */
export function SlotLegend({ holdMinutes }: { holdMinutes: number }) {
  const item = (cls: string, label: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn("size-3.5 shrink-0 rounded-[4px] border", cls)} />
      {label}
    </li>
  );
  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
        {item("border-ink-line-strong bg-ink-3", "Available")}
        {item("border-neon bg-neon", "Selected")}
        {item("border-dashed border-ink-line-strong", "On hold")}
        {item("border-ink-line", "Booked / started")}
        {item("hatched border-dashed border-ink-line-strong", "Closed")}
      </ul>
      <p className="text-xs text-ink-subtle">A slot on hold is being paid for by someone else. It frees up if they don&apos;t finish within {holdMinutes} minutes.</p>
    </div>
  );
}
