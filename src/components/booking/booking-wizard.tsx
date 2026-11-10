"use client";

import { ArrowRight, Check, Info, Layers, Lock, RefreshCw } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { courtImage } from "@/components/home/court-images";
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

type StepState = "done" | "current" | "upcoming";

function StepBlock({ n, title, state, hint, children }: { n: number; title: string; state: StepState; hint?: ReactNode; children: ReactNode }) {
  return (
    <section
      id={`booking-step-${n}`}
      aria-labelledby={`step-${n}`}
      className={cn(
        "scroll-mt-28 rounded-[1.25rem] border bg-white p-4 transition-[border-color,box-shadow] duration-300 sm:p-6",
        state === "current" ? "border-royal/40 shadow-md" : "border-line shadow-sm",
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors",
            state === "done" ? "bg-royal text-white" : state === "current" ? "bg-gold text-ink" : "bg-paper-2 text-subtle",
          )}
        >
          {state === "done" ? <Check className="size-4" strokeWidth={3} /> : n}
        </span>
        <h3 id={`step-${n}`} className="display text-[1.45rem] sm:text-[1.7rem]">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h3>
      </div>
      {hint ? <div className="-mt-1 mb-4 text-sm text-muted">{hint}</div> : null}
      {children}
    </section>
  );
}

