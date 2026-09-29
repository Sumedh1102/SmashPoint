import Link from "next/link";
import { cn } from "@/lib/utils";

/** Monogram: a court outline with a centre line, in the brand's charcoal. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", inverted ? "bg-white text-ink" : "bg-ink text-white", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <rect x="4" y="3.5" width="16" height="17" rx="1.5" />
        <path d="M4 12h16" />
        <path d="M12 3.5v5M12 15.5v5" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" className="text-brand-200" />
      </svg>
    </span>
  );
}

export function Logo({ className, href = "/", inverted }: { className?: string; href?: string; inverted?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="SmashPoint Sports Arena — home">
      <LogoMark inverted={inverted} />
      <span className="leading-none">
        <span className={cn("block font-display text-[17px] font-bold tracking-tight", inverted ? "text-white" : "text-ink")}>SmashPoint</span>
        <span className={cn("mt-0.5 block text-[10px] font-medium uppercase tracking-[0.16em]", inverted ? "text-white/60" : "text-subtle")}>Sports Arena</span>
      </span>
    </Link>
  );
}
