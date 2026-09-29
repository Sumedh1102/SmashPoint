import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Top-down court drawings with regulation markings, used as calm cover art wherever a
 * photo hasn't been uploaded yet. Units are metres × 10.
 */

export type CourtArtKind = "badminton" | "pickleball" | "basketball" | "facility";

const PALETTE: Record<CourtArtKind, { surround: string; court: string; accent: string; line: string }> = {
  badminton: { surround: "#1f3d35", court: "#2b5447", accent: "#2b5447", line: "rgba(255,255,255,0.88)" },
  pickleball: { surround: "#1b2f48", court: "#27486e", accent: "#335b88", line: "rgba(255,255,255,0.9)" },
  basketball: { surround: "#4a3524", court: "#a87c52", accent: "#8b5e3c", line: "rgba(255,255,255,0.85)" },
  facility: { surround: "#1c1f25", court: "#2a2e36", accent: "#2a2e36", line: "rgba(255,255,255,0.35)" },
};

export function courtArtKind(slug: string | null | undefined): CourtArtKind {
  if (slug === "badminton" || slug === "pickleball" || slug === "basketball") return slug;
  return "facility";
}

function Frame({ w, h, pad, kind, className, label, children }: { w: number; h: number; pad: number; kind: CourtArtKind; className?: string; label?: string; children: ReactNode }) {
  const p = PALETTE[kind];
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
      preserveAspectRatio="xMidYMid slice"
      className={cn("block size-full", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} fill={p.surround} />
      <rect x={0} y={0} width={w} height={h} fill={p.court} />
      <g fill="none" stroke={p.line} strokeWidth={0.5} strokeLinecap="square">
        {children}
      </g>
    </svg>
  );
}

function Badminton({ className, label }: { className?: string; label?: string }) {
  // 13.4 m × 6.1 m doubles court, drawn landscape.
  const W = 134;
  const H = 61;
  const net = W / 2;
  const ssl = 19.8; // short service line from net
  const lsl = 7.6; // doubles long service line from back
  const side = 4.6; // singles sideline inset
  return (
    <Frame w={W} h={H} pad={24} kind="badminton" className={className} label={label}>
      <rect x={0} y={0} width={W} height={H} />
      <line x1={0} y1={side} x2={W} y2={side} />
      <line x1={0} y1={H - side} x2={W} y2={H - side} />
      <line x1={net - ssl} y1={0} x2={net - ssl} y2={H} />
      <line x1={net + ssl} y1={0} x2={net + ssl} y2={H} />
      <line x1={lsl} y1={0} x2={lsl} y2={H} />
      <line x1={W - lsl} y1={0} x2={W - lsl} y2={H} />
      <line x1={0} y1={H / 2} x2={net - ssl} y2={H / 2} />
      <line x1={net + ssl} y1={H / 2} x2={W} y2={H / 2} />
      <line x1={net} y1={-3} x2={net} y2={H + 3} strokeWidth={1.1} stroke="rgba(255,255,255,0.95)" />
    </Frame>
  );
}

function Pickleball({ className, label }: { className?: string; label?: string }) {
  // 13.41 m × 6.1 m, 2.13 m non-volley zone each side of the net.
  const W = 134;
  const H = 61;
  const net = W / 2;
  const kitchen = 21.3;
  const p = PALETTE.pickleball;
  return (
    <Frame w={W} h={H} pad={24} kind="pickleball" className={className} label={label}>
      <rect x={net - kitchen} y={0} width={kitchen * 2} height={H} fill={p.accent} stroke="none" />
      <rect x={0} y={0} width={W} height={H} />
      <line x1={net - kitchen} y1={0} x2={net - kitchen} y2={H} />
      <line x1={net + kitchen} y1={0} x2={net + kitchen} y2={H} />
      <line x1={0} y1={H / 2} x2={net - kitchen} y2={H / 2} />
      <line x1={net + kitchen} y1={H / 2} x2={W} y2={H / 2} />
      <line x1={net} y1={-3} x2={net} y2={H + 3} strokeWidth={1.1} stroke="rgba(255,255,255,0.95)" />
    </Frame>
  );
}

function Basketball({ className, label }: { className?: string; label?: string }) {
  // 28 m × 15 m (FIBA).
  const W = 280;
  const H = 150;
  const cy = H / 2;
  const hoop = 15.75;
  const keyW = 58;
  const keyH = 49;
  const three = 67.5;
  const corner = 9; // three-point line inset from sideline
  const p = PALETTE.basketball;
  const arc = (side: 1 | -1) => {
    const hx = side === 1 ? hoop : W - hoop;
    const y1 = corner;
    const y2 = H - corner;
    const dx = Math.sqrt(three * three - (cy - corner) ** 2);
    const x = hx + side * dx;
    const base = side === 1 ? 0 : W;
    return `M ${base} ${y1} L ${x} ${y1} A ${three} ${three} 0 0 ${side === 1 ? 1 : 0} ${x} ${y2} L ${base} ${y2}`;
  };
  return (
    <Frame w={W} h={H} pad={40} kind="basketball" className={className} label={label}>
      <rect x={0} y={cy - keyH / 2} width={keyW} height={keyH} fill={p.accent} stroke="none" />
      <rect x={W - keyW} y={cy - keyH / 2} width={keyW} height={keyH} fill={p.accent} stroke="none" />
      <rect x={0} y={0} width={W} height={H} />
      <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
      <circle cx={W / 2} cy={cy} r={18} />
      <rect x={0} y={cy - keyH / 2} width={keyW} height={keyH} />
      <rect x={W - keyW} y={cy - keyH / 2} width={keyW} height={keyH} />
      <circle cx={keyW} cy={cy} r={18} />
      <circle cx={W - keyW} cy={cy} r={18} />
      <path d={arc(1)} />
      <path d={arc(-1)} />
      <circle cx={hoop} cy={cy} r={2.3} strokeWidth={0.8} />
      <circle cx={W - hoop} cy={cy} r={2.3} strokeWidth={0.8} />
    </Frame>
  );
}

function Facility({ className, label }: { className?: string; label?: string }) {
  const W = 160;
  const H = 100;
  return (
    <Frame w={W} h={H} pad={0} kind="facility" className={className} label={label}>
      {Array.from({ length: 7 }, (_, i) => (
        <line key={i} x1={(i + 1) * 20} y1={0} x2={(i + 1) * 20} y2={H} strokeWidth={0.3} />
      ))}
      {Array.from({ length: 4 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * 20} x2={W} y2={(i + 1) * 20} strokeWidth={0.3} />
      ))}
    </Frame>
  );
}

export function CourtArt({ kind, className, label }: { kind: CourtArtKind; className?: string; label?: string }) {
  if (kind === "badminton") return <Badminton className={className} label={label} />;
  if (kind === "pickleball") return <Pickleball className={className} label={label} />;
  if (kind === "basketball") return <Basketball className={className} label={label} />;
  return <Facility className={className} label={label} />;
}

/** An uploaded photo when there is one, otherwise the matching court drawing. */
export function CoverImage({
  src,
  alt,
  kind = "facility",
  className,
  imgClassName,
  priority,
}: {
  src?: string | null;
  alt: string;
  kind?: CourtArtKind;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-ink", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- uploaded media comes from Supabase Storage or /uploads; sizes vary
        <img src={src} alt={alt} className={cn("absolute inset-0 size-full object-cover", imgClassName)} loading={priority ? "eager" : "lazy"} decoding="async" />
      ) : (
        <CourtArt kind={kind} className="absolute inset-0" label={alt} />
      )}
    </div>
  );
}
