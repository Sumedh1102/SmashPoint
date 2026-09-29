import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDayAvailability } from "@/server/services/bookings";
import { errorResponse, json } from "@/server/http";
import { isoDate, uuid } from "@/lib/validation";

const schema = z.object({
  date: isoDate,
  duration: z.coerce.number().int().min(30).max(240).default(60),
  sport: uuid.optional(),
  court: uuid.optional(),
});

/** Slot grid for one day: every court of a sport, or a single court. */
export async function GET(req: NextRequest) {
  try {
    const q = schema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return json(await getDayAvailability({ date: q.date, duration: q.duration, sportId: q.sport, courtId: q.court }));
  } catch (err) {
    return errorResponse(err);
  }
}
