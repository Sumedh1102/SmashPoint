import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutSignature, isValidCheckoutSignature, isValidWebhookSignature, parseWebhookBody } from "./razorpay";

const KEY_SECRET = "test_key_secret";
const WEBHOOK_SECRET = "test_webhook_secret";

describe("checkout signature", () => {
  it("matches Razorpay's documented formula: HMAC-SHA256(order_id|payment_id, key_secret)", () => {
    const expected = createHmac("sha256", KEY_SECRET).update("order_ABC|pay_XYZ").digest("hex");
    expect(checkoutSignature("order_ABC", "pay_XYZ", KEY_SECRET)).toBe(expected);
  });

  it("accepts a genuine signature and rejects tampered ones", () => {
    const signature = checkoutSignature("order_ABC", "pay_XYZ", KEY_SECRET);
    expect(isValidCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature }, KEY_SECRET)).toBe(true);
    // Payment id swapped for another one
    expect(isValidCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_OTHER", signature }, KEY_SECRET)).toBe(false);
    // Signed with the wrong secret
    expect(isValidCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: checkoutSignature("order_ABC", "pay_XYZ", "nope") }, KEY_SECRET)).toBe(false);
    expect(isValidCheckoutSignature({ orderId: "order_ABC", paymentId: "pay_XYZ", signature: "short" }, KEY_SECRET)).toBe(false);
  });
});

describe("webhook signature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} });
  const sign = (b: string, s = WEBHOOK_SECRET) => createHmac("sha256", s).update(b).digest("hex");

  it("verifies the raw body against the webhook secret", () => {
    expect(isValidWebhookSignature(body, sign(body), WEBHOOK_SECRET)).toBe(true);
  });

  it("rejects missing, forged or body-altered signatures", () => {
    expect(isValidWebhookSignature(body, null, WEBHOOK_SECRET)).toBe(false);
    expect(isValidWebhookSignature(body, sign(body, "other"), WEBHOOK_SECRET)).toBe(false);
    expect(isValidWebhookSignature(body.replace("captured", "failed"), sign(body), WEBHOOK_SECRET)).toBe(false);
  });
});

describe("parseWebhookBody", () => {
  const payment = { id: "pay_1", order_id: "order_1", amount: 50000, currency: "INR", status: "captured", error_description: "Card declined" };

  it("maps payment.captured and order.paid to a paid event", () => {
    for (const event of ["payment.captured", "order.paid"]) {
      expect(parseWebhookBody(JSON.stringify({ event, payload: { payment: { entity: payment } } }))).toEqual({
        kind: "payment.paid",
        event,
        orderId: "order_1",
        paymentId: "pay_1",
        amount: 50000,
        currency: "INR",
      });
    }
  });

  it("maps authorized, failed and refund events", () => {
    expect(parseWebhookBody(JSON.stringify({ event: "payment.authorized", payload: { payment: { entity: payment } } })).kind).toBe("payment.authorized");
    expect(parseWebhookBody(JSON.stringify({ event: "payment.failed", payload: { payment: { entity: payment } } }))).toMatchObject({ kind: "payment.failed", reason: "Card declined" });
    expect(
      parseWebhookBody(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 50000, status: "processed" } } } })),
    ).toEqual({ kind: "refund", event: "refund.processed", paymentId: "pay_1", refundId: "rfnd_1", status: "processed" });
  });

  it("ignores events it doesn't handle and invalid JSON", () => {
    expect(parseWebhookBody(JSON.stringify({ event: "subscription.charged", payload: {} })).kind).toBe("ignored");
    expect(parseWebhookBody("not json").kind).toBe("ignored");
  });
});
