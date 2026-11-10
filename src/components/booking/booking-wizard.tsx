"use client";

import { ArrowRight, Info, Lock, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/field";
import { Button, Spinner } from "@/components/ui/button";
import { PICKLEBALL_NOTICE } from "@/content/sports";
import { priceForDuration, twoHourSaving, type AvailabilityResult } from "@/lib/booking/engine";
import { describeHours, DURATIONS, type BookingHours, type Duration } from "@/lib/booking/rules";
import { formatDate, formatDuration, formatMinutes, formatMoney } from "@/lib/format";
import { addDays } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { PublicCourt } from "@/server/queries/public";
import { api, ApiError } from "./api";
import { CheckoutDialog, type CheckoutSelection } from "./checkout-dialog";
import { DateSelector } from "./date-selector";
import { useBookingSelection } from "./selection-context";
import { SportIcon } from "./sport-icon";
import { SlotLegend, TimeSlotGrid } from "./time-slot-grid";

const SPORT_ORDER = ["badminton", "pickleball", "basketball"];

function StepBlock({ n, title, hint, children }: { n: number; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={`booking-step-${n}`} aria-labelledby={`step-${n}`} className="scroll-mt-28 border-t border-ink-line pt-7 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-baseline gap-3">
        <span aria-hidden className="display tabular text-[1.35rem] text-neon">
          {String(n).padStart(2, "0")}
        </span>
        <h3 id={`step-${n}`} className="display text-[1.6rem] sm:text-[1.85rem]">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h3>
      </div>
      {hint ? <div className="-mt-2 mb-4 text-sm text-ink-muted">{hint}</div> : null}
      {children}
    </section>
  );
}

/** Free slots on a court for the chosen date and duration, with a status dot. */
function Availability({ court, count, loading, date, today }: { court: PublicCourt; count: number | undefined; loading: boolean; date: string; today: string }) {
  const [dot, text] =
    court.status === "MAINTENANCE"
      ? ["bg-ink-line-strong", "Closed for maintenance"]
      : count === undefined
        ? ["bg-ink-line-strong", loading ? "Checking availability…" : "—"]
        : count === 0
          ? ["bg-danger", `Fully booked ${date === today ? "today" : `on ${formatDate(date, "weekday")}`}`]
          : [count <= 3 ? "bg-warning" : "bg-neon", `${count} ${count === 1 ? "slot" : "slots"} free ${date === today ? "today" : `on ${formatDate(date, "weekday")}`}`];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      {text}
    </span>
  );
}

