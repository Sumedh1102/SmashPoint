import Link from "next/link";
import { ClipboardCheck, QrCode, ScanLine } from "lucide-react";
import { AttendanceCalendar } from "@/components/attendance/attendance-calendar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AttendanceBar, BarChart, Sparkline } from "@/components/ui/charts";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { ProgressRing, SkillMeter } from "@/components/ui/meters";
import { formatDate, formatTimeRange } from "@/lib/format";
import { can, isStaff } from "@/lib/rbac";
import { SKILLS } from "@/lib/skills";
import { dayOfWeek, endOfMonth, nowMinutesInTz, startOfMonth, todayInTz } from "@/lib/time";
import { param } from "@/lib/url";
import { requireUser } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { studentQrSvg } from "@/server/qr";
import { getBatchesOn } from "@/server/queries/admin";
import { attendancePercent, getAttendanceCounts, getAttendanceLog, getMonthlyAttendance, getPerformanceHistory } from "@/server/queries/student";
import { getCoachForUser, getViewerStudents } from "@/server/queries/viewer";
import { db } from "@/server/db";
import { students } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { StudentSwitcher, pickStudent } from "../_components/student-switcher";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/dashboard/attendance">) {
  const user = await requireUser();
  const sp = await searchParams;
  if (isStaff(user.role) && can(user.role, "attendance:view")) return <StaffAttendance user={user} date={param(sp.date)} />;
  return <MyAttendance user={user} studentParam={sp.student} month={param(sp.month)} />;
}

