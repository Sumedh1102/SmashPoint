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
            <legend className="mb-3 flex w-full items-center gap-2">
              <span className="eyebrow text-ink">{period.label}</span>
              <span className="text-xs text-subtle">
                · {free} of {list.length} free
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
                      "group relative flex min-h-[4.25rem] flex-col justify-center rounded-xl border px-3.5 py-2.5 text-left transition-[background-color,border-color,color,box-shadow] duration-200",
                      available && !isSelected && "border-line bg-white hover:border-royal hover:shadow-[0_0_0_1px_var(--color-royal)]",
                      isSelected && "border-ink bg-ink text-white shadow-[0_0_0_2px_var(--color-gold)]",
                      !available && "cursor-not-allowed border-line/80 bg-paper-2/70 text-subtle",
                      (slot.state === "BLOCKED" || slot.state === "MAINTENANCE") && "hatched border-dashed",
                    )}
                  >
                    {isSelected ? (
                      <span aria-hidden className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-gold text-ink">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : null}
                    <span className={cn("tabular text-[1rem] font-bold", !available && "line-through decoration-1 opacity-70")}>{formatMinutes(slot.startMinute)}</span>
                    <span className={cn("mt-0.5 truncate text-xs", isSelected ? "text-white/75" : available ? "text-muted" : "")}>
                      {available ? (
                        <>
                          until {formatMinutes(slot.endMinute)}
                          <span className={cn("ml-1 font-semibold", isSelected ? "text-gold" : "text-success")}>· Free</span>
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

/** Legend plus a plain-language reason for each kind of unavailable slot. */
export function SlotLegend({ holdMinutes }: { holdMinutes: number }) {
  const item = (cls: string, label: string, detail?: string) => (
    <li className="flex items-start gap-2">
      <span aria-hidden className={cn("mt-0.5 size-3.5 shrink-0 rounded-[4px] border", cls)} />
      <span>
        <span className="font-semibold text-ink">{label}</span>
        {detail ? <span className="text-muted"> — {detail}</span> : null}
      </span>
    </li>
  );
  return (
    <ul className="grid gap-x-6 gap-y-2 rounded-xl bg-paper px-4 py-3 text-xs sm:grid-cols-2">
      {item("border-line bg-white", "Available", "tap to select")}
      {item("border-ink bg-ink shadow-[0_0_0_1.5px_var(--color-gold)]", "Selected")}
      {item("border-line/80 bg-paper-2", "Booked", "another player has this time")}
      {item("border-line/80 bg-paper-2", "On hold", `someone is paying; frees up if they don't finish within ${holdMinutes} min`)}
      {item("hatched border-dashed border-line-strong bg-paper-2", "Unavailable / maintenance", "closed by the academy")}
      {item("border-line/80 bg-paper-2", "Started", "the time has already begun")}
    </ul>
  );
}
