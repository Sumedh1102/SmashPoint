"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { changePassword } from "@/server/actions/admin";
import { FormMessage, fieldError } from "./form-message";

export function PasswordForm() {
  const [state, dispatch, pending] = useActionState(changePassword, null);
  return (
    <form key={state?.ok ? "saved" : "form"} onSubmit={submitWithoutReset(dispatch)} className="max-w-md space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="current" label="Current password" error={fieldError(state, "current")}>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field id="password" label="New password" hint="At least 12 characters." error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
      </Field>
      <Field id="confirm" label="Confirm new password" error={fieldError(state, "confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" variant="dark" disabled={pending}>
        {pending ? <Spinner /> : null} Change password
      </Button>
    </form>
  );
}
