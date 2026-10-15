import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay client: Orders API + Standard Checkout, payment verification, capture, refunds and
 * webhooks, over Razorpay's documented REST API (https://razorpay.com/docs/api/).
 *
 * Configure RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET (server-side
 * environment variables). Only the key id is ever sent to the browser; the key secret and the
 * webhook secret never leave the server.
 */

export type RazorpayConfig = { keyId: string; keySecret: string; webhookSecret: string | null };

export function razorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null };
}

export function isRazorpayConfigured() {
  return razorpayConfig() !== null;
}

/** True for rzp_test_ keys (Razorpay test mode: no real money moves). */
export function isRazorpayTestMode() {
  return razorpayConfig()?.keyId.startsWith("rzp_test_") ?? false;
}

function requireConfig(): RazorpayConfig {
  const cfg = razorpayConfig();
  if (!cfg) throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
  return cfg;
}

/**
 * Automated tests point this at a local stand-in for Razorpay's API. The override is ignored
 * in production builds, so a deployed site always talks to api.razorpay.com.
 */
function apiBase() {
  const override = process.env.RAZORPAY_API_BASE_URL;
  if (override && process.env.NODE_ENV !== "production") return override.replace(/\/+$/, "");
  return "https://api.razorpay.com/v1";
}

export class RazorpayApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
  ) {
    super(message);
    this.name = "RazorpayApiError";
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const { keyId, keySecret } = requireConfig();
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new RazorpayApiError(`Razorpay ${method} ${path} failed with ${res.status}`, res.status, text.slice(0, 500));
  return JSON.parse(text) as T;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Signatures (pure)                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret), hex. */
export function checkoutSignature(orderId: string, paymentId: string, keySecret: string) {
  return createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function isValidCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }, keySecret: string) {
  return safeEqual(checkoutSignature(input.orderId, input.paymentId, keySecret), input.signature);
}

/** Webhook signature: HMAC-SHA256(raw request body, webhook_secret), hex, in X-Razorpay-Signature. */
export function isValidWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
  if (!signature) return false;
  return safeEqual(createHmac("sha256", webhookSecret).update(rawBody).digest("hex"), signature);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* API                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };
export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  method?: string;
  captured?: boolean;
  error_description?: string | null;
};
export type RazorpayRefund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

export function createOrder(input: { amount: number; currency: string; receipt: string; notes: Record<string, string> }) {
  return call<RazorpayOrder>("POST", "/orders", input);
}

export function fetchPayment(paymentId: string) {
  return call<RazorpayPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);
}

export async function fetchOrderPayments(orderId: string) {
  return (await call<{ items: RazorpayPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`)).items;
}

/** Captures an authorized payment (needed when the account isn't set to auto-capture). */
export function capturePaymentApi(paymentId: string, amount: number, currency: string) {
  return call<RazorpayPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });
}

export function createRefund(paymentId: string, amount: number, notes: Record<string, string>) {
  return call<RazorpayRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, speed: "normal", notes });
}

export function fetchRefund(paymentId: string, refundId: string) {
  return call<RazorpayRefund>("GET", `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Webhooks                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type WebhookEvent =
  | { kind: "payment.paid"; event: string; orderId: string; paymentId: string; amount: number; currency: string }
  | { kind: "payment.authorized"; event: string; orderId: string; paymentId: string; amount: number; currency: string }
  | { kind: "payment.failed"; event: string; orderId: string; paymentId: string; reason: string | null }
  | { kind: "refund"; event: string; paymentId: string; refundId: string; status: "processed" | "failed" }
  | { kind: "ignored"; event: string };

type WebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    refund?: { entity?: RazorpayRefund };
  };
};

/** Parses an already signature-verified webhook body into the events this app acts on. */
export function parseWebhookBody(rawBody: string): WebhookEvent {
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return { kind: "ignored", event: "invalid-json" };
  }
  const event = body.event ?? "unknown";
  const payment = body.payload?.payment?.entity;
  const refund = body.payload?.refund?.entity;

  if ((event === "payment.captured" || event === "order.paid") && payment?.order_id) {
    return { kind: "payment.paid", event, orderId: payment.order_id, paymentId: payment.id, amount: payment.amount, currency: payment.currency };
  }
  if (event === "payment.authorized" && payment?.order_id) {
    return { kind: "payment.authorized", event, orderId: payment.order_id, paymentId: payment.id, amount: payment.amount, currency: payment.currency };
  }
  if (event === "payment.failed" && payment?.order_id) {
    return { kind: "payment.failed", event, orderId: payment.order_id, paymentId: payment.id, reason: payment.error_description ?? null };
  }
  if ((event === "refund.processed" || event === "refund.failed") && refund?.id) {
    return { kind: "refund", event, paymentId: refund.payment_id, refundId: refund.id, status: event === "refund.processed" ? "processed" : "failed" };
  }
  return { kind: "ignored", event };
}
