import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { bookings, courts, payments, settings } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { addDays, todayInTz } from "@/lib/time";
import { createBookingHold, expireStaleHolds, getAvailability, releaseHold } from "@/server/services/bookings";
import { cancelBooking, createBlock, updateBookingHours, updateCourt } from "@/server/services/admin";
import { checkoutSignature } from "@/server/payments/razorpay";
import { reconcilePayments, recordCapture, recordFailure, startCheckout, verifyCheckout } from "@/server/payments/service";
import { fakePay } from "../fake-razorpay";
import { CATALOGUE_SETTING, upgradeCatalogue } from "../../scripts/lib/setup";
import { COURTS } from "../../scripts/lib/catalogue";

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

/** The published rate card, in paise: [1 hour, 2 hours]. */
const RATES: Record<string, [number, number]> = {
  "badminton-court-1": [50_000, 90_000],
  "badminton-court-2": [40_000, 70_000],
  "pickleball-court-1": [40_000, 70_000],
  "pickleball-court-2": [40_000, 70_000],
  "basketball-court-1": [70_000, 130_000],
};

/** Merges keys into the `booking` settings document (read by the app and the rules trigger). */
async function patchBookingSettings(patch: Record<string, unknown>) {
  await db.update(settings).set({ value: sql`${settings.value} || ${JSON.stringify(patch)}::jsonb` }).where(eq(settings.key, "booking"));
}
async function resetBookingHours() {
  await db.update(settings).set({ value: sql`${settings.value} - 'openMinute' - 'closeMinute'` }).where(eq(settings.key, "booking"));
}

describe("catalogue", () => {
  it("has exactly 2 badminton, 2 pickleball and 1 basketball court", async () => {
    const a = await getAvailability({ date: DAY, duration: 60 });
    expect(a.courts.map((c) => c.courtSlug)).toEqual(["badminton-court-1", "badminton-court-2", "pickleball-court-1", "pickleball-court-2", "basketball-court-1"]);
  });

  it("stores the rate card: exact 1 h / 2 h prices, monthly plans and badminton surfaces", async () => {
    const rows = await db.select().from(courts);
    for (const [slug, [h1, h2]] of Object.entries(RATES)) {
      const c = rows.find((r) => r.slug === slug)!;
      expect([c.price1h, c.price2h]).toEqual([h1, h2]);
    }
    const bySlug = (slug: string) => rows.find((r) => r.slug === slug)!;
    expect(bySlug("badminton-court-1")).toMatchObject({ surface: "Green Mat (5 mm)", monthlyPrice1m: 700_000, monthlyPrice3m: 1_950_000, monthlyPrice6m: 3_750_000, monthlyPrice12m: 7_200_000 });
    expect(bySlug("badminton-court-2")).toMatchObject({ surface: "Wooden Finish (2.5 mm)", monthlyPrice1m: 600_000, monthlyPrice3m: 1_650_000, monthlyPrice6m: 3_150_000, monthlyPrice12m: 6_000_000 });
    for (const slug of ["pickleball-court-1", "pickleball-court-2"]) {
      expect(bySlug(slug)).toMatchObject({ monthlyPrice1m: 550_000, monthlyPrice3m: 1_500_000, monthlyPrice6m: 2_750_000, monthlyPrice12m: 5_000_000 });
    }
    expect(bySlug("basketball-court-1")).toMatchObject({ monthlyPrice1m: 700_000, monthlyPrice3m: 1_950_000, monthlyPrice6m: 3_750_000, monthlyPrice12m: 7_200_000 });
  });

  it("applies a new catalogue revision once to an existing database, by slug, and keeps later admin edits", async () => {
    const slug = "pickleball-court-1";
    const [before] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, CATALOGUE_SETTING));
    try {
      // A database set up before the rate card: old demo prices, no monthly plans, revision 1.
      await db.update(courts).set({ price1h: 60_000, price2h: 120_000, monthlyPrice1m: null, monthlyPrice3m: null, monthlyPrice6m: null, monthlyPrice12m: null }).where(eq(courts.slug, slug));
      await db.update(settings).set({ value: { revision: 1 } }).where(eq(settings.key, CATALOGUE_SETTING));
      expect(await upgradeCatalogue(db)).toMatch(/catalogue revision 2/);
      let [c] = await db.select().from(courts).where(eq(courts.slug, slug));
      expect([c!.price1h, c!.price2h, c!.monthlyPrice1m, c!.monthlyPrice12m]).toEqual([40_000, 70_000, 550_000, 5_000_000]);

      // An admin changes the price afterwards: the next deploy leaves it alone.
      await db.update(courts).set({ price1h: 45_000 }).where(eq(courts.slug, slug));
      expect(await upgradeCatalogue(db)).toBeNull();
      [c] = await db.select().from(courts).where(eq(courts.slug, slug));
      expect(c!.price1h).toBe(45_000);
    } finally {
      const original = COURTS.find((x) => x.slug === slug)!;
      await db.update(courts).set({ price1h: original.price1h, price2h: original.price2h }).where(eq(courts.slug, slug));
      if (before) await db.update(settings).set({ value: before.value }).where(eq(settings.key, CATALOGUE_SETTING));
    }
  });
});

