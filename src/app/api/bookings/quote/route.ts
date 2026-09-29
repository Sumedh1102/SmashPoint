import { getCurrentUser } from "@/server/auth/guards";
import { errorResponse, json, readJson } from "@/server/http";
import { quoteReservation, quoteSeriesPlan } from "@/server/services/bookings";
import { bookingPlanSchema } from "@/lib/validation";

/** Prices the review step: court, discounts, equipment and total (single or recurring). */
export async function POST(req: Request) {
  try {
    const input = bookingPlanSchema.parse(await readJson(req));
    const user = await getCurrentUser();
    if (input.type === "SINGLE") {
      const quote = await quoteReservation({
        courtId: input.courtId,
        date: input.date,
        startMinute: input.startMinute,
        duration: input.duration,
        userId: user?.id,
        couponCode: input.couponCode,
        equipment: input.equipment,
      });
      return json({ type: "SINGLE" as const, ...quote });
    }
    const plan = await quoteSeriesPlan({
      type: input.type,
      courtId: input.courtId,
      startDate: input.date,
      daysOfWeek: input.daysOfWeek,
      startMinute: input.startMinute,
      duration: input.duration,
      userId: user?.id,
      equipment: input.equipment,
    });
    return json(plan);
  } catch (err) {
    return errorResponse(err);
  }
}
