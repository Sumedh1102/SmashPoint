import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courts, payments } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { addDays, todayInTz } from "@/lib/time";
import { createBookingHold, expireStaleHolds, getAvailability, releaseHold } from "@/server/services/bookings";
import { cancelBooking, createBlock } from "@/server/services/admin";
import { checkoutSignature } from "@/server/payments/razorpay";
import { reconcilePayments, recordCapture, recordFailure, startCheckout, verifyCheckout } from "@/server/payments/service";
import { fakePay } from "../fake-razorpay";

const H = 60;
const FAKE = process.env.FAKE_RAZORPAY_URL!;
const DAY = addDays(todayInTz(), 3);
const customer = { name: "Test Player", phone: "+919876543210", email: "player@example.com" };

let courtIds: Record<string, string> = {};

async function courtId(slug: string) {
  if (!courtIds[slug]) {
    const rows = await db.select({ id: courts.id, slug: courts.slug }).from(courts);
    courtIds = Object.fromEntries(rows.map((r) => [r.slug, r.id]));
  }
  return courtIds[slug]!;
}

async function hold(slug: string, startMinute: number, duration = 60, date = DAY) {
  return createBookingHold({ courtId: await courtId(slug), date, startMinute, duration, customer });
}

async function expectRejected(p: Promise<unknown>, code: DomainError["code"]) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, `expected ${code}`).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  return err as DomainError;
}

async function slotState(slug: string, start: number, duration = 60) {
  const a = await getAvailability({ date: DAY, duration, courtSlug: slug });
  return a.courts[0]!.slots.find((s) => s.startMinute === start)!.state;
}

/** Hold + Razorpay order + customer pays at the (fake) gateway → returns what Checkout would hand the browser. */
async function holdAndPay(slug: string, start: number, duration = 60, status: "captured" | "authorized" = "captured") {
  const booking = await hold(slug, start, duration);
  const checkout = await startCheckout(booking);
  const paid = await fakePay(FAKE, checkout.orderId, status);
  return { booking, checkout, paid };
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE bookings, booking_events, payments, court_blocks, payment_webhook_events, notification_deliveries RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await (globalThis as { __smashpointPool?: { end(): Promise<void> } }).__smashpointPool?.end();
});

describe("catalogue", () => {
  it("has exactly 2 badminton, 2 pickleball and 1 basketball court", async () => {
    const a = await getAvailability({ date: DAY, duration: 60 });
    expect(a.courts.map((c) => c.courtSlug)).toEqual(["badminton-court-1", "badminton-court-2", "pickleball-court-1", "pickleball-court-2", "basketball-court-1"]);
  });
});

