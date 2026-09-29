import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Gauge, IdCard, Printer, QrCode, RefreshCw, Trash2, UsersRound } from "lucide-react";
import { ActionForm, SelectField, SubmitButton } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AttendanceBar } from "@/components/ui/charts";
import { FormMessage } from "@/components/ui/form";
import { Avatar, KeyValue, PageHeader } from "@/components/ui/misc";
import { ProgressRing, SkillMeter } from "@/components/ui/meters";
import { ageFromDob, formatDate, formatDays, formatMoney, formatTimeRange, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { todayInTz } from "@/lib/time";
import { addToBatch, deleteStudent, regenerateQr, removeFromBatch, updateStudent, uploadStudentPhoto } from "@/server/actions/students";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { parents } from "@/server/db/schema";
import { studentQrSvg } from "@/server/qr";
import { getCoachStudentIds } from "@/server/queries/coach";
import {
  SKILLS,
  attendancePercent,
  getAttendanceCounts,
  getAttendanceLog,
  getPaymentsFor,
  getPerformanceHistory,
  getStudentBatches,
  getStudentMemberships,
  getStudentProfile,
  pickCurrentMembership,
} from "@/server/queries/student";
import { getBatchOptions, getCoachOptions } from "@/server/queries/students";
import { getCoachForUser } from "@/server/queries/viewer";
import { StudentForm } from "../_components/student-form";

export const metadata = { title: "Student" };

export default async function StudentDetailPage({ params, searchParams }: PageProps<"/dashboard/students/[id]">) {
  const user = await requirePermission("students:view");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  if (user.role === "COACH") {
    const coach = await getCoachForUser(user.id);
    const ids = coach ? await getCoachStudentIds(coach.id) : [];
    if (!ids.includes(id)) redirect("/dashboard/students");
  }

  const profile = await getStudentProfile(id);
  if (!profile) notFound();
  const s = profile.student;
  const today = todayInTz();
  const manage = can(user.role, "students:manage");

  const [parent, batches, memberships, counts, log, perf, payments, qrSvg, coachOptions, batchOptions] = await Promise.all([
    s.parentId ? db.select().from(parents).where(eq(parents.id, s.parentId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    getStudentBatches(id),
    getStudentMemberships(id),
    getAttendanceCounts(id),
    getAttendanceLog(id, today),
    getPerformanceHistory(id),
    getPaymentsFor({ studentIds: [id] }, 8),
    studentQrSvg(s.qrToken),
    getCoachOptions(),
    getBatchOptions(),
  ]);
  const membership = pickCurrentMembership(memberships, today);
  const latest = perf.at(-1)?.record;
  const previous = perf.at(-2)?.record;
  const age = ageFromDob(s.dateOfBirth, today);
  const availableBatches = batchOptions.filter((b) => !batches.some((x) => x.id === b.id));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Students", href: "/dashboard/students" }, { label: s.name }]}
        title={
          <span className="flex items-center gap-4">
            <Avatar name={s.name} src={s.photoUrl} size={56} />
            <span>
              {s.name}
              <span className="mt-1 flex flex-wrap items-center gap-2 font-sans text-sm font-medium tracking-normal">
                <span className="font-mono text-muted">{s.studentCode}</span>
                <StatusBadge status={s.status} />
                <Badge tone="blue">{titleCase(s.level)}</Badge>
                {age !== null ? <Badge tone="outline">{age} yrs</Badge> : null}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            {can(user.role, "performance:manage") ? (
              <ButtonLink href={`/dashboard/performance/${s.id}`} variant="outline" icon={<Gauge className="size-4" />}>
                Performance
              </ButtonLink>
            ) : null}
            {can(user.role, "memberships:manage") ? (
              <ButtonLink href={`/dashboard/memberships/assign?student=${s.id}`} variant="outline" icon={<IdCard className="size-4" />}>
                Membership
              </ButtonLink>
            ) : null}
            {can(user.role, "students:delete") ? (
              <ActionButton
                action={deleteStudent.bind(null, s.id)}
                variant="danger"
                icon={<Trash2 className="size-4" />}
                successHref="/dashboard/students"
                confirm={{ title: `Delete ${s.name}?`, description: "Attendance, memberships and performance history for this student will be removed.", confirmLabel: "Delete student", danger: true }}
              >
                Delete
              </ActionButton>
            ) : null}
          </>
        }
      />
      {sp.created ? (
        <div className="mb-6">
          <FormMessage tone="success">Student created. Their check-in QR code is ready below.</FormMessage>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Attendance" description={`${counts.PRESENT + counts.LATE + counts.ABSENT + counts.LEAVE} sessions recorded`} />
            <CardBody className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <ProgressRing value={attendancePercent(counts)} label="attended" />
              <div>
                <AttendanceBar counts={counts} />
                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted">This month</p>
                <div className="flex flex-wrap gap-1.5">
                  {log.length ? (
                    log.map((r, i) => (
                      <span key={i} title={`${formatDate(r.date)} · ${r.batchName} · ${r.status}`} className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-xs font-medium">
                        {formatDate(r.date, "dayMonth")}
                        <StatusBadge status={r.status} className="border-0 px-1 py-0" />
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted">No sessions this month yet.</span>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Skills"
              description={latest ? `Assessed ${formatDate(latest.assessedOn)} · ${perf.length} assessments` : "Not assessed yet"}
              action={can(user.role, "performance:manage") ? <Link href={`/dashboard/performance/${s.id}`} className="text-sm font-medium text-brand">Add assessment</Link> : null}
            />
            <CardBody>
              {latest ? (
                <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                  {SKILLS.map((k) => (
                    <SkillMeter key={k.key} label={k.label} value={latest[k.key]} previous={previous?.[k.key]} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">Coaches can add the first assessment from the Performance page.</p>
              )}
            </CardBody>
          </Card>

          {manage ? (
            <Card>
              <CardHeader title="Edit profile" />
              <CardBody className="p-6">
                <StudentForm
                  action={updateStudent.bind(null, s.id)}
                  coaches={coachOptions}
                  batches={availableBatches}
                  submitLabel="Save changes"
                  defaults={{
                    ...s,
                    parentName: parent?.name,
                    parentRelation: parent?.relation,
                    parentPhone: parent?.phone,
                    parentEmail: parent?.email,
                  }}
                />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Profile" />
              <CardBody>
                <KeyValue
                  items={[
                    { label: "Date of birth", value: formatDate(s.dateOfBirth) },
                    { label: "Gender", value: s.gender ? titleCase(s.gender) : "—" },
                    { label: "Phone", value: s.phone ?? "—" },
                    { label: "Joined", value: formatDate(s.joiningDate) },
                    { label: "Medical notes", value: s.medicalNotes ?? "—" },
                  ]}
                />
              </CardBody>
            </Card>
          )}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Check-in QR" icon={<QrCode className="size-5" />} />
            <CardBody className="text-center">
              <div className="mx-auto w-52 rounded-2xl border border-line bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-3 font-mono text-sm font-medium">{s.studentCode}</p>
              <p className="text-xs text-muted">Scan at the front desk or coach&apos;s device to mark attendance.</p>
              {manage ? (
                <div className="mt-4 flex justify-center gap-2">
                  <ActionButton action={regenerateQr.bind(null, s.id)} icon={<RefreshCw className="size-4" />} confirm={{ title: "Issue a new QR code?", description: "The current code (e.g. a printed card) will stop working immediately." }}>
                    New code
                  </ActionButton>
                  <ButtonLink href={`/dashboard/students/${s.id}/card`} variant="outline" size="sm" icon={<Printer className="size-4" />}>
                    ID card
                  </ButtonLink>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {manage ? (
            <Card>
              <CardHeader title="Profile photo" />
              <CardBody>
                <ActionForm action={uploadStudentPhoto.bind(null, s.id)} className="grid gap-3">
                  <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:font-medium" />
                  <SubmitButton size="sm" variant="dark">
                    Upload photo
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Batches" icon={<UsersRound className="size-5" />} />
            <CardBody className="grid gap-3">
              {batches.length ? (
                batches.map((b) => (
                  <div key={b.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/dashboard/batches/${b.id}`} className="font-semibold hover:text-brand">
                        {b.name}
                      </Link>
                      {manage ? (
                        <ActionButton action={removeFromBatch.bind(null, s.id, b.id)} variant="ghost" size="sm" confirm={{ title: `Remove from ${b.name}?`, confirmLabel: "Remove", danger: true }}>
                          Remove
                        </ActionButton>
                      ) : null}
                    </div>
                    <p className="text-xs font-semibold text-muted">
                      {formatDays(b.daysOfWeek)} · {formatTimeRange(b.startMinute, b.endMinute)} · {b.courtName} · {b.coachName}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">Not enrolled in any batch.</p>
              )}
              {manage && availableBatches.length ? (
                <ActionForm action={addToBatch.bind(null, s.id)} className="grid gap-2 border-t border-line pt-3">
                  <SelectField name="batchId" label="Add to batch" options={availableBatches.map((b) => ({ value: b.id, label: b.name }))} />
                  <SubmitButton size="sm" variant="outline">
                    Enrol
                  </SubmitButton>
                </ActionForm>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Membership" icon={<IdCard className="size-5" />} />
            <CardBody>
              {membership ? (
                <KeyValue
                  items={[
                    { label: "Plan", value: membership.planName },
                    { label: "Status", value: <StatusBadge status={membership.endDate < today ? "EXPIRED" : membership.status} /> },
                    { label: "Start", value: formatDate(membership.startDate) },
                    { label: "Expiry", value: formatDate(membership.endDate) },
                    { label: "Payment", value: <StatusBadge status={membership.paymentStatus} /> },
                  ]}
                />
              ) : (
                <p className="text-sm text-muted">No membership.</p>
              )}
              {memberships.length > 1 ? <p className="mt-3 text-xs font-semibold text-muted">{memberships.length - 1} earlier term(s) on record.</p> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contacts" />
            <CardBody>
              <KeyValue
                items={[
                  { label: "Parent", value: parent ? `${parent.name} (${parent.relation})` : "—" },
                  { label: "Parent phone", value: parent?.phone ?? "—" },
                  { label: "Student phone", value: s.phone ?? "—" },
                  { label: "Email", value: s.email ?? parent?.email ?? "—" },
                  { label: "Emergency", value: s.emergencyContactName ? `${s.emergencyContactName} · ${s.emergencyContactPhone ?? ""}` : "—" },
                  { label: "Address", value: s.address ?? "—" },
                ]}
              />
            </CardBody>
          </Card>

          {can(user.role, "payments:view") ? (
            <Card>
              <CardHeader title="Payments" />
              <CardBody className="p-0">
                {payments.length ? (
                  <ul className="divide-y divide-line">
                    {payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                        <span>
                          <span className="block font-medium">{titleCase(p.purpose)}</span>
                          <span className="text-xs text-muted">{p.paidAt ? formatDate(p.paidAt.toISOString().slice(0, 10)) : "—"} · {titleCase(p.method)}</span>
                        </span>
                        <span className="font-display font-semibold">{formatMoney(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-4 text-sm text-muted">No payments recorded.</p>
                )}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
