import Link from "next/link";
import { formatHour } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScheduleCell } from "@/server/queries/admin";

type Court = { id: string; slug: string; name: string; status: string; sport: { name: string }; cells: ScheduleCell[] };

/** Merges consecutive hours that belong to the same booking or block into one span. */
function spans(cells: ScheduleCell[]) {
  const out: { cell: ScheduleCell; span: number }[] = [];
  for (const cell of cells) {
    const prev = out.at(-1);
    const same =
      prev &&
      ((prev.cell.kind === "booking" && cell.kind === "booking" && prev.cell.code === cell.code) ||
        (prev.cell.kind === "block" && cell.kind === "block" && prev.cell.reason === cell.reason) ||
        (prev.cell.kind === "closure" && cell.kind === "closure"));
    if (same) prev.span++;
    else out.push({ cell, span: 1 });
  }
  return out;
}

/** Day view of every court, 7 AM – 10 PM: bookings, payment holds, blocks and the academy closure. */
export function ScheduleGrid({ hours, courts, linkCourts = true }: { hours: number[]; courts: Court[]; linkCourts?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[60rem] table-fixed border-separate border-spacing-1 text-xs">
        <caption className="sr-only">Court schedule by hour</caption>
        <thead>
          <tr>
            <th scope="col" className="w-40 px-2 text-left font-semibold text-subtle">
              Court
            </th>
            {hours.map((h) => (
              <th key={h} scope="col" className="px-1 text-left font-medium text-subtle">
                {formatHour(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {courts.map((c) => (
            <tr key={c.id}>
              <th scope="row" className="px-2 text-left text-sm leading-tight font-semibold">
                {linkCourts ? (
                  <Link href={`/admin/courts/${c.slug}`} className="hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  c.name
                )}
              </th>
              {spans(c.cells).map(({ cell, span }, i) => {
                const base = "h-12 rounded-lg px-2 align-middle";
                if (cell.kind === "booking") {
                  const held = cell.status === "PENDING" || cell.status === "PAYMENT_INITIATED";
                  return (
                    <td key={i} colSpan={span} className={cn(base, held ? "bg-warning-soft text-warning ring-1 ring-warning/25 ring-inset" : "bg-court text-white")}>
                      <Link href={`/admin/bookings/${cell.code}`} className="block truncate leading-tight hover:underline" title={`${cell.code} · ${cell.customer}`}>
                        <span className="font-semibold">{held ? "Hold · " : ""}{cell.customer}</span>
                        <span className="block opacity-75">{cell.code}</span>
                      </Link>
                    </td>
                  );
                }
                if (cell.kind === "block") {
                  return (
                    <td key={i} colSpan={span} className={cn(base, "bg-ink text-white/80")} title={cell.reason ?? undefined}>
                      <span className="block truncate font-semibold">{cell.type === "MAINTENANCE" ? "Maintenance" : "Blocked"}</span>
                      {cell.reason ? <span className="block truncate opacity-70">{cell.reason}</span> : null}
                    </td>
                  );
                }
                if (cell.kind === "closure") {
                  return (
                    <td key={i} colSpan={span} className={cn(base, "hatched bg-paper-2 text-muted ring-1 ring-line ring-inset")}>
                      <span className="block truncate font-semibold">{cell.label}</span>
                    </td>
                  );
                }
                return <td key={i} className={cn(base, "bg-white ring-1 ring-line ring-inset")} aria-label="Free" />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 px-1 text-xs text-muted">
        <li className="flex items-center gap-2"><span className="size-3 rounded bg-court" /> Confirmed</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded bg-warning-soft ring-1 ring-warning/30" /> Payment hold</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded bg-ink" /> Blocked / maintenance</li>
        <li className="flex items-center gap-2"><span className="hatched size-3 rounded bg-paper-2 ring-1 ring-line" /> Academy session</li>
        <li className="flex items-center gap-2"><span className="size-3 rounded bg-white ring-1 ring-line" /> Free</li>
      </ul>
    </div>
  );
}
