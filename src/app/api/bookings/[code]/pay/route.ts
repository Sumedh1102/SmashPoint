import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json, readJson } from "@/server/http";
import { initiateBookingPayment, initiateSeriesPayment } from "@/server/payments/service";
import { findAccessibleBooking, findAccessibleSeries, isSeriesCode } from "@/server/services/booking-access";

export async function POST(req: Request, ctx: RouteContext<"/api/bookings/[code]/pay">) {
  try {
    assertSameOrigin(req);
    const { code } = await ctx.params;
    const body = (await readJson(req)) as { t?: string };
    if (isSeriesCode(code)) {
      const { series } = await findAccessibleSeries(code, body.t);
      if (!series) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
      return json(await initiateSeriesPayment(series.code));
    }
    const { booking } = await findAccessibleBooking(code, body.t);
    if (!booking) throw new DomainError("Booking not found.", "NOT_FOUND", 404);
    return json(await initiateBookingPayment(booking.code));
  } catch (err) {
    return errorResponse(err);
  }
}
