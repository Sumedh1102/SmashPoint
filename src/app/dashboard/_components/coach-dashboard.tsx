import Link from "next/link";
import { CalendarClock, ClipboardCheck, Gauge, NotebookPen, ScanLine, Users, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { CapacityBar } from "@/components/ui/meters";
import { formatDate, formatTimeRange, titleCase } from "@/lib/format";
import { upcomingSessions } from "@/lib/schedule";
import { addDays, diffDays, nowMinutesInTz, todayInTz } from "@/lib/time";
import type { SessionUser } from "@/server/auth/session";
import { getBatchesOn } from "@/server/queries/admin";
import { getCoachBatches, getCoachSessionStats, getCoachStudentsWithScores, getRecentClassNotes } from "@/server/queries/coach";
import { getCoachForUser } from "@/server/queries/viewer";

export async function CoachDashboard({ user }: { user: SessionUser }) {
  const coach = await getCoachForUser(user.id);
  if (!coach) {
    return <EmptyState title="Coach profile missing" description="Ask an admin to link your account to a coach profile." />;
  }
  const today = todayInTz();
  const now = nowMinutesInTz();
  const [todays, batches, students, stats, notes] = await Promise.all([
    getBatchesOn(today, coach.id),
    getCoachBatches(coach.id),
    getCoachStudentsWithScores(coach.id),
    getCoachSessionStats(coach.id, `${today.slice(0, 7)}-01`, today),
    getRecentClassNotes(coach.id, 4),
  ]);
  const upcoming = upcomingSessions(batches, addDays(today, 1), 6).slice(0, 6);
  const dueForAssessment = students.filter((s) => !s.lastAssessed || diffDays(s.lastAssessed, today) > 30);

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="blue">{formatDate(today, "long")}</Badge>}
        title={`Ready for court, ${user.name.split(" ")[0]}?`}
        description={`${coach.title} · ${todays.length} batch${todays.length === 1 ? "" : "es"} today`}
        actions={
          <>
            <ButtonLink href="/dashboard/attendance/scan" variant="outline" icon={<ScanLine className="size-4" />}>
              QR check-in
            </ButtonLink>
            <ButtonLink href="/dashboard/attendance" icon={<ClipboardCheck className="size-4" />}>
              Mark attendance
            </ButtonLink>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Today's batches" value={todays.length} icon={<CalendarClock className="size-4" />} tone="blue" />
        <StatCard label="Assigned students" value={students.length} icon={<Users className="size-4" />} href="/dashboard/students" />
        <StatCard label="Sessions this month" value={stats.sessions} icon={<UsersRound className="size-4" />} hint={`${stats.records} attendance entries handled`} />
        <StatCard label="Batch attendance" value={stats.attendancePct === null ? "—" : `${stats.attendancePct}%`} icon={<ClipboardCheck className="size-4" />} hint="This month" />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Today's schedule" description="Tap a batch to mark attendance" icon={<CalendarClock className="size-5" />} />
          <CardBody>
            {todays.length ? (
              <ul className="grid gap-3">
                {todays.map((b) => {
                  const live = now >= b.startMinute && now < b.endMinute;
                  const done = now >= b.endMinute;
                  return (
                    <li key={b.id} className={live ? "rounded-2xl border border-line bg-brand p-4 text-white shadow-xs" : "rounded-2xl border border-line bg-white p-4"}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-sm font-medium opacity-80">{formatTimeRange(b.startMinute, b.endMinute)}</p>
                          <p className="font-display text-xl font-semibold">{b.name}</p>
                          <p className="text-sm font-semibold opacity-80">
                            {b.courtName} · {b.enrolled} students {live ? "· In session now" : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {b.marked ? <Badge tone="green">Marked {b.marked}/{b.enrolled}</Badge> : done ? <Badge tone="yellow">Pending</Badge> : null}
                          <ButtonLink href={`/dashboard/attendance/${b.id}?date=${today}`} variant={live ? "outline" : "dark"} size="sm">
                            {b.marked ? "Edit" : "Mark"} attendance
                          </ButtonLink>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No batches today" description="Enjoy the rest day — or catch up on assessments." className="py-8" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Upcoming sessions" />
          <CardBody>
            <ul className="grid gap-2">
              {upcoming.map((s) => (
                <li key={`${s.date}-${s.batch.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.batch.name}</p>
                    <p className="text-xs font-semibold text-muted">{formatTimeRange(s.batch.startMinute, s.batch.endMinute)} · {s.batch.courtName}</p>
                  </div>
                  <Badge tone="outline">{formatDate(s.date, "weekday")}</Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Assigned students" description={`${dueForAssessment.length} due for a skill assessment`} icon={<Gauge className="size-5" />} action={<Link href="/dashboard/performance" className="text-sm font-medium text-brand">Performance</Link>} />
          <CardBody className="p-0">
            <ul className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
              {students.slice(0, 12).map((s) => {
                const due = !s.lastAssessed || diffDays(s.lastAssessed, today) > 30;
                return (
                  <li key={s.id} className="border-line sm:border-b sm:odd:border-r">
                    <Link href={`/dashboard/performance/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/60">
                      <Avatar name={s.name} src={s.photoUrl} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{s.name}</p>
                        <p className="text-xs font-semibold text-muted">
                          {titleCase(s.level)} · {s.lastAssessed ? `assessed ${formatDate(s.lastAssessed, "dayMonth")}` : "never assessed"}
                        </p>
                      </div>
                      {due ? <Badge tone="yellow">Due</Badge> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My batches" />
          <CardBody className="grid gap-3">
            {batches.map((b) => (
              <Link key={b.id} href={`/dashboard/batches/${b.id}`} className="rounded-xl border border-line p-3 hover:bg-brand-50">
                <p className="font-semibold">{b.name}</p>
                <div className="mt-1 flex items-center justify-between text-xs font-semibold text-muted">
                  <span>{formatTimeRange(b.startMinute, b.endMinute)} · {b.courtName}</span>
                  <CapacityBar used={b.enrolled} total={b.capacity} />
                </div>
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Class notes" icon={<NotebookPen className="size-5" />} description="Your latest session notes" />
          <CardBody>
            {notes.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-line bg-paper p-3">
                    <p className="text-xs font-semibold uppercase text-brand">
                      {n.batchName} · {formatDate(n.date, "weekday")}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{n.notes}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Notes you add while marking attendance show up here.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