describe("booking rules enforced by the backend", () => {
  it("creates a valid one-hour hold with a server-computed price and an expiry", async () => {
    const b = await hold("pickleball-court-1", 10 * H);
    expect(b.status).toBe("PENDING");
    expect(b.endMinute).toBe(11 * H);
    expect(b.total).toBe(60_000); // ₹600 off-peak
    const minutes = (b.holdExpiresAt!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
  });

  it("creates a valid two-hour hold that spans both hours and their rates", async () => {
    const b = await hold("pickleball-court-1", 16 * H, 120);
    expect([b.startMinute, b.endMinute]).toEqual([16 * H, 18 * H]);
    expect(b.total).toBe(60_000 + 80_000); // one off-peak + one peak hour
    expect(await slotState("pickleball-court-1", 16 * H)).toBe("HELD");
    expect(await slotState("pickleball-court-1", 17 * H)).toBe("HELD");
  });

  it("rejects badminton bookings during the 5–7 PM academy closure, on both courts", async () => {
    for (const slug of ["badminton-court-1", "badminton-court-2"]) {
      await expectRejected(hold(slug, 17 * H), "RULE_VIOLATION");
      await expectRejected(hold(slug, 18 * H), "RULE_VIOLATION");
      await expectRejected(hold(slug, 16 * H, 120), "RULE_VIOLATION"); // 4–6 PM overlaps
      await expectRejected(hold(slug, 18 * H, 120), "RULE_VIOLATION"); // 6–8 PM overlaps
    }
    expect((await hold("badminton-court-1", 15 * H)).status).toBe("PENDING"); // 3–4 PM
    expect((await hold("badminton-court-1", 16 * H)).status).toBe("PENDING"); // 4–5 PM
    expect((await hold("badminton-court-1", 19 * H)).status).toBe("PENDING"); // 7–8 PM
  });

  it("keeps pickleball and basketball bookable from 5 to 7 PM", async () => {
    expect((await hold("pickleball-court-1", 17 * H)).status).toBe("PENDING");
    expect((await hold("pickleball-court-2", 18 * H)).status).toBe("PENDING");
    expect((await hold("basketball-court-1", 17 * H, 120)).status).toBe("PENDING");
  });

  it("rejects bookings outside 7 AM – 10 PM, misaligned or of other lengths", async () => {
    await expectRejected(hold("basketball-court-1", 21 * H, 120), "RULE_VIOLATION"); // would end 11 PM
    await expectRejected(hold("basketball-court-1", 6 * H), "RULE_VIOLATION");
    await expectRejected(hold("basketball-court-1", 9 * H + 30), "RULE_VIOLATION");
    await expectRejected(hold("basketball-court-1", 9 * H, 90), "RULE_VIOLATION");
    await expectRejected(hold("basketball-court-1", 9 * H, 180), "RULE_VIOLATION");
    expect((await hold("basketball-court-1", 21 * H)).endMinute).toBe(22 * H); // 9–10 PM is fine
  });

  it("rejects past dates and dates beyond the booking window", async () => {
    await expectRejected(hold("pickleball-court-1", 10 * H, 60, addDays(todayInTz(), -1)), "RULE_VIOLATION");
    await expectRejected(hold("pickleball-court-1", 10 * H, 60, addDays(todayInTz(), 400)), "RULE_VIOLATION");
  });

  it("rejects overlapping bookings on the same court but allows other courts", async () => {
    await hold("badminton-court-1", 19 * H, 120); // 7–9 PM
    await expectRejected(hold("badminton-court-1", 20 * H), "SLOT_UNAVAILABLE"); // 8–9 PM
    await expectRejected(hold("badminton-court-1", 19 * H), "SLOT_UNAVAILABLE");
    expect((await hold("badminton-court-2", 19 * H)).status).toBe("PENDING"); // other court, same time
    expect((await hold("badminton-court-1", 21 * H)).status).toBe("PENDING"); // after it
  });

  it("the database itself refuses a badminton booking in the closure (trigger)", async () => {
    const id = await courtId("badminton-court-1");
    const [court] = await db.select().from(courts).where(eq(courts.id, id));
    const err = await db
      .insert(bookings)
      .values({ code: "SP-TRIGGR", sportId: court!.sportId, courtId: id, customerName: "x", customerPhone: "x", date: DAY, startMinute: 17 * H, endMinute: 18 * H, subtotal: 0, total: 0, status: "CONFIRMED" })
      .then(() => null, (e: unknown) => e);
    expect(String((err as Error)?.cause ?? err)).toMatch(/academy sessions/);
  });
});

describe("concurrency", () => {
  it("lets exactly one of many simultaneous requests for a slot win", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => hold("basketball-court-1", 19 * H)));
    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(11);
    for (const r of lost) expect((r.reason as DomainError).code).toBe("SLOT_UNAVAILABLE");
  });

  it("never double-books overlapping one- and two-hour requests", async () => {
    const reqs = [hold("pickleball-court-2", 19 * H, 120), hold("pickleball-court-2", 20 * H), hold("pickleball-court-2", 19 * H), hold("pickleball-court-2", 20 * H, 120)];
    await Promise.allSettled(reqs);
    const rows = await db.select().from(bookings).where(eq(bookings.courtId, await courtId("pickleball-court-2")));
    for (const a of rows) for (const b of rows) if (a.id !== b.id) expect(a.startMinute < b.endMinute && b.startMinute < a.endMinute).toBe(false);
  });
});

describe("holds", () => {
  it("expired holds stop blocking the slot", async () => {
    const first = await hold("pickleball-court-1", 12 * H);
    await db.update(bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, first.id));
    expect(await slotState("pickleball-court-1", 12 * H)).toBe("AVAILABLE");
    const second = await hold("pickleball-court-1", 12 * H);
    expect(second.status).toBe("PENDING");
    const [old] = await db.select().from(bookings).where(eq(bookings.id, first.id));
    expect(old!.status).toBe("EXPIRED");
  });

  it("the scheduled job expires stale holds", async () => {
    const b = await hold("pickleball-court-1", 13 * H);
    await db.update(bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, b.id));
    expect(await expireStaleHolds(db)).toBe(1);
  });

  it("a released hold frees the slot immediately", async () => {
    const b = await hold("pickleball-court-1", 14 * H);
    await releaseHold(b.code);
    expect(await slotState("pickleball-court-1", 14 * H)).toBe("AVAILABLE");
  });
});

