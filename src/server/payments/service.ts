import "server-only";
import { and, desc, eq, gte, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { db, type Transaction } from "@/server/db";
import { bookings, courts, payments, sports, type Booking, type Payment } from "@/server/db/schema";
import { formatDate, formatMoney, formatTimeRange } from "@/lib/format";
import { site } from "@/content/site";
import { DomainError, isExclusionViolation } from "@/server/errors";
import { sendEmail } from "@/server/email";
import { bookingAccessToken, randomCode } from "@/server/security";
import { transitionBooking } from "@/server/services/bookings";
import {
  capturePaymentApi,
  createOrder,
  createRefund,
  fetchOrderPayments,
  fetchPayment,
  fetchRefund,
  isValidCheckoutSignature,
  razorpayConfig,
  type RazorpayPayment,
} from "./razorpay";

/**
 * Booking payment lifecycle on Razorpay:
 *
 *   startCheckout      payment row (CREATED) → Razorpay order → INITIATED; booking PAYMENT_INITIATED
 *   verifyCheckout     browser success callback: signature check + payment fetched from Razorpay
 *   recordCapture      the single, idempotent place a payment becomes PAID and its booking CONFIRMED
 *   (webhooks and the reconciliation job call recordCapture too, so a payment is confirmed even if
 *    the customer closes the tab before the callback arrives)
 *   refundPayment      Razorpay refund; booking CANCELLED → REFUNDED once Razorpay processes it
 *
 * A booking is only ever confirmed from a payment the server has verified with Razorpay.
 */

export const PROVIDER = "razorpay";

export function paymentsEnabled() {
  return razorpayConfig() !== null;
}

export function bookingReceiptPath(code: string) {
  return `/booking/${code}?t=${bookingAccessToken(code)}`;
}

/** What the browser needs to open Razorpay Checkout. Contains no secrets. */
export type CheckoutParams = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  /** Seconds until the slot hold ends; Checkout closes itself then. */
  timeoutSeconds: number;
};

function checkoutParams(booking: Booking & { courtName: string }, orderId: string): CheckoutParams {
  const cfg = razorpayConfig()!;
  const remaining = booking.holdExpiresAt ? Math.floor((booking.holdExpiresAt.getTime() - Date.now()) / 1000) : 600;
  return {
    keyId: cfg.keyId,
    orderId,
    amount: booking.total,
    currency: "INR",
    name: site.name,
    description: `${booking.courtName} · ${formatDate(booking.date)} · ${formatTimeRange(booking.startMinute, booking.endMinute)}`,
    prefill: { name: booking.customerName, email: booking.customerEmail ?? "", contact: booking.customerPhone },
    timeoutSeconds: Math.max(60, remaining),
  };
}

async function bookingWithCourt(code: string) {
  const [row] = await db
    .select({ booking: bookings, courtName: courts.name, sportName: sports.name })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .innerJoin(sports, eq(sports.id, bookings.sportId))
    .where(eq(bookings.code, code))
    .limit(1);
  return row ? { ...row.booking, courtName: row.courtName, sportName: row.sportName } : null;
}

