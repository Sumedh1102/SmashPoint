"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney, formatNumber } from "@/lib/format";

/*
 * Lightweight SVG charts. Specs: single hue per series, bars ≤ 24px with a 4px rounded
 * data-end on a single baseline, hairline recessive gridlines, per-mark hover/focus
 * tooltips, and a visually-hidden data table so no value is hover-gated.
 */

export type ValueFormat = "money" | "number" | "percent";

function fmt(value: number, format: ValueFormat) {
  if (format === "money") return formatMoney(value);
  if (format === "percent") return `${Math.round(value)}%`;
  return formatNumber(value);
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

function compact(value: number, format: ValueFormat) {
  const v = format === "money" ? value / 100 : value;
  const prefix = format === "money" ? "₹" : "";
  const suffix = format === "percent" ? "%" : "";
  if (Math.abs(v) >= 100000) return `${prefix}${+(v / 100000).toFixed(1)}L${suffix}`;
  if (Math.abs(v) >= 1000) return `${prefix}${+(v / 1000).toFixed(1)}K${suffix}`;
  return `${prefix}${Math.round(v)}${suffix}`;
}

export function BarChart({
  data,
  format = "number",
  height = 220,
  caption,
  accentIndex,
  className,
}: {
  data: { label: string; value: number; detail?: string }[];
  format?: ValueFormat;
  height?: number;
  caption: string;
  /** Index of the bar to emphasise (e.g. "today"); others use the lighter step. */
  accentIndex?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const padLeft = 44;
  const padBottom = 26;
  const padTop = 18;
  const width = 640;
  const plotW = width - padLeft - 8;
  const plotH = height - padBottom - padTop;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.62);
  const labelEvery = Math.ceil(data.length / 12);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);

  return (
    <figure className={cn("relative", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-cap`}>
        {ticks.map((t) => {
          const y = padTop + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padLeft} x2={width - 4} y1={y} y2={y} stroke="#0b0b0f" strokeOpacity={t === 0 ? 0.55 : 0.1} strokeWidth={1} />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="fill-muted text-[11px] font-semibold tabular-nums">
                {compact(t, format)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = max ? (d.value / max) * plotH : 0;
          const x = padLeft + band * i + (band - barW) / 2;
          const y = padTop + plotH - h;
          const r = Math.min(4, h / 2);
          const accent = accentIndex === undefined ? true : i === accentIndex;
          const path =
            h <= 0
              ? ""
              : `M${x},${padTop + plotH} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barW - r},${y} Q${x + barW},${y} ${x + barW},${y + r} L${x + barW},${padTop + plotH} Z`;
          return (
            <g
              key={i}
              tabIndex={0}
              role="listitem"
              aria-label={`${d.label}: ${fmt(d.value, format)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="cursor-default outline-none"
            >
              <rect x={padLeft + band * i} y={padTop} width={band} height={plotH} fill="transparent" />
              {path ? <path d={path} className={cn("transition-opacity", accent ? "fill-brand" : "fill-brand-200", hover !== null && hover !== i && "opacity-60")} /> : null}
              {i % labelEvery === 0 || i === data.length - 1 ? (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="fill-muted text-[11px] font-semibold">
                  {d.label}
                </text>
              ) : null}
              {i === peak && d.value > 0 && hover === null ? (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" className="fill-ink text-[11px] font-medium tabular-nums">
                  {compact(d.value, format)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] ? (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((padLeft + band * hover + band / 2) / width) * 100}%` }}
        >
          <p className="font-display text-sm font-semibold tabular-nums">{fmt(data[hover].value, format)}</p>
          <p className="font-semibold text-muted">{data[hover].detail ?? data[hover].label}</p>
        </div>
      ) : null}
      <figcaption id={`${id}-cap`} className="sr-only">
        {caption}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.detail ?? d.label}</th>
              <td>{fmt(d.value, format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars for ranked categories (e.g. court utilisation). Labels live outside the marks. */
export function HBarList({
  data,
  format = "number",
  caption,
}: {
  data: { label: string; value: number; detail?: string }[];
  format?: ValueFormat;
  caption: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure>
      <ul className="space-y-3" aria-label={caption}>
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm" title={d.detail}>
            <span className="truncate font-medium">{d.label}</span>
            <span className="h-2 rounded-full bg-paper-2">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="min-w-12 text-right font-medium tabular-nums">{fmt(d.value, format)}</span>
          </li>
        ))}
      </ul>
      <figcaption className="sr-only">{caption}</figcaption>
    </figure>
  );
}

const STATUS_COLORS = {
  PRESENT: { bar: "bg-success", label: "Present" },
  LATE: { bar: "bg-warning", label: "Late" },
  ABSENT: { bar: "bg-danger", label: "Absent" },
  LEAVE: { bar: "bg-brand-200", label: "Leave" },
} as const;

/** 100% stacked bar with a legend that always carries labels + counts (never colour alone). */
export function AttendanceBar({ counts, className }: { counts: Record<keyof typeof STATUS_COLORS, number>; className?: string }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = (Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((k) => ({ key: k, count: counts[k] ?? 0 }));
  return (
    <div className={className}>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full bg-paper-2" role="img" aria-label={entries.map((e) => `${STATUS_COLORS[e.key].label} ${e.count}`).join(", ")}>
        {total > 0
          ? entries
              .filter((e) => e.count > 0)
              .map((e) => <span key={e.key} className={STATUS_COLORS[e.key].bar} style={{ width: `${(e.count / total) * 100}%` }} title={`${STATUS_COLORS[e.key].label}: ${e.count}`} />)
          : null}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {entries.map((e) => (
          <li key={e.key} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-sm", STATUS_COLORS[e.key].bar)} aria-hidden />
            <span className="font-semibold text-muted">{STATUS_COLORS[e.key].label}</span>
            <span className="ml-auto font-medium tabular-nums">{e.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Tiny 2px trend line with an end marker (for stat tiles and skill trends). */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 8) + 4, h - 4 - ((v - min) / span) * (h - 8)] as const);
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-28", className)} role="img" aria-label={label}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--color-brand)" stroke="white" strokeWidth={2} />
    </svg>
  );
}