async function StaffAttendance({ user, date: requested }: { user: SessionUser; date?: string }) {
  const today = todayInTz();
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const coach = user.role === "COACH" ? await getCoachForUser(user.id) : null;
  const list = await getBatchesOn(date, coach?.id);
  const now = nowMinutesInTz();
  const marked = list.filter((b) => b.marked > 0).length;
  return (
    <>
      <PageHeader
        title="Attendance"
        description={`${formatDate(date, "long")} · ${list.length} batch${list.length === 1 ? "" : "es"} scheduled · ${marked} marked`}
        actions={
          can(user.role, "attendance:scan") ? (
            <ButtonLink href="/dashboard/attendance/scan" icon={<ScanLine className="size-4" />}>
              QR check-in
            </ButtonLink>
          ) : null
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-3 shadow-xs" action="/dashboard/attendance">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Date</span>
          <input type="date" name="date" defaultValue={date} max={today} className="h-11 rounded-[var(--radius-control)] border border-line bg-white px-3" />
        </label>
        <button type="submit" className="h-11 rounded-[var(--radius-control)] border border-line bg-ink px-4 font-medium text-white">
          Show
        </button>
        <Link href="/dashboard/attendance" className="h-11 px-3 py-2.5 text-sm font-medium">
          Today
        </Link>
      </form>
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => {
            const done = date < today || b.endMinute <= now;
            const live = date === today && now >= b.startMinute && now < b.endMinute;
            return (
              <Card key={b.id} className={live ? "border-brand p-5" : "p-5"}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-medium text-muted">{formatTimeRange(b.startMinute, b.endMinute)}</p>
                    <p className="font-display text-xl font-semibold leading-tight">{b.name}</p>
                    <p className="text-sm text-muted">
                      {b.courtName} · {b.coachName}
                    </p>
                  </div>
                  {b.marked ? <Badge tone="green">{b.marked}/{b.enrolled}</Badge> : live ? <Badge tone="brand">Live</Badge> : done ? <Badge tone="yellow">Pending</Badge> : <Badge tone="outline">Later</Badge>}
                </div>
                {can(user.role, "attendance:mark") ? (
                  <ButtonLink href={`/dashboard/attendance/${b.id}?date=${date}`} variant={b.marked ? "outline" : "dark"} className="mt-4 w-full" icon={<ClipboardCheck className="size-4" />}>
                    {b.marked ? "Review / edit" : "Mark attendance"}
                  </ButtonLink>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No batches on this day" description={`Nothing is scheduled on ${formatDate(date, "long")}.`} />
      )}
      <p className="mt-6 text-xs font-semibold text-muted">Day of week: {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayOfWeek(date)]}</p>
    </>
  );
}

async function MyAttendance({ user, studentParam, month: monthParam }: { user: SessionUser; studentParam?: string | string[]; month?: string }) {
  const today = todayInTz();
  const viewer = await getViewerStudents(user);
  const student = pickStudent(viewer, studentParam);
  if (!student) {
    return (
      <>
        <PageHeader title="Attendance" />
        <EmptyState title="No student profile linked" description="Ask the front desk to link your account to a student profile." />
      </>
    );
  }
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? `${monthParam}-01` : today;
  const [counts, monthCounts, monthly, log, perf, [row]] = await Promise.all([
    getAttendanceCounts(student.id),
    getAttendanceCounts(student.id, startOfMonth(month), endOfMonth(month)),
    getMonthlyAttendance(student.id, 6),
    getAttendanceLog(student.id, month),
    getPerformanceHistory(student.id),
    db.select({ qrToken: students.qrToken, studentCode: students.studentCode }).from(students).where(eq(students.id, student.id)).limit(1),
  ]);
  const qr = row ? await studentQrSvg(row.qrToken) : null;
  const latest = perf.at(-1)?.record;
  const previous = perf.at(-2)?.record;
  const base = (m: string) => `/dashboard/attendance?student=${student.id}&month=${m}`;

  return (
    <>
      <PageHeader title="Attendance" description={student.relation === "child" ? `${student.name}'s training record` : "Your training record"} />
      <StudentSwitcher students={viewer} activeId={student.id} basePath="/dashboard/attendance" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="col-span-2 flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm lg:col-span-1">
          <ProgressRing value={attendancePercent(counts)} size={92} label="overall" />
        </div>
        <StatCard label="Present days" value={counts.PRESENT} tone="soft" />
        <StatCard label="Late" value={counts.LATE} />
        <StatCard label="Absent days" value={counts.ABSENT} />
        <StatCard label="Leave days" value={counts.LEAVE} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Monthly attendance" description={`${formatDate(month, "dayMonth").split(" ")[1]} · ${attendancePercent(monthCounts)}% attended`} />
          <CardBody className="grid gap-6">
            <AttendanceCalendar month={month} records={log} hrefFor={base} today={today} />
            <AttendanceBar counts={monthCounts} />
          </CardBody>
        </Card>

        <Card id="qr">
          <CardHeader title="My check-in QR" icon={<QrCode className="size-5" />} />
          <CardBody className="text-center">
            {qr ? <div className="mx-auto w-56 rounded-2xl border border-line bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} /> : null}
            <p className="mt-3 font-mono text-sm font-medium">{row?.studentCode}</p>
            <p className="mt-1 text-sm text-muted">Show this at the desk or to your coach when you arrive. It marks you present automatically.</p>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Last 6 months" />
          <CardBody>
            {monthly.length ? (
              <BarChart
                format="percent"
                caption="Attendance percentage per month"
                accentIndex={monthly.length - 1}
                data={monthly.map((m) => ({ label: formatDate(`${m.month}-01`, "dayMonth").split(" ")[1]!, value: m.percent, detail: `${m.counts.PRESENT + m.counts.LATE} attended · ${m.counts.ABSENT} absent · ${m.counts.LEAVE} leave` }))}
              />
            ) : (
              <p className="text-sm text-muted">No sessions recorded yet.</p>
            )}
          </CardBody>
        </Card>

        <Card id="performance">
          <CardHeader title="Skill progress" description={latest ? `Last assessed ${formatDate(latest.assessedOn)}` : "No assessments yet"} />
          <CardBody className="grid gap-3">
            {latest ? (
              SKILLS.map((s) => (
                <div key={s.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <SkillMeter label={s.label} value={latest[s.key]} previous={previous?.[s.key]} />
                  <Sparkline values={perf.map((p) => p.record[s.key])} label={`${s.label} trend`} className="hidden h-6 w-16 sm:block" />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Your coach assesses skills monthly.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