function assertPayable(booking: Booking) {
  if (booking.status === "PAID" || booking.status === "CONFIRMED") throw new DomainError("This booking is already paid.", "CONFLICT", 409);
  const holdActive = booking.holdExpiresAt ? booking.holdExpiresAt.getTime() > Date.now() : false;
  if ((booking.status !== "PENDING" && booking.status !== "PAYMENT_INITIATED") || !holdActive) {
    throw new DomainError("The time to pay for this slot has run out, so it was released. Please choose your slot again.", "EXPIRED", 410);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Checkout                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/** Creates the Razorpay order for a held booking. */
export async function startCheckout(booking: Booking & { courtName: string }): Promise<CheckoutParams> {
  if (!paymentsEnabled()) throw new DomainError("Online payments aren't available right now. Please try again later.", "PAYMENTS_UNAVAILABLE", 503);
  assertPayable(booking);

  const [payment] = await db
    .insert(payments)
    .values({
      receiptNumber: randomCode("RCP", 8),
      purpose: "BOOKING",
      bookingId: booking.id,
      payerName: booking.customerName,
      payerEmail: booking.customerEmail,
      payerPhone: booking.customerPhone,
      amount: booking.total,
      currency: "INR",
      status: "CREATED",
      method: "ONLINE",
      provider: PROVIDER,
    })
    .returning();

  let orderId: string;
  try {
    const order = await createOrder({
      amount: booking.total,
      currency: "INR",
      receipt: payment!.receiptNumber,
      notes: { booking_code: booking.code, payment_id: payment!.id, court: booking.courtName, date: booking.date },
    });
    orderId = order.id;
  } catch (err) {
    console.error("[payments] order creation failed", err);
    await db.update(payments).set({ status: "FAILED", failureReason: "Could not create the Razorpay order" }).where(eq(payments.id, payment!.id));
    throw new DomainError("We couldn't reach the payment gateway. Your slot hasn't been charged. Please try again.", "PAYMENT_FAILED", 502);
  }

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "INITIATED", providerOrderId: orderId }).where(eq(payments.id, payment!.id));
    if (booking.status === "PENDING") await transitionBooking(tx, booking.id, "PAYMENT_INITIATED", { note: `Razorpay order ${orderId} created` });
  });
  return checkoutParams(booking, orderId);
}

/** Re-opens checkout for a held booking (after the customer closed the Razorpay window). */
export async function resumeCheckout(code: string): Promise<CheckoutParams> {
  const booking = await bookingWithCourt(code);
  if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  assertPayable(booking);
  const [open] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.bookingId, booking.id), eq(payments.provider, PROVIDER), inArray(payments.status, ["INITIATED", "FAILED"])))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  // A Razorpay order accepts further attempts after a failed one, so reuse it.
  if (open?.providerOrderId) return checkoutParams(booking, open.providerOrderId);
  return startCheckout(booking);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Verification                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

async function paymentByOrder(orderId: string) {
  const [row] = await db.select().from(payments).where(and(eq(payments.provider, PROVIDER), eq(payments.providerOrderId, orderId))).limit(1);
  return row ?? null;
}

/**
 * Checks a fetched Razorpay payment against our records and captures it if it is only
 * authorized. Returns the captured payment, or null if it isn't successful (yet).
 */
async function ensureCaptured(local: Payment, remote: RazorpayPayment): Promise<RazorpayPayment | null> {
  if (remote.order_id !== local.providerOrderId) throw new DomainError("This payment doesn't belong to this booking.", "PAYMENT_FAILED", 400);
  if (remote.amount !== local.amount || remote.currency !== local.currency) {
    console.error("[payments] amount mismatch", { payment: local.id, expected: local.amount, got: remote.amount, currency: remote.currency });
    throw new DomainError("The paid amount doesn't match this booking. Please contact us with your payment reference.", "PAYMENT_FAILED", 400);
  }
  if (remote.status === "captured") return remote;
  if (remote.status === "authorized") return capturePaymentApi(remote.id, local.amount, local.currency);
  return null;
}

/**
 * The browser's Checkout success callback. The signature proves the callback came from
 * Razorpay for this order; the payment is then fetched from Razorpay's API (amount, currency,
 * order and status checked) before anything is confirmed.
 */
export async function verifyCheckout(input: { code: string; orderId: string; paymentId: string; signature: string }) {
  const cfg = razorpayConfig();
  if (!cfg) throw new DomainError("Online payments aren't configured.", "PAYMENTS_UNAVAILABLE", 503);
  const local = await paymentByOrder(input.orderId);
  const booking = local?.bookingId ? (await db.select().from(bookings).where(eq(bookings.id, local.bookingId)).limit(1))[0] : null;
  if (!local || !booking || booking.code !== input.code) throw new DomainError("Payment not found for this booking.", "NOT_FOUND", 404);
  if (!isValidCheckoutSignature(input, cfg.keySecret)) {
    throw new DomainError("We couldn't verify this payment. If money was deducted, it will be confirmed or refunded automatically.", "PAYMENT_FAILED", 400);
  }

  const captured = await ensureCaptured(local, await fetchPayment(input.paymentId));
  if (!captured) return { status: booking.status, pending: true as const };
  await recordCapture({ orderId: input.orderId, paymentId: captured.id, amount: captured.amount, signature: input.signature });
  const [after] = await db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, booking.id)).limit(1);
  return { status: after!.status, pending: false as const };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Capture (idempotent)                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

