import type { NextRequest } from "next/server";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json } from "@/server/http";
import { resumeCheckout } from "@/server/payments/service";
import { verifyBookingAccess } from "@/server/security";

/** Re-opens Razorpay Checkout for a booking whose hold is still running. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/bookings/[code]/checkout">) {
  try {
    assertSameOrigin(req);
    const { code } = await ctx.params;
    if (!verifyBookingAccess(code, req.nextUrl.searchParams.get("t"))) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    return json({ checkout: await resumeCheckout(code) });
  } catch (err) {
    return errorResponse(err);
  }
}
