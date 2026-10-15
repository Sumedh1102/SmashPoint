import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { bookingCodeSchema } from "@/lib/validation";
import { db } from "@/server/db";
import { bookings, payments } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/server/http";
import { PROVIDER, recordFailure } from "@/server/payments/service";
import { verifyBookingAccess } from "@/server/security";

const schema = z.object({
  code: bookingCodeSchema,
  token: z.string().min(10).max(64),
  orderId: z.string().min(1).max(100),
  reason: z.string().max(300).optional(),
});

/**
 * Checkout reported a failed attempt (card declined, UPI timeout, …). Only the reason is
 * recorded — the slot stays held so the customer can retry until the hold runs out.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const input = schema.parse(await readJson(req));
    if (!verifyBookingAccess(input.code, input.token)) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    const [match] = await db
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(and(eq(bookings.code, input.code), eq(payments.provider, PROVIDER), eq(payments.providerOrderId, input.orderId)))
      .limit(1);
    if (match) await recordFailure(input.orderId, input.reason ?? "Payment failed at checkout");
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