type Fulfilment = { refund: false } | { refund: true; reason: string };

/** Confirms the booking a captured payment is for, or says why it must be refunded. */
async function fulfil(tx: Transaction, payment: Payment): Promise<Fulfilment> {
  if (!payment.bookingId) return { refund: true, reason: "Payment isn't linked to a booking" };
  const [booking] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId)).for("update");
  if (!booking) return { refund: true, reason: "Booking no longer exists" };
  if (booking.status === "PAID" || booking.status === "CONFIRMED") return { refund: true, reason: "Booking was already paid (duplicate payment)" };
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") return { refund: true, reason: "Booking was cancelled before the payment arrived" };

  try {
    // A payment that lands after its hold expired re-activates the booking only if the slot is
    // still free; the savepoint lets the EXCLUDE constraint decide atomically.
    await tx.transaction(async (sp) => {
      await transitionBooking(sp, booking.id, "PAID", {
        note: `Payment ${payment.providerPaymentId} verified (${formatMoney(payment.amount)})`,
        patch: { paidAt: new Date(), holdExpiresAt: null },
      });
    });
  } catch (err) {
    if (isExclusionViolation(err)) return { refund: true, reason: "The slot was taken after the payment window ran out" };
    throw err;
  }
  await transitionBooking(tx, booking.id, "CONFIRMED", { note: "Booking confirmed", patch: { confirmedAt: new Date() } });
  return { refund: false };
}

/**
 * Marks a verified, captured Razorpay payment as PAID and confirms its booking. Safe to call
 * any number of times for the same payment (browser callback, webhook, reconciliation).
 */
export async function recordCapture(input: { orderId: string; paymentId: string; amount: number; signature?: string }) {
  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.provider, PROVIDER), eq(payments.providerOrderId, input.orderId)))
      .for("update");
    if (!row) return { kind: "unknown" as const };
    if (input.amount !== row.amount) {
      console.error("[payments] captured amount mismatch", { payment: row.id, expected: row.amount, got: input.amount });
      await tx.update(payments).set({ failureReason: `Captured amount ${input.amount} doesn't match ${row.amount}; needs review` }).where(eq(payments.id, row.id));
      return { kind: "mismatch" as const };
    }
    if (row.status === "PAID" || row.status === "REFUNDED") {
      // Same payment reported again → nothing to do. A different payment on the same order
      // (the customer was charged twice) → refund the extra one.
      return row.providerPaymentId === input.paymentId ? { kind: "duplicate" as const } : { kind: "extra" as const, payment: row };
    }
    const [paid] = await tx
      .update(payments)
      .set({ status: "PAID", paidAt: new Date(), providerPaymentId: input.paymentId, providerSignature: input.signature ?? row.providerSignature, failureReason: null })
      .where(eq(payments.id, row.id))
      .returning();
    return { kind: "captured" as const, payment: paid!, fulfilment: await fulfil(tx, paid!) };
  });

  if (outcome.kind === "extra") {
    const extras = (outcome.payment.meta?.extraPaymentRefunds as { paymentId: string }[] | undefined) ?? [];
    if (extras.some((e) => e.paymentId === input.paymentId)) return "duplicate" as const;
    const refund = await createRefund(input.paymentId, input.amount, { reason: "Second payment for the same order" });
    await db
      .update(payments)
      .set({ meta: { ...(outcome.payment.meta ?? {}), extraPaymentRefunds: [...extras, { paymentId: input.paymentId, refundId: refund.id, status: refund.status }] } })
      .where(eq(payments.id, outcome.payment.id));
    return outcome.kind;
  }
  if (outcome.kind !== "captured") return outcome.kind;
  if (outcome.fulfilment.refund) {
    // The booking wasn't confirmed by this payment, so leave the booking as it is.
    await refundPayment(outcome.payment.id, { reason: outcome.fulfilment.reason, cancelBooking: false });
    return "refunded" as const;
  }
  await sendConfirmation(outcome.payment.bookingId!);
  return outcome.kind;
}

