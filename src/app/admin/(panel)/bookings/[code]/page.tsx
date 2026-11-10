import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CancelBookingForm, RefundForm } from "@/components/admin/booking-actions";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Alert } from "@/components/ui/field";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badge";
import { formatDate, formatDateTime, formatDuration, formatMinutes, formatMoney } from "@/lib/format";
import { getBookingDetail } from "@/server/queries/admin";

export async function generateMetadata({ params }: PageProps<"/admin/bookings/[code]">) {
  return { title: `Booking ${(await params).code}` };
}

const NOTICES: Record<string, string> = {
  "cancelled-refunded": "Booking cancelled and a full refund was requested from Razorpay. Its status below updates when Razorpay processes it.",
  cancelled: "Booking cancelled. No refund was issued.",
  refunded: "Refund requested from Razorpay. Its status below updates when Razorpay processes it.",
};

export default async function AdminBookingPage({ params, searchParams }: PageProps<"/admin/bookings/[code]">) {
  const { code } = await params;
  const { notice } = await searchParams;
  const d = await getBookingDetail(code);
  if (!d) notFound();
  const { booking: b, court, sport } = d;
  const active = ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(b.status);
  const paid = d.payments.find((p) => p.status === "PAID");
  const refundable = paid && (!paid.refundStatus || paid.refundStatus === "failed") && paid.provider === "razorpay";
  const latest = d.payments[0];

  const details: [string, string][] = [
    ["Sport", sport.name],
    ["Court", court.name],
    ["Date", formatDate(b.date, "long")],
    ["Start", formatMinutes(b.startMinute)],
    ["End", formatMinutes(b.endMinute)],
    ["Duration", formatDuration(b.endMinute - b.startMinute)],
    ["Amount", formatMoney(b.total)],
    ["Source", b.source === "ONLINE" ? "Online" : b.source === "WALK_IN" ? "Walk-in" : "Admin"],
    ["Created", formatDateTime(b.createdAt)],
    ["Confirmed", b.confirmedAt ? formatDateTime(b.confirmedAt) : "—"],
  ];
  if (b.cancelledAt) details.push(["Cancelled", `${formatDateTime(b.cancelledAt)}${b.cancelReason ? ` · ${b.cancelReason}` : ""}`]);

  return (
    <>
      <Link href="/admin/bookings" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Bookings
      </Link>
      <PageHeader
        eyebrow="Booking"
        title={b.code}
        actions={
          <div className="flex items-center gap-2">
            <BookingStatusBadge status={b.status} holdExpiresAt={b.holdExpiresAt} />
            <PaymentStatusBadge status={latest?.status} refundStatus={latest?.refundStatus} />
          </div>
        }
      />

      {typeof notice === "string" && NOTICES[notice] ? (
        <Alert tone="success" className="mb-6">
          {NOTICES[notice]}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Details">
            <dl className="grid gap-px bg-line sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k} className="bg-white px-5 py-3">
                  <dt className="text-xs text-subtle">{k}</dt>
                  <dd className="mt-0.5 font-medium break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Customer">
            <dl className="grid gap-px bg-line sm:grid-cols-3">
              {[
                ["Name", b.customerName],
                ["Phone", b.customerPhone],
                ["Email", b.customerEmail ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="bg-white px-5 py-3">
                  <dt className="text-xs text-subtle">{k}</dt>
                  <dd className="mt-0.5 font-medium break-all">{v}</dd>
                </div>
              ))}
            </dl>
            {b.notes ? <p className="border-t border-line px-5 py-3 text-sm text-muted">Note: {b.notes}</p> : null}
          </Panel>

          <Panel title="Payments">
            {d.payments.length ? (
              <ul className="divide-y divide-line text-sm">
                {d.payments.map((p) => (
                  <li key={p.id} className="space-y-1 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">
                        {formatMoney(p.amount)} <span className="font-normal text-muted">· {p.receiptNumber}</span>
                      </span>
                      <PaymentStatusBadge status={p.status} refundStatus={p.refundStatus} />
                    </div>
                    <p className="text-muted">
                      {p.provider === "razorpay" ? "Razorpay" : p.provider} · order {p.providerOrderId ?? "—"} · payment {p.providerPaymentId ?? "—"}
                    </p>
                    {p.paidAt ? <p className="text-muted">Paid {formatDateTime(p.paidAt)}</p> : null}
                    {p.refundReference ? (
                      <p className="text-muted">
                        Refund {p.refundReference} · {p.refundStatus}
                        {p.refundedAt ? ` · ${formatDateTime(p.refundedAt)}` : ""}
                      </p>
                    ) : null}
                    {p.failureReason ? <p className="text-muted">Note: {p.failureReason}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-muted">No payment attempts.</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {active ? (
            <Panel title="Cancel booking">
              <div className="p-5">
                <CancelBookingForm bookingId={b.id} paidAmount={paid ? paid.amount : null} />
              </div>
            </Panel>
          ) : refundable ? (
            <Panel title="Refund payment">
              <div className="space-y-3 p-5">
                <p className="text-sm text-muted">This booking is no longer active but its payment hasn&apos;t been refunded.</p>
                <RefundForm bookingId={b.id} amount={paid.amount} />
              </div>
            </Panel>
          ) : null}

          <Panel title="History">
            <ol className="space-y-4 p-5">
              {d.events.map((e) => (
                <li key={e.id} className="relative border-l-2 border-line pl-4">
                  <span className="absolute top-1.5 -left-[5px] size-2 rounded-full bg-ink" />
                  <p className="text-sm font-semibold">
                    <BookingStatusBadge status={e.status} />
                  </p>
                  {e.note ? <p className="mt-1 text-sm text-ink/80">{e.note}</p> : null}
                  <p className="mt-0.5 text-xs text-subtle">
                    {formatDateTime(e.createdAt)}
                    {e.actor ? ` · ${e.actor}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
