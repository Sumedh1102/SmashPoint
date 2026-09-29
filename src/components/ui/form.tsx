import type { ComponentProps, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 text-sm text-ink placeholder:text-subtle " +
  "shadow-xs transition-[box-shadow,border-color] " +
  "focus:outline-none focus:border-brand focus:ring-3 focus:ring-brand/15 focus-visible:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-10 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-ink-soft", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | string[] | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      {children}
      {message ? (
        <p className="mt-1.5 text-sm text-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        type="checkbox"
        className="peer mt-0.5 size-4.5 shrink-0 cursor-pointer appearance-none rounded border border-line-strong bg-white transition checked:border-brand checked:bg-brand focus-visible:outline-2 focus-visible:outline-brand bg-[length:12px] bg-center bg-no-repeat checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M20 6 9 17l-5-5%22/></svg>')]"
        {...props}
      />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Switch({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4", className)}>
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-muted">{description}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span className="h-6 w-10 rounded-full bg-line-strong transition peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/** Radio options rendered as selectable cards. */
export function RadioCards<T extends string | number>({
  name,
  options,
  value,
  defaultValue,
  onChange,
  className,
}: {
  name: string;
  options: { value: T; label: ReactNode; description?: ReactNode; disabled?: boolean }[];
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("grid gap-2", className)}>
      {options.map((opt) => (
        <label
          key={String(opt.value)}
          className={cn(
            "relative flex cursor-pointer flex-col rounded-lg border border-line-strong bg-white px-4 py-3 transition hover:border-subtle has-[:checked]:border-brand has-[:checked]:bg-brand-50 has-[:checked]:ring-1 has-[:checked]:ring-brand has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
          )}
        >
          <input
            type="radio"
            name={name}
            value={String(opt.value)}
            className="sr-only"
            disabled={opt.disabled}
            {...(value !== undefined ? { checked: value === opt.value } : { defaultChecked: defaultValue === opt.value })}
            onChange={() => onChange?.(opt.value)}
          />
          <span className="text-sm font-semibold">{opt.label}</span>
          {opt.description ? <span className="mt-0.5 text-xs text-muted">{opt.description}</span> : null}
        </label>
      ))}
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  if (!children) return null;
  const tones = {
    error: "border-danger/20 bg-danger-soft text-danger",
    success: "border-success/20 bg-success-soft text-success",
    info: "border-brand-100 bg-brand-50 text-brand-700",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