/** Records a failed attempt. The order stays open, so the customer can retry until the hold ends. */
export async function recordFailure(orderId: string, reason: string | null) {
  await db
    .update(payments)
    .set({ status: "FAILED", failureReason: (reason || "Payment failed").slice(0, 300) })
    .where(and(eq(payments.provider, PROVIDER), eq(payments.providerOrderId, orderId), inArray(payments.status, ["CREATED", "INITIATED", "FAILED"])));
}

/** Webhook: an authorized (not yet captured) payment. Captures it, then confirms as usual. */
export async function handleAuthorized(input: { orderId: string; paymentId: string; amount: number }) {
  const local = await paymentByOrder(input.orderId);
  if (!local) return "unknown";
  if (local.status === "PAID" && local.providerPaymentId === input.paymentId) return "duplicate";
  const captured = await ensureCaptured(local, await fetchPayment(input.paymentId));
  if (!captured) return "pending";
  return recordCapture({ orderId: input.orderId, paymentId: captured.id, amount: captured.amount });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Refunds                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Refunds a paid booking in full through Razorpay and cancels the booking. The payment is
 * only marked REFUNDED once Razorpay reports the refund as processed (immediately, or later
 * through the refund.processed webhook / reconciliation job); until then it shows as pending.
 */
export async function refundPayment(
  paymentId: string,
  opts: {
    reason: string;
    actorId?: string | null;
    /** Cancel the booking this payment paid for (false for automatic refunds of payments that never confirmed it). */
    cancelBooking?: boolean;
  },
) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new DomainError("Payment not found.", "NOT_FOUND", 404);
  if (payment.status !== "PAID") throw new DomainError("Only paid payments can be refunded.", "CONFLICT", 409);
  if (payment.provider !== PROVIDER || !payment.providerPaymentId) {
    throw new DomainError("This payment wasn't made online, so it can't be refunded through Razorpay. Refund it at the desk.", "CONFLICT", 409);
  }

  // Claim the refund so two simultaneous requests can't both reach Razorpay. A claim older than
  // 15 minutes (the process died mid-request) may be retried.
  const claimed = await db
    .update(payments)
    .set({ refundStatus: "requested" })
    .where(
      and(
        eq(payments.id, payment.id),
        eq(payments.status, "PAID"),
        or(isNull(payments.refundStatus), eq(payments.refundStatus, "failed"), and(eq(payments.refundStatus, "requested"), lt(payments.updatedAt, new Date(Date.now() - 15 * 60_000)))),
      ),
    )
    .returning({ id: payments.id });
  if (!claimed.length) throw new DomainError("A refund has already been issued for this payment.", "CONFLICT", 409);

  let refund: Awaited<ReturnType<typeof createRefund>>;
  try {
    refund = await createRefund(payment.providerPaymentId, payment.amount, { reason: opts.reason.slice(0, 200), receipt: payment.receiptNumber });
  } catch (err) {
    await db.update(payments).set({ refundStatus: payment.refundStatus }).where(eq(payments.id, payment.id));
    console.error("[payments] refund request failed", err);
    throw new DomainError("Razorpay didn't accept the refund request. Nothing was refunded; please try again.", "PAYMENT_FAILED", 502);
  }
  if (refund.status === "failed") {
    await db.update(payments).set({ refundReference: refund.id, refundStatus: "failed" }).where(eq(payments.id, payment.id));
    throw new DomainError("Razorpay couldn't process this refund. Check the Razorpay dashboard and try again.", "PAYMENT_FAILED", 502);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ refundReference: refund.id, refundStatus: refund.status, refundedAmount: payment.amount, failureReason: opts.reason.slice(0, 300) })
      .where(eq(payments.id, payment.id));
    if (payment.bookingId && opts.cancelBooking !== false) {
      const [booking] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId)).for("update");
      if (booking && booking.status !== "CANCELLED" && booking.status !== "REFUNDED") {
        await transitionBooking(tx, booking.id, "CANCELLED", {
          note: `${opts.reason} · refund ${refund.id} requested`,
          actorId: opts.actorId,
          patch: { cancelledAt: new Date(), cancelReason: opts.reason.slice(0, 300), holdExpiresAt: null },
        });
      }
    }
  });
  if (refund.status === "processed") await applyRefundStatus(refund.id, "processed");

  await sendEmail({
    to: payment.payerEmail,
    subject: `Refund initiated · ${site.name}`,
    text: `Hi ${payment.payerName},\n\nWe've refunded ${formatMoney(payment.amount)} (receipt ${payment.receiptNumber}) to your original payment method. Reason: ${opts.reason}.\nRazorpay refund reference: ${refund.id}. Refunds usually reach your account within 5–7 working days.\n\n${site.name}`,
  });
}

