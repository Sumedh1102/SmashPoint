import { z } from "zod";
import { bookingCodeSchema } from "@/lib/validation";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/server/http";
import { bookingReceiptPath, verifyCheckout } from "@/server/payments/service";
import { rateLimit, verifyBookingAccess } from "@/server/security";

const schema = z.object({
  code: bookingCodeSchema,
  token: z.string().min(10).max(64),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().min(1).max(200),
});

/**
 * Razorpay Checkout's success handler posts here. The signature and the payment itself are
 * verified with Razorpay on the server before the booking is confirmed.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!(await rateLimit(`verify:${clientIp(req)}`, 30, 10 * 60_000)).ok) throw new DomainError("Too many requests. Please wait a moment.", "RATE_LIMITED", 429);
    const input = schema.parse(await readJson(req));
    if (!verifyBookingAccess(input.code, input.token)) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    const result = await verifyCheckout({
      code: input.code,
      orderId: input.razorpay_order_id,
      paymentId: input.razorpay_payment_id,
      signature: input.razorpay_signature,
    });
    return json({ ...result, receiptUrl: bookingReceiptPath(input.code) });
  } catch (err) {
    return errorResponse(err);
  }
}
