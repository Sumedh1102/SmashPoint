import { bookingRequestSchema } from "@/lib/validation";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/server/http";
import { bookingReceiptPath, paymentsEnabled, startCheckout } from "@/server/payments/service";
import { bookingAccessToken, rateLimit } from "@/server/security";
import { createBookingHold, releaseHold } from "@/server/services/bookings";

/**
 * Step 8 of the booking flow: validates the slot on the server, holds it for the payment
 * window and creates the Razorpay order. Returns what the browser needs to open Checkout.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    if (!(await rateLimit(`booking:${clientIp(req)}`, 12, 10 * 60_000)).ok) {
      throw new DomainError("Too many booking attempts from your network. Please wait a few minutes.", "RATE_LIMITED", 429);
    }
    if (!paymentsEnabled()) throw new DomainError("Online booking is temporarily unavailable because payments aren't set up yet.", "PAYMENTS_UNAVAILABLE", 503);

    const input = bookingRequestSchema.parse(await readJson(req));
    const booking = await createBookingHold({
      courtId: input.courtId,
      date: input.date,
      startMinute: input.startMinute,
      duration: input.duration,
      customer: { name: input.name, phone: input.phone, email: input.email },
      notes: input.notes,
    });

    try {
      const checkout = await startCheckout(booking);
      return json(
        {
          code: booking.code,
          token: bookingAccessToken(booking.code),
          receiptUrl: bookingReceiptPath(booking.code),
          amount: booking.total,
          holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
          checkout,
        },
        { status: 201 },
      );
    } catch (err) {
      // No order means no way to pay: give the slot back straight away.
      await releaseHold(booking.code).catch((e) => console.error("[bookings] release after failed checkout", e));
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
