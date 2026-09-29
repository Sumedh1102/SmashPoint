"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgePercent, Check, ChevronLeft, ChevronRight, Clock, Flame, LockKeyhole, RefreshCw, Wrench } from "lucide-react";
import type { AvailabilityResult, Slot } from "@/lib/booking/engine";
import { formatDate, formatDuration, formatMinutes, formatMinutes24, formatMoney, formatTimeRange, monthShort } from "@/lib/format";
import { WEEKDAYS_SHORT, addDays, parseISODate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { runCheckout } from "@/components/payments/checkout";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Shuttlecock } from "@/components/brand/illustrations";

type BookingUser = { name: string; email: string; phone: string | null } | null;
type Selection = { courtId: string; startMinute: number } | null;
type Quote = { subtotal: number; memberDiscount: number; couponDiscount: number; discount: number; total: number; isPeak: boolean; couponId: string | null; couponMessage: string | null };

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

export function BookingFlow({
  initial,
  today,
  firstDay,
  durations,
  advanceDays,
  holdMinutes,
  user,
}: {
  initial: AvailabilityResult;
  today: string;
  firstDay: string;
  durations: number[];
  advanceDays: number;
  holdMinutes: number;
  user: BookingUser;
}) {
  const toast = useToast();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [date, setDate] = useState(initial.date);
  const [duration, setDuration] = useState(initial.duration);
  const [availability, setAvailability] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [mobileCourt, setMobileCourt] = useState(initial.courts[0]?.courtId ?? null);
  const [step, setStep] = useState<"pick" | "details">("pick");
  const firstLoad = useRef(true);

  const refresh = useCallback(
    async (opts: { signal?: AbortSignal; quiet?: boolean } = {}) => {
      if (!opts.quiet) setLoading(true);
      try {
        const res = await fetch(`/api/availability?date=${date}&duration=${duration}`, { signal: opts.signal, cache: "no-store" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Could not load availability");
        const data = (await res.json()) as AvailabilityResult;
        setAvailability(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") toast.error("Couldn't refresh availability", (err as Error).message);
      } finally {
        if (!opts.quiet) setLoading(false);
      }
    },
    [date, duration, toast],
  );

  // Reload when the date or duration changes; keep the URL shareable.
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const ctrl = new AbortController();
    setSelection(null);
    setStep("pick");
    void refresh({ signal: ctrl.signal });
    window.history.replaceState(null, "", `/book?date=${date}&duration=${duration}`);
    return () => ctrl.abort();
  }, [date, duration, refresh]);

  // Keep the grid fresh while the page is open.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void refresh({ quiet: true });
    const interval = setInterval(tick, 45_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const selectedCourt = selection ? availability.courts.find((c) => c.courtId === selection.courtId) : undefined;
  const selectedSlot = selection ? selectedCourt?.slots.find((s) => s.startMinute === selection.startMinute) : undefined;

  // If someone else grabbed the selected slot, drop it and tell the user.
  useEffect(() => {
    if (selection && selectedSlot && selectedSlot.state !== "AVAILABLE") {
      setSelection(null);
      setStep("pick");
      toast.warning("That slot was just booked", "Please pick another time.");
    }
  }, [selection, selectedSlot, toast]);

  const select = (courtId: string, slot: Slot) => {
    if (slot.state !== "AVAILABLE") return;
    const same = selection?.courtId === courtId && selection.startMinute === slot.startMinute;
    setSelection(same ? null : { courtId, startMinute: slot.startMinute });
    if (same) setStep("pick");
  };

  const totalFree = availability.courts.reduce((a, c) => a + c.availableCount, 0);

  return (
    <div className="grid gap-8 pb-28 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
      <div className="min-w-0 space-y-6">
        <StepCard n={1} title="Pick a date & duration">
          <DateStrip today={today} firstDay={firstDay} advanceDays={advanceDays} value={date} onChange={setDate} />
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-sm font-semibold">Duration</span>
            <div role="radiogroup" aria-label="Slot duration" className="inline-flex gap-1 rounded-xl border border-line bg-white p-1">
              {durations.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={duration === d}
                  onClick={() => setDuration(d)}
                  className={cn("rounded-lg px-4 py-2 font-display text-sm font-semibold transition", duration === d ? "bg-ink text-white" : "hover:bg-brand-50")}
                >
                  {formatDuration(d)}
                </button>
              ))}
            </div>
          </div>
        </StepCard>

        <StepCard
          n={2}
          title="Choose court & time"
          action={
            <button type="button" onClick={() => refresh()} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium hover:bg-paper" aria-label="Refresh availability">
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Refresh
            </button>
          }
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted">
              <span className="font-semibold text-ink">{formatDate(date, "long")}</span> · {totalFree} open slot{totalFree === 1 ? "" : "s"}
            </p>
            <Legend />
          </div>
          <div className={cn("transition-opacity", loading && "pointer-events-none opacity-50")} aria-busy={loading}>
            {availability.courts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong p-8 text-center font-semibold text-muted">No courts are open for booking right now.</p>
            ) : isDesktop ? (
              <SlotGrid availability={availability} selection={selection} onSelect={select} />
            ) : (
              <SlotList availability={availability} selection={selection} onSelect={select} court={mobileCourt} onCourt={setMobileCourt} />
            )}
          </div>
        </StepCard>
      </div>

      {/* Summary (desktop sidebar) */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <SummaryCard
            date={date}
            duration={duration}
            courtName={selectedCourt?.courtName}
            slot={selectedSlot}
            step={step}
            onContinue={() => setStep("details")}
            onBack={() => setStep("pick")}
            holdMinutes={holdMinutes}
            details={
              step === "details" && selection && selectedSlot && isDesktop ? (
                <DetailsForm user={user} date={date} duration={duration} courtId={selection.courtId} slot={selectedSlot} onConflict={() => { setSelection(null); setStep("pick"); void refresh(); }} />
              ) : null
            }
          />
        </div>
      </aside>

      {/* Mobile sticky bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden" data-print-hide>
        {selection && selectedSlot && selectedCourt ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold">
                {selectedCourt.courtName} · {formatTimeRange(selectedSlot.startMinute, selectedSlot.endMinute)}
              </p>
              <p className="text-sm font-semibold text-muted">
                {formatDate(date, "weekday")} · {formatMoney(selectedSlot.price)}
              </p>
            </div>
            <Button size="lg" onClick={() => setStep("details")}>
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="py-2 text-center text-sm font-medium text-muted">Tap an open slot to continue</p>
        )}
      </div>

      {!isDesktop ? (
        <Modal
          open={step === "details" && !!selection && !!selectedSlot}
          onClose={() => setStep("pick")}
          title="Confirm your booking"
          description={selectedCourt && selectedSlot ? `${selectedCourt.courtName} · ${formatDate(date, "weekday")} · ${formatTimeRange(selectedSlot.startMinute, selectedSlot.endMinute)}` : undefined}
        >
          {selection && selectedSlot ? (
            <DetailsForm user={user} date={date} duration={duration} courtId={selection.courtId} slot={selectedSlot} onConflict={() => { setSelection(null); setStep("pick"); void refresh(); }} />
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function StepCard({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`step-${n}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={`step-${n}`} className="flex items-center gap-3 text-xl font-semibold sm:text-2xl">
          <span className="grid size-8 place-items-center rounded-lg border border-line bg-brand font-mono text-sm text-white">{n}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DateStrip({ today, firstDay, advanceDays, value, onChange }: { today: string; firstDay: string; advanceDays: number; value: string; onChange: (d: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastDay = addDays(today, advanceDays);
  const dates = useMemo(() => {
    const out: string[] = [];
    for (let d = firstDay; d <= lastDay; d = addDays(d, 1)) out.push(d);
    return out;
  }, [firstDay, lastDay]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value]);

  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={ref} className="scrollbar-none -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-1">
        {dates.map((d) => {
          const dt = parseISODate(d);
          const offset = Math.round((dt.getTime() - parseISODate(today).getTime()) / 86_400_000);
          const active = d === value;
          const weekend = dt.getUTCDay() === 0 || dt.getUTCDay() === 6;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={active}
              aria-label={formatDate(d, "long")}
              onClick={() => onChange(d)}
              className={cn(
                "flex w-[4.5rem] shrink-0 snap-start flex-col items-center rounded-xl border border-line py-2.5 transition",
                active ? "bg-brand text-white shadow-xs" : "bg-white hover:bg-brand-50",
              )}
            >
              <span className={cn("text-[11px] font-semibold uppercase", !active && weekend && "text-brand")}>
                {offset === 0 ? "Today" : offset === 1 ? "Tmrw" : WEEKDAYS_SHORT[dt.getUTCDay()]}
              </span>
              <span className="font-display text-2xl font-semibold leading-tight">{dt.getUTCDate()}</span>
              <span className="text-[11px] font-medium opacity-70">{monthShort(dt.getUTCMonth())}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 hidden justify-end gap-2 sm:flex">
        <button type="button" onClick={() => scroll(-1)} className="grid size-8 place-items-center rounded-lg border border-line bg-white hover:bg-paper" aria-label="Earlier dates">
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" onClick={() => scroll(1)} className="grid size-8 place-items-center rounded-lg border border-line bg-white hover:bg-paper" aria-label="Later dates">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Available", cls: "bg-white" },
    { label: "Selected", cls: "bg-brand" },
    { label: "Booked", cls: "bg-paper-2 slot-stripes" },
    { label: "Unavailable", cls: "bg-ink/10 border-dashed" },
    { label: "Maintenance", cls: "bg-warning-soft slot-stripes-warn" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-medium" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-3.5 rounded border border-line", i.cls)} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

function SlotButton({ slot, selected, onClick, compact, courtName }: { slot: Slot; selected: boolean; onClick: () => void; compact?: boolean; courtName: string }) {
  const time = formatTimeRange(slot.startMinute, slot.endMinute);
  const base = "relative flex w-full flex-col items-center justify-center rounded-xl border text-center transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";
  const size = compact ? "h-14 px-1" : "min-h-[4.25rem] px-2 py-2";

  if (slot.state === "AVAILABLE") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${courtName}, ${time}, ${formatMoney(slot.price)}${slot.isPeak ? ", peak" : ""}${selected ? ", selected" : ", available"}`}
        className={cn(
          base,
          size,
          "border-line",
          selected ? "bg-brand text-white shadow-xs -translate-x-0.5 -translate-y-0.5" : "bg-white hover:bg-brand-50 hover:shadow-xs",
        )}
      >
        {!compact ? <span className={cn("text-sm font-semibold", selected ? "text-white" : "text-ink")}>{formatMinutes(slot.startMinute)}</span> : null}
        <span className={cn("font-display font-semibold leading-tight", compact ? "text-[15px]" : "text-xs", selected ? "text-white/90" : "text-muted")}>
          {selected ? (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" strokeWidth={4} /> {compact ? formatMoney(slot.price) : "Selected"}
            </span>
          ) : (
            formatMoney(slot.price)
          )}
        </span>
        {slot.isPeak ? (
          <Flame className={cn("absolute right-1.5 top-1.5 size-3.5", selected ? "text-white" : "text-brand")} aria-hidden />
        ) : null}
      </button>
    );
  }

  const label =
    slot.state === "BOOKED" ? "Booked" : slot.state === "MAINTENANCE" ? "Maintenance" : slot.state === "TRAINING" ? "Training" : slot.state === "PAST" ? "Closed" : "Blocked";
  return (
    <div
      role="note"
      aria-label={`${courtName}, ${time}, ${slot.state === "BOOKED" ? "booked" : slot.state === "MAINTENANCE" ? "under maintenance" : "unavailable"}`}
      title={slot.label}
      className={cn(
        base,
        size,
        slot.state === "BOOKED" && "slot-stripes border-line-strong bg-paper-2 text-muted",
        slot.state === "MAINTENANCE" && "slot-stripes-warn border-line-strong bg-warning-soft text-[#7a5200]",
        (slot.state === "TRAINING" || slot.state === "BLOCKED") && "border-dashed border-line-strong bg-ink/5 text-muted",
        slot.state === "PAST" && "border-line bg-transparent text-subtle",
      )}
    >
      {!compact ? <span className="text-sm font-medium opacity-70">{formatMinutes(slot.startMinute)}</span> : null}
      <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
        {slot.state === "MAINTENANCE" ? <Wrench className="size-3" /> : slot.state === "TRAINING" || slot.state === "BLOCKED" ? <LockKeyhole className="size-3" /> : null}
        {label}
      </span>
    </div>
  );
}

function inMaintenance(c: AvailabilityResult["courts"][number]) {
  return c.courtStatus === "MAINTENANCE" || (c.slots.length > 0 && c.slots.every((s) => s.state === "MAINTENANCE"));
}

/** Desktop: times down the side, courts across the top. */
function SlotGrid({ availability, selection, onSelect }: { availability: AvailabilityResult; selection: Selection; onSelect: (courtId: string, slot: Slot) => void }) {
  const cols = availability.courts.length;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[640px] gap-2" style={{ gridTemplateColumns: `4.5rem repeat(${cols}, minmax(0, 1fr))` }} role="grid" aria-label="Court availability">
        <div />
        {availability.courts.map((c) => {
          const maint = inMaintenance(c);
          return (
            <div key={c.courtId} className={cn("rounded-xl border border-line px-2 py-2 text-center", maint ? "bg-warning-soft" : "bg-ink text-white")} role="columnheader">
              <p className="font-display font-semibold leading-tight">{c.courtName}</p>
              <p className={cn("text-[11px] font-medium", maint ? "text-ink" : "text-white/70")}>{maint ? "Maintenance" : `${c.availableCount} open`}</p>
            </div>
          );
        })}
        {availability.times.map((t, row) => (
          <div key={t.startMinute} className="contents" role="row">
            <div className="flex flex-col justify-center pr-1 text-right font-mono text-xs font-medium text-muted" role="rowheader">
              <span className="text-ink">{formatMinutes24(t.startMinute)}</span>
              <span>{formatMinutes24(t.endMinute)}</span>
            </div>
            {availability.courts.map((c) => {
              const slot = c.slots[row]!;
              return (
                <div key={c.courtId} role="gridcell">
                  <SlotButton
                    compact
                    courtName={c.courtName}
                    slot={slot}
                    selected={selection?.courtId === c.courtId && selection.startMinute === slot.startMinute}
                    onClick={() => onSelect(c.courtId, slot)}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mobile: court tabs, then a thumb-friendly grid of slots. */
function SlotList({
  availability,
  selection,
  onSelect,
  court,
  onCourt,
}: {
  availability: AvailabilityResult;
  selection: Selection;
  onSelect: (courtId: string, slot: Slot) => void;
  court: string | null;
  onCourt: (id: string) => void;
}) {
  const active = availability.courts.find((c) => c.courtId === court) ?? availability.courts[0]!;
  return (
    <div>
      <div className="scrollbar-none -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Courts">
        {availability.courts.map((c) => (
          <button
            key={c.courtId}
            type="button"
            role="tab"
            aria-selected={c.courtId === active.courtId}
            onClick={() => onCourt(c.courtId)}
            className={cn(
              "shrink-0 rounded-xl border border-line px-3.5 py-2 text-left transition",
              c.courtId === active.courtId ? "bg-ink text-white" : inMaintenance(c) ? "bg-warning-soft" : "bg-white",
            )}
          >
            <span className="block font-display font-semibold leading-tight">{c.courtName}</span>
            <span className="text-[11px] font-medium opacity-75">{inMaintenance(c) ? "Maintenance" : `${c.availableCount} open`}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3" role="tabpanel" aria-label={`${active.courtName} slots`}>
        {active.slots.map((slot) => (
          <SlotButton
            key={slot.startMinute}
            courtName={active.courtName}
            slot={slot}
            selected={selection?.courtId === active.courtId && selection.startMinute === slot.startMinute}
            onClick={() => onSelect(active.courtId, slot)}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  date,
  duration,
  courtName,
  slot,
  step,
  onContinue,
  onBack,
  details,
  holdMinutes,
}: {
  date: string;
  duration: number;
  courtName?: string;
  slot?: Slot;
  step: "pick" | "details";
  onContinue: () => void;
  onBack: () => void;
  details: React.ReactNode;
  holdMinutes: number;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-md">
      <div className="bg-brand border-b border-line px-5 py-4 text-white">
        <p className="font-mono text-xs font-medium uppercase tracking-widest text-white/80">Your booking</p>
        <p className="font-display text-2xl font-semibold">{slot && courtName ? courtName : "Select a slot"}</p>
      </div>
      {slot && courtName ? (
        <div className="p-5">
          {step === "pick" ? (
            <>
              <dl className="grid gap-2 text-sm">
                {[
                  ["Date", formatDate(date, "long")],
                  ["Time", formatTimeRange(slot.startMinute, slot.endMinute)],
                  ["Duration", formatDuration(duration)],
                  ["Rate", slot.isPeak ? "Peak hours" : "Non-peak"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="font-semibold text-muted">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="my-4 h-[3px] bg-ink" />
              <div className="flex items-end justify-between">
                <span className="font-medium">Total</span>
                <span className="font-display text-4xl font-semibold leading-none">{formatMoney(slot.price)}</span>
              </div>
              <Button size="lg" className="mt-5 w-full" onClick={onContinue}>
                Continue <ArrowRight className="size-4" />
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-muted">
                <Clock className="size-3.5" /> Slot held for {holdMinutes} min while you pay
              </p>
            </>
          ) : (
            <>
              <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-medium hover:text-brand">
                <ArrowLeft className="size-4" /> Change slot
              </button>
              <p className="mb-4 rounded-xl border border-line bg-brand-50 px-3 py-2 text-sm font-medium">
                {formatDate(date, "weekday")} · {formatTimeRange(slot.startMinute, slot.endMinute)}
              </p>
              {details}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <Shuttlecock className="size-16" />
          <p className="mt-4 font-display text-lg font-semibold">Tap an open slot</p>
          <p className="mt-1 text-sm text-muted">Pick any white tile in the grid. Peak slots are marked with a flame.</p>
        </div>
      )}
    </div>
  );
}

function DetailsForm({
  user,
  date,
  duration,
  courtId,
  slot,
  onConflict,
}: {
  user: BookingUser;
  date: string;
  duration: number;
  courtId: string;
  slot: Slot;
  onConflict: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>(undefined);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const loadQuote = useCallback(
    async (couponCode?: string) => {
      setQuoting(true);
      try {
        const res = await fetch("/api/bookings/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courtId, date, startMinute: slot.startMinute, duration, couponCode }),
        });
        const data = await res.json();
        if (res.ok) {
          setQuote(data);
          if (couponCode) {
            if (data.couponId) {
              setAppliedCoupon(couponCode);
              toast.success("Coupon applied", data.couponMessage);
            } else {
              setAppliedCoupon(undefined);
              toast.error("Coupon not applied", data.couponMessage ?? "Invalid coupon");
            }
          }
        }
      } finally {
        setQuoting(false);
      }
    },
    [courtId, date, duration, slot.startMinute, toast],
  );

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          date,
          startMinute: slot.startMinute,
          duration,
          name: fd.get("name"),
          phone: fd.get("phone"),
          email: fd.get("email"),
          couponCode: appliedCoupon,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "SLOT_UNAVAILABLE") {
          toast.error("Slot already booked", data.error);
          onConflict();
        } else if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          toast.error("Check your details", "Some fields need attention.");
        } else {
          setFormError(data.error);
          toast.error("Booking failed", data.error);
          if (data.receiptUrl) router.push(data.receiptUrl);
        }
        setSubmitting(false);
        return;
      }
      toast.success("Slot held for you", "Taking you to secure payment…");
      await runCheckout(data.checkout, {
        onError: (message) => {
          toast.error("Payment not completed", message);
          router.push(`${data.receiptUrl}&payment=failed`);
        },
      });
    } catch {
      setFormError("Network error — please check your connection and try again.");
      setSubmitting(false);
    }
  }

  const total = quote?.total ?? slot.price;
  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="Full name" htmlFor="b-name" required error={errors.name}>
        <Input id="b-name" name="name" defaultValue={user?.name} autoComplete="name" required aria-invalid={!!errors.name} />
      </Field>
      <Field label="Mobile number" htmlFor="b-phone" required error={errors.phone} hint="For your WhatsApp confirmation">
        <Input id="b-phone" name="phone" type="tel" inputMode="tel" defaultValue={user?.phone ?? ""} autoComplete="tel" placeholder="+91 98xxx xxxxx" required aria-invalid={!!errors.phone} />
      </Field>
      <Field label="Email" htmlFor="b-email" required error={errors.email}>
        <Input id="b-email" name="email" type="email" defaultValue={user?.email} autoComplete="email" required aria-invalid={!!errors.email} />
      </Field>

      <details className="group rounded-xl border border-line bg-paper px-3 py-2 [&_summary::-webkit-details-marker]:hidden" open={!!appliedCoupon}>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
          <BadgePercent className="size-4 text-brand" /> Have a coupon code?
        </summary>
        <div className="mt-2 flex gap-2 pb-1">
          <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" aria-label="Coupon code" className="h-10 uppercase" />
          <Button variant="dark" size="sm" className="h-10" disabled={!coupon.trim()} loading={quoting} onClick={() => loadQuote(coupon.trim())}>
            Apply
          </Button>
        </div>
      </details>

      <div className="rounded-xl border border-line p-3 text-sm">
        <div className="flex justify-between">
          <span className="font-semibold text-muted">Court fee</span>
          <span className="font-medium">{formatMoney(quote?.subtotal ?? slot.price)}</span>
        </div>
        {quote?.memberDiscount ? (
          <div className="flex justify-between text-success">
            <span className="font-semibold">Member discount</span>
            <span className="font-medium">−{formatMoney(quote.memberDiscount)}</span>
          </div>
        ) : null}
        {quote?.couponDiscount ? (
          <div className="flex justify-between text-success">
            <span className="font-semibold">Coupon {appliedCoupon}</span>
            <span className="font-medium">−{formatMoney(quote.couponDiscount)}</span>
          </div>
        ) : null}
        <div className="mt-2 flex items-end justify-between border-t border-line pt-2">
          <span className="font-semibold">To pay</span>
          <span className="font-display text-3xl font-semibold leading-none">{formatMoney(total)}</span>
        </div>
      </div>

      {formError ? <FormMessage>{formError}</FormMessage> : null}
      <Button type="submit" size="lg" loading={submitting} className="w-full">
        {submitting ? "Holding your slot…" : `Proceed to pay ${formatMoney(total)}`}
      </Button>
      <p className="text-center text-xs font-semibold text-muted">
        {user ? `Booking as ${user.email}` : "No account needed."} Secure payment · Instant confirmation
      </p>
    </form>
  );
}
