import Link from "next/link";
import { CalendarCheck2, ClipboardCheck, CalendarPlus, IdCard, IndianRupee, Inbox, Trophy, UserPlus, Users, UsersRound, Whistle, AlarmClock } from "lucide-react";
import { AttendanceBar, BarChart } from "@/components/ui/charts";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { formatDate, formatMoney, formatNumber, formatRelative, formatTimeRange, titleCase } from "@/lib/format";
import { can, type Permission } from "@/lib/rbac";
import { addDays, nowMinutesInTz, todayInTz } from "@/lib/time";
import type { SessionUser } from "@/server/auth/session";
import {
  getAdminStats,
  getAttendanceOverview,
  getBatchesOn,
  getCourtSchedule,
  getExpiringMemberships,
  getRecentBookings,
  getRecentPayments,
  getRevenueSeries,
} from "@/server/queries/admin";
import { getBookingSettings } from "@/server/settings";
import { CourtTimeline } from "./court-timeline";

const QUICK_ACTIONS: { label: string; href: string; icon: typeof UserPlus; permission: Permission }[] = [
  { label: "Add Student", href: "/dashboard/students/new", icon: UserPlus, permission: "students:manage" },
  { label: "Add Booking", href: "/dashboard/bookings/new", icon: CalendarPlus, permission: "bookings:manage" },
  { label: "Add Batch", href: "/dashboard/batches/new", icon: UsersRound, permission: "batches:manage" },
  { label: "Mark Attendance", href: "/dashboard/attendance", icon: ClipboardCheck, permission: "attendance:mark" },
  { label: "Add Coach", href: "/dashboard/coaches/new", icon: Whistle, permission: "coaches:manage" },
  { label: "Create Event", href: "/dashboard/events/new", icon: Trophy, permission: "events:manage" },
];

