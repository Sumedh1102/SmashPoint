import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { EventCard } from "@/components/marketing/cards";
import { Mark, PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { getPastEvents, getUpcomingEvents } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events & Tournaments",
  description: "Badminton tournaments, workshops, junior camps and free trial weekends at SmashPoint Academy, Palghar. Register online.",
  alternates: { canonical: "/events" },
  openGraph: { title: "Events & Tournaments · SmashPoint", url: "/events" },
};

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([getUpcomingEvents(20), getPastEvents()]);
  return (
    <>
      <PageHero
        eyebrow="Events & tournaments"
        title={
          <>
            Match days, camps & <Mark>trophies.</Mark>
          </>
        }
        description="Open tournaments, coach-led workshops, holiday camps and community days. Register online in a minute."
      />
      <Section>
        <SectionHeading index="01" eyebrow="Upcoming" title="What's next on court." />
        {upcoming.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming events" description="New tournaments and camps are announced every month — check back soon." />
        )}
      </Section>
      {past.length ? (
        <Section className="border-t border-line">
          <SectionHeading index="02" eyebrow="Past events" title="Recent results." />
          <ul className="grid gap-4 md:grid-cols-2">
            {past.map((e) => (
              <li key={e.id} className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-xs">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-warning-soft">
                  <Trophy className="size-6" />
                </span>
                <div>
                  <p className="font-mono text-xs font-medium text-muted">{formatDate(e.date)}</p>
                  <h3 className="text-lg font-semibold">{e.name}</h3>
                  <p className="text-sm text-muted">{e.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
