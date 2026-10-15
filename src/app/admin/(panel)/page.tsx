import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { ScheduleGrid } from "@/components/admin/schedule-grid";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badge";
import { formatDate, formatMoney, formatTimeRange } from "@/lib/format";
import { getOverview } from "@/server/queries/admin";
import { isRazorpayConfigured, isRazorpayTestMode } from "@/server/payments/razorpay";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const o = await getOverview();
  const tiles = [
    { label: "Today's bookings", value: o.stats.today, href: `/admin/bookings?status=confirmed&from=${o.today}&to=${o.today}`, note: "Confirmed, today" },
    { label: "Upcoming", value: o.stats.upcoming, href: `/admin/bookings?status=confirmed&from=${o.today}`, note: "Confirmed, not yet started" },
    { label: "Confirmed", value: o.stats.confirmed30, href: "/admin/bookings?status=confirmed", note: "Confirmed in the last 30 days" },
    { label: "Pending payments", value: o.stats.pendingPayments, href: "/admin/bookings?status=pending", note: "Slots held right now" },
    { label: "Cancellations", value: o.stats.cancelled30, href: "/admin/bookings?status=cancelled", note: "Last 30 days" },
    { label: "Collected", value: formatMoney(o.stats.revenue30), href: "/admin/payments?status=PAID", note: `${o.stats.payments30} paid in 30 days, refunds excluded` },
  ];

  return (
    <>
      <PageHeader eyebrow={formatDate(o.today, "long")} title="Overview" />

      {!isRazorpayConfigured() ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Online booking is switched off:</span> set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET on the server to accept payments.
          </p>
        </div>
      ) : isRazorpayTestMode() ? (
        <div className="mb-6 rounded-xl border border-info/20 bg-info-soft px-4 py-3 text-sm text-info">
          <span className="font-semibold">Razorpay test mode:</span> payments use test keys and no real money is collected.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group rounded-[var(--radius-card)] border border-line bg-white p-5 transition-colors hover:border-ink">
            <p className="text-sm font-medium text-muted">{t.label}</p>
            <p className="display tabular mt-3 text-[2.6rem] leading-none">{t.value}</p>
            <p className="mt-2 text-xs text-subtle">{t.note}</p>
          </Link>
        ))}
      </div>

      {o.attention.length ? (
        <Panel title="Needs attention" className="mt-6">
          <ul className="divide-y divide-line text-sm">
            {o.attention.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span>
                  <span className="font-semibold">{a.receiptNumber}</span>
                  {a.code ? <span className="text-muted"> · booking {a.code}</span> : null}
                  <span className="block text-muted">{a.refundStatus === "failed" ? "Refund failed at Razorpay — retry from the booking." : a.failureReason}</span>
                </span>
                {a.code ? (
                  <Link href={`/admin/bookings/${a.code}`} className="font-semibold text-court hover:underline">
                    Open booking
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="Today on court" className="mt-6" actions={<Link href="/admin/courts" className="text-sm font-semibold text-court hover:underline">Manage courts</Link>}>
        <div className="p-3 sm:p-4">
          <ScheduleGrid hours={o.schedule.hours} courts={o.schedule.courts} />
        </div>
      </Panel>

      <Panel
        title="Latest bookings"
        className="mt-6"
        actions={
          <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-court hover:underline">
            All bookings <ArrowRight className="size-4" />
          </Link>
        }
      >
        {o.recent.length ? (
          <ul className="divide-y divide-line">
            {o.recent.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/bookings/${b.code}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3.5 hover:bg-paper">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {b.customerName} <span className="font-normal text-muted">· {b.code}</span>
                    </span>
                    <span className="block text-sm text-muted">
                      {b.court} · {formatDate(b.date, "weekday")} · {formatTimeRange(b.startMinute, b.endMinute)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <BookingStatusBadge status={b.status} holdExpiresAt={b.holdExpiresAt} />
                    <PaymentStatusBadge status={b.paymentStatus} refundStatus={b.refundStatus} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted">No bookings yet. They&apos;ll appear here as customers book.</p>
        )}
      </Panel>
    </>
  );
}