describe("Razorpay payments", () => {
  it("confirms a booking only after the payment is verified, and locks the slot", async () => {
    const { booking, checkout, paid } = await holdAndPay("badminton-court-2", 19 * H, 120);
    expect(checkout.amount).toBe(booking.total);
    expect(checkout.keyId).toBe("rzp_test_IntegrationKey");
    expect(JSON.stringify(checkout)).not.toContain("integration_key_secret");

    const [before] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(before!.status).toBe("PAYMENT_INITIATED");

    const result = await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
    expect(result.status).toBe("CONFIRMED");
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(p!.status).toBe("PAID");
    expect(p!.providerPaymentId).toBe(paid.paymentId);
    expect(await slotState("badminton-court-2", 19 * H)).toBe("BOOKED");
    expect(await slotState("badminton-court-2", 20 * H)).toBe("BOOKED");
    expect(await slotState("badminton-court-1", 19 * H)).toBe("AVAILABLE");
  });

  it("is idempotent across the browser callback and duplicate webhooks", async () => {
    const { booking, checkout, paid } = await holdAndPay("pickleball-court-1", 9 * H);
    await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
    expect(await recordCapture({ orderId: checkout.orderId, paymentId: paid.paymentId, amount: booking.total })).toBe("duplicate");
    expect(await recordCapture({ orderId: checkout.orderId, paymentId: paid.paymentId, amount: booking.total })).toBe("duplicate");
    await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(rows.filter((r) => r.status === "PAID")).toHaveLength(1);
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).toBe("CONFIRMED");
  });

  it("rejects a forged signature and doesn't confirm", async () => {
    const { booking, checkout, paid } = await holdAndPay("pickleball-court-1", 10 * H);
    await expectRejected(verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: checkoutSignature(checkout.orderId, paid.paymentId, "wrong-secret") }), "PAYMENT_FAILED");
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).toBe("PAYMENT_INITIATED");
  });

  it("rejects a payment whose amount doesn't match the booking", async () => {
    const booking = await hold("pickleball-court-1", 11 * H);
    const checkout = await startCheckout(booking);
    const paid = await fakePay(FAKE, checkout.orderId, "captured", 100); // ₹1 instead of ₹600
    await expectRejected(verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature }), "PAYMENT_FAILED");
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).not.toBe("CONFIRMED");
  });

  it("captures an authorized payment before confirming", async () => {
    const { booking, checkout, paid } = await holdAndPay("basketball-court-1", 8 * H, 60, "authorized");
    const result = await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
    expect(result.status).toBe("CONFIRMED");
    const state = (await (await fetch(`${FAKE}/__test/state`)).json()) as { payments: { id: string; status: string }[] };
    expect(state.payments.find((p) => p.id === paid.paymentId)!.status).toBe("captured");
  });

  it("a failed payment never confirms, and the slot is released when the hold ends", async () => {
    const booking = await hold("pickleball-court-2", 9 * H);
    const checkout = await startCheckout(booking);
    await fakePay(FAKE, checkout.orderId, "failed");
    await recordFailure(checkout.orderId, "Your card was declined.");
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect(p!.status).toBe("FAILED");
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).toBe("PAYMENT_INITIATED");
    await db.update(bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, booking.id));
    await expireStaleHolds(db);
    expect(await slotState("pickleball-court-2", 9 * H)).toBe("AVAILABLE");
  });

  it("refunds a payment that arrives after the hold expired and the slot was taken", async () => {
    const late = await hold("basketball-court-1", 12 * H);
    const checkout = await startCheckout(late);
    await db.update(bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, late.id));
    const someoneElse = await hold("basketball-court-1", 12 * H); // takes the slot
    const paid = await fakePay(FAKE, checkout.orderId);
    expect(await recordCapture({ orderId: checkout.orderId, paymentId: paid.paymentId, amount: late.total })).toBe("refunded");
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, late.id));
    expect(p!.refundStatus).toBe("processed");
    expect(p!.status).toBe("REFUNDED");
    const [lateRow] = await db.select().from(bookings).where(eq(bookings.id, late.id));
    expect(lateRow!.status).toBe("EXPIRED");
    const [other] = await db.select().from(bookings).where(eq(bookings.id, someoneElse.id));
    expect(other!.status).toBe("PENDING"); // untouched
  });

  it("re-activates a late payment when the slot is still free", async () => {
    const late = await hold("basketball-court-1", 13 * H);
    const checkout = await startCheckout(late);
    await db.update(bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(bookings.id, late.id));
    await expireStaleHolds(db);
    const paid = await fakePay(FAKE, checkout.orderId);
    expect(await recordCapture({ orderId: checkout.orderId, paymentId: paid.paymentId, amount: late.total })).toBe("captured");
    const [b] = await db.select().from(bookings).where(eq(bookings.id, late.id));
    expect(b!.status).toBe("CONFIRMED");
  });

  it("reconciliation confirms a captured payment whose callback and webhook never arrived", async () => {
    const { booking, checkout } = await holdAndPay("basketball-court-1", 14 * H);
    await db.update(payments).set({ createdAt: new Date(Date.now() - 5 * 60_000) }).where(eq(payments.providerOrderId, checkout.orderId));
    const result = await reconcilePayments();
    expect(result.confirmed).toBe(1);
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).toBe("CONFIRMED");
  });

  it("releases the hold if the Razorpay order can't be created", async () => {
    await fetch(`${FAKE}/__test/fail-next-order`, { method: "POST" });
    const booking = await hold("basketball-court-1", 15 * H);
    await expectRejected(startCheckout(booking), "PAYMENT_FAILED");
  });
});

