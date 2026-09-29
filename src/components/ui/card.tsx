import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "white" | "paper" | "blue" | "ink" | "brand-soft";
type Shadow = "none" | "sm" | "md" | "lg";

const tones: Record<Tone, string> = {
  white: "bg-white text-ink border-line",
  paper: "bg-paper text-ink border-line",
  blue: "bg-brand text-white border-brand",
  ink: "bg-ink text-white border-line",
  "brand-soft": "bg-brand-50 text-ink border-brand-100",
};

const shadows: Record<Shadow, string> = {
  none: "",
  sm: "shadow-xs",
  md: "shadow-sm",
  lg: "shadow-md",
};

export function Card({
  tone = "white",
  shadow = "md",
  interactive,
  className,
  ...props
}: ComponentProps<"div"> & { tone?: Tone; shadow?: Shadow; interactive?: boolean }) {
  return (
    <div
      className={cn("min-w-0 rounded-[var(--radius-card)] border", tones[tone], shadows[shadow], interactive && "lift-hover", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
