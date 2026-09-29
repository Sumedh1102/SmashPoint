import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Transaction } from "@/server/db";
import {
  bookingSeries,
  bookings,
  courts,
  eventRegistrations,
  events,
  memberships,
  membershipPlans,
  payments,
  students,
  type Payment,
} from "@/server/db/schema";
import { formatDate, formatMoney, formatTimeRange } from "@/lib/format";
import { DomainError, isExclusionViolation } from "@/server/errors";
import { bookingAccessToken, randomCode } from "@/server/security";
import { getBookingSettings } from "@/server/settings";
import { notify } from "@/server/notifications";
import { transitionBooking, transitionSeries } from "@/server/services/bookings";
import { incrementCouponUse } from "@/server/services/coupons";
import { getPaymentProvider } from "./index";
import type { CheckoutInstruction } from "./types";

type Purpose = Payment["purpose"];

type StartPaymentInput = {
  purpose: Purpose;
  amount: number;
  description: string;
  payer: { name: string; email?: string | null; phone?: string | null };
  userId?: string | null;
  studentId?: string | null;
  bookingId?: string | null;
  seriesId?: string | null;
  membershipId?: string | null;
  eventRegistrationId?: string | null;
};

/** Creates a payment row and a gateway order; returns what the browser must do next. */
export async function startPayment(input: StartPaymentInput): Promise<{ paymentId: string; checkout: CheckoutInstruction }> {
  const provider = getPaymentProvider();
  const [payment] = await db
    .insert(payments)
    .values({
      receiptNumber: randomCode("RCP", 8),
      purpose: input.purpose,
      amount: input.amount,
      currency: "INR",
      status: "CREATED",
      method: "ONLINE",
      provider: provider.id,
      payerName: input.payer.name,
      payerEmail: input.payer.email ?? null,
      payerPhone: input.payer.phone ?? null,
      userId: input.userId ?? null,
      studentId: input.studentId ?? null,
      bookingId: input.bookingId ?? null,
      seriesId: input.seriesId ?? null,
      membershipId: input.membershipId ?? null,
      eventRegistrationId: input.eventRegistrationId ?? null,
    })
    .returning();

  try {
    const order = await provider.createOrder({
      paymentId: payment!.id,
      amount: input.amount,
      currency: "INR",
      receipt: payment!.receiptNumber,
      description: input.description,
      customer: input.payer,
      notes: { purpose: input.purpose },
    });
    await db.update(payments).set({ status: "INITIATED", providerOrderId: order.orderId }).where(eq(payments.id, payment!.id));
    return { paymentId: payment!.id, checkout: order.checkout };
  } catch (err) {
    await db
      .update(payments)
      .set({ status: "FAILED", failureReason: "Could not reach payment gateway" })
      .where(eq(payments.id, payment!.id));
    console.error("[payments] createOrder failed", err);
    throw new DomainError("We couldn't reach the payment gateway. Please try again.", "PAYMENT_FAILED", 502);
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Booking payments                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export function bookingReceiptPath(code: string) {
  return `/booking/${code}?t=${bookingAccessToken(code)}`;
}

export async function initiateBookingPayment(code: string): Promise<{ checkout: CheckoutInstruction }> {
  const settings = await getBookingSettings();
  const [booking] = await db.select().from(bookings).where(eq(bookings.code, code)).limit(1);
  if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (booking.status === "PAID" || booking.status === "CONFIRMED") {
    throw new DomainError("This booking is already paid.", "CONFLICT", 409);
  }
  if (!["PENDING", "PAYMENT_INITIATED"].includes(booking.status)) {
    throw new DomainError("This booking can no longer be paid. Please make a new booking.", "EXPIRED", 410);
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    await transitionBooking(db, booking.id, "EXPIRED", { note: "Payment window elapsed" });
    throw new DomainError("Your slot hold expired. Please choose the slot again.", "EXPIRED", 410);
  }

  // Fully discounted bookings are confirmed without visiting a gateway.
  if (booking.total === 0) {
    await recordOfflinePayment({
      purpose: "BOOKING",
      bookingId: booking.id,
      amount: 0,
      method: "ONLINE",
      payer: { name: booking.customerName, email: booking.customerEmail, phone: booking.customerPhone },
      userId: booking.userId,
      note: "Fully discounted",
    });
    return { checkout: { kind: "redirect", url: bookingReceiptPath(code) } };
  }

  // Supersede any earlier unfinished attempt.
  await db
    .update(payments)
    .set({ status: "FAILED", failureReason: "Superseded by a new payment attempt" })
    .where(and(eq(payments.bookingId, booking.id), inArray(payments.status, ["CREATED", "INITIATED"])));

  const { checkout } = await startPayment({
    purpose: "BOOKING",
    amount: booking.total,
    description: `Court booking ${booking.code}`,
    payer: { name: booking.customerName, email: booking.customerEmail, phone: booking.customerPhone },
    userId: booking.userId,
    bookingId: booking.id,
  });

  await transitionBooking(db, booking.id, "PAYMENT_INITIATED", {
    note: `Checkout started (${getPaymentProvider().displayName})`,
    patch: { holdExpiresAt: new Date(Date.now() + settings.holdMinutes * 60_000) },
  });
  return { checkout };
}

/** Checkout for a monthly/quarterly booking: one payment covers every session. */
export async function initiateSeriesPayment(code: string): Promise<{ checkout: CheckoutInstruction }> {
  const settings = await getBookingSettings();
  const [series] = await db.select().from(bookingSeries).where(eq(bookingSeries.code, code)).limit(1);
  if (!series) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
  if (series.status === "PAID" || series.status === "CONFIRMED") throw new DomainError("This booking is already paid.", "CONFLICT", 409);
  if (!["PENDING", "PAYMENT_INITIATED"].includes(series.status)) {
    throw new DomainError("This booking can no longer be paid. Please make a new booking.", "EXPIRED", 410);
  }
  if (series.holdExpiresAt && series.holdExpiresAt < new Date()) {
    await db.transaction((tx) => transitionSeries(tx, series.id, "EXPIRED", { note: "Payment window elapsed", fromStatuses: ["PENDING", "PAYMENT_INITIATED"] }));
    throw new DomainError("Your slot hold expired. Please choose the slots again.", "EXPIRED", 410);
  }
  if (series.total === 0) {
    await recordOfflinePayment({
      purpose: "BOOKING",
      seriesId: series.id,
      amount: 0,
      method: "ONLINE",
      payer: { name: series.customerName, email: series.customerEmail, phone: series.customerPhone },
      userId: series.userId,
      note: "Fully discounted",
    });
    return { checkout: { kind: "redirect", url: bookingReceiptPath(code) } };
  }
  await db
    .update(payments)
    .set({ status: "FAILED", failureReason: "Superseded by a new payment attempt" })
    .where(and(eq(payments.seriesId, series.id), inArray(payments.status, ["CREATED", "INITIATED"])));
  const { checkout } = await startPayment({
    purpose: "BOOKING",
    amount: series.total,
    description: `${series.type === "MONTHLY" ? "Monthly" : "Quarterly"} court booking ${series.code}`,
    payer: { name: series.customerName, email: series.customerEmail, phone: series.customerPhone },
    userId: series.userId,
    seriesId: series.id,
  });
  const holdExpiresAt = new Date(Date.now() + settings.holdMinutes * 60_000);
  await db.transaction(async (tx) => {
    await tx.update(bookingSeries).set({ status: "PAYMENT_INITIATED", holdExpiresAt }).where(eq(bookingSeries.id, series.id));
    await tx
      .update(bookings)
      .set({ status: "PAYMENT_INITIATED", holdExpiresAt })
      .where(and(eq(bookings.seriesId, series.id), inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"])));
  });
  return { checkout };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Capture / fail / refund                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

type FulfilmentOutcome = { needsRefund: boolean; reason?: string };

async function fulfil(tx: Transaction, payment: Payment, actorId?: string | null): Promise<FulfilmentOutcome> {
  if (payment.purpose === "BOOKING" && payment.seriesId) {
    const [series] = await tx.select().from(bookingSeries).where(eq(bookingSeries.id, payment.seriesId)).for("update");
    if (!series) return { needsRefund: true, reason: "Booking no longer exists" };
    if (series.status === "PAID" || series.status === "CONFIRMED") return { needsRefund: true, reason: "Duplicate payment" };
    if (series.status === "CANCELLED" || series.status === "REFUNDED") return { needsRefund: true, reason: "Booking was cancelled" };
    try {
      // Late payments re-activate expired sessions only if every one is still free.
      await tx.transaction(async (sp) => {
        await transitionSeries(sp, series.id, "PAID", {
          note: `Payment ${payment.receiptNumber} received`,
          actorId,
          fromStatuses: ["PENDING", "PAYMENT_INITIATED", "EXPIRED"],
          patch: { paidAt: new Date(), holdExpiresAt: null },
        });
      });
    } catch (err) {
      if (isExclusionViolation(err)) return { needsRefund: true, reason: "Some sessions were taken after the hold expired" };
      throw err;
    }
    await transitionSeries(tx, series.id, "CONFIRMED", { note: "Booking confirmed", actorId, fromStatuses: ["PAID"], patch: { confirmedAt: new Date() } });
    return { needsRefund: false };
  }

  if (payment.purpose === "BOOKING" && payment.bookingId) {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, payment.bookingId)).for("update");
    if (!booking) return { needsRefund: true, reason: "Booking no longer exists" };
    if (booking.status === "PAID" || booking.status === "CONFIRMED") return { needsRefund: true, reason: "Duplicate payment" };
    if (booking.status === "CANCELLED" || booking.status === "REFUNDED") return { needsRefund: true, reason: "Booking was cancelled" };

    try {
      // A late payment for an expired hold re-activates the booking only if the slot is still free;
      // the savepoint + EXCLUDE constraint decide atomically.
      await tx.transaction(async (sp) => {
        await transitionBooking(sp, booking.id, "PAID", {
          note: `Payment ${payment.receiptNumber} received`,
          actorId,
          patch: { paidAt: new Date(), holdExpiresAt: null },
        });
      });
    } catch (err) {
      if (isExclusionViolation(err)) return { needsRefund: true, reason: "Slot was taken after the hold expired" };
      throw err;
    }
    await transitionBooking(tx, booking.id, "CONFIRMED", { note: "Booking confirmed", actorId, patch: { confirmedAt: new Date() } });
    if (booking.couponId) await incrementCouponUse(tx, booking.couponId);
    return { needsRefund: false };
  }

  if (payment.purpose === "MEMBERSHIP" && payment.membershipId) {
    await tx.update(memberships).set({ status: "ACTIVE", paymentStatus: "PAID" }).where(eq(memberships.id, payment.membershipId));
    return { needsRefund: false };
  }

  if (payment.purpose === "EVENT" && payment.eventRegistrationId) {
    await tx
      .update(eventRegistrations)
      .set({ status: "CONFIRMED", paymentStatus: "PAID" })
      .where(eq(eventRegistrations.id, payment.eventRegistrationId));
    return { needsRefund: false };
  }
  return { needsRefund: false };
}

/** Sends the customer-facing confirmation for a fulfilled payment. */
async function announceFulfilment(payment: Payment) {
  if (payment.purpose === "BOOKING" && payment.seriesId) {
    const [s] = await db
      .select({ series: bookingSeries, court: courts.name })
      .from(bookingSeries)
      .innerJoin(courts, eq(courts.id, bookingSeries.courtId))
      .where(eq(bookingSeries.id, payment.seriesId))
      .limit(1);
    if (!s) return;
    await notify({
      userId: s.series.userId,
      recipient: { name: s.series.customerName, email: s.series.customerEmail, phone: s.series.customerPhone },
      type: "BOOKING_CONFIRMED",
      title: `${s.series.type === "MONTHLY" ? "Monthly" : "Quarterly"} booking confirmed · ${s.series.code}`,
      body: `${s.court}, ${formatTimeRange(s.series.startMinute, s.series.endMinute)}, ${s.series.sessionCount} sessions from ${formatDate(s.series.startDate, "long")} to ${formatDate(s.series.endDate, "long")}. Amount paid: ${formatMoney(s.series.total)}.`,
      link: s.series.userId ? "/dashboard/bookings" : bookingReceiptPath(s.series.code),
    });
    return;
  }
  if (payment.purpose === "BOOKING" && payment.bookingId) {
    const [b] = await db.query.bookings.findMany({ where: eq(bookings.id, payment.bookingId), with: { court: true }, limit: 1 });
    if (!b) return;
    await notify({
      userId: b.userId,
      recipient: { name: b.customerName, email: b.customerEmail, phone: b.customerPhone },
      type: "BOOKING_CONFIRMED",
      title: `Booking confirmed · ${b.code}`,
      body: `${b.court.name} on ${formatDate(b.date, "long")}, ${formatTimeRange(b.startMinute, b.endMinute)}. Amount paid: ${formatMoney(b.total)}. See you on court!`,
      link: b.userId ? `/dashboard/bookings` : bookingReceiptPath(b.code),
    });
  } else if (payment.purpose === "MEMBERSHIP" && payment.membershipId) {
    const [m] = await db
      .select({ endDate: memberships.endDate, plan: membershipPlans.name, userId: students.userId })
      .from(memberships)
      .innerJoin(membershipPlans, eq(membershipPlans.id, memberships.planId))
      .innerJoin(students, eq(students.id, memberships.studentId))
      .where(eq(memberships.id, payment.membershipId))
      .limit(1);
    await notify({
      userId: payment.userId ?? m?.userId,
      recipient: { name: payment.payerName, email: payment.payerEmail, phone: payment.payerPhone },
      type: "PAYMENT_RECEIVED",
      title: "Membership activated",
      body: `Your ${m?.plan ?? ""} membership is active until ${formatDate(m?.endDate)}. Receipt ${payment.receiptNumber} · ${formatMoney(payment.amount)}.`,
      link: "/dashboard/membership",
    });
  } else if (payment.purpose === "EVENT" && payment.eventRegistrationId) {
    const [r] = await db
      .select({ name: events.name, date: events.date, slug: events.slug })
      .from(eventRegistrations)
      .innerJoin(events, eq(events.id, eventRegistrations.eventId))
      .where(eq(eventRegistrations.id, payment.eventRegistrationId))
      .limit(1);
    await notify({
      userId: payment.userId,
      recipient: { name: payment.payerName, email: payment.payerEmail, phone: payment.payerPhone },
      type: "EVENT",
      title: `You're registered · ${r?.name ?? "Event"}`,
      body: `Registration confirmed for ${r?.name} on ${formatDate(r?.date, "long")}. Receipt ${payment.receiptNumber}.`,
      link: r ? `/events/${r.slug}` : null,
    });
  }
}

export async function capturePayment(input: {
  providerId: string;
  orderId: string;
  providerPaymentId: string;
  signature?: string;
  /** True when the event already arrived through a verified webhook. */
  preVerified?: boolean;
}): Promise<Payment> {
  const provider = getPaymentProvider(input.providerId);
  if (!input.preVerified) {
    const ok = input.signature ? await provider.verifyPayment({ orderId: input.orderId, providerPaymentId: input.providerPaymentId, signature: input.signature }) : false;
    if (!ok) {
      await failPayment({ providerId: input.providerId, orderId: input.orderId, reason: "Signature verification failed" });
      throw new DomainError("We couldn't verify this payment. If money was deducted it will be auto-refunded.", "PAYMENT_FAILED", 400);
    }
  }

  const { payment, outcome, alreadyProcessed } = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.provider, provider.id), eq(payments.providerOrderId, input.orderId)))
      .for("update");
    if (!row) throw new DomainError("Payment not found.", "NOT_FOUND", 404);
    if (row.status === "PAID" || row.status === "REFUNDED") {
      return { payment: row, outcome: { needsRefund: false } as FulfilmentOutcome, alreadyProcessed: true };
    }
    const [paid] = await tx
      .update(payments)
      .set({ status: "PAID", paidAt: new Date(), providerPaymentId: input.providerPaymentId, providerSignature: input.signature ?? null, failureReason: null })
      .where(eq(payments.id, row.id))
      .returning();
    const outcome = await fulfil(tx, paid!);
    return { payment: paid!, outcome, alreadyProcessed: false };
  });

  if (alreadyProcessed) return payment;
  if (outcome.needsRefund) {
    await refundPayment(payment.id, { reason: outcome.reason ?? "Automatic refund" });
    return payment;
  }
  await announceFulfilment(payment);
  return payment;
}

