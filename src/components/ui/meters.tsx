import { cn } from "@/lib/utils";

/** Donut ring for a single headline percentage (attendance, capacity). */
export function ProgressRing({ value, size = 120, label, sublabel, className }: { value: number; size?: number; label?: string; sublabel?: string; className?: string }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 80 ? "var(--color-brand)" : pct >= 60 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div className={cn("relative inline-grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-brand-50)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-2xl font-semibold leading-none">{Math.round(pct)}%</p>
        {label ? <p className="mt-1 text-xs font-medium text-muted">{label}</p> : null}
        {sublabel ? <p className="text-[11px] text-muted">{sublabel}</p> : null}
      </div>
      <span className="sr-only">{`${label ?? "Progress"}: ${Math.round(pct)}%`}</span>
    </div>
  );
}

/** Skill meter on a 1–10 scale; track is a lighter step of the same hue. */
export function SkillMeter({ label, value, previous }: { label: string; value: number; previous?: number | null }) {
  const delta = previous != null ? value - previous : null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-3 text-sm">
      <span className="font-medium">{label}</span>
      <span className="relative h-2 rounded-full bg-paper-2" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${value * 10}%` }} />
      </span>
      <span className="flex items-baseline justify-end gap-1 tabular-nums">
        <span className="font-display font-semibold">{value}</span>
        <span className="text-xs text-muted">/10</span>
        {delta ? (
          <span className={cn("text-[11px] font-medium", delta > 0 ? "text-success" : "text-danger")} aria-label={`${delta > 0 ? "up" : "down"} ${Math.abs(delta)}`}>
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function CapacityBar({ used, total }: { used: number; total: number }) {
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className="h-2 w-20 rounded-full bg-brand-50" aria-hidden>
        <span className={cn("block h-full rounded-full", pct >= 100 ? "bg-danger" : pct >= 85 ? "bg-warning" : "bg-brand")} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">
        {used}/{total}
      </span>
    </div>
  );
}
