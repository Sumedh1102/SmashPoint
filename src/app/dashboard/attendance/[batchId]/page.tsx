import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AttendanceSheet } from "@/components/attendance/attendance-sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDate, formatDays, formatTimeRange } from "@/lib/format";
import { can } from "@/lib/rbac";
import { addDays, dayOfWeek, isValidISODate, todayInTz } from "@/lib/time";
import { saveAttendance } from "@/server/actions/attendance";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { attendanceRecords, attendanceSessions, batchStudents, students } from "@/server/db/schema";
import { getBatch } from "@/server/queries/batches";
import { getCoachForUser } from "@/server/queries/viewer";

export const metadata = { title: "Mark attendance" };

export default async function MarkAttendancePage({ params, searchParams }: PageProps<"/dashboard/attendance/[batchId]">) {
  const user = await requirePermission("attendance:view");
  const { batchId } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) notFound();
  const today = todayInTz();
  const date = typeof sp.date === "string" && isValidISODate(sp.date) && sp.date <= today ? sp.date : today;
  const detail = await getBatch(batchId);
  if (!detail) notFound();
  const b = detail.batch;
  if (user.role === "COACH") {
    const coach = await getCoachForUser(user.id);
    if (!coach || coach.id !== b.coachId) redirect("/dashboard/attendance");
  }

  const [session] = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.batchId, batchId), eq(attendanceSessions.date, date))).limit(1);
  const roster = await db
    .select({
      id: students.id,
      name: students.name,
      studentCode: students.studentCode,
      photoUrl: students.photoUrl,
    })
    .from(batchStudents)
    .innerJoin(students, eq(students.id, batchStudents.studentId))
    .where(and(eq(batchStudents.batchId, batchId), eq(batchStudents.isActive, true), eq(students.status, "ACTIVE")))
    .orderBy(students.name);
  const records = session
    ? await db.select().from(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id))
    : [];
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  const runs = b.daysOfWeek.includes(dayOfWeek(date));

  // Previous / next scheduled day for quick navigation.
  const prev = (() => {
    for (let i = 1; i <= 7; i++) if (b.daysOfWeek.includes(dayOfWeek(addDays(date, -i)))) return addDays(date, -i);
    return null;
  })();
  const next = (() => {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(date, i);
      if (d > today) return null;
      if (b.daysOfWeek.includes(dayOfWeek(d))) return d;
    }
    return null;
  })();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Attendance", href: "/dashboard/attendance" }, { label: b.name }]}
        title={b.name}
        description={`${formatDays(b.daysOfWeek)} · ${formatTimeRange(b.startMinute, b.endMinute)} · ${detail.courtName ?? ""} · ${detail.coachName ?? ""}`}
        eyebrow={session ? <Badge tone="green">Marked · {records.length} students</Badge> : <Badge tone="yellow">Not marked yet</Badge>}
        actions={
          <div className="flex items-center gap-2">
            {prev ? (
              <Link href={`/dashboard/attendance/${batchId}?date=${prev}`} className="grid size-10 place-items-center rounded-xl border border-line bg-white" aria-label="Previous session">
                <ChevronLeft className="size-4" />
              </Link>
            ) : null}
            <span className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold">{formatDate(date, "weekday")}</span>
            {next ? (
              <Link href={`/dashboard/attendance/${batchId}?date=${next}`} className="grid size-10 place-items-center rounded-xl border border-line bg-white" aria-label="Next session">
                <ChevronRight className="size-4" />
              </Link>
            ) : null}
          </div>
        }
      />
      {!runs ? (
        <EmptyState title="No session on this day" description={`${b.name} runs ${formatDays(b.daysOfWeek)}.`} />
      ) : roster.length ? (
        <AttendanceSheet
          key={date}
          action={saveAttendance.bind(null, batchId, date)}
          readOnly={!can(user.role, "attendance:mark")}
          initialNotes={session?.notes ?? null}
          students={roster.map((s) => {
            const r = byStudent.get(s.id);
            return { ...s, status: r?.status ?? null, remarks: r?.remarks ?? null, source: r?.source ?? null };
          })}
        />
      ) : (
        <EmptyState title="No students in this batch" />
      )}
    </>
  );
}
