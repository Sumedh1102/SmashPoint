import { Check, Trophy, Zap } from "lucide-react";
import { CourtDiagram, Shuttlecock } from "@/components/brand/illustrations";
import { FloatingTile } from "@/components/site/floating-tile";

const SLOTS = [
  { court: "Court 1", time: "5:00 PM", state: "open" },
  { court: "Court 2", time: "5:00 PM", state: "booked" },
  { court: "Court 3", time: "6:00 PM", state: "open" },
] as const;

/** Layered hero composition: court card + live-availability panel + stickers. */
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl pb-10 pl-4 pt-6 sm:pl-10 lg:max-w-none">
      <div className="relative rounded-[1.75rem] border border-line bg-white p-3 shadow-lg">
        <div className="bg-brand overflow-hidden rounded-2xl border border-line px-5 pb-6 pt-5">
          <div className="mb-4 flex items-center justify-between text-white">
            <span className="font-mono text-xs font-medium uppercase tracking-widest">Court 5 · Show court</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-white px-2 py-0.5 text-xs font-medium">
              <span className="size-2 animate-pulse rounded-full bg-success" /> Live
            </span>
          </div>
          <CourtDiagram highlight="right" />
        </div>
      </div>

      <div className="absolute -bottom-2 left-0 w-[17rem] rounded-2xl border border-line bg-white p-4 shadow-md sm:w-72">
        <p className="mb-3 flex items-center justify-between font-display text-sm font-semibold">
          Today&apos;s availability <span className="font-mono text-[11px] font-medium text-muted">4AM–7PM</span>
        </p>
        <ul className="grid gap-2">
          {SLOTS.map((s) => (
            <li key={s.court} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-sm">
              <span className="font-medium">
                {s.court} <span className="text-muted">· {s.time}</span>
              </span>
              {s.state === "open" ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 text-xs font-medium text-white">
                  <Check className="size-3" strokeWidth={4} /> Open
                </span>
              ) : (
                <span className="rounded-md bg-paper-2 px-1.5 py-0.5 text-xs font-medium text-muted line-through">Booked</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <span className="absolute -right-2 -top-2 rounded-2xl border border-line bg-warning px-4 py-2 font-display text-lg font-semibold shadow-sm sm:right-2">
        from ₹400/hr
      </span>
      <FloatingTile tone="white" rotate={-12} float className="absolute -left-3 top-1/3 hidden sm:inline-grid">
        <Shuttlecock className="size-8!" />
      </FloatingTile>
      <FloatingTile tone="ink" rotate={10} className="absolute bottom-16 right-2 hidden sm:inline-grid" size="sm">
        <Zap />
      </FloatingTile>
      <FloatingTile tone="soft" rotate={-6} className="absolute -bottom-6 right-24 hidden md:inline-grid" size="sm">
        <Trophy />
      </FloatingTile>
    </div>
  );
}
