import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import { ScoreSlider } from "@/components/performance/score-slider";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Sparkline } from "@/components/ui/charts";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { SkillMeter } from "@/components/ui/meters";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, titleCase } from "@/lib/format";
import { SKILLS } from "@/lib/skills";
import { todayInTz } from "@/lib/time";
import { addAssessment } from "@/server/actions/performance";
import { requirePermission } from "@/server/auth/guards";
import { getCoachStudentIds } from "@/server/queries/coach";
import { getPerformanceHistory, getStudentProfile } from "@/server/queries/student";
import { getCoachForUser } from "@/server/queries/viewer";

export const metadata = { title: "Performance" };

export default async function StudentPerformancePage({ params }: PageProps<"/dashboard/performance/[studentId]">) {
  const user = await requirePermission("performance:manage");
  const { studentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) notFound();
  if (user.role === "COACH") {
    const coach = await getCoachForUser(user.id);
    if (!coach || !(await getCoachStudentIds(coach.id)).includes(studentId)) redirect("/dashboard/performance");
  }
  const [profile, history] = await Promise.all([getStudentProfile(studentId), getPerformanceHistory(studentId)]);
  if (!profile) notFound();
  const s = profile.student;
  const latest = history.at(-1)?.record;
  const previous = history.at(-2)?.record;

  return (
    <>
      <PageHeader breadcrumbs={[{ label: "Performance", href: "/dashboard/performance" }, { label: s.name }]} title={s.name} description={`${titleCase(s.level)} · ${history.length} assessments`} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Progress by skill" description={latest ? `Latest: ${formatDate(latest.assessedOn)}${history.at(-1)?.coachName ? ` by ${history.at(-1)?.coachName}` : ""}` : "No assessments yet"} />
            <CardBody>
              {latest ? (
                <ul className="grid gap-3">
                  {SKILLS.map((k) => (
                    <li key={k.key} className="grid grid-cols-[1fr_auto] items-center gap-4">
                      <SkillMeter label={k.label} value={latest[k.key]} previous={previous?.[k.key]} />
                      <Sparkline values={history.map((h) => h.record[k.key])} label={`${k.label} over time`} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No assessments yet" description="Add the first one using the form." className="py-8" />
              )}
            </CardBody>
          </Card>
          {history.length ? (
            <Card>
              <CardHeader title="Assessment history" />
              <CardBody className="p-0">
                <TableWrap className="rounded-none border-0 shadow-none">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Date</TH>
                        {SKILLS.map((k) => (
                          <TH key={k.key} className="text-center">
                            {k.label.slice(0, 5)}
                          </TH>
                        ))}
                        <TH>Notes</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {[...history].reverse().map(({ record: r }) => (
                        <TR key={r.id}>
                          <TD className="whitespace-nowrap text-sm font-medium">{formatDate(r.assessedOn, "short")}</TD>
                          {SKILLS.map((k) => (
                            <TD key={k.key} className="text-center font-display font-semibold tabular-nums">
                              {r[k.key]}
                            </TD>
                          ))}
                          <TD className="max-w-64 text-sm text-muted">{r.notes ?? "—"}</TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </CardBody>
            </Card>
          ) : null}
        </div>
        <Card tone="brand-soft" className="self-start">
          <CardHeader title="New assessment" description="Score each skill from 1 (beginner) to 10 (elite)." />
          <CardBody>
            <ActionForm action={addAssessment.bind(null, studentId)} className="grid gap-4">
              <TextField name="assessedOn" label="Date" type="date" defaultValue={todayInTz()} />
              {SKILLS.map((k) => (
                <ScoreSlider key={k.key} name={k.key} label={k.label} defaultValue={latest?.[k.key] ?? 5} />
              ))}
              <TextareaField name="notes" label="Coach notes" rows={3} placeholder="What improved? What to focus on next month?" />
              <SubmitButton>Save assessment</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
