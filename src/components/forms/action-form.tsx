"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Checkbox, Field, FormMessage, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { FieldErrors } from "@/lib/validation";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";

type Result = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; fieldErrors?: FieldErrors };

const FormCtx = createContext<{ errors?: FieldErrors; pending: boolean }>({ pending: false });

/**
 * Wraps a server action with useActionState: shows field errors inline, a toast on
 * success/failure, and optionally resets or navigates after success.
 */
export function ActionForm<S extends Result>({
  action,
  children,
  className,
  resetOnSuccess,
  successHref,
  onSuccess,
  showFormError = true,
  id,
}: {
  action: (prev: S | null, formData: FormData) => Promise<S>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  successHref?: string;
  onSuccess?: () => void;
  showFormError?: boolean;
  id?: string;
}) {
  const [rawState, formAction, pending] = useActionState<S | null, FormData>(action, null);
  const state = rawState as Result | null;
  const toast = useToast();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Saved");
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
      if (successHref) router.push(successHref);
    } else {
      toast.error(state.fieldErrors ? "Please fix the highlighted fields" : "Couldn't save", state.fieldErrors ? undefined : state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <FormCtx.Provider value={{ errors: state && !state.ok ? state.fieldErrors : undefined, pending }}>
      <form ref={ref} id={id} onSubmit={submitWithoutReset(formAction)} className={className} noValidate>
        {children}
        {showFormError && state && !state.ok && !state.fieldErrors ? (
          <div className="mt-4">
            <FormMessage>{state.error}</FormMessage>
          </div>
        ) : null}
      </form>
    </FormCtx.Provider>
  );
}

export function useFormCtx() {
  return useContext(FormCtx);
}

type BaseProps = { name: string; label: ReactNode; hint?: ReactNode; required?: boolean; className?: string };

export function TextField({
  name,
  label,
  hint,
  required,
  className,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
  min,
  max,
  step,
  inputMode,
}: BaseProps & {
  type?: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const { errors } = useFormCtx();
  const err = errors?.[name];
  return (
    <Field label={label} htmlFor={`f-${name}`} hint={hint} error={err} required={required} className={className}>
      <Input
        id={`f-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        aria-invalid={!!err}
      />
    </Field>
  );
}

export function TextareaField({ name, label, hint, required, className, defaultValue, rows, placeholder }: BaseProps & { defaultValue?: string | null; rows?: number; placeholder?: string }) {
  const { errors } = useFormCtx();
  const err = errors?.[name];
  return (
    <Field label={label} htmlFor={`f-${name}`} hint={hint} error={err} required={required} className={className}>
      <Textarea id={`f-${name}`} name={name} defaultValue={defaultValue ?? undefined} rows={rows} placeholder={placeholder} aria-invalid={!!err} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  required,
  className,
  defaultValue,
  options,
  placeholder,
}: BaseProps & { defaultValue?: string | null; options: { value: string; label: string }[]; placeholder?: string }) {
  const { errors } = useFormCtx();
  const err = errors?.[name];
  return (
    <Field label={label} htmlFor={`f-${name}`} hint={hint} error={err} required={required} className={className}>
      <Select id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""} aria-invalid={!!err}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function CheckboxField({ name, label, description, defaultChecked, value = "on" }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean; value?: string }) {
  return <Checkbox name={name} label={label} description={description} defaultChecked={defaultChecked} value={value} />;
}

export function SwitchField({ name, label, description, defaultChecked }: { name: string; label: ReactNode; description?: ReactNode; defaultChecked?: boolean }) {
  return <Switch name={name} label={label} description={description} defaultChecked={defaultChecked} />;
}

/** Weekday picker posting `days` (0–6) as repeated fields. */
export function DaysField({ name = "days", label, defaultValue = [] }: { name?: string; label: ReactNode; defaultValue?: number[] }) {
  const { errors } = useFormCtx();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <label key={d} className="cursor-pointer">
            <input type="checkbox" name={name} value={d} defaultChecked={defaultValue.includes(d)} className="peer sr-only" />
            <span className="inline-grid h-10 min-w-12 place-items-center rounded-lg border border-line bg-white px-2 text-sm font-medium transition peer-checked:bg-brand peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
              {days[d]}
            </span>
          </label>
        ))}
      </div>
      {errors?.[name] ? <p className="mt-1.5 text-sm font-semibold text-danger">{errors[name]![0]}</p> : null}
    </fieldset>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", className }: { children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string }) {
  const { pending } = useFormCtx();
  return (
    <Button type="submit" variant={variant} size={size} loading={pending} className={className}>
      {children}
    </Button>
  );
}
