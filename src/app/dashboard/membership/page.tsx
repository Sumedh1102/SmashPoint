import { redirect } from "next/navigation";
import { Check, CreditCard } from "lucide-react";
import { CheckoutForm } from "@/components/payments/checkout-form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage, Input } from "@/components/ui/form";
import { EmptyState, KeyValue, PageHeader } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { SubmitAsButton } from "@/components/payments/submit-as-button";
import { formatDate, formatMoney } from "@/lib/format";
import { isStaff } from "@/lib/rbac";
import { diffDays, todayInTz } from "@/lib/time";
import { cn } from "@/lib/utils";
import { param } from "@/lib/url";
import { purchaseMembership } from "@/server/actions/memberships";
import { requireUser } from "@/server/auth/guards";
import { getMembershipPlans } from "@/server/queries/public";
import { getStudentMemberships, pickCurrentMembership } from "@/server/queries/student";
import { getViewerStudents } from "@/server/queries/viewer";
import { StudentSwitcher, pickStudent } from "../_components/student-switcher";

export const metadata = { title: "Membership" };

export default async function MyMembershipPage({ searchParams }: PageProps<"/dashboard/membership">) {
  const user = await requireUser();
  if (isStaff(user.role)) redirect("/dashboard/memberships");
  const sp = await searchParams;
  const today = todayInTz();
  const viewer = await getViewerStudents(user);
  const student = pickStudent(viewer, sp.student);
  const plans = await getMembershipPlans();
  const highlighted = param(sp.plan);

  if (!student) {
    return (
      <>
        <PageHeader title="Membership" />
        <EmptyState title="No student profile linked" description="Memberships belong to a student profile. Contact the front desk to set one up." />
      </>
    );
  }
  const history = await getStudentMemberships(student.id);
  const current = pickCurrentMembership(history, today);
  const daysLeft = current ? diffDays(today, current.endDate) : null;

  return (
    <>
      <PageHeader title="Membership" description={student.relation === "child" ? `Membership for ${student.name}` : "Your academy membership"} />
      <StudentSwitcher students={viewer} activeId={student.id} basePath="/dashboard/membership" />
      {sp.payment === "success" ? (
        <div className="mb-6">
          <FormMessage tone="success">Payment received — the membership is active. A receipt has been sent to your email.</FormMessage>
        </div>
      ) : sp.payment === "failed" ? (
        <div className="mb-6">
          <FormMessage>Payment didn&apos;t go through. No money was taken — you can try again below.</FormMessage>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card tone={current?.status === "ACTIVE" && current.endDate >= today ? "blue" : "white"} className="p-6">
          <p className="text-sm font-medium opacity-80">Current membership</p>
          {current ? (
            <>
              <p className="mt-1 font-display text-4xl font-semibold leading-none">{current.planName}</p>
              <p className="mt-3 font-medium">{current.endDate >= today ? (current.startDate > today ? `Starts ${formatDate(current.startDate)}` : "Active") : "Expired"} — expires {formatDate(current.endDate)}</p>
              {daysLeft !== null && daysLeft >= 0 ? <p className="mt-1 text-sm font-semibold opacity-85">{daysLeft} days remaining</p> : null}
              <div className="mt-4 rounded-xl border border-current/40 px-3 py-2 text-sm font-medium">{current.trainingAccess}</div>
            </>
          ) : (
            <p className="mt-1 font-display text-3xl font-semibold">No active plan</p>
          )}
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Details" />
          <CardBody>
            {current ? (
              <KeyValue
                items={[
                  { label: "Start date", value: formatDate(current.startDate) },
                  { label: "Expiry date", value: formatDate(current.endDate) },
                  { label: "Payment status", value: <StatusBadge status={current.paymentStatus} /> },
                  { label: "Court booking discount", value: `${current.courtDiscountPercent}%` },
                  { label: "Renewal", value: "Renew anytime — the new term starts when this one ends" },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">Choose a plan below to start training.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-4 mt-10 text-2xl font-semibold">{current ? "Renew or change plan" : "Choose a plan"}</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => (
          <Card key={p.id} className={cn("flex flex-col p-5", (highlighted === p.slug || (!highlighted && p.isFeatured)) && "border-brand shadow-lg")}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-2xl font-semibold">{p.name}</h3>
              {p.isFeatured ? <Badge tone="yellow">Popular</Badge> : null}
            </div>
            <p className="mt-2 font-display text-4xl font-semibold">{formatMoney(p.price)}</p>
            <p className="text-sm font-semibold text-muted">
              {p.durationMonths} month{p.durationMonths > 1 ? "s" : ""} · {p.trainingAccess}
            </p>
            <ul className="mt-4 grid flex-1 gap-1.5 text-sm">
              {p.benefits.map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" /> {b}
                </li>
              ))}
            </ul>
            <CheckoutForm action={purchaseMembership} className="mt-5 grid gap-2">
              <input type="hidden" name="studentId" value={student.id} />
              <input type="hidden" name="planId" value={p.id} />
              <Input name="coupon" placeholder="Coupon (optional)" className="h-10 uppercase" aria-label={`Coupon for ${p.name}`} />
              <SubmitAsButton icon={<CreditCard className="size-4" />}>{current ? "Renew" : "Buy"} · {formatMoney(p.price)}</SubmitAsButton>
            </CheckoutForm>
          </Card>
        ))}
      </div>

      {history.length ? (
        <>
          <h2 className="mb-4 mt-10 text-2xl font-semibold">History</h2>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Plan</TH>
                  <TH>Start</TH>
                  <TH>Expiry</TH>
                  <TH>Status</TH>
                  <TH>Payment</TH>
                  <TH>Price</TH>
                </tr>
              </THead>
              <tbody>
                {history.map((m) => (
                  <TR key={m.id}>
                    <TD className="font-medium">{m.planName}</TD>
                    <TD className="text-sm">{formatDate(m.startDate)}</TD>
                    <TD className="text-sm">{formatDate(m.endDate)}</TD>
                    <TD>
                      <StatusBadge status={m.status === "ACTIVE" && m.endDate < today ? "EXPIRED" : m.status} />
                    </TD>
                    <TD>
                      <StatusBadge status={m.paymentStatus} />
                    </TD>
                    <TD className="font-medium">{formatMoney(m.price)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </>
      ) : null}
    </>
  );
}
