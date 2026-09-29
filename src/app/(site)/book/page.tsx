import type { Metadata } from "next";
import { Flame, ShieldCheck, Timer } from "lucide-react";
import { BookingFlow } from "@/components/booking/booking-flow";
import { Container, Eyebrow } from "@/components/marketing/section";
import { formatMinutes, formatMoney } from "@/lib/format";
import { addDays, isValidISODate, nowMinutesInTz, todayInTz } from "@/lib/time";
import { getCurrentUser } from "@/server/auth/guards";
import { getCourtSummary } from "@/server/queries/public";
import { getAvailability } from "@/server/services/bookings";
import { getBookingSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book a Badminton Court",
  description: "Check live badminton court availability in Palghar and book 30, 60 or 90-minute slots online. Open daily 4 AM – 7 PM. Instant confirmation.",
  alternates: { canonical: "/book" },
  openGraph: { title: "Book a Court · SmashPoint Badminton Academy", url: "/book" },
};

export default async function BookPage({ searchParams }: PageProps<"/book">) {
  const sp = await searchParams;
  const [settings, user, summary] = await Promise.all([getBookingSettings(), getCurrentUser(), getCourtSummary()]);
  const today = todayInTz(settings.timezone);
  // After the last slot of the day has started, open the grid on tomorrow.
  const dayOver = nowMinutesInTz(settings.timezone) >= settings.closeMinute - settings.defaultDuration;
  const firstDay = dayOver ? addDays(today, 1) : today;
  const lastDay = addDays(today, settings.advanceDays);
  const requested = typeof sp.date === "string" && isValidISODate(sp.date) ? sp.date : firstDay;
  const date = requested < firstDay || requested > lastDay ? firstDay : requested;
  const duration = settings.durations.includes(Number(sp.duration)) ? Number(sp.duration) : settings.defaultDuration;
  const availability = await getAvailability(date, duration);
  const peak = settings.peakWindows[0];

  return (
    <>
      <section className="border-b border-line">
        <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between md:py-12">
          <div>
            <Eyebrow>Court booking</Eyebrow>
            <h1 className="mt-3 text-5xl font-semibold leading-[0.92] md:text-7xl">Book a court.</h1>
            <p className="mt-3 max-w-xl text-lg text-muted">
              {summary.count} courts · open {formatMinutes(settings.openMinute)} – {formatMinutes(settings.closeMinute)} · pay online, play instantly.
            </p>
          </div>
          <ul className="grid gap-2 text-sm font-medium sm:grid-cols-3 md:max-w-xl">
            <li className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <span className="font-display text-lg font-semibold">{formatMoney(summary.fromRate)}</span>/hr non-peak
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <Flame className="size-4 text-brand" />
              {peak ? `${formatMinutes(peak.startMinute)}–${formatMinutes(peak.endMinute)}` : "Peak"} peak
            </li>
            <li className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
              <Timer className="size-4 text-brand" /> {settings.holdMinutes}-min slot hold
            </li>
          </ul>
        </Container>
      </section>
      <Container className="py-8 md:py-10">
        <BookingFlow
          initial={availability}
          today={today}
          firstDay={firstDay}
          durations={settings.durations}
          advanceDays={settings.advanceDays}
          holdMinutes={settings.holdMinutes}
          user={user ? { name: user.name, email: user.email, phone: user.phone } : null}
        />
        <p className="mt-8 flex items-center gap-2 text-sm font-semibold text-muted">
          <ShieldCheck className="size-4" /> Payments are verified server-side. Double bookings are impossible — every slot is locked at the database level.
        </p>
      </Container>
    </>
  );
}
