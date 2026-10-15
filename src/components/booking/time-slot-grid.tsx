"use client";

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
  RESTRICTED: "Academy session",
  MAINTENANCE: "Maintenance",
  BLOCKED: "Unavailable",
  PAST: "Closed",
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
        return (
          <fieldset key={period.label}>
            <legend className="eyebrow mb-3 text-subtle">{period.label}</legend>
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
                      "group relative flex min-h-[4.25rem] flex-col justify-center rounded-xl border px-3.5 py-2.5 text-left transition-[background-color,border-color,color,box-shadow] duration-200",
                      available && !isSelected && "border-line bg-white hover:border-court hover:shadow-[0_0_0_1px_var(--color-court)]",
                      isSelected && "border-ink bg-ink text-white shadow-[0_0_0_2px_var(--color-lime)]",
                      !available && "cursor-not-allowed border-line/80 bg-paper-2/70 text-subtle",
                      slot.state === "RESTRICTED" && "hatched border-dashed",
                    )}
                  >
                    <span className={cn("tabular text-[0.95rem] font-semibold", !available && "line-through decoration-1 opacity-70")}>
                      {formatMinutes(slot.startMinute)}
                      <span className={cn("font-normal", isSelected ? "text-white/60" : "text-subtle")}> – {formatMinutes(slot.endMinute)}</span>
                    </span>
                    <span className={cn("mt-0.5 text-xs", isSelected ? "text-lime" : available ? "text-muted" : "")}>
                      {available ? (
                        <>
                          {formatMoney(slot.price)}
                          {slot.isPeak ? <span className="ml-1.5 text-[0.65rem] tracking-wider uppercase opacity-80">Peak</span> : null}
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

export function SlotLegend({ showRestricted }: { showRestricted: boolean }) {
  const item = (cls: string, label: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn("size-3.5 rounded-[4px] border", cls)} />
      {label}
    </li>
  );
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
      {item("border-line bg-white", "Available")}
      {item("border-ink bg-ink shadow-[0_0_0_1.5px_var(--color-lime)]", "Selected")}
      {item("border-line/80 bg-paper-2", "Booked / unavailable")}
      {showRestricted ? item("hatched border-dashed border-line-strong bg-paper-2", "Academy session (5–7 PM)") : null}
    </ul>
  );
}
