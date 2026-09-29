import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { CourtDiagram } from "@/components/brand/illustrations";
import { FacilityIcon } from "@/components/marketing/facility-icon";
import { Container, Mark, PageHero, Section } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { facilities } from "@/content/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Facilities",
  description: "5 BWF-spec badminton courts with glare-free LED lighting, PU flooring on sprung wood, changing rooms, parking and training equipment in Palghar.",
  alternates: { canonical: "/facilities" },
  openGraph: { title: "Facilities · SmashPoint Badminton Academy", url: "/facilities" },
};

const SPANS = ["md:col-span-2 md:row-span-2", "", "", "md:col-span-2", "", "", "", "md:col-span-2"];
const TONES = ["bg-ink text-white", "bg-white", "bg-brand-100", "bg-brand text-white", "bg-white", "bg-warning-soft", "bg-white", "bg-white"];

export default function FacilitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="Facilities"
        title={
          <>
            Built for the <Mark>5 AM</Mark> smash.
          </>
        }
        description="Tournament-grade courts, lighting that never blinds you and all the boring-but-important stuff done right."
      >
        <ButtonLink href="/book" size="lg">
          Book a court <ArrowUpRight className="size-4" />
        </ButtonLink>
      </PageHero>

      <Section>
        <div className="grid auto-rows-[minmax(220px,auto)] gap-5 md:grid-cols-4">
          {facilities.map((f, i) => {
            const dark = TONES[i]!.includes("text-white");
            return (
              <article key={f.title} className={cn("flex flex-col rounded-[var(--radius-card)] border border-line p-6 shadow-sm lift-hover", SPANS[i], TONES[i])}>
                <span className={cn("grid size-12 place-items-center rounded-xl border", dark ? "border-white bg-white/10" : "border-line bg-white")}>
                  <FacilityIcon name={f.icon} className="size-6" />
                </span>
                <h2 className={cn("mt-5 font-semibold leading-tight", i === 0 ? "text-4xl md:text-5xl" : "text-2xl")}>{f.title}</h2>
                <p className={cn("mt-1 font-mono text-xs font-medium uppercase tracking-wider", dark ? "text-brand-200" : "text-brand")}>{f.spec}</p>
                <p className={cn("mt-3", dark ? "text-white/80" : "text-muted")}>{f.body}</p>
                {i === 0 ? (
                  <div className="mt-auto pt-6">
                    <div className="rounded-2xl border border-white bg-brand p-4">
                      <CourtDiagram />
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </Section>

      <Container>
        <div className="grid gap-6 rounded-[2rem] border border-line bg-white p-8 shadow-md md:grid-cols-3 md:p-12">
          {[
            ["13.4 × 6.1 m", "Regulation court size"],
            ["9 m", "Clear ceiling height"],
            ["800+ lux", "Glare-free LED lighting"],
          ].map(([v, l]) => (
            <div key={l}>
              <p className="font-display text-5xl font-semibold leading-none">{v}</p>
              <p className="mt-2 font-medium text-muted">{l}</p>
            </div>
          ))}
        </div>
      </Container>
    </>
  );
}
