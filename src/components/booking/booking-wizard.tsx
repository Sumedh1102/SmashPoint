"use client";

import { ArrowRight, Info, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/field";
import { Button, Spinner } from "@/components/ui/button";
import type { AvailabilityResult } from "@/lib/booking/engine";
import { closuresFor, DURATIONS } from "@/lib/booking/rules";
import { formatDate, formatDuration, formatMinutes, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PublicCourt } from "@/server/queries/public";
import { api, ApiError } from "./api";
import { CheckoutDialog, type CheckoutSelection } from "./checkout-dialog";
import { DateSelector } from "./date-selector";
import { useBookingSelection } from "./selection-context";
import { SportIcon } from "./sport-icon";
import { SlotLegend, TimeSlotGrid } from "./time-slot-grid";

const SPORT_ORDER = ["badminton", "pickleball", "basketball"];

function StepBlock({ n, title, hint, children, className }: { n: number; title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={`step-${n}`} className={cn("border-t border-line pt-7 first:border-t-0 first:pt-0", className)}>
      <div className="mb-4 flex items-baseline gap-3">
        <span aria-hidden className="display tabular text-[1.35rem] text-court">{String(n).padStart(2, "0")}</span>
        <h3 id={`step-${n}`} className="display text-[1.6rem] sm:text-[1.85rem]">
          {title}
        </h3>
      </div>
      {hint ? <div className="-mt-2 mb-4 text-sm text-muted">{hint}</div> : null}
      {children}
    </section>
  );
}

export function BookingWizard({
  courts,
  today,
  lastDate,
  holdMinutes,
  paymentsEnabled,
  initialCourtSlug,
}: {
  courts: PublicCourt[];
  today: string;
  lastDate: string;
  holdMinutes: number;
  paymentsEnabled: boolean;
  initialCourtSlug: string | null;
}) {
  const bookable = courts.filter((c) => c.status !== "INACTIVE");
  const sports = SPORT_ORDER.map((slug) => {
    const list = bookable.filter((c) => c.sport.slug === slug);
    return list.length ? { slug, name: list[0]!.sport.name, courts: list } : null;
  }).filter((s): s is NonNullable<typeof s> => !!s);

  const initial = bookable.find((c) => c.slug === initialCourtSlug) ?? null;
  const [sport, setSport] = useState<string | null>(initial?.sport.slug ?? null);
  const [courtId, setCourtId] = useState<string | null>(initial?.id ?? null);
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState<number>(60);
  const [start, setStart] = useState<number | null>(null);
  const [data, setData] = useState<AvailabilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const slotsRef = useRef<HTMLDivElement>(null);

  const sportCourts = useMemo(() => bookable.filter((c) => c.sport.slug === sport), [bookable, sport]);
  const court = bookable.find((c) => c.id === courtId) ?? null;

  // A court card elsewhere on the page asked to book a specific court.
  const { request } = useBookingSelection();
  useEffect(() => {
    if (!request) return;
    const c = bookable.find((x) => x.slug === request.slug);
    if (!c) return;
    setSport(c.sport.slug);
    setCourtId(c.id);
    setStart(null);
  }, [request?.nonce]); // only when a new request arrives


  // Live availability for every court of the chosen sport (one request feeds steps 2 and 5).
  useEffect(() => {
    if (!sport) return;
    const ctrl = new AbortController();
    setLoading(true);
    setLoadError(null);
    api<AvailabilityResult>(`/api/availability?date=${date}&duration=${duration}&sport=${sport}`, { signal: ctrl.signal })
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if ((err as Error).name === "AbortError") return;
        setLoadError(err instanceof ApiError ? err.message : "Couldn't load availability.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [sport, date, duration, reloadKey]);

  // Keep availability fresh while the visitor is choosing (paused in the background / during checkout).
  useEffect(() => {
    if (!sport || checkoutOpen) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setReloadKey((k) => k + 1);
    }, 45_000);
    return () => clearInterval(t);
  }, [sport, checkoutOpen]);

  const courtAvail = data && data.date === date && data.duration === duration ? data.courts.find((c) => c.courtId === courtId) : undefined;
  const slots = courtAvail?.slots ?? [];
  const selectedSlot = slots.find((s) => s.startMinute === start && s.state === "AVAILABLE") ?? null;

  // If a refresh shows the selected slot was taken, drop it and say so.
  useEffect(() => {
    if (start === null || !courtAvail) return;
    const s = courtAvail.slots.find((x) => x.startMinute === start);
    if (!s || s.state !== "AVAILABLE") {
      setStart(null);
      if (!checkoutOpen) setNotice("The time you picked was just taken or closed. Please choose another.");
    }
  }, [courtAvail, start, checkoutOpen]);

  const chooseSport = (slug: string) => {
    setSport(slug);
    const first = bookable.find((c) => c.sport.slug === slug && c.status === "ACTIVE") ?? bookable.find((c) => c.sport.slug === slug);
    setCourtId(first?.id ?? null);
    setStart(null);
    setNotice(null);
  };

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const noneLeftToday = date === today && slots.length > 0 && slots.every((s) => s.state !== "AVAILABLE") && slots.some((s) => s.state === "PAST");

  const selection: CheckoutSelection | null =
    court && selectedSlot
      ? { courtId: court.id, courtName: court.name, sportName: court.sport.name, date, startMinute: selectedSlot.startMinute, duration, price: selectedSlot.price, isPeak: selectedSlot.isPeak }
      : null;

  const summary = (
    <>
      <dl className="space-y-3 text-sm">
        {[
          ["Sport", court?.sport.name ?? (sport ? sports.find((s) => s.slug === sport)?.name : null)],
          ["Court", court?.name],
          ["Date", formatDate(date, "long")],
          ["Time", selectedSlot ? `${formatMinutes(selectedSlot.startMinute)} – ${formatMinutes(selectedSlot.endMinute)}` : null],
          ["Duration", formatDuration(duration)],
        ].map(([k, v]) => (
          <div key={k as string} className="flex justify-between gap-4">
            <dt className="text-ink-muted">{k}</dt>
            <dd className={cn("text-right font-medium", !v && "text-ink-muted/70")}>{v ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-white/10 pt-5">
        <span className="text-sm text-ink-muted">Total</span>
        <span className="display tabular text-[2.4rem] leading-none text-white">{selectedSlot ? formatMoney(selectedSlot.price) : "—"}</span>
      </div>
      {selectedSlot?.isPeak ? <p className="mt-1 text-right text-xs text-ink-muted">Includes peak-hour rate</p> : null}
    </>
  );

  const canContinue = paymentsEnabled && !!selection;

  return (
    <div className={cn("grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12", selection && "pb-24 lg:pb-0")}>
      <div className="space-y-9">
        <p className="sr-only" aria-live="polite">
          {loading ? "Loading availability" : notice ?? ""}
        </p>

        <StepBlock n={1} title="Select a sport">
          <div role="group" aria-label="Sport" className="grid grid-cols-3 gap-2 sm:gap-3">
            {sports.map((s) => {
              const active = sport === s.slug;
              return (
                <button
                  key={s.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => chooseSport(s.slug)}
                  className={cn(
                    "flex flex-col items-start gap-3 rounded-[var(--radius-card)] border p-3.5 text-left transition-[background-color,border-color,color] duration-200 sm:p-5",
                    active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink/60",
                  )}
                >
                  <SportIcon sport={s.slug} className={cn("size-7 sm:size-9", active ? "text-lime" : "text-court")} />
                  <span>
                    <span className="display block text-[1.2rem] leading-none sm:text-[1.55rem]">{s.name}</span>
                    <span className={cn("mt-1 block text-xs", active ? "text-white/60" : "text-muted")}>
                      {s.courts.length} {s.courts.length === 1 ? "court" : "courts"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </StepBlock>

        {sport ? (
          <StepBlock n={2} title="Select a court">
            <div role="group" aria-label="Court" className="grid gap-2 sm:grid-cols-2 sm:gap-3">
              {sportCourts.map((c) => {
                const active = c.id === courtId;
                const avail = data?.date === date && data.duration === duration ? data.courts.find((x) => x.courtId === c.id) : undefined;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    disabled={c.status !== "ACTIVE"}
                    onClick={() => {
                      setCourtId(c.id);
                      setStart(null);
                      setNotice(null);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4 py-3.5 text-left transition-[background-color,border-color] duration-200 disabled:opacity-50",
                      active ? "border-court bg-court-50 shadow-[inset_0_0_0_1px_var(--color-court)]" : "border-line bg-white hover:border-ink/60",
                    )}
                  >
                    <span>
                      <span className="block font-semibold">{c.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {c.status === "MAINTENANCE"
                          ? "Closed for maintenance"
                          : avail
                            ? `${avail.availableCount} ${avail.availableCount === 1 ? "slot" : "slots"} free on ${date === today ? "today" : formatDate(date, "weekday")}`
                            : loading
                              ? "Checking availability…"
                              : `From ${formatMoney(c.hourlyRate)} / hour`}
                      </span>
                    </span>
                    <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-court bg-court" : "border-line-strong")}>
                      {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </StepBlock>
        ) : null}

        {court ? (
          <>
            <StepBlock n={3} title="Select a date">
              <DateSelector
                value={date}
                today={today}
                lastDate={lastDate}
                onChange={(d) => {
                  setDate(d);
                  setStart(null);
                  setNotice(null);
                }}
              />
            </StepBlock>

            <StepBlock n={4} title="Select duration" hint="A two-hour booking needs both consecutive hours free.">
              <div role="group" aria-label="Duration" className="inline-grid grid-cols-2 rounded-full border border-line-strong bg-white p-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={duration === d}
                    onClick={() => {
                      setDuration(d);
                      setStart(null);
                      setNotice(null);
                    }}
                    className={cn("h-10 rounded-full px-6 text-sm font-semibold transition-colors", duration === d ? "bg-ink text-white" : "text-muted hover:text-ink")}
                  >
                    {formatDuration(d)}
                  </button>
                ))}
              </div>
            </StepBlock>

            <StepBlock
              n={5}
              title="Choose a time"
              hint={
                closuresFor(court.sport.slug).length ? (
                  <span className="flex gap-2">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-court" />
                    Badminton courts are reserved for academy sessions every day from 5:00 PM to 7:00 PM.
                  </span>
                ) : (
                  "Open every day from 7:00 AM to 10:00 PM."
                )
              }
            >
              <div ref={slotsRef} className="space-y-5">
                <SlotLegend showRestricted={closuresFor(court.sport.slug).length > 0} />
                {notice ? <Alert tone="warning">{notice}</Alert> : null}
                {loadError ? (
                  <Alert tone="danger" title="Availability couldn't be loaded">
                    <span className="flex flex-wrap items-center gap-3">
                      {loadError}
                      <Button size="sm" variant="outline" onClick={refresh}>
                        <RefreshCw className="size-3.5" /> Try again
                      </Button>
                    </span>
                  </Alert>
                ) : !courtAvail ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-hidden>
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="h-[4.25rem] animate-pulse rounded-xl bg-paper-2" />
                    ))}
                  </div>
                ) : (
                  <div className={cn("relative transition-opacity", loading && "opacity-60")}>
                    {loading ? <Spinner className="absolute -top-9 right-0 text-subtle" /> : null}
                    {courtAvail.availableCount === 0 ? (
                      <Alert tone="info" title={noneLeftToday ? "No more slots today" : "Fully booked"} className="mb-5">
                        {noneLeftToday ? "Today's remaining slots have passed. Try tomorrow or another date." : `${court.name} has no free ${formatDuration(duration).replace(/s$/, "")} slots on this date. Try another date, duration or court.`}
                      </Alert>
                    ) : null}
                    <TimeSlotGrid
                      slots={slots}
                      selected={start}
                      onSelect={(s) => {
                        setStart(s);
                        setNotice(null);
                      }}
                    />
                  </div>
                )}
              </div>
            </StepBlock>
          </>
        ) : sport ? null : (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-5 py-6 text-sm text-muted">Choose a sport to see its courts and live availability.</p>
        )}
      </div>

      {/* Summary: sticky card on desktop */}
      <aside aria-label="Booking summary" className="hidden lg:block">
        <div className="sticky top-24 rounded-[var(--radius-card)] bg-ink p-6 text-white shadow-lg">
          <p className="eyebrow text-lime">Your booking</p>
          <div className="mt-5">{summary}</div>
          <Button size="lg" className="mt-6 w-full" disabled={!canContinue} onClick={() => setCheckoutOpen(true)}>
            Continue <ArrowRight className="size-4" />
          </Button>
          {!paymentsEnabled ? (
            <p className="mt-3 text-xs text-ink-muted">Online payments are being set up, so bookings can't be completed online yet.</p>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">Secure payment with Razorpay. Your slot is held for {holdMinutes} minutes while you pay.</p>
          )}
        </div>
      </aside>

      {/* Summary: bottom bar on phones and tablets */}
      {selection ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/95 px-4 pt-3 text-white backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">
                {selection.courtName} · {formatMinutes(selection.startMinute)}
              </p>
              <p className="truncate text-ink-muted">
                {formatDate(date, "weekday")} · {formatDuration(duration)} · <span className="font-semibold text-white">{formatMoney(selection.price)}</span>
              </p>
            </div>
            <Button size="lg" disabled={!canContinue} onClick={() => setCheckoutOpen(true)} className="shrink-0">
              Continue
            </Button>
          </div>
          {!paymentsEnabled ? <p className="mx-auto mt-2 max-w-3xl text-xs text-ink-muted">Online payments are being set up.</p> : null}
        </div>
      ) : null}

      <CheckoutDialog
        open={checkoutOpen}
        selection={selection}
        holdMinutes={holdMinutes}
        onClose={() => setCheckoutOpen(false)}
        onSlotUnavailable={(message) => {
          setCheckoutOpen(false);
          setStart(null);
          setNotice(message);
          refresh();
          slotsRef.current?.scrollIntoView({ block: "center" });
        }}
        onReleased={refresh}
      />
    </div>
  );
}