describe("rate card — prices computed by the server", () => {
  it("charges each court's exact one-hour price, morning or evening", async () => {
    for (const [slug, [oneHour]] of Object.entries(RATES)) {
      expect((await hold(slug, 8 * H)).total).toBe(oneHour);
      expect((await hold(slug, 19 * H)).total).toBe(oneHour); // formerly a peak hour: no surcharge
    }
  });

  it("charges each court's two-hour package price, not twice the hourly price", async () => {
    for (const [slug, [oneHour, twoHours]] of Object.entries(RATES)) {
      const b = await hold(slug, 10 * H, 120);
      expect(b.total).toBe(twoHours);
      expect(b.total).toBeLessThan(oneHour * 2);
      expect(b.subtotal).toBe(twoHours);
      expect(b.discount).toBe(0);
      const evening = await hold(slug, 17 * H, 120); // 5–7 PM
      expect(evening.total).toBe(twoHours);
    }
  });

  it("shows the same price in availability as the hold charges", async () => {
    for (const duration of [60, 120] as const) {
      const a = await getAvailability({ date: DAY, duration });
      for (const c of a.courts) {
        const expected = RATES[c.courtSlug]![duration === 60 ? 0 : 1];
        expect(new Set(c.slots.map((s) => s.price))).toEqual(new Set([expected]));
      }
    }
  });

  it("creates the Razorpay order for the server's amount", async () => {
    const booking = await hold("basketball-court-1", 18 * H, 120);
    const checkout = await startCheckout(booking);
    expect(checkout.amount).toBe(130_000);
  });

  it("uses a price an admin sets for new bookings; existing bookings keep what they were charged", async () => {
    const id = await courtId("badminton-court-2");
    const earlier = await hold("badminton-court-2", 9 * H);
    const [court] = await db.select().from(courts).where(eq(courts.id, id));
    const patch = {
      description: court!.description,
      surface: court!.surface,
      status: court!.status,
      price1h: 45_000,
      price2h: 80_000,
      monthlyPrice1m: court!.monthlyPrice1m,
      monthlyPrice3m: court!.monthlyPrice3m,
      monthlyPrice6m: court!.monthlyPrice6m,
      monthlyPrice12m: court!.monthlyPrice12m,
    };
    try {
      await updateCourt(id, patch, null as unknown as string);
      expect((await hold("badminton-court-2", 11 * H)).total).toBe(45_000);
      expect((await hold("badminton-court-2", 12 * H, 120)).total).toBe(80_000);
      const [kept] = await db.select().from(bookings).where(eq(bookings.id, earlier.id));
      expect(kept!.total).toBe(40_000);
      await expectRejected(updateCourt(id, { ...patch, price1h: 0 }, null as unknown as string), "INVALID_INPUT");
    } finally {
      await updateCourt(id, { ...patch, price1h: 40_000, price2h: 70_000 }, null as unknown as string);
    }
  });
});