describe("admin", () => {
  it("cancelling with a refund refunds through Razorpay and frees the slot", async () => {
    const { booking, checkout, paid } = await holdAndPay("pickleball-court-1", 19 * H);
    await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
    await cancelBooking(booking.id, { reason: "Court maintenance", refund: true, actorId: null as unknown as string });
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).toBe("REFUNDED");
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect([p!.status, p!.refundStatus]).toEqual(["REFUNDED", "processed"]);
    expect(await slotState("pickleball-court-1", 19 * H)).toBe("AVAILABLE");
  });

  it("shows a refund as pending until Razorpay reports it processed", async () => {
    await fetch(`${FAKE}/__test/refund-mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "pending" }) });
    try {
      const { booking, checkout, paid } = await holdAndPay("pickleball-court-2", 19 * H);
      await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
      await cancelBooking(booking.id, { reason: "Rain leak", refund: true, actorId: null as unknown as string });
      let [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
      let [p] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
      expect(b!.status).toBe("CANCELLED");
      expect([p!.status, p!.refundStatus]).toEqual(["PAID", "pending"]);

      // Razorpay processes it; the scheduled reconciliation (or the refund.processed webhook) picks it up.
      await fetch(`${FAKE}/__test/process-refunds`, { method: "POST" });
      expect((await reconcilePayments()).refundsUpdated).toBe(1);
      [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
      [p] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
      expect(b!.status).toBe("REFUNDED");
      expect([p!.status, p!.refundStatus]).toEqual(["REFUNDED", "processed"]);
    } finally {
      await fetch(`${FAKE}/__test/refund-mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "processed" }) });
    }
  });

  it("cancelling without a refund leaves the payment untouched", async () => {
    const { booking, checkout, paid } = await holdAndPay("pickleball-court-1", 20 * H);
    await verifyCheckout({ code: booking.code, orderId: checkout.orderId, paymentId: paid.paymentId, signature: paid.signature });
    await cancelBooking(booking.id, { reason: "Customer request", refund: false, actorId: null as unknown as string });
    const [b] = await db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b!.status).toBe("CANCELLED");
    const [p] = await db.select().from(payments).where(eq(payments.bookingId, booking.id));
    expect([p!.status, p!.refundStatus]).toEqual(["PAID", null]);
  });

  it("can't block a slot that has a booking, and blocks stop new bookings", async () => {
    await hold("badminton-court-1", 9 * H);
    await expectRejected(
      createBlock({ courtId: await courtId("badminton-court-1"), type: "MAINTENANCE", startDate: DAY, endDate: DAY, startMinute: 8 * H, endMinute: 10 * H, reason: "Repairs" }, null as unknown as string),
      "CONFLICT",
    );
    await createBlock({ courtId: await courtId("badminton-court-1"), type: "BLOCKED", startDate: DAY, endDate: DAY, startMinute: 11 * H, endMinute: 13 * H, reason: "Private event" }, null as unknown as string);
    expect(await slotState("badminton-court-1", 12 * H)).toBe("BLOCKED");
    await expectRejected(hold("badminton-court-1", 12 * H), "SLOT_UNAVAILABLE");
    expect((await hold("badminton-court-2", 12 * H)).status).toBe("PENDING"); // other court unaffected
  });
});
