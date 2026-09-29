import Link from "next/link";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, titleCase } from "@/lib/format";
import { diffDays, todayInTz } from "@/lib/time";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { performanceRecords, students } from "@/server/db/schema";
import { getCoachStudentIds } from "@/server/queries/coach";
import { getCoachForUser } from "@/server/queries/viewer";

export const metadata = { title: "Performance" };

export default async function PerformancePage() {
  const user = await requirePermission("performance:manage");
  const today = todayInTz();
  const coach = user.role === "COACH" ? await getCoachForUser(user.id) : null;
  const ids = coach ? await getCoachStudentIds(coach.id) : null;
  const rows = await db
    .select({
      id: students.id,
      name: students.name,
      photoUrl: students.photoUrl,
      level: students.level,
      studentCode: students.studentCode,
      lastAssessed: sql<string | null>`(select max(p.assessed_on)::text from ${performanceRecords} p where p.student_id = ${students.id})`,
      average: sql<number | null>`(select round(((p.footwork + p.smash + p.drop + p.serve + p.defense + p.agility + p.stamina + p.match_performance) / 8.0)::numeric, 1)::float from ${performanceRecords} p where p.student_id = ${students.id} order by p.assessed_on desc limit 1)`,
      assessments: sql<number>`(select count(*)::int from ${performanceRecords} p where p.student_id = ${students.id})`,
    })
    .from(students)
    .where(ids ? (ids.length ? inArray(students.id, ids) : sql`false`) : eq(students.status, "ACTIVE"))
    .orderBy(sql`2 is null`, asc(students.name));
  const due = rows.filter((r) => !r.lastAssessed || diffDays(r.lastAssessed, today) > 30).length;

  return (
    <>
      <PageHeader title="Student performance" description={`${rows.length} students · ${due} due for a monthly assessment`} />
      {rows.length ? (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Student</TH>
                <TH>Level</TH>
                <TH>Latest average</TH>
                <TH>Assessments</TH>
                <TH>Last assessed</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => {
                const isDue = !r.lastAssessed || diffDays(r.lastAssessed, today) > 30;
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link href={`/dashboard/performance/${r.id}`} className="flex items-center gap-3 font-medium hover:text-brand">
                        <Avatar name={r.name} src={r.photoUrl} size={34} />
                        <span>
                          {r.name}
                          <span className="block font-mono text-xs text-muted">{r.studentCode}</span>
                        </span>
                      </Link>
                    </TD>
                    <TD className="text-sm">{titleCase(r.level)}</TD>
                    <TD className="font-display text-lg font-semibold">{r.average ?? "—"}<span className="text-xs text-muted">{r.average ? "/10" : ""}</span></TD>
                    <TD className="text-sm">{r.assessments}</TD>
                    <TD className="text-sm">
                      {r.lastAssessed ? formatDate(r.lastAssessed) : "Never"} {isDue ? <Badge tone="yellow" className="ml-1">Due</Badge> : null}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState title="No students assigned" />
      )}
    </>
  );
}
