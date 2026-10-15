import Link from "next/link";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ScheduleGrid } from "@/components/admin/schedule-grid";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatDate, formatMoney } from "@/lib/format";
import { addDays, isValidISODate } from "@/lib/time";
import { getScheduleForDate, listCourtsAdmin } from "@/server/queries/admin";
import { bookingWindow } from "@/server/services/bookings";
import { getBookingSettings } from "@/server/settings";

export const metadata = { title: "Courts" };

export default async function AdminCourtsPage({ searchParams }: PageProps<"/admin/courts">) {
  const { date: dateParam } = await searchParams;
  const { today } = bookingWindow(await getBookingSettings());
  const date = typeof dateParam === "string" && isValidISODate(dateParam) ? dateParam : today;
  const [courts, schedule] = await Promise.all([listCourtsAdmin(), getScheduleForDate(date)]);

  return (
    <>
      <PageHeader title="Courts" description="All five courts, their status and prices. Open a court to block slots for maintenance or events." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {courts.map(({ court, sport, upcoming30, blocks }) => (
          <Link key={court.id} href={`/admin/courts/${court.slug}`} className="rounded-[var(--radius-card)] border border-line bg-white p-5 transition-colors hover:border-ink">
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow text-subtle">{sport.name}</span>
              <Badge tone={court.status === "ACTIVE" ? "success" : court.status === "MAINTENANCE" ? "warning" : "neutral"}>
                {court.status === "ACTIVE" ? "Active" : court.status === "MAINTENANCE" ? "Maintenance" : "Inactive"}
              </Badge>
            </div>
            <p className="display mt-3 text-[1.6rem]">{court.name}</p>
            <p className="mt-2 text-sm text-muted">
              {formatMoney(court.hourlyRate)} / {formatMoney(court.peakHourlyRate)} peak
            </p>
            <p className="mt-1 text-sm text-muted">
              {upcoming30} confirmed in the next 30 days{blocks ? ` · ${blocks} block${blocks === 1 ? "" : "s"}` : ""}
            </p>
          </Link>
        ))}
      </div>

      <Panel
        title={`Schedule · ${formatDate(date, "weekday")}`}
        className="mt-6"
        actions={
          <form method="get" className="flex items-center gap-2">
            <Link href={`/admin/courts?date=${addDays(date, -1)}`} className={buttonClass({ variant: "outline", size: "sm" })} aria-label="Previous day">
              ←
            </Link>
            <Input type="date" name="date" defaultValue={date} className="h-9 w-40" aria-label="Date" />
            <button type="submit" className={buttonClass({ variant: "dark", size: "sm" })}>
              Go
            </button>
            <Link href={`/admin/courts?date=${addDays(date, 1)}`} className={buttonClass({ variant: "outline", size: "sm" })} aria-label="Next day">
              →
            </Link>
          </form>
        }
      >
        <div className="p-3 sm:p-4">
          <ScheduleGrid hours={schedule.hours} courts={schedule.courts} />
        </div>
      </Panel>
    </>
  );
}
