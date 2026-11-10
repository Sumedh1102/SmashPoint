"use client";

import { useActionState, useState } from "react";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { cancelBookingAction, refundBookingAction } from "@/server/actions/admin";
import { formatMoney } from "@/lib/format";
import { FormMessage, fieldError } from "./form-message";

/** Cancel an active booking. Refunding is an explicit choice, never automatic. */
export function CancelBookingForm({ bookingId, paidAmount }: { bookingId: string; paidAmount: number | null }) {
  const [state, dispatch, pending] = useActionState(cancelBookingAction, null);
  const [refund, setRefund] = useState(paidAmount ? "yes" : "no");
  const [confirmed, setConfirmed] = useState(false);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form onSubmit={submitWithoutReset(dispatch)} className="space-y-4" noValidate>
      <input type="hidden" name="bookingId" value={bookingId} />
      <FormMessage state={state} />
      <Field id="cancel-reason" label="Reason" hint="Shown to the customer on their booking page and in the refund email." error={fieldError(state, "reason")}>
        <Textarea id="cancel-reason" name="reason" rows={2} maxLength={200} required />
      </Field>
      {paidAmount ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Payment of {formatMoney(paidAmount)}</legend>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-paper">
            <input type="radio" name="refund" value="yes" checked={refund === "yes"} onChange={() => setRefund("yes")} className="mt-1 accent-[var(--color-ink)]" />
            <span>
              <span className="font-semibold">Cancel and refund in full</span>
              <span className="block text-muted">Razorpay refunds the customer&apos;s original payment method. The booking is only cancelled if Razorpay accepts the refund.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-ink has-[:checked]:bg-paper">
            <input type="radio" name="refund" value="no" checked={refund === "no"} onChange={() => setRefund("no")} className="mt-1 accent-[var(--color-ink)]" />
            <span>
              <span className="font-semibold">Cancel without a refund</span>
              <span className="block text-muted">The payment stays as it is. You can still refund it later from this page.</span>
            </span>
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="refund" value="no" />
      )}
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-4 accent-[var(--color-danger)]" />
        I understand this frees the slot and can&apos;t be undone.
      </label>
      <Button type="submit" variant="danger" disabled={!confirmed || pending}>
        {pending ? <Spinner /> : null}
        {refund === "yes" && paidAmount ? `Cancel & refund ${formatMoney(paidAmount)}` : "Cancel booking"}
      </Button>
    </form>
  );
}

export function RefundForm({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [state, dispatch, pending] = useActionState(refundBookingAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form onSubmit={submitWithoutReset(dispatch)} className="space-y-3" noValidate>
      <input type="hidden" name="bookingId" value={bookingId} />
      <FormMessage state={state} />
      <Field id="refund-reason" label="Refund reason" error={fieldError(state, "reason")}>
        <Textarea id="refund-reason" name="reason" rows={2} maxLength={200} required />
      </Field>
      <Button type="submit" variant="dark" disabled={pending}>
        {pending ? <Spinner /> : null} Refund {formatMoney(amount)} via Razorpay
      </Button>
    </form>
  );
}
