import type { Metadata } from "next";
import { ArrowRight, Medal } from "lucide-react";
import { GalleryArt } from "@/components/brand/illustrations";
import { CoachCard } from "@/components/marketing/cards";
import { FacilityIcon } from "@/components/marketing/facility-icon";
import { Container, Eyebrow, Mark, PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { about, facilities, site } from "@/content/site";
import { getPublicCoaches } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About the Academy",
  description: `The story, mission and training philosophy behind ${site.name} — Palghar's home of structured badminton coaching since ${site.founded}.`,
  alternates: { canonical: "/about" },
  openGraph: { title: `About ${site.name}`, url: "/about" },
};

export default async function AboutPage() {
  const coaches = await getPublicCoaches();
  return (
    <>
      <PageHero
        eyebrow="About the academy"
        title={
          <>
            Ten years of <Mark>early mornings</Mark> and loud whistles.
          </>
        }
        description="From one rented court and twelve kids to five pro courts and a competition pathway — here's what SmashPoint is about."
        aside={
          <div className="grid grid-cols-2 gap-3">
            {site.stats.map((s, i) => (
              <div key={s.label} className={i % 3 === 0 ? "rounded-2xl border border-line bg-brand p-4 text-white shadow-sm" : "rounded-2xl border border-line bg-white p-4 shadow-sm"}>
                <p className="font-display text-4xl font-semibold leading-none">{s.value}</p>
                <p className="mt-1 text-sm font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        }
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Eyebrow index="01">Our story</Eyebrow>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.95] sm:text-5xl">It started with twelve kids and one court.</h2>
          </div>
          <div className="space-y-5 text-lg leading-relaxed text-ink-soft">
            {about.story.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <article className="rounded-[var(--radius-card)] border border-line bg-white p-8 shadow-md">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-brand">Mission</p>
            <p className="mt-3 font-display text-3xl font-semibold leading-tight">{about.mission}</p>
          </article>
          <article className="rounded-[var(--radius-card)] border border-line bg-ink p-8 text-white shadow-md">
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-brand-200">Vision</p>
            <p className="mt-3 font-display text-3xl font-semibold leading-tight">{about.vision}</p>
          </article>
        </div>
      </Section>

      <section className="bg-brand border-y border-line py-16 text-white md:py-24">
        <Container>
          <SectionHeading index="02" eyebrow="Training philosophy" inverted title="Four rules we coach by." />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {about.philosophy.map((p, i) => (
              <article key={p.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-ink shadow-md" style={{ rotate: `${[-1.5, 1, -0.5, 1.5][i]}deg` }}>
                <p className="font-display text-5xl font-semibold leading-none text-brand">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-2xl font-semibold">{p.title}</h3>
                <p className="mt-2 text-muted">{p.body}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <Section>
        <SectionHeading
          index="03"
          eyebrow="Facilities"
          title="Everything a serious player needs."
          action={
            <ButtonLink href="/facilities" variant="outline">
              See facilities <ArrowRight className="size-4" />
            </ButtonLink>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {facilities.map((f) => (
            <li key={f.title} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-xs">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-brand-100 text-brand-700">
                <FacilityIcon name={f.icon} className="size-5" />
              </span>
              <span>
                <span className="block font-semibold leading-tight">{f.title}</span>
                <span className="text-xs font-medium text-muted">{f.spec}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section className="border-y border-line bg-white/70">
        <SectionHeading index="04" eyebrow="The coaching team" title="The people behind the whistle." />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {coaches.map((c, i) => (
            <CoachCard key={c.id} coach={c} index={i} />
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <Eyebrow index="05">Achievements</Eyebrow>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.95] sm:text-5xl">Medals are a by-product. We still count them.</h2>
          </div>
          <ol className="relative grid gap-4 border-l border-line pl-6">
            {about.achievements.map((a) => (
              <li key={a.title} className="relative rounded-2xl border border-line bg-white p-5 shadow-xs">
                <span className="absolute -left-[2.35rem] top-5 grid size-7 place-items-center rounded-lg border border-line bg-warning">
                  <Medal className="size-4" />
                </span>
                <p className="font-mono text-sm font-medium text-brand">{a.year}</p>
                <p className="mt-1 font-display text-xl font-semibold leading-tight">{a.title}</p>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section className="border-t border-line">
        <SectionHeading index="06" eyebrow="Gallery" title="Life at the academy." />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {about.gallery.map((g, i) => (
            <figure key={g.title} className={i === 0 ? "col-span-2 row-span-2 overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm md:col-span-2" : "overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm"}>
              <GalleryArt variant={g.variant} className={i === 0 ? "aspect-[16/10] border-b border-line" : "aspect-[4/3] border-b border-line"} />
              <figcaption className="px-4 py-3 text-sm font-medium">{g.title}</figcaption>
            </figure>
          ))}
        </div>
      </Section>
    </>
  );
}