export async function failPayment(input: { providerId: string; orderId: string; reason?: string }) {
  await db
    .update(payments)
    .set({ status: "FAILED", failureReason: input.reason?.slice(0, 300) ?? "Payment failed" })
    .where(
      and(eq(payments.provider, input.providerId), eq(payments.providerOrderId, input.orderId), inArray(payments.status, ["CREATED", "INITIATED"])),
    );
}

/** Staff-recorded payments (cash / UPI at the desk) and zero-value confirmations. */
export async function recordOfflinePayment(input: {
  purpose: Purpose;
  amount: number;
  method: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "ONLINE";
  payer: { name: string; email?: string | null; phone?: string | null };
  userId?: string | null;
  studentId?: string | null;
  bookingId?: string | null;
  seriesId?: string | null;
  membershipId?: string | null;
  eventRegistrationId?: string | null;
  actorId?: string | null;
  note?: string;
}) {
  const payment = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(payments)
      .values({
        receiptNumber: randomCode("RCP", 8),
        purpose: input.purpose,
        amount: input.amount,
        status: "PAID",
        method: input.method,
        provider: "offline",
        payerName: input.payer.name,
        payerEmail: input.payer.email ?? null,
        payerPhone: input.payer.phone ?? null,
        userId: input.userId ?? null,
        studentId: input.studentId ?? null,
        bookingId: input.bookingId ?? null,
        seriesId: input.seriesId ?? null,
        membershipId: input.membershipId ?? null,
        eventRegistrationId: input.eventRegistrationId ?? null,
        paidAt: new Date(),
        recordedById: input.actorId ?? null,
        meta: input.note ? { note: input.note } : null,
      })
      .returning();
    const outcome = await fulfil(tx, row!, input.actorId);
    if (outcome.needsRefund) throw new DomainError(outcome.reason ?? "Could not apply payment.", "CONFLICT", 409);
    return row!;
  });
  await announceFulfilment(payment);
  return payment;
}

