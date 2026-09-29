import type { NextRequest } from "next/server";
import { z } from "zod";
import { getMonthCalendar } from "@/server/services/bookings";
import { errorResponse, json } from "@/server/http";
import { uuid } from "@/lib/validation";

const schema = z.object({
  court: uuid,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  duration: z.coerce.number().int().min(30).max(240).default(60),
});

/** Day-by-day status of one court for a month (available, full, not released…). */
export async function GET(req: NextRequest) {
  try {
    const q = schema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return json(await getMonthCalendar({ courtId: q.court, month: q.month, duration: q.duration }));
  } catch (err) {
    return errorResponse(err);
  }
}
