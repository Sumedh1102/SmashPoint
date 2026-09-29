import type { Metadata } from "next";
import { CoachCard } from "@/components/marketing/cards";
import { Mark, PageHero, Section } from "@/components/marketing/section";
import { EmptyState } from "@/components/ui/misc";
import { getPublicCoaches } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Our Coaches",
  description: "Meet SmashPoint's BAI & SAI certified badminton coaches — specialists in footwork, doubles, kids training and strength & conditioning.",
  alternates: { canonical: "/coaches" },
  openGraph: { title: "Coaches · SmashPoint Badminton Academy", url: "/coaches" },
};

export default async function CoachesPage() {
  const coaches = await getPublicCoaches();
  const totalYears = coaches.reduce((a, c) => a + c.experienceYears, 0);
  return (
    <>
      <PageHero
        eyebrow="Coaches"
        title={
          <>
            Certified. Specialised. <Mark>Obsessed.</Mark>
          </>
        }
        description="Our coaching team combines national-circuit experience with modern sports science. Every coach owns a specialty — and a whistle."
        aside={
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-md">
            <p className="font-display text-6xl font-semibold leading-none">{totalYears}+</p>
            <p className="mt-2 font-medium">combined years of coaching experience</p>
            <p className="mt-4 text-sm text-muted">Plus assistant coaches and visiting specialists for camps and workshops.</p>
          </div>
        }
      />
      <Section>
        {coaches.length ? (
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {coaches.map((c, i) => (
              <CoachCard key={c.id} coach={c} index={i} detailed />
            ))}
          </div>
        ) : (
          <EmptyState title="Coach profiles coming soon" />
        )}
      </Section>
    </>
  );
}
