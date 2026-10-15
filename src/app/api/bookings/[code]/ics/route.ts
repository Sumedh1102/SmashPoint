import type { NextRequest } from "next/server";
import { isPlaceholder, site } from "@/content/site";
import { findCustomerBooking } from "@/server/queries/public";

function icsDate(date: string, minute: number) {
  // Facility time is IST (UTC+05:30, no DST); calendar files use UTC.
  const d = new Date(new Date(`${date}T00:00:00+05:30`).getTime() + minute * 60_000);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const escape = (v: string) => v.replace(/[\\;,]/g, (c) => `\\${c}`);

/** Calendar file for a confirmed booking (linked from the confirmation page). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/bookings/[code]/ics">) {
  const { code } = await ctx.params;
  const found = await findCustomerBooking(code, req.nextUrl.searchParams.get("t"));
  if (!found || !["PAID", "CONFIRMED"].includes(found.booking.status)) return new Response("Not found", { status: 404 });
  const { booking, court, sport } = found;
  const address = site.contact.addressLines.filter((l) => !isPlaceholder(l)).join(", ");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${site.name}//Court Booking//EN`,
    "BEGIN:VEVENT",
    `UID:${booking.code}@${new URL(site.url).hostname}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(booking.date, booking.startMinute)}`,
    `DTEND:${icsDate(booking.date, booking.endMinute)}`,
    `SUMMARY:${escape(`${sport.name} · ${court.name}`)} (${booking.code})`,
    `LOCATION:${escape(address ? `${site.name}, ${address}` : site.name)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${booking.code}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
