import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Form controls follow the surface: black fields on the site, white ones in the admin. */
const control =
  "block w-full rounded-[var(--radius-control)] border border-edge-strong bg-field px-3.5 text-[0.95rem] text-fg placeholder:text-fg-subtle transition-colors focus:border-fg focus:outline-none focus:ring-2 focus:ring-fg/15 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20 disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-3", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-12 pr-9", className)} {...props} />;
}

/** Label + control + hint/error, wired up for screen readers via ids. */
export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-fg">
        {label}
        {optional ? <span className="text-xs font-normal text-fg-subtle">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children?: ReactNode; className?: string }) {
  const tones = {
    info: "border-info/35 bg-info/10 text-info",
    success: "border-success/35 bg-success/10 text-success",
    warning: "border-warning/35 bg-warning/10 text-warning",
    danger: "border-danger/35 bg-danger/10 text-danger",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-[var(--radius-control)] border px-4 py-3 text-sm", tones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn(title && "mt-0.5", "text-fg/85")}>{children}</div> : null}
    </div>
  );
}