/** Applies a refund status reported by Razorpay (webhook, refund response or reconciliation). */
export async function applyRefundStatus(refundId: string, status: "pending" | "processed" | "failed") {
  await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.refundReference, refundId)).for("update");
    if (!payment || payment.refundStatus === status) return;
    if (status === "processed") {
      await tx.update(payments).set({ status: "REFUNDED", refundStatus: "processed", refundedAt: new Date() }).where(eq(payments.id, payment.id));
      if (payment.bookingId) {
        const [booking] = await tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, payment.bookingId));
        if (booking?.status === "CANCELLED") await transitionBooking(tx, payment.bookingId, "REFUNDED", { note: `Refund ${refundId} processed by Razorpay` });
      }
    } else {
      await tx.update(payments).set({ refundStatus: status }).where(eq(payments.id, payment.id));
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Reconciliation                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Safety net for missed callbacks and webhooks (run by the scheduled job): asks Razorpay about
 * recent unfinished orders and pending refunds, and applies what it reports.
 */
export async function reconcilePayments() {
  const result = { checked: 0, confirmed: 0, refundsUpdated: 0, errors: 0 };
  if (!paymentsEnabled()) return result;

  const open = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.provider, PROVIDER),
        inArray(payments.status, ["INITIATED", "FAILED"]),
        gte(payments.createdAt, new Date(Date.now() - 3 * 86_400_000)),
        lte(payments.createdAt, new Date(Date.now() - 2 * 60_000)),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(50);
  for (const local of open) {
    if (!local.providerOrderId) continue;
    result.checked++;
    try {
      const attempts = await fetchOrderPayments(local.providerOrderId);
      const done = attempts.find((p) => p.status === "captured") ?? attempts.find((p) => p.status === "authorized");
      if (!done) continue;
      const captured = await ensureCaptured(local, done);
      if (captured) {
        await recordCapture({ orderId: local.providerOrderId, paymentId: captured.id, amount: captured.amount });
        result.confirmed++;
      }
    } catch (err) {
      result.errors++;
      console.error("[payments] reconcile order failed", local.providerOrderId, err);
    }
  }

  const refunds = await db.select().from(payments).where(and(eq(payments.provider, PROVIDER), eq(payments.refundStatus, "pending"))).limit(50);
  for (const p of refunds) {
    if (!p.providerPaymentId || !p.refundReference) continue;
    try {
      const refund = await fetchRefund(p.providerPaymentId, p.refundReference);
      if (refund.status !== "pending") {
        await applyRefundStatus(refund.id, refund.status);
        result.refundsUpdated++;
      }
    } catch (err) {
      result.errors++;
      console.error("[payments] reconcile refund failed", p.refundReference, err);
    }
  }
  return result;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Customer emails                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

async function sendConfirmation(bookingId: string) {
  const [row] = await db
    .select({ b: bookings, court: courts.name, sport: sports.name })
    .from(bookings)
    .innerJoin(courts, eq(courts.id, bookings.courtId))
    .innerJoin(sports, eq(sports.id, bookings.sportId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return;
  const { b } = row;
  await sendEmail({
    to: b.customerEmail,
    subject: `Booking confirmed · ${b.code} · ${site.name}`,
    text: [
      `Hi ${b.customerName},`,
      "",
      "Your court is booked.",
      "",
      `Reference: ${b.code}`,
      `Court: ${row.court} (${row.sport})`,
      `Date: ${formatDate(b.date, "long")}`,
      `Time: ${formatTimeRange(b.startMinute, b.endMinute)}`,
      `Paid: ${formatMoney(b.total)}`,
      "",
      `View your booking: ${site.url}${bookingReceiptPath(b.code)}`,
      "",
      site.name,
    ].join("\n"),
  });
}