export async function refundPayment(paymentId: string, opts: { reason: string; actorId?: string | null }) {
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment) throw new DomainError("Payment not found.", "NOT_FOUND", 404);
  if (payment.status !== "PAID") throw new DomainError("Only paid payments can be refunded.");

  let refundReference = "manual";
  if (payment.provider !== "offline" && payment.providerPaymentId && payment.amount > 0) {
    const provider = getPaymentProvider(payment.provider);
    refundReference = (await provider.refund({ providerPaymentId: payment.providerPaymentId, amount: payment.amount, reason: opts.reason })).refundId;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "REFUNDED", refundedAmount: payment.amount, refundedAt: new Date(), refundReference, failureReason: opts.reason.slice(0, 300) })
      .where(eq(payments.id, payment.id));
    if (payment.seriesId) {
      const [series] = await tx.select({ status: bookingSeries.status }).from(bookingSeries).where(eq(bookingSeries.id, payment.seriesId));
      if (series && series.status !== "REFUNDED") {
        await transitionSeries(tx, payment.seriesId, "CANCELLED", {
          note: opts.reason,
          actorId: opts.actorId,
          fromStatuses: ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"],
          patch: { cancelledAt: new Date(), cancelReason: opts.reason },
        });
        await transitionSeries(tx, payment.seriesId, "REFUNDED", { note: `Refund ${refundReference}`, actorId: opts.actorId, fromStatuses: ["CANCELLED"] });
      }
    }
    if (payment.bookingId) {
      const [booking] = await tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, payment.bookingId));
      if (booking && booking.status !== "REFUNDED") {
        if (booking.status !== "CANCELLED") {
          await transitionBooking(tx, payment.bookingId, "CANCELLED", { note: opts.reason, actorId: opts.actorId, patch: { cancelledAt: new Date(), cancelReason: opts.reason } });
        }
        await transitionBooking(tx, payment.bookingId, "REFUNDED", { note: `Refund ${refundReference}`, actorId: opts.actorId });
      }
    }
    if (payment.membershipId) {
      await tx.update(memberships).set({ status: "CANCELLED", paymentStatus: "REFUNDED" }).where(eq(memberships.id, payment.membershipId));
    }
    if (payment.eventRegistrationId) {
      await tx
        .update(eventRegistrations)
        .set({ status: "CANCELLED", paymentStatus: "REFUNDED" })
        .where(eq(eventRegistrations.id, payment.eventRegistrationId));
    }
  });

  await notify({
    userId: payment.userId,
    recipient: { name: payment.payerName, email: payment.payerEmail, phone: payment.payerPhone },
    type: "PAYMENT_RECEIVED",
    title: "Refund initiated",
    body: `We've refunded ${formatMoney(payment.amount)} for receipt ${payment.receiptNumber}. It usually reaches your account in 5–7 working days.`,
  });
}

