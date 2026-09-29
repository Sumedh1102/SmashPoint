import type { NextRequest } from "next/server";
import { z } from "zod";
import { equipmentAvailability } from "@/server/services/equipment";
import { errorResponse, json } from "@/server/http";
import { isoDate, uuid } from "@/lib/validation";

const schema = z.object({
  sport: uuid,
  date: isoDate,
  start: z.coerce.number().int().min(0).max(1439),
  duration: z.coerce.number().int().min(30).max(240),
});

/** Rentable items for a sport with the units still free during a slot. */
export async function GET(req: NextRequest) {
  try {
    const q = schema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return json({ items: await equipmentAvailability(q.sport, { date: q.date, startMinute: q.start, endMinute: q.start + q.duration }) });
  } catch (err) {
    return errorResponse(err);
  }
}
