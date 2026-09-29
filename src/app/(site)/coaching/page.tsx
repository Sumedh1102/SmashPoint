import type { Metadata } from "next";
import { ArrowRight, ClipboardCheck, Gauge, Users } from "lucide-react";
import { ProgramCard } from "@/components/marketing/cards";
import { Mark, PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getPrograms } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coaching Programs",
  description: "Beginner, Intermediate, Advanced and Kids badminton coaching programs in Palghar — small groups, certified coaches and monthly skill assessments.",
  alternates: { canonical: "/coaching" },
  openGraph: { title: "Badminton Coaching Programs · SmashPoint", url: "/coaching" },
};

export default async function CoachingPage() {
  const programs = await getPrograms();
  return (
    <>
      <PageHero
        eyebrow="Coaching programs"
        title={
          <>
            Train with a <Mark>plan</Mark>, not just a racket.
          </>
        }
        description="Every program has a curriculum, a lead coach and a monthly assessment across 8 skill areas — so progress is visible, not a feeling."
      >
        <div className="flex flex-wrap gap-2">
          {programs.map((p) => (
            <a key={p.slug} href={`#${p.slug}`} className="rounded-xl border border-line bg-white px-4 py-2 font-display font-semibold shadow-xs transition hover:bg-brand hover:text-white">
              {p.name.replace(" Program", "")}
            </a>
          ))}
        </div>
      </PageHero>

      <Section>
        {programs.length ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {programs.map((p) => (
              <ProgramCard key={p.id} program={p} detailed />
            ))}
          </div>
        ) : (
          <EmptyState title="Programs are being updated" description="Please check back soon or contact the front desk." />
        )}
      </Section>

      <Section className="border-y border-line bg-white/70">
        <SectionHeading index="01" eyebrow="How it works" title="From trial to tournament." />
        <ol className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Users, title: "Free trial session", body: "Play one session in the program that fits your level. Our coach assesses grip, footwork and rally consistency." },
            { icon: ClipboardCheck, title: "Placement & batch", body: "We place you in a batch by level and timing. Batches are capped so every player gets real coach attention." },
            { icon: Gauge, title: "Monthly skill scores", body: "Footwork, smash, drop, serve, defence, agility, stamina and match play — scored monthly in your dashboard." },
          ].map((s, i) => (
            <li key={s.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl border border-line bg-brand text-white">
                  <s.icon className="size-6" />
                </span>
                <span className="font-display text-4xl font-semibold text-brand-200">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/contact?topic=trial" size="lg">
            Book a free trial <ArrowRight className="size-4" />
          </ButtonLink>
          <ButtonLink href="/membership" size="lg" variant="outline">
            See membership plans
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
