"use client";

import { useActionState, useEffect } from "react";
import { ArrowRight, CircleCheck } from "lucide-react";
import { registerForEvent } from "@/server/actions/public";
import { runCheckout } from "@/components/payments/checkout";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";

export function EventRegistrationForm({
  eventId,
  divisions,
  fee,
  defaults,
  closedReason,
}: {
  eventId: string;
  divisions: string[];
  fee: number;
  defaults?: { name?: string; email?: string; phone?: string | null };
  closedReason?: string | null;
}) {
  const [state, action, pending] = useActionState(registerForEvent, null);
  const toast = useToast();

  useEffect(() => {
    if (!state) return;
    if (state.ok && state.data?.checkout) {
      void runCheckout(state.data.checkout, { onError: (m) => toast.error("Payment not completed", m) });
    } else if (state.ok) {
      toast.success("Registration received", state.message);
    } else {
      toast.error("Couldn't register", state.error);
    }
  }, [state, toast]);

  if (closedReason) return <FormMessage tone="info">{closedReason}</FormMessage>;

  if (state?.ok && !state.data?.checkout) {
    return (
      <div className="rounded-2xl border border-line bg-success-soft p-6 text-center">
        <CircleCheck className="mx-auto size-10 text-success" />
        <p className="mt-3 font-display text-2xl font-semibold">You&apos;re registered!</p>
        <p className="mt-1 text-sm">{state.message}</p>
      </div>
    );
  }

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form onSubmit={submitWithoutReset(action)} className="grid gap-4" noValidate>
      <input type="hidden" name="eventId" value={eventId} />
      <Field label="Participant name" htmlFor="participantName" required error={errors?.participantName}>
        <Input id="participantName" name="participantName" defaultValue={defaults?.name} autoComplete="name" required aria-invalid={!!errors?.participantName} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" required error={errors?.email}>
          <Input id="email" name="email" type="email" defaultValue={defaults?.email} autoComplete="email" required aria-invalid={!!errors?.email} />
        </Field>
        <Field label="Phone" htmlFor="phone" required error={errors?.phone}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults?.phone ?? ""} autoComplete="tel" required aria-invalid={!!errors?.phone} />
        </Field>
      </div>
      {divisions.length ? (
        <Field label="Category" htmlFor="division" required error={errors?.division}>
          <Select id="division" name="division" defaultValue={divisions[0]}>
            {divisions.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      {state && !state.ok && !errors ? <FormMessage>{state.error}</FormMessage> : null}
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {fee > 0 ? `Register & pay ${formatMoney(fee)}` : "Register for free"} <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}
