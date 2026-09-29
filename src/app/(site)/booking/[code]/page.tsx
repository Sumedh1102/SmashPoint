import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Clock, LogIn, TriangleAlert, XCircle } from "lucide-react";
import { Container } from "@/components/marketing/section";
import { HoldCountdown, PayNowButton, ReceiptToolbar } from "@/components/booking/receipt-actions";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { formatDate, formatDateTime, formatDuration, formatMoney, formatTimeRange, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { canCustomerCancel } from "@/server/services/bookings";
import { findAccessibleBooking } from "@/server/services/booking-access";
import { getBookingSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

const LIFECYCLE = ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"] as const;
const LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAYMENT_INITIATED: "Payment initiated",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  EXPIRED: "Hold expired",
};

export default async function BookingReceiptPage({ params, searchParams }: PageProps<"/booking/[code]">) {
  const { code } = await params;
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : undefined;
  const { booking } = await findAccessibleBooking(code, token);

  if (!booking) {
    return (
      <Container className="py-20">
        <div className="mx-auto max-w-lg rounded-[var(--radius-card)] border border-line bg-white p-8 text-center shadow-md">
          <TriangleAlert className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 text-3xl font-semibold">Booking not found</h1>
          <p className="mt-2 text-muted">This link is invalid or has expired. Sign in to see bookings made with your account, or use the link from your confirmation message.</p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink href="/login?next=/dashboard/bookings" icon={<LogIn className="size-4" />}>
              Sign in
            </ButtonLink>
            <ButtonLink href="/book" variant="outline">
              Book a court
            </ButtonLink>
          </div>
        </div>
      </Container>
    );
  }

  const settings = await getBookingSettings();
  const payment = booking.payments.find((p) => p.status === "PAID" || p.status === "REFUNDED") ?? booking.payments[0];
  const reached = new Map(booking.events.map((e) => [e.status, e.createdAt]));
  const awaitingPayment = booking.status === "PENDING" || booking.status === "PAYMENT_INITIATED";
  const holdActive = awaitingPayment && booking.holdExpiresAt && booking.holdExpiresAt > new Date();
  const confirmed = booking.status === "CONFIRMED" || booking.status === "PAID";
  const closed = ["CANCELLED", "REFUNDED", "EXPIRED"].includes(booking.status);
  const icsHref = `/api/bookings/${booking.code}/ics${token ? `?t=${token}` : ""}`;

  return (
    <Container className="py-10 md:py-14">
      <div className="mx-auto max-w-3xl">
        {sp.payment === "failed" && awaitingPayment ? (
          <div className="mb-6">
            <FormMessage>Payment failed or was cancelled. Your slot is still held — you can try again below.</FormMessage>
          </div>
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-4 rounded-[var(--radius-card)] border border-line p-6 shadow-md sm:flex-row sm:items-center md:p-8",
            confirmed ? "bg-brand text-white" : closed ? "bg-paper-2" : "bg-warning-soft",
          )}
        >
          <span className={cn("grid size-16 shrink-0 place-items-center rounded-2xl border border-line", confirmed ? "bg-white text-brand" : "bg-white")}>
            {confirmed ? <CircleCheck className="size-9" /> : closed ? <XCircle className="size-9 text-danger" /> : <Clock className="size-9" />}
          </span>
          <div className="flex-1">
            <h1 className="text-3xl font-semibold leading-tight md:text-4xl">
              {confirmed ? "You're booked!" : awaitingPayment ? (holdActive ? "Complete your payment" : "Hold expired") : `Booking ${LABELS[booking.status]?.toLowerCase()}`}
            </h1>
            <p className={cn("mt-1 font-semibold", confirmed ? "text-white/85" : "text-ink-soft")}>
              {confirmed
                ? `Confirmation sent to ${booking.customerEmail ?? booking.customerPhone}. See you on court.`
                : awaitingPayment && holdActive
                  ? "Your slot is reserved while you pay."
                  : booking.status === "REFUNDED"
                    ? "Your refund has been initiated to the original payment method."
                    : "This booking is no longer active."}
            </p>
          </div>
          {awaitingPayment && holdActive && booking.holdExpiresAt ? (
            <div className="rounded-xl border border-line bg-white px-4 py-2 text-center">
              <p className="text-xs font-medium uppercase text-muted">Hold ends in</p>
              <p className="text-2xl">
                <HoldCountdown expiresAt={booking.holdExpiresAt.toISOString()} />
              </p>
            </div>
          ) : null}
        </div>

        <article className="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-6 py-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Booking ID</p>
              <p className="font-mono text-2xl font-medium">{booking.code}</p>
            </div>
            <StatusBadge status={booking.status} />
          </header>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <dl className="grid content-start gap-3 text-sm">
              {[
                ["Court", booking.court.name],
                ["Date", formatDate(booking.date, "long")],
                ["Time", formatTimeRange(booking.startMinute, booking.endMinute)],
                ["Duration", formatDuration(booking.endMinute - booking.startMinute)],
                ["Name", booking.customerName],
                ["Phone", booking.customerPhone],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="font-semibold text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-2xl border border-line p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">Payment</p>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Court fee</dt>
                  <dd className="font-medium">{formatMoney(booking.subtotal)}</dd>
                </div>
                {booking.discount ? (
                  <div className="flex justify-between text-success">
                    <dt>Discount</dt>
                    <dd className="font-medium">−{formatMoney(booking.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex items-end justify-between border-t border-line pt-2">
                  <dt className="font-semibold">Amount</dt>
                  <dd className="font-display text-3xl font-semibold leading-none">{formatMoney(booking.total)}</dd>
                </div>
                <div className="mt-2 flex justify-between">
                  <dt className="text-muted">Payment status</dt>
                  <dd>{payment ? <StatusBadge status={payment.status} /> : <StatusBadge status="CREATED" />}</dd>
                </div>
                {payment ? (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-muted">Receipt no.</dt>
                      <dd className="font-mono font-medium">{payment.receiptNumber}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Method</dt>
                      <dd className="font-medium">{payment.provider === "offline" ? titleCase(payment.method) : `Online · ${payment.provider}`}</dd>
                    </div>
                    {payment.paidAt ? (
                      <div className="flex justify-between">
                        <dt className="text-muted">Paid at</dt>
                        <dd className="font-medium">{formatDateTime(payment.paidAt)}</dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
            </div>
          </div>

          <div className="border-t border-line px-6 py-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">Booking lifecycle</p>
            <ol className="grid gap-3 sm:grid-cols-4">
              {LIFECYCLE.map((s, i) => {
                const at = reached.get(s);
                return (
                  <li key={s} className={cn("relative rounded-xl border px-3 py-2", at ? "border-line bg-brand-50" : "border-dashed border-line-strong text-muted")}>
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className={cn("grid size-5 place-items-center rounded-md text-[11px]", at ? "bg-brand text-white" : "bg-ink/10")}>{i + 1}</span>
                      {LABELS[s]}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold">{at ? formatDateTime(at) : "—"}</p>
                  </li>
                );
              })}
            </ol>
            {reached.has("CANCELLED") || reached.has("REFUNDED") || reached.has("EXPIRED") ? (
              <ol className="mt-3 grid gap-3 sm:grid-cols-4">
                {(["CANCELLED", "REFUNDED", "EXPIRED"] as const)
                  .filter((s) => reached.has(s))
                  .map((s) => (
                    <li key={s} className="rounded-xl border border-line bg-danger-soft px-3 py-2">
                      <p className="text-sm font-semibold">{LABELS[s]}</p>
                      <p className="text-xs font-semibold">{formatDateTime(reached.get(s)!)}</p>
                    </li>
                  ))}
              </ol>
            ) : null}
          </div>
        </article>

        <div className="mt-6 flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          {confirmed ? (
            <ReceiptToolbar icsHref={icsHref} cancel={canCustomerCancel(booking, settings) ? { code: booking.code, token } : undefined} />
          ) : awaitingPayment && holdActive ? (
            <PayNowButton code={booking.code} token={token} label={`Pay ${formatMoney(booking.total)} now`} />
          ) : (
            <span />
          )}
          <Link href="/book" className="inline-flex items-center gap-1 font-medium hover:text-brand" data-print-hide>
            Book another slot <ArrowRight className="size-4" />
          </Link>
        </div>
        {confirmed ? (
          <p className="mt-6 text-sm text-muted">
            Please arrive 10 minutes early and wear non-marking shoes. Cancellations are free up to {settings.cancellationCutoffHours} hours before your slot.
          </p>
        ) : null}
      </div>
    </Container>
  );
}
