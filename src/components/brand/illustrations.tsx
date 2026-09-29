import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

const INK = "#0b0b0f";
const BLUE = "#1f47ff";

/** Shuttlecock motif — used sparingly (logo, hero, empty states). */
export function Shuttlecock({ className, feather = "white", cork = INK, band = BLUE, ...props }: SVGProps<SVGSVGElement> & { feather?: string; cork?: string; band?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden {...props}>
      <path d="M10 6h44L41 38H23L10 6Z" fill={feather} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M21 6l7 32M32 6v32M43 6l-7 32M15.5 20h33" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="21" y="37" width="22" height="7" rx="2" fill={band} stroke={INK} strokeWidth="3.5" />
      <path d="M22 44h20a10 10 0 0 1-20 0Z" fill={cork} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Racket({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 128" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="32" cy="34" rx="24" ry="30" fill="white" stroke={INK} strokeWidth="4" />
      <g stroke={INK} strokeOpacity="0.35" strokeWidth="1.5">
        {[14, 20, 26, 32, 38, 44, 50].map((x) => (
          <line key={`v${x}`} x1={x} y1="8" x2={x} y2="60" />
        ))}
        {[12, 18, 24, 30, 36, 42, 48, 54].map((y) => (
          <line key={`h${y}`} x1="9" y1={y} x2="55" y2={y} />
        ))}
      </g>
      <ellipse cx="32" cy="34" rx="24" ry="30" stroke={INK} strokeWidth="4" />
      <path d="M26 63l6 16 6-16" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <rect x="29" y="78" width="6" height="18" fill={INK} />
      <rect x="25" y="94" width="14" height="30" rx="4" fill={BLUE} stroke={INK} strokeWidth="4" />
    </svg>
  );
}

/** Top-down badminton court with regulation markings (13.4 m × 6.1 m). */
export function CourtDiagram({ className, lines = "white", surface = BLUE, highlight }: { className?: string; lines?: string; surface?: string; highlight?: "left" | "right" }) {
  const s = 20; // px per metre
  const W = 13.4 * s;
  const H = 6.1 * s;
  const sw = 2.5;
  return (
    <svg viewBox={`-6 -6 ${W + 12} ${H + 12}`} className={cn("h-auto w-full", className)} aria-hidden>
      <rect x={0} y={0} width={W} height={H} fill={surface} />
      {highlight ? <rect x={highlight === "left" ? 0.76 * s : 8.68 * s} y={0.46 * s} width={3.96 * s} height={2.59 * s} fill="white" fillOpacity={0.18} /> : null}
      <g stroke={lines} strokeWidth={sw} fill="none">
        <rect x={0} y={0} width={W} height={H} />
        <line x1={0} y1={0.46 * s} x2={W} y2={0.46 * s} />
        <line x1={0} y1={H - 0.46 * s} x2={W} y2={H - 0.46 * s} />
        <line x1={0.76 * s} y1={0} x2={0.76 * s} y2={H} />
        <line x1={W - 0.76 * s} y1={0} x2={W - 0.76 * s} y2={H} />
        <line x1={4.72 * s} y1={0} x2={4.72 * s} y2={H} />
        <line x1={8.68 * s} y1={0} x2={8.68 * s} y2={H} />
        <line x1={0} y1={H / 2} x2={4.72 * s} y2={H / 2} />
        <line x1={8.68 * s} y1={H / 2} x2={W} y2={H / 2} />
      </g>
      <line x1={W / 2} y1={-5} x2={W / 2} y2={H + 5} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <circle cx={W / 2} cy={-5} r={3.5} fill={INK} />
      <circle cx={W / 2} cy={H + 5} r={3.5} fill={INK} />
    </svg>
  );
}

export function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden>
      <path d="M18 8h28v14a14 14 0 0 1-28 0V8Z" fill="#f2a900" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M18 13H9v4a9 9 0 0 0 9 9M46 13h9v4a9 9 0 0 1-9 9" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M32 36v10M22 56h20l-2-10H24l-2 10Z" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" fill="white" />
    </svg>
  );
}

/** Decorative tiles for the gallery / about page (placeholders that read as intentional art). */
export function GalleryArt({ variant, className }: { variant: string; className?: string }) {
  switch (variant) {
    case "shuttle":
      return (
        <div className={cn("grid place-items-center bg-brand-100", className)}>
          <Shuttlecock className="w-1/3" />
        </div>
      );
    case "trophy":
      return (
        <div className={cn("grid place-items-center bg-warning-soft", className)}>
          <Trophy className="w-1/3" />
        </div>
      );
    case "racket":
      return (
        <div className={cn("grid place-items-center bg-paper-2", className)}>
          <Racket className="h-3/4" />
        </div>
      );
    case "grid":
      return (
        <div className={cn("bg-ink grid place-items-center", className)}>
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className={cn("size-5 rounded-md border border-white", i % 3 === 0 ? "bg-brand" : "bg-transparent")} />
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className={cn("grid place-items-center bg-brand p-6", className)}>
          <CourtDiagram />
        </div>
      );
  }
}
