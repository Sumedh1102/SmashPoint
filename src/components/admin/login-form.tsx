"use client";

import { useActionState } from "react";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";
import { Button, Spinner } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { login } from "@/server/actions/admin";
import { FormMessage, fieldError } from "./form-message";

export function LoginForm() {
  const [state, dispatch, pending] = useActionState(login, null);
  return (
    <form onSubmit={submitWithoutReset(dispatch)} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="email" label="Email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field id="password" label="Password" error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : null} Sign in
      </Button>
    </form>
  );
}
