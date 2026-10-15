import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { paymentWebhookEvents } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { isValidWebhookSignature, parseWebhookBody, razorpayConfig } from "@/server/payments/razorpay";
import { applyRefundStatus, handleAuthorized, PROVIDER, recordCapture, recordFailure } from "@/server/payments/service";

/**
 * Razorpay webhooks (Dashboard → Settings → Webhooks → https://<site>/api/payments/webhook/razorpay).
 * Subscribe to: payment.authorized, payment.captured, payment.failed, order.paid,
 * refund.processed, refund.failed.
 *
 * The X-Razorpay-Signature header is verified against the raw body with RAZORPAY_WEBHOOK_SECRET;
 * anything unsigned is rejected. Processing is idempotent (Razorpay retries, and the browser
 * callback may already have confirmed the payment), and each event id is recorded once handled.
 */
export async function POST(req: Request) {
  const secret = razorpayConfig()?.webhookSecret;
  if (!secret) return new Response("Webhook secret not configured", { status: 503 });

  const raw = await req.text();
  if (!isValidWebhookSignature(raw, req.headers.get("x-razorpay-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const eventId = req.headers.get("x-razorpay-event-id")?.slice(0, 100) ?? null;
  if (eventId) {
    const [seen] = await db.select({ id: paymentWebhookEvents.id }).from(paymentWebhookEvents).where(eq(paymentWebhookEvents.id, eventId)).limit(1);
    if (seen) return new Response("OK (duplicate)");
  }

  const event = parseWebhookBody(raw);
  try {
    switch (event.kind) {
      case "payment.paid":
        await recordCapture({ orderId: event.orderId, paymentId: event.paymentId, amount: event.amount });
        break;
      case "payment.authorized":
        await handleAuthorized({ orderId: event.orderId, paymentId: event.paymentId, amount: event.amount });
        break;
      case "payment.failed":
        await recordFailure(event.orderId, event.reason);
        break;
      case "refund":
        await applyRefundStatus(event.refundId, event.status);
        break;
      case "ignored":
        break;
    }
  } catch (err) {
    // Orders created outside this app (another integration on the same account) aren't ours.
    if (!(err instanceof DomainError && err.code === "NOT_FOUND")) {
      console.error("[webhook] processing failed", event, err);
      // Non-2xx makes Razorpay retry later.
      return new Response("Error", { status: 500 });
    }
  }

  if (eventId) {
    await db.insert(paymentWebhookEvents).values({ id: eventId, provider: PROVIDER, event: event.event.slice(0, 60) }).onConflictDoNothing();
  }
  return new Response("OK");
}
