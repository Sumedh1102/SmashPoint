"use client";

import { useActionState, useState } from "react";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createBlockAction, deleteBlockAction, updateBookingHoursAction, updateCourtAction } from "@/server/actions/admin";
import type { BookingHours } from "@/lib/booking/rules";
import { formatHour, formatMoney } from "@/lib/format";
import { MONTHLY_TERMS } from "@/lib/pricing";
import { FormMessage, fieldError } from "./form-message";

/** Hour marks from opening to closing, inclusive (e.g. 7 AM … 10 PM). */
function hourOptions(hours: BookingHours) {
  const out: number[] = [];
  for (let m = hours.openMinute; m <= hours.closeMinute; m += 60) out.push(m);
  return out;
}

export function BlockForm({ courtId, today, hours }: { courtId: string; today: string; hours: BookingHours }) {
  const HOURS = hourOptions(hours);
  const defaultFrom = Math.max(hours.openMinute, Math.min(9 * 60, hours.closeMinute - 60));
  const [state, dispatch, pending] = useActionState(createBlockAction, null);
  const [wholeDay, setWholeDay] = useState(false);
  return (
    <form key={state?.ok ? "done" : "form"} onSubmit={submitWithoutReset(dispatch)} className="space-y-4" noValidate>
      <input type="hidden" name="courtId" value={courtId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="block-type" label="Type">
          <Select id="block-type" name="type" defaultValue="BLOCKED">
            <option value="BLOCKED">Blocked (event, private use…)</option>
            <option value="MAINTENANCE">Maintenance</option>
          </Select>
        </Field>
        <Field id="block-reason" label="Reason" hint="Shown to customers on the slot." error={fieldError(state, "reason")}>
          <Input id="block-reason" name="reason" maxLength={200} required />
        </Field>
        <Field id="block-start" label="From date" error={fieldError(state, "startDate")}>
          <Input id="block-start" type="date" name="startDate" min={today} defaultValue={today} required />
        </Field>
        <Field id="block-end" label="To date" error={fieldError(state, "endDate")}>
          <Input id="block-end" type="date" name="endDate" min={today} defaultValue={today} required />
        </Field>
      </div>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="wholeDay" value="yes" checked={wholeDay} onChange={(e) => setWholeDay(e.target.checked)} className="size-4 accent-[var(--color-royal)]" />
        Whole day
      </label>
      {!wholeDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="block-from" label="From" error={fieldError(state, "startMinute")}>
            <Select id="block-from" name="startMinute" defaultValue={String(defaultFrom)}>
              {HOURS.slice(0, -1).map((m) => (
                <option key={m} value={m}>
                  {formatHour(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="block-to" label="Until">
            <Select id="block-to" name="endMinute" defaultValue={String(defaultFrom + 60)}>
              {HOURS.slice(1).map((m) => (
                <option key={m} value={m}>
                  {formatHour(m)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}
      <p className="text-xs text-muted">
        Blocks can&apos;t cover existing bookings — cancel those first. For a recurring closure (for example academy sessions at the same time every day), choose the
        date range and the hours.
      </p>
      <Button type="submit" variant="dark" disabled={pending}>
        {pending ? <Spinner /> : null} Block court
      </Button>
    </form>
  );
}

export function DeleteBlockButton({ blockId }: { blockId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <form
      action={async (fd) => {
        setPending(true);
        await deleteBlockAction(fd);
        setPending(false);
      }}
    >
      <input type="hidden" name="blockId" value={blockId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Spinner /> : null} Remove
      </Button>
    </form>
  );
}

type CourtForForm = {
  id: string;
  description: string | null;
  surface: string | null;
  status: string;
  price1h: number;
  price2h: number;
  monthlyPrice1m: number | null;
  monthlyPrice3m: number | null;
  monthlyPrice6m: number | null;
  monthlyPrice12m: number | null;
};

const rupeesValue = (paise: number | null) => (paise === null ? "" : String(paise / 100));

/** Rupee input with a ₹ prefix. */
function RupeeInput({ id, name, defaultValue, required, describedBy, invalid }: { id: string; name: string; defaultValue: string; required?: boolean; describedBy?: string; invalid?: boolean }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
        ₹
      </span>
      <Input id={id} name={name} type="text" inputMode="numeric" autoComplete="off" defaultValue={defaultValue} required={required} className="tabular pl-8" aria-describedby={describedBy} aria-invalid={invalid} />
    </div>
  );
}

/**
 * Status, surface, description and the court's rate card: the exact one-hour and two-hour
 * prices that online bookings charge, and the monthly plans shown on the website.
 */
export function CourtSettingsForm({ court, upcoming, sportName }: { court: CourtForForm; upcoming: number; sportName: string }) {
  const [state, dispatch, pending] = useActionState(updateCourtAction, null);
  const [status, setStatus] = useState(court.status);
  const [p1, setP1] = useState(rupeesValue(court.price1h));
  const [p2, setP2] = useState(rupeesValue(court.price2h));
  const n1 = Number(p1);
  const n2 = Number(p2);
  const saving = Number.isFinite(n1) && Number.isFinite(n2) && n1 > 0 && n2 > 0 ? n1 * 2 - n2 : 0;
  return (
    <form onSubmit={submitWithoutReset(dispatch)} className="space-y-5" noValidate>
      <input type="hidden" name="courtId" value={court.id} />
      <FormMessage state={state} />
      <Field id="court-status" label="Status">
        <Select id="court-status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">Active — bookable</option>
          <option value="MAINTENANCE">Maintenance — shown, not bookable</option>
          <option value="INACTIVE">Inactive — hidden from the website</option>
        </Select>
      </Field>
      {status !== "ACTIVE" && upcoming > 0 ? (
        <p className="rounded-xl border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning">
          This court has {upcoming} upcoming confirmed {upcoming === 1 ? "booking" : "bookings"}. Changing the status doesn&apos;t cancel them — cancel and refund each one from Bookings.
        </p>
      ) : null}

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Hourly rental — charged for online bookings</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="court-price1h" label="1 hour (₹)" error={fieldError(state, "price1h")}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
                ₹
              </span>
              <Input id="court-price1h" name="price1h" type="text" inputMode="numeric" autoComplete="off" value={p1} onChange={(e) => setP1(e.target.value)} required className="tabular pl-8" />
            </div>
          </Field>
          <Field
            id="court-price2h"
            label="2 hours (₹)"
            hint={saving > 0 ? `Package price — saves ${formatMoney(saving * 100)} vs two 1-hour bookings.` : "Package price for two consecutive hours (not necessarily 2 × the 1-hour price)."}
            error={fieldError(state, "price2h")}
          >
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">
                ₹
              </span>
              <Input id="court-price2h" name="price2h" type="text" inputMode="numeric" autoComplete="off" value={p2} onChange={(e) => setP2(e.target.value)} required className="tabular pl-8" />
            </div>
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">The same price applies at every time of day.</p>
      </fieldset>

      <fieldset className="rounded-xl border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Monthly rental plans — shown on the website (Mon–Sat)</legend>
        <div className="grid grid-cols-2 gap-3">
          {MONTHLY_TERMS.map((t) => {
            const err = fieldError(state, t.key);
            return (
              <Field key={t.key} id={`court-${t.key}`} label={`${t.label} (₹)`} error={err}>
                <RupeeInput id={`court-${t.key}`} name={t.key} defaultValue={rupeesValue(court[t.key])} invalid={!!err} />
              </Field>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">Optional: leave a plan blank if it isn&apos;t offered for this court. Monthly plans are arranged with the customer directly, not paid online.</p>
      </fieldset>

      <Field id="court-surface" label="Playing surface" optional hint={`Shown to customers, e.g. "Green Mat (5 mm)". ${sportName} courts with the same prices and surface share one row on the rate card.`}>
        <Input id="court-surface" name="surface" maxLength={80} defaultValue={court.surface ?? ""} />
      </Field>
      <Field id="court-desc" label="Description" optional>
        <Textarea id="court-desc" name="description" rows={2} maxLength={400} defaultValue={court.description ?? ""} />
      </Field>
      <p className="text-xs text-muted">New prices apply to bookings made from now on and appear on the website immediately; existing bookings keep the price that was paid.</p>
      <Button type="submit" variant="dark" disabled={pending}>
        {pending ? <Spinner /> : null} Save court
      </Button>
    </form>
  );
}

/** The daily online booking window (applies to every court). */
export function BookingHoursForm({ hours }: { hours: BookingHours }) {
  const [state, dispatch, pending] = useActionState(updateBookingHoursAction, null);
  const marks = Array.from({ length: 25 }, (_, i) => i * 60);
  return (
    <form onSubmit={submitWithoutReset(dispatch)} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <p className="text-sm text-muted">
        Online bookings must start and end within these hours (every day). The defaults, 7 AM – 10 PM, still need to be confirmed with the facility. Changing them doesn&apos;t affect
        existing bookings.
      </p>
      <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
        <Field id="hours-open" label="First slot starts" error={fieldError(state, "openMinute")}>
          <Select id="hours-open" name="openMinute" defaultValue={String(hours.openMinute)}>
            {marks.slice(0, -1).map((m) => (
              <option key={m} value={m}>
                {formatHour(m)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="hours-close" label="Last slot ends" error={fieldError(state, "closeMinute")}>
          <Select id="hours-close" name="closeMinute" defaultValue={String(hours.closeMinute)}>
            {marks.slice(1).map((m) => (
              <option key={m} value={m}>
                {m === 24 * 60 ? "Midnight" : formatHour(m)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Button type="submit" variant="dark" disabled={pending}>
        {pending ? <Spinner /> : null} Save booking hours
      </Button>
    </form>
  );
}
