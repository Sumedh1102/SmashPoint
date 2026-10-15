import type { NextRequest } from "next/server";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json } from "@/server/http";
import { verifyBookingAccess } from "@/server/security";
import { releaseHold } from "@/server/services/bookings";

/** The customer abandoned checkout to pick another slot: release the hold now. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/bookings/[code]/release">) {
  try {
    assertSameOrigin(req);
    const { code } = await ctx.params;
    if (!verifyBookingAccess(code, req.nextUrl.searchParams.get("t"))) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    await releaseHold(code);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