describe("booking rules enforced by the backend", () => {
  it("creates a valid one-hour hold with a server-computed price and an expiry", async () => {
    const b = await hold("pickleball-court-1", 10 * H);
    expect(b.status).toBe("PENDING");
    expect(b.endMinute).toBe(11 * H);
    expect(b.total).toBe(40_000); // ₹400 for one hour
    const minutes = (b.holdExpiresAt!.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
  });

  it("creates a valid two-hour hold that occupies both hours at the two-hour price", async () => {
    const b = await hold("pickleball-court-1", 16 * H, 120);
    expect([b.startMinute, b.endMinute]).toEqual([16 * H, 18 * H]);
    expect(b.total).toBe(70_000); // ₹700 two-hour package
    expect(await slotState("pickleball-court-1", 16 * H)).toBe("HELD");
    expect(await slotState("pickleball-court-1", 17 * H)).toBe("HELD");
  });

  it("has no unconfirmed badminton closure: both courts are bookable from 5 to 7 PM", async () => {
    expect((await hold("badminton-court-1", 17 * H)).status).toBe("PENDING");
    expect((await hold("badminton-court-1", 18 * H)).status).toBe("PENDING");
    expect((await hold("badminton-court-2", 16 * H, 120)).status).toBe("PENDING"); // 4–6 PM
    expect((await hold("badminton-court-2", 18 * H, 120)).status).toBe("PENDING"); // 6–8 PM
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

  it("the database itself enforces the booking hours, durations and alignment (trigger)", async () => {
    const id = await courtId("badminton-court-1");
    const [court] = await db.select().from(courts).where(eq(courts.id, id));
    let n = 0;
    const insert = (startMinute: number, endMinute: number) =>
      db
        .insert(bookings)
        .values({ code: `SP-TRG${String(++n).padStart(3, "0")}`, sportId: court!.sportId, courtId: id, customerName: "x", customerPhone: "x", date: DAY, startMinute, endMinute, subtotal: 0, total: 0, status: "CONFIRMED" })
        .then(
          () => null,
          (e: unknown) => String((e as Error)?.cause ?? e),
        );
    expect(await insert(17 * H, 18 * H)).toBeNull(); // no badminton closure in the database either
    expect(await insert(6 * H, 7 * H)).toMatch(/outside the booking hours/);
    expect(await insert(21 * H, 23 * H)).toMatch(/outside the booking hours/);
    expect(await insert(9 * H + 30, 10 * H + 30)).toMatch(/start on the hour/);
    expect(await insert(10 * H, 13 * H)).toMatch(/one or two hours/);
  });

  it("follows the booking hours setting in the app and the database alike", async () => {
    try {
      await patchBookingSettings({ openMinute: 6 * H, closeMinute: 23 * H });
      const a = await getAvailability({ date: DAY, duration: 60, courtSlug: "basketball-court-1" });
      expect(a.courts[0]!.slots[0]!.startMinute).toBe(6 * H);
      expect(a.courts[0]!.slots.at(-1)!.endMinute).toBe(23 * H);
      expect((await hold("basketball-court-1", 6 * H)).status).toBe("PENDING");
      expect((await hold("basketball-court-1", 21 * H, 120)).endMinute).toBe(23 * H);

      // Invalid stored hours fall back to 7 AM – 10 PM on both sides.
      await patchBookingSettings({ openMinute: 6 * H + 30 });
      await expectRejected(hold("pickleball-court-1", 6 * H), "RULE_VIOLATION");
      expect((await hold("pickleball-court-1", 7 * H)).status).toBe("PENDING");

      // The admin service refuses invalid hours and reports bookings outside new ones.
      await expectRejected(updateBookingHours({ openMinute: 9 * H, closeMinute: 9 * H }, null as unknown as string), "INVALID_INPUT");
      const result = await updateBookingHours({ openMinute: 8 * H, closeMinute: 20 * H }, null as unknown as string);
      expect(result.hours).toEqual({ openMinute: 8 * H, closeMinute: 20 * H });
      await expectRejected(hold("pickleball-court-2", 7 * H), "RULE_VIOLATION");
    } finally {
      await resetBookingHours();
    }
    expect((await hold("pickleball-court-2", 7 * H)).status).toBe("PENDING");
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
    const paid = await fakePay(FAKE, checkout.orderId, "captured", 100); // ₹1 instead of ₹400
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
