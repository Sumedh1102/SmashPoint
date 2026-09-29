import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, addMonths, dayOfWeek, endOfMonth, startOfMonth } from "@/lib/time";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TONE: Record<string, string> = {
  PRESENT: "bg-success text-white",
  LATE: "bg-warning text-ink",
  ABSENT: "bg-danger text-white",
  LEAVE: "bg-brand-200 text-ink",
};
const SHORT: Record<string, string> = { PRESENT: "P", LATE: "L", ABSENT: "A", LEAVE: "Lv" };

/** Month grid with one chip per recorded session (server component). */
export function AttendanceCalendar({ month, records, hrefFor, today }: { month: string; records: { date: string; status: string; batchName: string }[]; hrefFor: (month: string) => string; today: string }) {
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const lead = (dayOfWeek(first) + 6) % 7;
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  const byDate = new Map<string, typeof records>();
  for (const r of records) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={hrefFor(addMonths(first, -1).slice(0, 7))} className="grid size-9 place-items-center rounded-lg border border-line bg-white hover:bg-paper" aria-label="Previous month">
          <ChevronLeft className="size-4" />
        </Link>
        <p className="font-display text-lg font-semibold">
          {MONTHS[Number(first.slice(5, 7)) - 1]} {first.slice(0, 4)}
        </p>
        <Link href={hrefFor(addMonths(first, 1).slice(0, 7))} className="grid size-9 place-items-center rounded-lg border border-line bg-white hover:bg-paper" aria-label="Next month">
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <span key={d} className="py-1 text-[11px] font-semibold uppercase text-muted">
            {d}
          </span>
        ))}
        {days.map((d, i) =>
          d ? (
            <div key={d} className={cn("min-h-14 rounded-lg border p-1 text-left", d === today ? "border-brand" : "border-line", d > today && "opacity-50")}>
              <p className="text-xs font-medium">{Number(d.slice(8))}</p>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {(byDate.get(d) ?? []).map((r, k) => (
                  <span key={k} title={`${r.batchName}: ${r.status}`} className={cn("rounded px-1 text-[10px] font-semibold", TONE[r.status])}>
                    {SHORT[r.status]}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <span key={`p${i}`} />
          ),
        )}
      </div>
    </div>
  );
}