/** Progress across the whole flow: five on-page steps, then checkout (details, review, pay). */
function Progress({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <nav aria-label="Booking progress" className="mb-6">
      <ol className="no-scrollbar relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {steps.map((s, i) => (
          <li key={s.label} className="flex shrink-0 items-center gap-2" aria-current={s.state === "current" ? "step" : undefined}>
            <a
              href={i < 5 ? `#booking-step-${i + 1}` : "#booking-summary"}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-1.5 text-xs transition-colors",
                s.state === "current" ? "border-ink bg-ink text-white" : s.state === "done" ? "border-royal/25 bg-royal-50 text-ink" : "border-line bg-white text-subtle",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full text-[0.68rem] font-bold",
                  s.state === "current" ? "bg-gold text-ink" : s.state === "done" ? "bg-royal text-white" : "bg-paper-2 text-subtle",
                )}
              >
                {s.state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="font-semibold">{s.label}</span>
              <span className="sr-only">{s.state === "done" ? "(done)" : s.state === "current" ? "(current step)" : "(to do)"}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function AvailabilityBadge({ court, count, loading }: { court: PublicCourt; count: number | undefined; loading: boolean }) {
  if (court.status === "MAINTENANCE") return <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.7rem] font-semibold text-muted">Maintenance</span>;
  if (count === undefined) return <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.7rem] font-semibold text-muted">{loading ? "Checking…" : "—"}</span>;
  if (count === 0) return <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[0.7rem] font-semibold text-danger">Fully booked</span>;
  if (count <= 3)
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.7rem] font-semibold text-warning">
        {count} {count === 1 ? "slot" : "slots"} left
      </span>
    );
  return <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-semibold text-success">{count} slots free</span>;
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

  // A sport card, price row or court card elsewhere on the page asked to book something.
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

  const sportName = court?.sport.name ?? (sport ? sports.find((s) => s.slug === sport)?.name : null) ?? null;
  const progress: { label: string; state: StepState }[] = [
    { label: "Sport", state: sport ? "done" : "current" },
    { label: "Court", state: court ? "done" : sport ? "current" : "upcoming" },
    { label: "Date", state: court ? "done" : "upcoming" },
    { label: "Duration", state: court ? "done" : "upcoming" },
    { label: "Time", state: selectedSlot ? "done" : court ? "current" : "upcoming" },
    { label: "Details & pay", state: selectedSlot ? "current" : "upcoming" },
  ];

  const summaryRows: [string, string | null][] = [
    ["Sport", sportName],
    ["Court", court ? court.name : null],
    ["Surface", court?.surface ?? null],
    ["Date", formatDate(date, "long")],
    ["Time", selectedSlot ? `${formatMinutes(selectedSlot.startMinute)} – ${formatMinutes(selectedSlot.endMinute)}` : null],
    ["Duration", formatDuration(duration)],
  ];

  const canContinue = paymentsEnabled && !!selection;

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10", selection && "pb-24 lg:pb-0")}>
      <div className="min-w-0">
        <Progress steps={progress} />
        <p className="sr-only" aria-live="polite">
          {loading ? "Loading availability" : (notice ?? "")}
        </p>

        <div className="space-y-5">
          <StepBlock n={1} title="Choose your sport" state={sport ? "done" : "current"}>
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
                      "group flex items-center gap-3 rounded-2xl border p-3 text-left transition-[background-color,border-color,color,box-shadow] duration-200 sm:flex-col sm:items-start sm:p-5",
                      active ? "border-ink bg-ink text-white shadow-md" : "border-line bg-paper text-ink hover:border-royal/50 hover:bg-white",
                    )}
                  >
                    <span className={cn("grid size-10 place-items-center rounded-full sm:size-12", active ? "bg-gold text-ink" : "bg-white text-royal ring-1 ring-line")}>
                      <SportIcon sport={s.slug} className="size-6 sm:size-7" />
                    </span>
                    <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 sm:block">
                      <span className="display block text-[1.3rem] leading-none sm:text-[1.5rem]">{s.name}</span>
                      <span className={cn("block text-xs sm:mt-1.5", active ? "text-white/70" : "text-muted")}>From {formatMoney(s.from)}/hr</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </StepBlock>

          {sport ? (
            <StepBlock
              n={2}
              title="Choose your court"
              state={court ? "done" : "current"}
              hint={
                sport === "pickleball" ? (
                  <span className="flex items-start gap-2 rounded-xl border border-gold/50 bg-gold-50 px-3 py-2.5 font-medium text-ink">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
                    {PICKLEBALL_NOTICE}
                  </span>
                ) : null
              }
            >
              <div role="group" aria-label="Court" className="grid gap-3 sm:grid-cols-2">
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
                        "flex items-stretch gap-3 overflow-hidden rounded-2xl border p-2.5 text-left transition-[background-color,border-color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-55",
                        active ? "border-royal bg-royal-50/70 shadow-[0_0_0_1px_var(--color-royal)]" : "border-line bg-white hover:border-royal/50",
                      )}
                    >
                      <span className="relative w-20 shrink-0 overflow-hidden rounded-xl bg-ink sm:w-24">
                        <Image src={courtImage(c.slug, c.sport.slug)} alt="" fill sizes="96px" className="object-cover object-[center_80%]" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col py-0.5">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-bold text-ink">{c.name}</span>
                          <span aria-hidden className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2", active ? "border-royal bg-royal" : "border-line-strong")}>
                            {active ? <span className="size-1.5 rounded-full bg-white" /> : null}
                          </span>
                        </span>
                        {c.surface ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-royal-700">
                            <Layers aria-hidden className="size-3.5" /> {c.surface}
                          </span>
                        ) : null}
                        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2">
                          <AvailabilityBadge court={c} count={count} loading={loading} />
                          <span className="tabular text-xs text-muted">
                            <span className="font-semibold text-ink">{formatMoney(c.price1h)}</span>/1 h · <span className="font-semibold text-ink">{formatMoney(c.price2h)}</span>/2 h
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </StepBlock>
          ) : null}

          {court ? (
            <>
              <StepBlock n={3} title="Select a date" state="done">
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

              <StepBlock n={4} title="Choose duration" state="done" hint="A two-hour booking needs both consecutive hours free.">
                <div role="group" aria-label="Duration" className="grid grid-cols-2 gap-3 sm:max-w-lg">
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
                          "relative flex flex-col items-start rounded-2xl border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] duration-200",
                          active ? "border-ink bg-ink text-white shadow-md" : "border-line bg-white text-ink hover:border-royal/50",
                        )}
                      >
                        <span className="text-sm font-bold">{formatDuration(d)}</span>
                        <span className={cn("tabular mt-1 text-2xl font-bold", active ? "text-gold" : "text-ink")}>{formatMoney(priceForDuration(court, d))}</span>
                        {saving > 0 ? (
                          <span className={cn("mt-1 rounded-full px-2 py-0.5 text-[0.68rem] font-bold", active ? "bg-white/12 text-white" : "bg-success-soft text-success")}>
                            Save {formatMoney(saving)}
                          </span>
                        ) : (
                          <span className={cn("mt-1 text-[0.7rem]", active ? "text-white/60" : "text-muted")}>{d === 60 ? "Single hour" : "Two consecutive hours"}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </StepBlock>

              <StepBlock
                n={5}
                title="Pick a time"
                state={selectedSlot ? "done" : "current"}
                hint={`Courts can be booked online from ${describeHours(hours)}, every day. Bookings start on the hour.`}
              >
                <div ref={slotsRef} className="space-y-5">
                  <SlotLegend holdMinutes={holdMinutes} />
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
            <p className="rounded-[1.25rem] border border-dashed border-line-strong bg-white/60 px-5 py-6 text-sm text-muted">
              Choose a sport to see its courts, prices and live availability.
            </p>
          )}
        </div>
      </div>

      {/* Summary: sticky card on desktop */}
      <aside id="booking-summary" aria-label="Booking summary" className="hidden lg:block">
        <div className="surface-dark sticky top-24 overflow-hidden rounded-[1.25rem] bg-ink text-white shadow-lg">
          <div className="court-lines border-b border-white/10 px-6 pt-6 pb-5">
            <p className="eyebrow text-gold">Your booking</p>
            <p className="display mt-3 flex items-center gap-2.5 text-[1.7rem]">
              {sport ? (
                <span className="grid size-9 place-items-center rounded-full bg-gold text-ink">
                  <SportIcon sport={sport} className="size-5" />
                </span>
              ) : null}
              {court?.name ?? sportName ?? "Choose a sport"}
            </p>
          </div>
          <div className="px-6 py-5">
            <dl className="space-y-3 text-sm">
              {summaryRows
                .filter(([k, v]) => k !== "Surface" || v)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className={cn("text-right font-medium", !v && "text-ink-muted/70")}>{v ?? "—"}</dd>
                  </div>
                ))}
            </dl>
            <div className="mt-5 flex items-baseline justify-between border-t border-white/10 pt-5">
              <span className="text-sm text-ink-muted">Total</span>
              {selectedSlot ? (
                <span className="display tabular text-[2.4rem] leading-none text-gold">{formatMoney(selectedSlot.price)}</span>
              ) : court ? (
                <span className="tabular text-sm text-white/80">{formatMoney(priceForDuration(court, duration))} · pick a time</span>
              ) : (
                <span className="text-sm text-ink-muted">Choose a court</span>
              )}
            </div>
            {sport === "pickleball" ? <p className="mt-4 rounded-xl bg-white/8 px-3 py-2.5 text-xs text-white/80">{PICKLEBALL_NOTICE}</p> : null}
            <Button
              size="lg"
              className="mt-5 w-full uppercase tracking-wide disabled:bg-white/10 disabled:text-white/50 disabled:opacity-100 disabled:shadow-none"
              disabled={!canContinue}
              onClick={() => setCheckoutOpen(true)}
            >
              Continue <ArrowRight className="size-4" />
            </Button>
            {!paymentsEnabled ? (
              <p className="mt-3 text-xs text-ink-muted">Online payments are being set up, so bookings can&apos;t be completed online yet.</p>
            ) : (
              <p className="mt-3 flex gap-2 text-xs text-ink-muted">
                <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Secure payment with Razorpay. Your slot is held for {holdMinutes} minutes while you pay.
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Summary: bottom bar on phones and tablets */}
      {selection ? (
        <div role="region" aria-label="Selected slot" className="surface-dark safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/97 px-4 pt-3 text-white backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">
                {selection.courtName} · {formatMinutes(selection.startMinute)}
              </p>
              <p className="truncate text-ink-muted">
                {formatDate(date, "weekday")} · {formatDuration(duration)} · <span className="font-bold text-gold">{formatMoney(selection.price)}</span>
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
