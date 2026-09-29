import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClipboardCheck, UserMinus } from "lucide-react";
import { ActionForm, SelectField, SubmitButton } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { Avatar, EmptyState, KeyValue, PageHeader } from "@/components/ui/misc";
import { CapacityBar } from "@/components/ui/meters";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, formatDays, formatMoney, formatTimeRange, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { addDays, todayInTz } from "@/lib/time";
import { enrolStudentInBatch, updateBatch } from "@/server/actions/batches";
import { removeFromBatch } from "@/server/actions/students";
import { requirePermission } from "@/server/auth/guards";
import { getBatch, getBatchRoster, getBatchSessions, getProgramOptions } from "@/server/queries/batches";
import { getCourtOptions } from "@/server/queries/bookings";
import { getCoachOptions, getStudentOptions } from "@/server/queries/students";
import { getCoachForUser } from "@/server/queries/viewer";
import { BatchForm } from "../_components/batch-form";

export const metadata = { title: "Batch" };

export default async function BatchDetailPage({ params, searchParams }: PageProps<"/dashboard/batches/[id]">) {
  const user = await requirePermission("batches:view");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getBatch(id);
  if (!detail) notFound();
  const b = detail.batch;
  if (user.role === "COACH") {
    const coach = await getCoachForUser(user.id);
    if (!coach || b.coachId !== coach.id) redirect("/dashboard/batches");
  }
  const manage = can(user.role, "batches:manage");
  const today = todayInTz();
  const [roster, sessions, coaches, courts, programs, allStudents] = await Promise.all([
    getBatchRoster(id, addDays(today, -60)),
    getBatchSessions(id, 8),
    manage ? getCoachOptions() : Promise.resolve([]),
    manage ? getCourtOptions() : Promise.resolve([]),
    manage ? getProgramOptions() : Promise.resolve([]),
    manage ? getStudentOptions() : Promise.resolve([]),
  ]);
  const candidates = allStudents.filter((s) => !roster.some((r) => r.id === s.id));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Batches", href: "/dashboard/batches" }, { label: b.name }]}
        title={b.name}
        description={`${formatDays(b.daysOfWeek)} · ${formatTimeRange(b.startMinute, b.endMinute)} · ${detail.courtName ?? "No court"} · ${detail.coachName ?? "No coach"}`}
        eyebrow={
          <span className="flex gap-2">
            <Badge tone="blue">{titleCase(b.level)}</Badge>
            {!b.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
          </span>
        }
        actions={
          can(user.role, "attendance:mark") ? (
            <ButtonLink href={`/dashboard/attendance/${b.id}?date=${today}`} icon={<ClipboardCheck className="size-4" />}>
              Mark attendance
            </ButtonLink>
          ) : null
        }
      />
      {sp.created ? (
        <div className="mb-6">
          <FormMessage tone="success">Batch created. Add students below.</FormMessage>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader title={`Students (${roster.length}/${b.capacity})`} description="Attendance over the last 60 days" action={<CapacityBar used={roster.length} total={b.capacity} />} />
            <CardBody className="p-0">
              {roster.length ? (
                <TableWrap className="rounded-none border-0 shadow-none">
                  <Table className="min-w-0">
                    <THead>
                      <tr>
                        <TH>Student</TH>
                        <TH>Level</TH>
                        <TH>Joined</TH>
                        <TH>Attendance</TH>
                        {manage ? <TH className="text-right">Action</TH> : null}
                      </tr>
                    </THead>
                    <tbody>
                      {roster.map((s) => (
                        <TR key={s.id}>
                          <TD>
                            <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                              <Avatar name={s.name} src={s.photoUrl} size={30} className="rounded-lg" />
                              {s.name}
                            </Link>
                          </TD>
                          <TD className="text-sm">{titleCase(s.level)}</TD>
                          <TD className="text-sm">{formatDate(s.joinedOn, "short")}</TD>
                          <TD className="text-sm font-medium">{s.counted ? `${Math.round((s.attended / s.counted) * 100)}%` : "—"}</TD>
                          {manage ? (
                            <TD className="text-right">
                              <ActionButton action={removeFromBatch.bind(null, s.id, b.id)} variant="ghost" icon={<UserMinus className="size-4" />} confirm={{ title: `Remove ${s.name}?`, confirmLabel: "Remove", danger: true }}>
                                Remove
                              </ActionButton>
                            </TD>
                          ) : null}
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              ) : (
                <div className="p-5">
                  <EmptyState title="No students yet" />
                </div>
              )}
            </CardBody>
          </Card>
          {manage ? (
            <Card>
              <CardHeader title="Edit batch" />
              <CardBody className="p-6">
                <BatchForm action={updateBatch.bind(null, b.id)} defaults={b} coaches={coaches} courts={courts} programs={programs} submitLabel="Save batch" showActive />
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="grid content-start gap-6">
          {manage && candidates.length ? (
            <Card tone="brand-soft">
              <CardHeader title="Add student" />
              <CardBody>
                <ActionForm action={enrolStudentInBatch.bind(null, b.id)} className="grid gap-3">
                  <SelectField name="studentId" label="Student" placeholder="Choose…" options={candidates.map((s) => ({ value: s.id, label: `${s.name} (${s.studentCode})` }))} />
                  <SubmitButton>Add to batch</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <KeyValue items={[{ label: "Program", value: detail.programName ?? "—" }, { label: "Fee", value: `${formatMoney(b.monthlyFee)}/month` }, { label: "Started", value: formatDate(b.startDate) }]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent sessions" />
            <CardBody className="grid gap-2">
              {sessions.length ? (
                sessions.map((s) => (
                  <Link key={s.id} href={`/dashboard/attendance/${b.id}?date=${s.date}`} className="rounded-xl border border-line px-3 py-2 text-sm hover:bg-brand-50">
                    <span className="flex justify-between font-medium">
                      {formatDate(s.date, "weekday")}
                      <span>
                        {s.present}/{s.total} present
                      </span>
                    </span>
                    {s.notes ? <span className="mt-0.5 block text-xs text-muted">{s.notes}</span> : null}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted">No sessions recorded yet.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