export async function AdminDashboard({ user }: { user: SessionUser }) {
  const today = todayInTz();
  const now = nowMinutesInTz();
  const [settings, stats, schedule, classes, recentBookings, recentPayments, revenue, attendance, expiring] = await Promise.all([
    getBookingSettings(),
    getAdminStats(today),
    getCourtSchedule(today),
    getBatchesOn(today),
    getRecentBookings(6),
    getRecentPayments(6),
    getRevenueSeries(today, 14),
    getAttendanceOverview(addDays(today, -29), today),
    getExpiringMemberships(today),
  ]);
  const upcomingClasses = classes.filter((c) => c.endMinute > now);
  const attendancePct = stats.todayMarked ? Math.round((stats.todayPresent / stats.todayMarked) * 100) : null;
  const showMoney = can(user.role, "payments:view");

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="blue">{formatDate(today, "long")}</Badge>}
        title={`Good ${now < 720 ? "morning" : now < 1020 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}.`}
        description="Here's what's happening at the academy today."
        actions={
          can(user.role, "bookings:manage") ? (
            <ButtonLink href="/dashboard/bookings/new" icon={<CalendarPlus className="size-4" />}>
              New booking
            </ButtonLink>
          ) : null
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Key numbers">
        <StatCard label="Today's bookings" value={formatNumber(stats.todayBookings)} icon={<CalendarCheck2 className="size-4" />} tone="blue" href="/dashboard/bookings" hint="Confirmed court slots" />
        <StatCard label="Total students" value={formatNumber(stats.activeStudents)} icon={<Users className="size-4" />} href="/dashboard/students" hint="Active" />
        <StatCard label="Active memberships" value={formatNumber(stats.activeMemberships)} icon={<IdCard className="size-4" />} href="/dashboard/memberships" hint={`${expiring.length} expiring in 7 days`} />
        <StatCard label="Today's attendance" value={attendancePct === null ? "—" : `${attendancePct}%`} icon={<ClipboardCheck className="size-4" />} href="/dashboard/attendance" hint={`${stats.todayPresent}/${stats.todayMarked} marked present`} />
        {showMoney ? <StatCard label="Today's revenue" value={formatMoney(stats.todayRevenue)} icon={<IndianRupee className="size-4" />} tone="ink" href="/dashboard/payments" hint="Bookings, memberships & events" /> : null}
        <StatCard label="Upcoming classes" value={formatNumber(upcomingClasses.length)} icon={<AlarmClock className="size-4" />} hint={`${classes.length} scheduled today`} />
      </section>

      <section className="mt-6" aria-label="Quick actions">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 min-[1400px]:grid-cols-6">
          {QUICK_ACTIONS.filter((a) => can(user.role, a.permission)).map((a) => (
            <Link key={a.label} href={a.href} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 font-display font-semibold shadow-xs transition hover:bg-brand-50 hover:shadow-xs">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-brand text-white">
                <a.icon className="size-4" />
              </span>
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Today's court schedule" description={`${schedule.reduce((a, l) => a + l.items.length, 0)} bookings & sessions across ${schedule.length} courts`} action={<Link href="/dashboard/bookings" className="text-sm font-medium text-brand">Manage</Link>} />
          <CardBody>
            <CourtTimeline lanes={schedule} openMinute={settings.openMinute} closeMinute={settings.closeMinute} nowMinute={now} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Today's classes" action={<Link href="/dashboard/attendance" className="text-sm font-medium text-brand">Attendance</Link>} />
          <CardBody>
            {classes.length ? (
              <ul className="grid gap-2">
                {classes.map((c) => {
                  const done = c.endMinute <= now;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs font-semibold text-muted">
                          {formatTimeRange(c.startMinute, c.endMinute)} · {c.courtName} · {c.coachName}
                        </p>
                      </div>
                      {c.marked ? <Badge tone="green">Marked {c.marked}/{c.enrolled}</Badge> : done ? <Badge tone="yellow">Not marked</Badge> : <Badge tone="outline">Upcoming</Badge>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">No classes scheduled today.</p>
            )}
          </CardBody>
        </Card>

        {showMoney ? (
          <Card className="xl:col-span-2">
            <CardHeader title="Revenue overview" description={`Last 14 days · ${formatMoney(revenue.reduce((a, r) => a + r.value, 0))} collected`} action={<Link href="/dashboard/reports" className="text-sm font-medium text-brand">Reports</Link>} />
            <CardBody>
              <BarChart
                format="money"
                caption="Daily revenue for the last 14 days"
                accentIndex={revenue.length - 1}
                data={revenue.map((r) => ({ label: formatDate(r.date, "dayMonth").split(" ")[0]!, value: r.value, detail: formatDate(r.date, "weekday") }))}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Attendance overview" description="Last 30 days, all batches" />
          <CardBody>
            <p className="mb-4 font-display text-4xl font-semibold">
              {(() => {
                const denom = attendance.PRESENT + attendance.LATE + attendance.ABSENT;
                return denom ? `${Math.round(((attendance.PRESENT + attendance.LATE) / denom) * 100)}%` : "—";
              })()}
              <span className="ml-2 text-sm font-medium text-muted">attended</span>
            </p>
            <AttendanceBar counts={attendance} />
            {expiring.length ? (
              <div className="mt-6">
                <p className="mb-2 text-sm font-semibold">Memberships expiring soon</p>
                <ul className="grid gap-1.5 text-sm">
                  {expiring.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex justify-between gap-2">
                      <Link href={`/dashboard/students/${m.studentId}`} className="truncate font-semibold hover:underline">
                        {m.studentName}
                      </Link>
                      <span className="shrink-0 font-medium text-[#7a5200]">{formatDate(m.endDate, "dayMonth")}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card className={showMoney ? "xl:col-span-2" : "xl:col-span-3"}>
          <CardHeader title="Recent bookings" action={<Link href="/dashboard/bookings" className="text-sm font-medium text-brand">All bookings</Link>} />
          <CardBody className="p-0">
            <ul className="divide-y divide-line">
              {recentBookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/dashboard/bookings/${b.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-brand-50/60">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {b.customerName} <span className="font-mono text-xs text-muted">{b.code}</span>
                      </p>
                      <p className="text-muted">
                        {b.court.name} · {formatDate(b.date, "weekday")} · {formatTimeRange(b.startMinute, b.endMinute)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="hidden font-medium sm:inline">{formatMoney(b.total)}</span>
                      <StatusBadge status={b.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {showMoney ? (
          <Card>
            <CardHeader title="Recent payments" action={<Link href="/dashboard/payments" className="text-sm font-medium text-brand">All</Link>} />
            <CardBody className="p-0">
              <ul className="divide-y divide-line">
                {recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.payerName}</p>
                      <p className="text-muted">
                        {titleCase(p.purpose)} · {p.paidAt ? formatRelative(p.paidAt) : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 font-display text-lg font-semibold">{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {stats.newEnquiries && can(user.role, "enquiries:view") ? (
        <Link href="/dashboard/enquiries" className="mt-6 flex items-center justify-between rounded-2xl border border-line bg-warning-soft px-5 py-4 font-medium shadow-xs">
          <span className="flex items-center gap-2">
            <Inbox className="size-5" /> {stats.newEnquiries} new website enquir{stats.newEnquiries === 1 ? "y" : "ies"} waiting for a reply
          </span>
          <span>Open inbox →</span>
        </Link>
      ) : null}
    </>
  );
}
