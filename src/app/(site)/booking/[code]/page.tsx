import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Check, Clock3, Info, RotateCcw, XCircle } from "lucide-react";
import { BookingStatusPoller } from "@/components/booking/booking-status-poller";
import { PrintButton } from "@/components/booking/print-button";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { formatDate, formatDateTime, formatDuration, formatMinutes, formatMoney } from "@/lib/format";
import { site } from "@/content/site";
import { PICKLEBALL_NOTICE } from "@/content/sports";
import { findCustomerBooking } from "@/server/queries/public";
import { getSetting } from "@/server/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

type View = { tone: "success" | "pending" | "ended"; title: string; text: string };

function viewFor(status: string, refundStatus: string | null | undefined, holdActive: boolean, emailOn: boolean): View {
  switch (status) {
    case "CONFIRMED":
    case "PAID":
      return {
        tone: "success",
        title: "Booking confirmed",
        text: `Your payment is verified and the court is yours. ${emailOn ? "A confirmation has been sent to your email." : "Keep this page's link — it's your confirmation."}`,
      };
    case "PENDING":
    case "PAYMENT_INITIATED":
      return holdActive
        ? { tone: "pending", title: "Waiting for payment", text: "We're waiting for Razorpay to confirm your payment. This page updates by itself." }
        : { tone: "ended", title: "Not confirmed", text: "The payment window ended before a payment was confirmed, so the slot was released." };
    case "EXPIRED":
      return { tone: "ended", title: "Not confirmed", text: "The payment wasn't completed in time, so the slot was released. If money left your account, it's refunded automatically." };
    case "CANCELLED":
      return {
        tone: "ended",
        title: "Booking cancelled",
        text: refundStatus === "pending" || refundStatus === "requested" ? "This booking was cancelled and a refund is on its way (usually 5–7 working days)." : "This booking was cancelled.",
      };
    case "REFUNDED":
      return { tone: "ended", title: "Booking refunded", text: "This booking was cancelled and the payment has been refunded to the original payment method." };
    default:
      return { tone: "ended", title: "Booking", text: "" };
  }
}

