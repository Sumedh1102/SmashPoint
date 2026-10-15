import { cn } from "@/lib/utils";

/** Line glyphs for the three sports (lucide has no badminton or pickleball icons). */
export function SportIcon({ sport, className }: { sport: string; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      {sport === "badminton" ? (
        <g {...common}>
          <path d="M11 21.5a5 5 0 0 0 7 0l1.5-1.5-7-7L11 14.5a5 5 0 0 0 0 7Z" />
          <path d="M19.5 20 27 5.5 12.5 13M16 16.5 25 6.5M23 9l-4.5 1.5M20 13.5l-1-3.5" />
        </g>
      ) : sport === "pickleball" ? (
        <g {...common}>
          <rect x="6" y="4" width="13" height="16" rx="6" transform="rotate(-30 12.5 12)" />
          <path d="m15.5 19.5 3.8 6.6" strokeWidth="3" />
          <circle cx="24.5" cy="10" r="3.2" />
          <circle cx="24" cy="9.2" r="0.5" fill="currentColor" />
          <circle cx="25.3" cy="10.8" r="0.5" fill="currentColor" />
        </g>
      ) : (
        <g {...common}>
          <circle cx="16" cy="16" r="11" />
          <path d="M5 16h22M16 5v22" />
          <path d="M8.2 8.2c3.6 3.6 3.6 12 0 15.6M23.8 8.2c-3.6 3.6-3.6 12 0 15.6" />
        </g>
      )}
    </svg>
  );
}
