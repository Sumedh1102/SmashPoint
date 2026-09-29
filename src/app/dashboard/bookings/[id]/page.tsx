import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { KeyValue, PageHeader } from "@/components/ui/misc";
import { formatDate, formatDateTime, formatDuration, formatMinutes, formatMoney, formatTimeRange, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { minutesToHHMM } from "@/lib/time";
import { staffCancelBooking, staffRecordBookingPayment, staffRescheduleBooking } from "@/server/actions/bookings";
import { requirePermission } from "@/server/auth/guards";
import { bookingReceiptPath } from "@/server/payments/service";
import { getBookingDetail, getCourtOptions } from "@/server/queries/bookings";
import { getBookingSettings } from "@/server/settings";

export const metadata = { title: "Booking" };

export default async function BookingDetailPage({ params, searchParams }: PageProps<"/dashboard/bookings/[id]">) {
  const user = await requirePermission("bookings:manage");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [b, courts, settings] = await Promise.all([getBookingDetail(id), getCourtOptions(), getBookingSettings()]);
  if (!b) notFound();

  const active = ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(b.status);
  const unpaid = ["PENDING", "PAYMENT_INITIATED", "EXPIRED"].includes(b.status) && !b.payments.some((p) => p.status === "PAID");
  const times: string[] = [];
  for (let m = settings.openMinute; m < settings.closeMinute; m += 30) times.push(minutesToHHMM(m));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Bookings", href: "/dashboard/bookings" }, { label: b.code }]}
        title={<span className="font-mono">{b.code}</span>}
        description={`${b.court.name} · ${formatDate(b.date, "long")} · ${formatTimeRange(b.startMinute, b.endMinute)}`}
        eyebrow={<StatusBadge status={b.status} />}
        actions={
          <Link href={bookingReceiptPath(b.code)} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand">
            Customer receipt <ExternalLink className="size-4" />
          </Link>
        }
      />
      {sp.created ? (
        <div className="mb-6">
          <FormMessage tone="success">Booking created. {unpaid ? "Share the customer receipt link so they can pay online." : "Payment recorded and booking confirmed."}</FormMessage>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Booking" />
              <CardBody>
                <KeyValue
                  items={[
                    { label: "Court", value: b.court.name },
                    { label: "Date", value: formatDate(b.date, "long") },
                    { label: "Time", value: formatTimeRange(b.startMinute, b.endMinute) },
                    { label: "Duration", value: formatDuration(b.endMinute - b.startMinute) },
                    { label: "Source", value: titleCase(b.source) },
                    { label: "Created", value: formatDateTime(b.createdAt) },
                    ...(b.notes ? [{ label: "Notes", value: b.notes }] : []),
                    ...(b.cancelReason ? [{ label: "Cancel reason", value: b.cancelReason }] : []),
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Customer" />
              <CardBody>
                <KeyValue
                  items={[
                    { label: "Name", value: b.customerName },
                    { label: "Phone", value: <a href={`tel:${b.customerPhone}`} className="underline">{b.customerPhone}</a> },
                    { label: "Email", value: b.customerEmail ?? "—" },
                    { label: "Account", value: b.user ? b.user.name : "Guest" },
                  ]}
                />
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Payments" description={`Court fee ${formatMoney(b.subtotal)}${b.discount ? ` · discount ${formatMoney(b.discount)}${b.coupon ? ` (${b.coupon.code})` : ""}` : ""} · total ${formatMoney(b.total)}`} />
            <CardBody className="p-0">
              {b.payments.length ? (
                <ul className="divide-y divide-line">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div>
                        <p className="font-mono font-medium">{p.receiptNumber}</p>
                        <p className="text-muted">
                          {p.provider === "offline" ? titleCase(p.method) : `Online · ${p.provider}`} · {formatDateTime(p.paidAt ?? p.createdAt)}
                          {p.failureReason ? ` · ${p.failureReason}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-lg font-semibold">{formatMoney(p.amount)}</span>
                        <StatusBadge status={p.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-muted">No payment attempts yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Lifecycle" />
            <CardBody>
              <ol className="relative grid gap-3 border-l border-line pl-5">
                {b.events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.72rem] top-1 size-3.5 rounded-full border border-line bg-brand" aria-hidden />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={e.status} />
                      <span className="text-xs font-semibold text-muted">{formatDateTime(e.createdAt)}</span>
                    </div>
                    {e.note ? <p className="mt-1 text-sm">{e.note}</p> : null}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          {unpaid && active && can(user.role, "payments:record") ? (
            <Card tone="brand-soft">
              <CardHeader title="Collect payment" />
              <CardBody>
                <ActionForm action={staffRecordBookingPayment.bind(null, b.id)} className="grid gap-3">
                  <SelectField name="method" label="Method" options={["CASH", "UPI", "CARD", "BANK_TRANSFER"].map((m) => ({ value: m, label: titleCase(m) }))} />
                  <SubmitButton>Mark {formatMoney(b.total)} paid</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {active ? (
            <Card>
              <CardHeader title="Reschedule" description="Same duration; availability is re-checked." />
              <CardBody>
                <ActionForm action={staffRescheduleBooking.bind(null, b.id)} className="grid gap-3">
                  <SelectField name="courtId" label="Court" defaultValue={b.courtId} options={courts.filter((c) => c.status === "ACTIVE").map((c) => ({ value: c.id, label: c.name }))} />
                  <TextField name="date" label="Date" type="date" defaultValue={b.date} />
                  <SelectField name="startTime" label="Start" defaultValue={minutesToHHMM(b.startMinute)} options={times.map((t) => ({ value: t, label: formatMinutes(Number(t.slice(0, 2)) * 60 + Number(t.slice(3))) }))} />
                  <SubmitButton variant="dark">Move booking</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {active ? (
            <Card>
              <CardHeader title="Cancel booking" />
              <CardBody>
                <ActionForm action={staffCancelBooking.bind(null, b.id)} className="grid gap-3">
                  <TextField name="reason" label="Reason" placeholder="e.g. Customer request" />
                  {can(user.role, "payments:refund") && !unpaid ? <CheckboxField name="refund" label="Refund the payment" description="Cancelled → Refunded via the original method" defaultChecked /> : null}
                  <SubmitButton variant="danger">Cancel booking</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
