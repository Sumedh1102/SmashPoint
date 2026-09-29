import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarPlus, IdCard, Megaphone, QrCode } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProgressRing, SkillMeter } from "@/components/ui/meters";
import { formatDate, formatDays, formatMoney, formatRelative, formatTimeRange, titleCase } from "@/lib/format";
import { diffDays, nowMinutesInTz, todayInTz } from "@/lib/time";
import { upcomingSessions } from "@/lib/schedule";
import type { SessionUser } from "@/server/auth/session";
import { getAnnouncementsFor, getNotifications, getViewerStudents } from "@/server/queries/viewer";
import {
  SKILLS,
  attendancePercent,
  getAttendanceCounts,
  getPaymentsFor,
  getPerformanceHistory,
  getStudentBatches,
  getStudentMemberships,
  getUserBookings,
  pickCurrentMembership,
} from "@/server/queries/student";
import { StudentSwitcher, pickStudent } from "./student-switcher";

export async function StudentDashboard({ user, studentParam }: { user: SessionUser; studentParam?: string | string[] }) {
  const today = todayInTz();
  const viewerStudents = await getViewerStudents(user);
  const student = pickStudent(viewerStudents, studentParam);

  const [bookings, notifications, announcements] = await Promise.all([
    getUserBookings(user.id, { upcoming: true, today, limit: 4 }),
    getNotifications(user.id, 5),
    getAnnouncementsFor("STUDENTS", 3),
  ]);

  if (!student) {
    return (
      <>
        <PageHeader title={`Welcome, ${user.name.split(" ")[0]}!`} description="Your account isn't linked to a student profile yet." />
        <EmptyState
          title="No student profile yet"
          description="Book courts right away, or contact the front desk to enrol in a coaching batch."
          action={<ButtonLink href="/book">Book a court</ButtonLink>}
        />
      </>
    );
  }

  const [batches, memberships, counts, monthCounts, perf, payments] = await Promise.all([
    getStudentBatches(student.id),
    getStudentMemberships(student.id),
    getAttendanceCounts(student.id),
    getAttendanceCounts(student.id, `${today.slice(0, 7)}-01`, today),
    getPerformanceHistory(student.id),
    getPaymentsFor({ userId: user.id, studentIds: viewerStudents.map((s) => s.id) }, 5),
  ]);

  const membership = pickCurrentMembership(memberships, today);
  const daysLeft = membership ? diffDays(today, membership.endDate) : null;
  const pct = attendancePercent(counts);
  const sessions = upcomingSessions(batches, today, 7, nowMinutesInTz()).slice(0, 5);
  const latest = perf.at(-1)?.record;
  const previous = perf.at(-2)?.record;
  const nextBooking = bookings[0];
  const isParent = student.relation === "child";

  return (
    <>
      <PageHeader
        eyebrow={<Badge tone="blue">{formatDate(today, "long")}</Badge>}
        title={`Welcome back, ${user.name.split(" ")[0]}!`}
        description={isParent ? `Here's how ${student.name.split(" ")[0]} is doing at the academy.` : "Here's your training at a glance."}
        actions={
          <>
            <ButtonLink href="/dashboard/attendance#qr" variant="outline" icon={<QrCode className="size-4" />}>
              Check-in QR
            </ButtonLink>
            <ButtonLink href="/book" icon={<CalendarPlus className="size-4" />}>
              Book a court
            </ButtonLink>
          </>
        }
      />
      <StudentSwitcher students={viewerStudents} activeId={student.id} basePath="/dashboard" />

      {daysLeft !== null && membership && membership.status === "ACTIVE" && daysLeft <= 7 && daysLeft >= 0 ? (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-warning-soft p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="font-medium">
            Membership expires {daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`} ({formatDate(membership.endDate)}). Renew now to keep your batch spot.
          </p>
          <ButtonLink href={`/dashboard/membership?student=${student.id}&plan=${membership.planSlug}`} size="sm" variant="dark">
            Renew
          </ButtonLink>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={pct} size={96} label="attendance" />
          <div className="text-sm">
            <p className="font-semibold">Attendance</p>
            <p className="text-muted">
              {counts.PRESENT + counts.LATE} of {counts.PRESENT + counts.LATE + counts.ABSENT} sessions
            </p>
            <Link href="/dashboard/attendance" className="mt-1 inline-flex items-center gap-1 font-medium text-brand">
              Details <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Card>
        <Card tone={membership?.status === "ACTIVE" ? "blue" : "white"} className="p-5">
          <p className="text-sm font-medium opacity-80">Membership</p>
          {membership ? (
            <>
              <p className="mt-1 font-display text-2xl font-semibold leading-tight">
                {membership.status === "ACTIVE" ? "Active" : titleCase(membership.status)} — {membership.planName}
              </p>
              <p className="mt-1 text-sm font-semibold opacity-85">
                {membership.endDate >= today ? `Expires ${formatDate(membership.endDate)}` : `Expired ${formatDate(membership.endDate)}`}
              </p>
            </>
          ) : (
            <p className="mt-1 font-display text-2xl font-semibold">No active plan</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Upcoming booking</p>
          {nextBooking ? (
            <>
              <p className="mt-1 font-display text-2xl font-semibold leading-tight">
                {nextBooking.court.name} — {formatDate(nextBooking.date, "weekday").split(",")[0]}
              </p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {formatDate(nextBooking.date, "dayMonth")} · {formatTimeRange(nextBooking.startMinute, nextBooking.endMinute)}
              </p>
            </>
          ) : (
            <p className="mt-1 font-display text-xl font-semibold">None yet</p>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted">Next training</p>
          {sessions[0] ? (
            <>
              <p className="mt-1 font-display text-2xl font-semibold leading-tight">{sessions[0].date === today ? "Today" : formatDate(sessions[0].date, "weekday")}</p>
              <p className="mt-1 text-sm font-semibold text-muted">
                {formatTimeRange(sessions[0].batch.startMinute, sessions[0].batch.endMinute)} · {sessions[0].batch.courtName}
              </p>
            </>
          ) : (
            <p className="mt-1 font-display text-xl font-semibold">Not enrolled</p>
          )}
        </Card>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Upcoming training" description={batches.map((b) => b.name).join(" · ") || "No batch assigned"} icon={<CalendarClock className="size-5" />} />
          <CardBody>
            {sessions.length ? (
              <ul className="grid gap-2.5">
                {sessions.map((s) => (
                  <li key={`${s.date}-${s.batch.id}`} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3">
                    <div className="w-16 shrink-0 text-center">
                      <p className="text-xs font-semibold uppercase text-brand">{s.date === today ? "Today" : formatDate(s.date, "weekday").split(",")[0]}</p>
                      <p className="font-display text-xl font-semibold leading-none">{formatDate(s.date, "dayMonth")}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.batch.name}</p>
                      <p className="text-sm text-muted">
                        {formatTimeRange(s.batch.startMinute, s.batch.endMinute)} · {s.batch.courtName} · {s.batch.coachName}
                      </p>
                    </div>
                    <Badge tone="outline">{formatDays(s.batch.daysOfWeek)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No sessions scheduled" description="Ask the front desk to add you to a batch." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Court bookings" icon={<CalendarPlus className="size-5" />} action={<Link href="/dashboard/bookings" className="text-sm font-medium text-brand">All</Link>} />
          <CardBody>
            {bookings.length ? (
              <ul className="grid gap-2.5">
                {bookings.map((b) => (
                  <li key={b.id} className="rounded-xl border border-line px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">{b.court.name}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted">
                      {formatDate(b.date, "weekday")} · {formatTimeRange(b.startMinute, b.endMinute)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No upcoming bookings" action={<ButtonLink href="/book" size="sm">Book now</ButtonLink>} className="py-8" />
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader
            title="Skill snapshot"
            description={latest ? `Last assessed ${formatDate(latest.assessedOn)} by ${perf.at(-1)?.coachName ?? "coach"}` : "No assessments yet"}
            action={<Link href="/dashboard/attendance#performance" className="text-sm font-medium text-brand">Progress</Link>}
          />
          <CardBody>
            {latest ? (
              <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                {SKILLS.map((s) => (
                  <SkillMeter key={s.key} label={s.label} value={latest[s.key]} previous={previous?.[s.key]} />
                ))}
                {latest.notes ? <p className="rounded-xl border border-line bg-brand-50 p-3 text-sm font-semibold md:col-span-2">“{latest.notes}”</p> : null}
              </div>
            ) : (
              <EmptyState title="No skill scores yet" description="Coaches assess every student monthly." className="py-8" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Membership" icon={<IdCard className="size-5" />} />
          <CardBody>
            {membership ? (
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Plan</span><span className="font-medium">{membership.planName}</span></div>
                <div className="flex justify-between"><span className="text-muted">Start</span><span className="font-medium">{formatDate(membership.startDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Expiry</span><span className="font-medium">{formatDate(membership.endDate)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Payment</span><StatusBadge status={membership.paymentStatus} /></div>
                <div className="flex justify-between"><span className="text-muted">This month</span><span className="font-medium">{monthCounts.PRESENT + monthCounts.LATE} sessions attended</span></div>
              </div>
            ) : (
              <p className="text-sm text-muted">No membership yet.</p>
            )}
            <ButtonLink href={`/dashboard/membership?student=${student.id}`} variant="outline" size="sm" className="mt-4 w-full">
              {membership?.status === "ACTIVE" ? "Manage / renew" : "Choose a plan"}
            </ButtonLink>
          </CardBody>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader title="Recent payments" />
          <CardBody className="p-0">
            {payments.length ? (
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{titleCase(p.purpose)} · <span className="font-mono">{p.receiptNumber}</span></p>
                      <p className="text-muted">{p.paidAt ? formatRelative(p.paidAt) : "—"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-lg font-semibold">{formatMoney(p.amount)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No payments yet.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notifications" action={<Link href="/dashboard/notifications" className="text-sm font-medium text-brand">All</Link>} />
          <CardBody className="grid gap-3">
            {announcements.slice(0, 1).map((a) => (
              <div key={a.id} className="rounded-xl border border-line bg-ink p-3 text-white">
                <p className="flex items-center gap-2 text-sm font-semibold"><Megaphone className="size-4" /> {a.title}</p>
                <p className="mt-1 text-xs text-white/80">{a.body}</p>
              </div>
            ))}
            {notifications.map((n) => (
              <div key={n.id} className="flex gap-3 text-sm">
                <span className={n.readAt ? "mt-1.5 size-2 shrink-0 rounded-full bg-ink/20" : "mt-1.5 size-2 shrink-0 rounded-full bg-brand"} aria-hidden />
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted">{formatRelative(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
