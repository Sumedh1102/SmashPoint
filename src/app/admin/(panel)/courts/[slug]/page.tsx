import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BlockForm, CourtSettingsForm, DeleteBlockButton } from "@/components/admin/court-forms";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ScheduleGrid } from "@/components/admin/schedule-grid";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatDate, formatTimeRange } from "@/lib/format";
import { addDays, isValidISODate } from "@/lib/time";
import { getCourtAdmin, getScheduleForDate } from "@/server/queries/admin";
import { upcomingBookingCount } from "@/server/services/admin";
import { getBookingSettings, hoursOf } from "@/server/settings";

export async function generateMetadata({ params }: PageProps<"/admin/courts/[slug]">) {
  return { title: `Court · ${(await params).slug}` };
}

export default async function AdminCourtPage({ params, searchParams }: PageProps<"/admin/courts/[slug]">) {
  const { slug } = await params;
  const { date: dateParam } = await searchParams;
  const data = await getCourtAdmin(slug);
  if (!data) notFound();
  const { court, sport, blocks, today } = data;
  const date = typeof dateParam === "string" && isValidISODate(dateParam) ? dateParam : today;
  const [schedule, upcoming, settings] = await Promise.all([getScheduleForDate(date, court.id), upcomingBookingCount(court.id), getBookingSettings()]);

  return (
    <>
      <Link href="/admin/courts" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Courts
      </Link>
      <PageHeader eyebrow={sport.name} title={court.name} actions={<Badge tone={court.status === "ACTIVE" ? "success" : "warning"}>{court.status === "ACTIVE" ? "Active" : court.status === "MAINTENANCE" ? "Maintenance" : "Inactive"}</Badge>} />

      <Panel
        title={formatDate(date, "long")}
        actions={
          <form method="get" className="flex items-center gap-2">
            <Link href={`/admin/courts/${slug}?date=${addDays(date, -1)}`} className={buttonClass({ variant: "outline", size: "sm" })} aria-label="Previous day">
              ←
            </Link>
            <Input type="date" name="date" defaultValue={date} className="h-9 w-34 sm:w-40" aria-label="Date" />
            <button type="submit" className={buttonClass({ variant: "dark", size: "sm" })}>
              Go
            </button>
            <Link href={`/admin/courts/${slug}?date=${addDays(date, 1)}`} className={buttonClass({ variant: "outline", size: "sm" })} aria-label="Next day">
              →
            </Link>
          </form>
        }
      >
        <div className="p-3 sm:p-4">
          <ScheduleGrid hours={schedule.hours} courts={schedule.courts} linkCourts={false} />
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Block slots">
          <div className="p-5">
            <BlockForm courtId={court.id} today={today} hours={hoursOf(settings)} />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Current & upcoming blocks">
            {blocks.length ? (
              <ul className="divide-y divide-line">
                {blocks.map(({ block, createdBy }) => (
                  <li key={block.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                    <span>
                      <span className="font-semibold">{block.type === "MAINTENANCE" ? "Maintenance" : "Blocked"}</span>
                      {block.reason ? <span className="text-muted"> · {block.reason}</span> : null}
                      <span className="block text-muted">
                        {block.startDate === block.endDate ? formatDate(block.startDate, "weekday") : `${formatDate(block.startDate, "weekday")} – ${formatDate(block.endDate, "weekday")}`} ·{" "}
                        {block.startMinute !== null && block.endMinute !== null ? formatTimeRange(block.startMinute, block.endMinute) : "Whole day"}
                        {createdBy ? ` · by ${createdBy}` : ""}
                      </span>
                    </span>
                    <DeleteBlockButton blockId={block.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No blocks. The court follows its normal hours.</p>
            )}
          </Panel>

          <Panel title="Court settings & rate card">
            <div className="p-5">
              <CourtSettingsForm court={court} upcoming={upcoming} sportName={sport.name} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