export function BookingWizard({
  courts,
  today,
  lastDate,
  holdMinutes,
  hours,
  paymentsEnabled,
  initialCourtSlug,
  initialSportSlug,
}: {
  courts: PublicCourt[];
  today: string;
  lastDate: string;
  holdMinutes: number;
  hours: BookingHours;
  paymentsEnabled: boolean;
  initialCourtSlug: string | null;
  initialSportSlug: string | null;
}) {
  const bookable = useMemo(() => courts.filter((c) => c.status !== "INACTIVE"), [courts]);
  const sports = SPORT_ORDER.map((slug) => {
    const list = bookable.filter((c) => c.sport.slug === slug);
    return list.length ? { slug, name: list[0]!.sport.name, courts: list, from: Math.min(...list.map((c) => c.price1h)) } : null;
  }).filter((s): s is NonNullable<typeof s> => !!s);

  const firstCourtOf = useCallback(
    (sportSlug: string) => bookable.find((c) => c.sport.slug === sportSlug && c.status === "ACTIVE") ?? bookable.find((c) => c.sport.slug === sportSlug) ?? null,
    [bookable],
  );
  const initial = bookable.find((c) => c.slug === initialCourtSlug) ?? (initialSportSlug ? firstCourtOf(initialSportSlug) : null);
  const [sport, setSport] = useState<string | null>(initial?.sport.slug ?? null);
  const [courtId, setCourtId] = useState<string | null>(initial?.id ?? null);
  // Late in the evening every slot today has started: open on tomorrow instead.
  const [date, setDate] = useState(() => (courts.some((c) => c.remainingToday > 0) || lastDate <= today ? today : addDays(today, 1)));
  const [duration, setDuration] = useState<Duration>(60);
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

  // A sport row, price row or court card elsewhere on the page asked to book something.
  const { request } = useBookingSelection();
  useEffect(() => {
    if (!request) return;
    const c = request.kind === "court" ? bookable.find((x) => x.slug === request.slug) : firstCourtOf(request.slug);
    if (!c) return;
    setSport(c.sport.slug);
    setCourtId(c.id);
    setStart(null);
    setNotice(null);
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

  const fresh = data && data.date === date && data.duration === duration ? data : null;
  const courtAvail = fresh?.courts.find((c) => c.courtId === courtId);
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
    setCourtId(firstCourtOf(slug)?.id ?? null);
    setStart(null);
    setNotice(null);
  };

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);
  const noneLeftToday = date === today && slots.length > 0 && slots.every((s) => s.state !== "AVAILABLE") && slots.some((s) => s.state === "PAST");

  const selection: CheckoutSelection | null =
    court && selectedSlot
      ? {
          courtId: court.id,
          courtName: court.name,
          courtSurface: court.surface,
          sportName: court.sport.name,
          sportSlug: court.sport.slug,
          date,
          startMinute: selectedSlot.startMinute,
          duration,
          price: selectedSlot.price,
        }
      : null;

  const summaryRows: [string, string | null][] = [
    ["Sport", court?.sport.name ?? (sport ? (sports.find((s) => s.slug === sport)?.name ?? null) : null)],
    ["Court", court?.name ?? null],
    ...(court?.surface ? ([["Surface", court.surface]] as [string, string][]) : []),
    ["Date", formatDate(date, "long")],
    ["Time", selectedSlot ? `${formatMinutes(selectedSlot.startMinute)} – ${formatMinutes(selectedSlot.endMinute)}` : null],
    ["Duration", formatDuration(duration)],
  ];

  const canContinue = paymentsEnabled && !!selection;

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12", selection && "pb-24 lg:pb-0")}>
      <div className="min-w-0">
        <p className="sr-only" aria-live="polite">
          {loading ? "Loading availability" : (notice ?? "")}
        </p>

        <div className="space-y-9">
          <StepBlock n={1} title="Select a sport">
            <div role="group" aria-label="Sport" className="grid gap-2 sm:grid-cols-3 sm:gap-3">
              {sports.map((s) => {
                const active = sport === s.slug;
                return (
                  <button
                    key={s.slug}
                    type="button"
                    aria-pressed={active}
                    onClick={() => chooseSport(s.slug)}
                    className={cn(
                      "flex items-center gap-3.5 rounded-[var(--radius-card)] border p-3.5 text-left transition-[background-color,border-color,color] duration-200 sm:flex-col sm:items-start sm:gap-3 sm:p-5",
                      active ? "border-white bg-white text-ink" : "border-ink-line bg-ink-3 text-white hover:border-ink-line-strong",
                    )}
                  >
                    <SportIcon sport={s.slug} className={cn("size-8 shrink-0 sm:size-9", active ? "text-ink" : "text-neon")} />
                    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 sm:block">
                      <span className="display block text-[1.35rem] leading-none sm:text-[1.55rem]">{s.name}</span>
                      <span className={cn("block text-xs sm:mt-1.5", active ? "text-ink/65" : "text-ink-muted")}>From {formatMoney(s.from)}/hr</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </StepBlock>

          {sport ? (
            <StepBlock
              n={2}
              title="Select a court"
              hint={
                sport === "pickleball" ? (
                  <span className="flex items-start gap-2 font-medium text-white">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-neon" />
                    {PICKLEBALL_NOTICE}
                  </span>
                ) : null
              }
            >
              <div role="group" aria-label="Court" className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                {sportCourts.map((c) => {
                  const active = c.id === courtId;
                  const count = fresh?.courts.find((x) => x.courtId === c.id)?.availableCount;
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
                        active ? "border-white bg-ink-4" : "border-ink-line bg-ink-3 hover:border-ink-line-strong",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">{c.name}</span>
                        {c.surface ? <span className="mt-0.5 block text-sm text-white/85">{c.surface}</span> : null}
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
                          <Availability court={c} count={count} loading={loading} date={date} today={today} />
                          <span className="tabular">
                            {formatMoney(c.price1h)}/1 h · {formatMoney(c.price2h)}/2 h
                          </span>
                        </span>
                      </span>
                      <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-neon" : "border-ink-line-strong")}>
                        {active ? <span className="size-2 rounded-full bg-neon" /> : null}
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
                <div role="group" aria-label="Duration" className="inline-grid grid-cols-2 gap-1 rounded-[var(--radius-card)] border border-ink-line-strong bg-ink-3 p-1">
                  {DURATIONS.map((d) => {
                    const active = duration === d;
                    const saving = d === 120 ? twoHourSaving(court) : 0;
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setDuration(d);
                          setStart(null);
                          setNotice(null);
                        }}
                        className={cn(
                          "flex min-w-[8.5rem] flex-col items-start rounded-[0.5rem] px-4 py-2.5 text-left transition-colors sm:min-w-[10rem]",
                          active ? "bg-white text-ink" : "text-white hover:bg-white/6",
                        )}
                      >
                        <span className="text-sm font-semibold">{formatDuration(d)}</span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="tabular text-lg font-bold">{formatMoney(priceForDuration(court, d))}</span>
                          {saving > 0 ? <span className="rounded-full bg-neon px-1.5 py-px text-[0.64rem] font-bold text-ink">Save {formatMoney(saving)}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </StepBlock>

              <StepBlock n={5} title="Choose a time" hint={`Courts can be booked online from ${describeHours(hours)}, every day. Bookings start on the hour.`}>
                <div ref={slotsRef} className="space-y-5">
                  <SlotLegend holdMinutes={holdMinutes} />
                  {notice ? <Alert tone="warning">{notice}</Alert> : null}
                  {loadError ? (
                    <Alert tone="danger" title="Availability couldn't be loaded">
                      <span className="flex flex-wrap items-center gap-3">
                        {loadError}
                        <Button size="sm" variant="ghostLight" onClick={refresh}>
                          <RefreshCw className="size-3.5" /> Try again
                        </Button>
                      </span>
                    </Alert>
                  ) : !courtAvail ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-hidden>
                      {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="h-[4.25rem] animate-pulse rounded-[var(--radius-control)] bg-ink-3" />
                      ))}
                    </div>
                  ) : (
                    <div className={cn("relative transition-opacity", loading && "opacity-60")}>
                      {loading ? <Spinner className="absolute -top-9 right-0 text-ink-subtle" /> : null}
                      {courtAvail.availableCount === 0 ? (
                        <Alert tone="info" title={noneLeftToday ? "No more slots today" : "Fully booked"} className="mb-5">
                          {noneLeftToday
                            ? "Today's remaining slots have passed. Try tomorrow or another date."
                            : `${court.name} has no free ${duration === 60 ? "one-hour" : "two-hour"} slots on this date. Try another date, duration or court.`}
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
            <p className="rounded-[var(--radius-card)] border border-dashed border-ink-line-strong px-5 py-6 text-sm text-ink-muted">
              Choose a sport to see its courts, prices and live availability.
            </p>
          )}
        </div>
      </div>

      {/* Summary: sticky card on desktop */}
      <aside id="booking-summary" aria-label="Booking summary" className="hidden lg:block">
        <div className="sticky top-24 rounded-[var(--radius-card)] border border-ink-line bg-ink-3 p-6">
          <p className="eyebrow text-neon">Your booking</p>
          <dl className="mt-5 space-y-3 text-sm">
            {summaryRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-muted">{k}</dt>
                <dd className={cn("text-right font-medium", !v && "text-ink-subtle")}>{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex items-baseline justify-between border-t border-ink-line pt-5">
            <span className="text-sm text-ink-muted">Total</span>
            {selectedSlot ? (
              <span className="display tabular text-[2.4rem] leading-none text-neon">{formatMoney(selectedSlot.price)}</span>
            ) : court ? (
              <span className="tabular text-sm text-white/80">{formatMoney(priceForDuration(court, duration))} · choose a time</span>
            ) : (
              <span className="text-sm text-ink-muted">Choose a court</span>
            )}
          </div>
          {sport === "pickleball" ? <p className="mt-4 text-xs leading-relaxed text-ink-muted">{PICKLEBALL_NOTICE}</p> : null}
          <Button size="lg" className="mt-6 w-full disabled:bg-white/10 disabled:text-white/45 disabled:opacity-100" disabled={!canContinue} onClick={() => setCheckoutOpen(true)}>
            Continue <ArrowRight className="size-4" />
          </Button>
          {!paymentsEnabled ? (
            <p className="mt-3 text-xs text-ink-muted">Online payments are being set up, so bookings can&apos;t be completed online yet.</p>
          ) : (
            <p className="mt-3 flex gap-2 text-xs leading-relaxed text-ink-muted">
              <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Secure payment with Razorpay. Your slot is held for {holdMinutes} minutes while you pay.
            </p>
          )}
        </div>
      </aside>

      {/* Summary: bottom bar on phones and tablets */}
      {selection ? (
        <div role="region" aria-label="Selected slot" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink px-4 pt-3 text-white lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">
                {selection.courtName} · {formatMinutes(selection.startMinute)}
              </p>
              <p className="truncate text-ink-muted">
                {formatDate(date, "weekday")} · {formatDuration(duration)} · <span className="font-bold text-neon">{formatMoney(selection.price)}</span>
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
