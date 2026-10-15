"use client";

import { useActionState, useState } from "react";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createBlockAction, deleteBlockAction, updateCourtAction } from "@/server/actions/admin";
import { formatHour } from "@/lib/format";
import { FormMessage, fieldError } from "./form-message";

const HOURS = Array.from({ length: 16 }, (_, i) => 7 * 60 + i * 60); // 7 AM … 10 PM

export function BlockForm({ courtId, today, isBadminton }: { courtId: string; today: string; isBadminton: boolean }) {
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
        <input type="checkbox" name="wholeDay" value="yes" checked={wholeDay} onChange={(e) => setWholeDay(e.target.checked)} className="size-4 accent-[var(--color-court)]" />
        Whole day
      </label>
      {!wholeDay ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="block-from" label="From" error={fieldError(state, "startMinute")}>
            <Select id="block-from" name="startMinute" defaultValue={String(9 * 60)}>
              {HOURS.slice(0, -1).map((m) => (
                <option key={m} value={m}>
                  {formatHour(m)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="block-to" label="Until">
            <Select id="block-to" name="endMinute" defaultValue={String(10 * 60)}>
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
        Blocks can&apos;t cover existing bookings — cancel those first.{isBadminton ? " The 5–7 PM academy closure always applies and isn't changed here." : ""}
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

export function CourtSettingsForm({
  court,
  upcoming,
}: {
  court: { id: string; description: string | null; status: string; hourlyRate: number; peakHourlyRate: number };
  upcoming: number;
}) {
  const [state, dispatch, pending] = useActionState(updateCourtAction, null);
  const [status, setStatus] = useState(court.status);
  return (
    <form onSubmit={submitWithoutReset(dispatch)} className="space-y-4" noValidate>
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="court-rate" label="Off-peak price / hour (₹)" error={fieldError(state, "hourlyRate")}>
          <Input id="court-rate" name="hourlyRate" type="number" min={0} step={1} inputMode="numeric" defaultValue={court.hourlyRate / 100} required />
        </Field>
        <Field id="court-peak" label="Peak price / hour (₹)" hint="Peak: 5 PM – 10 PM" error={fieldError(state, "peakHourlyRate")}>
          <Input id="court-peak" name="peakHourlyRate" type="number" min={0} step={1} inputMode="numeric" defaultValue={court.peakHourlyRate / 100} required />
        </Field>
      </div>
      <Field id="court-desc" label="Description" optional>
        <Textarea id="court-desc" name="description" rows={2} maxLength={400} defaultValue={court.description ?? ""} />
      </Field>
      <p className="text-xs text-muted">New prices apply to bookings made from now on; existing bookings keep the price that was paid.</p>
      <Button type="submit" variant="dark" disabled={pending}>
        {pending ? <Spinner /> : null} Save court
      </Button>
    </form>
  );
}
