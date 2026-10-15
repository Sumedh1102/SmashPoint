import type { NextRequest } from "next/server";
import { availabilityQuerySchema, uuid } from "@/lib/validation";
import { errorResponse, json } from "@/server/http";
import { getAvailability } from "@/server/services/bookings";

/** Live slot grid for one date: a single court (id or slug), every court of a sport, or all courts. */
export async function GET(req: NextRequest) {
  try {
    const q = availabilityQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const byId = q.court && uuid.safeParse(q.court).success;
    return json(
      await getAvailability({
        date: q.date,
        duration: q.duration,
        sportSlug: q.sport,
        courtId: byId ? q.court : undefined,
        courtSlug: q.court && !byId ? q.court : undefined,
      }),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
