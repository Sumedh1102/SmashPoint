import { bookingRequestSchema } from "@/lib/validation";
import { getCurrentUser } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json, readJson } from "@/server/http";
import { bookingReceiptPath, initiateBookingPayment, initiateSeriesPayment } from "@/server/payments/service";
import { rateLimit } from "@/server/security";
import { createBooking, createSeries } from "@/server/services/bookings";
import { getBookingSettings } from "@/server/settings";

/**
 * Creates a booking hold (Pending) and immediately starts checkout (Payment Initiated).
 * Monthly/quarterly bookings create every session under one reference and one payment.
 */
export async function POST(req: Request) {
  let code: string | undefined;
  try {
    assertSameOrigin(req);
    if (!(await rateLimit(`booking:${clientIp(req)}`, 20, 10 * 60_000)).ok) throw new DomainError("Too many booking attempts. Please wait a few minutes.", "INVALID_INPUT", 429);

    const input = bookingRequestSchema.parse(await readJson(req));
    const [user, settings] = await Promise.all([getCurrentUser(), getBookingSettings()]);
    if (!user && (!settings.allowGuestBooking || input.type !== "SINGLE")) {
      throw new DomainError(input.type === "SINGLE" ? "Please sign in to book a court." : "Please sign in to make a monthly or quarterly booking.", "FORBIDDEN", 401);
    }
    const customer = { name: input.name, phone: input.phone, email: input.email };

    if (input.type === "SINGLE") {
      const booking = await createBooking({
        courtId: input.courtId,
        date: input.date,
        startMinute: input.startMinute,
        duration: input.duration,
        customer,
        userId: user?.id ?? null,
        couponCode: input.couponCode,
        notes: input.notes,
        equipment: input.equipment,
        source: "ONLINE",
      });
      code = booking.code;
      const { checkout } = await initiateBookingPayment(booking.code);
      return json({ code: booking.code, total: booking.total, receiptUrl: bookingReceiptPath(booking.code), checkout }, { status: 201 });
    }

    const series = await createSeries({
      type: input.type,
      courtId: input.courtId,
      startDate: input.date,
      daysOfWeek: input.daysOfWeek,
      startMinute: input.startMinute,
      duration: input.duration,
      customer,
      userId: user!.id,
      notes: input.notes,
      equipment: input.equipment,
      source: "ONLINE",
    });
    code = series.code;
    const { checkout } = await initiateSeriesPayment(series.code);
    return json({ code: series.code, total: series.total, receiptUrl: bookingReceiptPath(series.code), checkout }, { status: 201 });
  } catch (err) {
    return errorResponse(err, code ? { code, receiptUrl: bookingReceiptPath(code) } : undefined);
  }
}