/** Where the customer lands after a completed (or failed) checkout. */
export async function paymentReturnUrl(payment: Pick<Payment, "purpose" | "bookingId" | "seriesId" | "eventRegistrationId">, outcome: "success" | "failed" = "success") {
  if (payment.purpose === "BOOKING" && payment.seriesId) {
    const [s] = await db.select({ code: bookingSeries.code }).from(bookingSeries).where(eq(bookingSeries.id, payment.seriesId)).limit(1);
    if (s) return `${bookingReceiptPath(s.code)}${outcome === "failed" ? "&payment=failed" : ""}`;
  }
  if (payment.purpose === "BOOKING" && payment.bookingId) {
    const [b] = await db.select({ code: bookings.code }).from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1);
    if (b) return `${bookingReceiptPath(b.code)}${outcome === "failed" ? "&payment=failed" : ""}`;
  }
  if (payment.purpose === "MEMBERSHIP") return `/dashboard/membership?payment=${outcome}`;
  if (payment.purpose === "EVENT" && payment.eventRegistrationId) {
    const [r] = await db
      .select({ slug: events.slug })
      .from(eventRegistrations)
      .innerJoin(events, eq(events.id, eventRegistrations.eventId))
      .where(eq(eventRegistrations.id, payment.eventRegistrationId))
      .limit(1);
    if (r) return `/events/${r.slug}?payment=${outcome}`;
  }
  return "/";
}
