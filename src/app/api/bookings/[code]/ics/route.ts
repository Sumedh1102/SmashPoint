import type { NextRequest } from "next/server";
import { findAccessibleBooking, findAccessibleSeries, isSeriesCode } from "@/server/services/booking-access";
import { site } from "@/content/site";

function icsDate(date: string, minute: number) {
  // Facility time is IST (UTC+05:30, no DST) — convert to UTC for the calendar file.
  const d = new Date(new Date(`${date}T00:00:00+05:30`).getTime() + minute * 60_000);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const escape = (v: string) => v.replace(/[\;,]/g, (c) => `\\${c}`);

type Session = { code: string; date: string; startMinute: number; endMinute: number };

function calendar(sessions: Session[], summary: string) {
  const location = escape(`${site.name}, ${site.contact.addressLines.join(", ")}`);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmashPoint//Court Booking//EN",
    ...sessions.flatMap((s) => [
      "BEGIN:VEVENT",
      `UID:${s.code}@smashpoint.in`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(s.date, s.startMinute)}`,
      `DTEND:${icsDate(s.date, s.endMinute)}`,
      `SUMMARY:${escape(summary)} (${s.code})`,
      `LOCATION:${location}`,
      "DESCRIPTION:Please arrive 10 minutes early. Non-marking shoes only.",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/bookings/[code]/ics">) {
  const { code } = await ctx.params;
  const token = req.nextUrl.searchParams.get("t");
  let body: string | null = null;
  let filename = code.toUpperCase();
  if (isSeriesCode(code)) {
    const { series } = await findAccessibleSeries(code, token);
    if (series) {
      const active = series.bookings.filter((b) => ["PAID", "CONFIRMED", "PENDING", "PAYMENT_INITIATED"].includes(b.status));
      body = calendar(active, `${series.sport.name} · ${series.court.name}`);
      filename = series.code;
    }
  } else {
    const { booking } = await findAccessibleBooking(code, token);
    if (booking) {
      body = calendar([booking], `${booking.sport.name} · ${booking.court.name}`);
      filename = booking.code;
    }
  }
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
