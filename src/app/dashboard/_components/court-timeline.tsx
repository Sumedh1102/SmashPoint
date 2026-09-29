import { formatMinutes, formatTimeRange } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = { kind: "booking" | "batch"; id: string; label: string; sub: string; startMinute: number; endMinute: number; status: string };
type Lane = { id: string; name: string; status: string; items: Item[] };

/** Horizontal day timeline per court: bookings in blue, training batches in ink. */
export function CourtTimeline({ lanes, openMinute, closeMinute, nowMinute }: { lanes: Lane[]; openMinute: number; closeMinute: number; nowMinute: number | null }) {
  const span = closeMinute - openMinute;
  const pos = (m: number) => `${((m - openMinute) / span) * 100}%`;
  const hours: number[] = [];
  for (let m = openMinute; m <= closeMinute; m += 120) hours.push(m);

  return (
    <div>
      <div className="hidden md:block">
        <div className="relative ml-24 h-6 text-[11px] font-medium text-muted">
          {hours.map((m) => (
            <span key={m} className="absolute -translate-x-1/2" style={{ left: pos(m) }}>
              {formatMinutes(m).replace(":00", "")}
            </span>
          ))}
        </div>
        <div className="grid gap-2">
          {lanes.map((lane) => (
            <div key={lane.id} className="flex items-center gap-3">
              <p className="w-21 shrink-0 truncate text-sm font-semibold">{lane.name}</p>
              <div className={cn("relative h-11 flex-1 rounded-xl border border-line", lane.status === "MAINTENANCE" ? "slot-stripes-warn bg-warning-soft" : "bg-paper")}>
                {hours.slice(1, -1).map((m) => (
                  <span key={m} className="absolute inset-y-0 w-px bg-ink/10" style={{ left: pos(m) }} aria-hidden />
                ))}
                {nowMinute !== null && nowMinute > openMinute && nowMinute < closeMinute ? (
                  <span className="absolute inset-y-[-4px] z-10 w-0.5 bg-danger" style={{ left: pos(nowMinute) }} aria-label="Now" />
                ) : null}
                {lane.items.map((it) => (
                  <div
                    key={`${it.kind}-${it.id}`}
                    title={`${it.label} · ${formatTimeRange(it.startMinute, it.endMinute)}${it.sub ? ` · ${it.sub}` : ""}`}
                    className={cn(
                      "absolute inset-y-1 overflow-hidden rounded-md border border-line px-1.5 py-0.5 text-[11px] font-medium leading-tight",
                      it.kind === "batch" ? "bg-ink text-white" : it.status === "CONFIRMED" || it.status === "PAID" ? "bg-brand text-white" : "bg-warning-soft",
                    )}
                    style={{ left: pos(it.startMinute), width: `calc(${pos(it.endMinute)} - ${pos(it.startMinute)})` }}
                  >
                    <span className="block truncate">{it.label}</span>
                  </div>
                ))}
                {lane.status === "MAINTENANCE" ? <span className="absolute inset-0 grid place-items-center text-xs font-semibold uppercase">Maintenance</span> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs font-medium text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line bg-brand" /> Booking</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line bg-ink" /> Training batch</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-line bg-warning-soft" /> Awaiting payment</span>
        </div>
      </div>

      <ul className="grid gap-3 md:hidden">
        {lanes.map((lane) => (
          <li key={lane.id} className="rounded-xl border border-line p-3">
            <p className="mb-2 flex items-center justify-between font-semibold">
              {lane.name} <span className="text-xs text-muted">{lane.items.length} items</span>
            </p>
            {lane.items.length ? (
              <ul className="grid gap-1 text-sm">
                {lane.items.map((it) => (
                  <li key={`${it.kind}-${it.id}`} className="flex justify-between gap-2">
                    <span className="truncate font-semibold">{it.label}</span>
                    <span className="shrink-0 font-mono text-xs font-medium text-muted">{formatTimeRange(it.startMinute, it.endMinute)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Free all day</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