export default async function BookingPage({ params, searchParams }: PageProps<"/booking/[code]">) {
  const { code } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : null;
  const found = await findCustomerBooking(code, token);
  if (!found || !token) notFound();
  const { booking, court, sport, payment } = found;

  const holdActive = !!booking.holdExpiresAt && booking.holdExpiresAt.getTime() > Date.now();
  const emailOn = !!process.env.RESEND_API_KEY && (await getSetting("notifications")).email;
  const view = viewFor(booking.status, payment?.refundStatus, holdActive, emailOn);
  const duration = booking.endMinute - booking.startMinute;

  const rows: [string, string][] = [
    ["Sport", sport.name],
    ["Court", court.name],
    ...(court.surface ? ([["Surface", court.surface]] as [string, string][]) : []),
    ["Date", formatDate(booking.date, "long")],
    ["Start time", formatMinutes(booking.startMinute)],
    ["End time", formatMinutes(booking.endMinute)],
    ["Duration", formatDuration(duration)],
    ["Name", booking.customerName],
    ["Amount", formatMoney(booking.total)],
  ];
  if (payment?.status === "PAID" || payment?.status === "REFUNDED") {
    rows.push(["Payment", `${payment.providerPaymentId ?? payment.receiptNumber}${payment.paidAt ? ` · ${formatDateTime(payment.paidAt)}` : ""}`]);
  }

  return (
    <div className="bg-ink pt-28 pb-20 sm:pt-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-ink-3">
          <div className={view.tone === "success" ? "bg-ink-2 px-6 py-8 sm:px-10 sm:py-10" : "border-b border-ink-line px-6 py-8 sm:px-10"}>
            <div className="flex items-start justify-between gap-4">
              <span
                aria-hidden
                className={
                  view.tone === "success"
                    ? "grid size-14 place-items-center rounded-full bg-neon text-ink"
                    : view.tone === "pending"
                      ? "grid size-14 place-items-center rounded-full bg-warning/12 text-warning"
                      : "grid size-14 place-items-center rounded-full bg-white/8 text-ink-muted"
                }
              >
                {view.tone === "success" ? <Check className="size-7" strokeWidth={2.5} /> : view.tone === "pending" ? <Clock3 className="size-7" /> : <XCircle className="size-7" />}
              </span>
              <div className="text-right">
                <p className="eyebrow text-ink-subtle">Booking reference</p>
                <p className="display tabular mt-1 text-[1.9rem] leading-none">{booking.code}</p>
              </div>
            </div>
            <h1 className="display mt-6 text-[clamp(2.4rem,7vw,3.75rem)]">{view.title}</h1>
            <p className="mt-3 max-w-xl text-ink-muted">{view.text}</p>
            {view.tone === "pending" ? (
              <div className="mt-4">
                <BookingStatusPoller code={booking.code} token={token} status={booking.status} />
              </div>
            ) : null}
          </div>

          <dl className="grid gap-px border-t border-ink-line bg-ink-line sm:grid-cols-2">
            {rows.map(([k, v], i) => (
              <div key={k} className={`bg-ink-3 px-6 py-4 sm:px-10 ${i === rows.length - 1 && rows.length % 2 ? "sm:col-span-2" : ""}`}>
                <dt className="eyebrow text-ink-subtle">{k}</dt>
                <dd className="mt-1 font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>

          {view.tone === "success" ? (
            <div className="border-t border-ink-line px-6 py-5 text-sm sm:px-10">
              <p className="eyebrow text-neon">Before you play</p>
              <ul className="mt-3 space-y-2 text-ink-muted">
                <li className="flex gap-2.5">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-neon" /> Arrive a few minutes early — the court is yours for the booked time only.
                </li>
                <li className="flex gap-2.5">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-neon" /> Keep your booking reference <span className="font-semibold text-white">{booking.code}</span> handy.
                </li>
                {sport.slug === "pickleball" ? (
                  <li className="flex gap-2.5 font-medium text-white">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-neon" /> {PICKLEBALL_NOTICE}
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {payment?.refundStatus ? (
            <div className="border-t border-ink-line px-6 py-4 text-sm sm:px-10">
              <Badge tone={payment.refundStatus === "processed" ? "success" : payment.refundStatus === "failed" ? "danger" : "warning"}>
                Refund {payment.refundStatus === "requested" ? "requested" : payment.refundStatus}
              </Badge>
              {payment.refundReference ? <span className="ml-2 text-ink-muted">Razorpay reference {payment.refundReference}</span> : null}
            </div>
          ) : null}

          <div className="no-print flex flex-col gap-3 border-t border-ink-line bg-ink-2 px-6 py-5 sm:flex-row sm:flex-wrap sm:px-10">
            {view.tone === "success" ? (
              <>
                <a href={`/api/bookings/${booking.code}/ics?t=${encodeURIComponent(token)}`} className={buttonClass({ variant: "light" })}>
                  <CalendarPlus className="size-4" /> Add to calendar
                </a>
                <PrintButton />
              </>
            ) : null}
            <Link href="/#book" className={buttonClass({ variant: view.tone === "success" ? "ghostLight" : "primary" }, "sm:ml-auto")}>
              {view.tone === "success" ? (
                "Book another court"
              ) : (
                <>
                  <RotateCcw className="size-4" /> Book a court
                </>
              )}
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Keep this page&apos;s link to come back to your booking. Need help? Contact {site.name} with reference <span className="font-semibold text-white">{booking.code}</span>.{" "}
          <Link href="/cancellation-policy" className="underline underline-offset-2 hover:text-white">
            Cancellation &amp; refund policy
          </Link>
        </p>
      </div>
    </div>
  );
}
