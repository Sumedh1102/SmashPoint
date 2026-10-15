import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-paper-2 text-muted ring-line",
  court: "bg-court-50 text-court ring-court/20",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/25",
  danger: "bg-danger-soft text-danger ring-danger/20",
  info: "bg-info-soft text-info ring-info/20",
  lime: "bg-lime text-ink ring-lime-600",
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

/** Live-availability dot: lime pulse when free, muted otherwise. */
export function LiveDot({ live, className }: { live: boolean; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", live ? "animate-pulse-dot bg-lime" : "bg-subtle", className)} />;
}
