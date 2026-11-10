import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Status tones follow the surface (dark on the site, light in the admin's .surface-light). */
const tones = {
  neutral: "bg-fg/8 text-fg-muted ring-edge",
  success: "bg-success/12 text-success ring-success/30",
  warning: "bg-warning/12 text-warning ring-warning/30",
  danger: "bg-danger/12 text-danger ring-danger/30",
  info: "bg-info/12 text-info ring-info/30",
  neon: "bg-neon text-ink ring-neon",
  dark: "bg-ink text-white ring-ink",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Availability dot: neon when a court has free time, grey otherwise. */
export function LiveDot({ live, className }: { live: boolean; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", live ? "bg-neon" : "bg-ink-line-strong", className)} />;
}
