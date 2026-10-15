import type { NextRequest } from "next/server";
import { errorResponse, json } from "@/server/http";
import { findCustomerBooking } from "@/server/queries/public";

/** Booking status for its customer (polled by the confirmation page while a payment settles). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/bookings/[code]">) {
  try {
    const { code } = await ctx.params;
    const found = await findCustomerBooking(code, req.nextUrl.searchParams.get("t"));
    if (!found) return json({ error: "Booking not found." }, { status: 404 });
    const { booking, payment } = found;
    return json({
      code: booking.code,
      status: booking.status,
      holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      payment: payment ? { status: payment.status, refundStatus: payment.refundStatus } : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
