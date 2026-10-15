import { cn } from "@/lib/utils";
import { site } from "@/content/site";

/** The mark: a court corner (service lines) with a shuttle in flight. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="var(--color-lime)" />
      <path d="M7 25V11M7 25h14M11.5 25V15.5H25" fill="none" stroke="var(--color-ink)" strokeWidth="2.2" strokeLinecap="square" />
      <circle cx="22.5" cy="9.5" r="3" fill="var(--color-ink)" />
    </svg>
  );
}

export function Wordmark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <Mark />
      <span className={cn("display text-[1.45rem] leading-none tracking-[0.01em]", tone === "light" ? "text-white" : "text-ink")}>{site.name}</span>
    </span>
  );
}
