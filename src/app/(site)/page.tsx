import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarCheck, CreditCard, MapPin, MessageCircle, Phone, Timer } from "lucide-react";
import { GalleryArt } from "@/components/brand/illustrations";
import { AnnouncementStrip } from "@/components/marketing/announcement-strip";
import { CoachCard, EventCard, Faq, PlanCard, ProgramCard, TestimonialCard } from "@/components/marketing/cards";
import { FacilityIcon } from "@/components/marketing/facility-icon";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { Container, Eyebrow, Mark, Section, SectionHeading } from "@/components/marketing/section";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { about, facilities, faqs, site, testimonials, whyChooseUs } from "@/content/site";
import { getMembershipPlans, getPrograms, getPublicCoaches, getUpcomingEvents } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: `${site.name} · Palghar — Coaching & Court Booking` },
  description: site.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [programs, coaches, plans, events] = await Promise.all([getPrograms(), getPublicCoaches(), getMembershipPlans(), getUpcomingEvents(3)]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: site.name,
    description: site.description,
    url: site.url,
    telephone: site.contact.phone,
    email: site.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.contact.addressLines.slice(0, 2).join(", "),
      addressLocality: "Palghar",
      addressRegion: "Maharashtra",
      postalCode: "401404",
      addressCountry: "IN",
    },
    openingHours: "Mo-Su 04:00-19:00",
    sport: "Badminton",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <AnnouncementStrip />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-line">
        <Container className="grid items-center gap-12 pb-16 pt-12 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-medium shadow-xs">
              <MapPin className="size-4 text-brand" /> Palghar&apos;s badminton HQ · Est. {site.founded}
            </p>
            <h1 className="mt-7 text-[3.4rem] font-semibold leading-[0.9] tracking-[-0.045em] sm:text-7xl lg:text-[5.6rem] xl:text-8xl">
              Where Palghar learns to <Mark>smash.</Mark>
            </h1>
            <p className="mt-7 max-w-xl text-lg text-ink-soft md:text-xl">
              Five pro-grade courts, certified coaches and structured programs for every age. Book a court in under a minute — no calls, no waiting.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/book" size="xl">
                Book a Court <ArrowUpRight className="size-5" />
              </ButtonLink>
              <ButtonLink href="/membership" size="xl" variant="outline">
                Join Academy
              </ButtonLink>
            </div>
            <p className="mt-5 text-sm font-semibold text-muted">Open daily 4:00 AM – 7:00 PM · 30, 60 & 90-minute slots</p>
          </div>
          <HeroVisual />
        </Container>

        <Container className="pb-14">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {site.stats.map((stat, i) => (
              <div
                key={stat.label}
                className={
                  i === 1
                    ? "rounded-2xl border border-line bg-brand p-5 text-white shadow-sm"
                    : i === 3
                      ? "rounded-2xl border border-line bg-ink p-5 text-white shadow-sm"
                      : "rounded-2xl border border-line bg-white p-5 shadow-sm"
                }
              >
                <dd className="font-display text-5xl font-semibold leading-none tracking-tight md:text-6xl">{stat.value}</dd>
                <dt className="mt-2 font-medium">{stat.label}</dt>
                <p className="text-sm opacity-70">{stat.note}</p>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <Section id="about">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <Eyebrow index="01">The academy</Eyebrow>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.95] sm:text-5xl lg:text-6xl">Built by players. Run like a pro setup.</h2>
            <div className="mt-6 space-y-4 text-lg text-ink-soft">
              {about.story.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
            </div>
            <ButtonLink href="/about" variant="outline" className="mt-8">
              Our story <ArrowRight className="size-4" />
            </ButtonLink>
          </div>
          <div className="grid gap-4">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
              <p className="font-mono text-xs font-medium uppercase tracking-widest text-brand">Mission</p>
              <p className="mt-2 font-display text-2xl font-semibold leading-tight">{about.mission}</p>
            </div>
            <div className="ml-0 rounded-[var(--radius-card)] border border-line bg-brand p-6 text-white shadow-sm sm:ml-10">
              <p className="font-mono text-xs font-medium uppercase tracking-widest text-white/80">Vision</p>
              <p className="mt-2 font-display text-2xl font-semibold leading-tight">{about.vision}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Programs ─────────────────────────────────────────────────────── */}
      <Section id="programs" className="border-y border-line bg-white/70">
        <SectionHeading
          index="02"
          eyebrow="Coaching programs"
          title={
            <>
              A clear path from <Mark>first rally</Mark> to podium.
            </>
          }
          description="Four structured programs, small groups and monthly skill assessments so you always know what to work on next."
          action={
            <ButtonLink href="/coaching" variant="outline">
              All programs <ArrowRight className="size-4" />
            </ButtonLink>
          }
        />
        {programs.length ? (
          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4">
            {programs.map((p) => (
              <div key={p.id} className="w-[85%] shrink-0 snap-start md:w-auto">
                <ProgramCard program={p} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Programs coming soon" />
        )}
      </Section>

      {/* ── Facilities ───────────────────────────────────────────────────── */}
      <Section id="facilities">
        <SectionHeading
          index="03"
          eyebrow="Court facilities"
          title="Courts you'll want to play on at 5 AM."
          action={
            <ButtonLink href="/facilities" variant="outline">
              Tour facilities <ArrowRight className="size-4" />
            </ButtonLink>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facilities.slice(0, 5).map((f, i) => (
            <div key={f.title} className={i === 0 ? "rounded-[var(--radius-card)] border border-line bg-ink p-6 text-white shadow-sm sm:col-span-2 lg:col-span-2 lg:row-span-2" : "rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm"}>
              <span className={i === 0 ? "grid size-12 place-items-center rounded-xl border border-white bg-brand" : "grid size-12 place-items-center rounded-xl border border-line bg-brand-100 text-brand-700"}>
                <FacilityIcon name={f.icon} className="size-6" />
              </span>
              <h3 className={i === 0 ? "mt-6 text-4xl font-semibold leading-none" : "mt-4 text-xl font-semibold"}>{f.title}</h3>
              <p className={i === 0 ? "mt-2 font-mono text-sm font-medium uppercase tracking-wider text-brand-200" : "mt-1 text-xs font-medium uppercase tracking-wider text-brand"}>{f.spec}</p>
              <p className={i === 0 ? "mt-4 max-w-md text-white/80" : "mt-2 text-sm text-muted"}>{f.body}</p>
              {i === 0 ? <GalleryArt variant="court" className="mt-6 rounded-2xl border border-white" /> : null}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Why choose us ────────────────────────────────────────────────── */}
      <section className="bg-brand border-y border-line py-16 text-white md:py-24">
        <Container>
          <SectionHeading index="04" eyebrow="Why SmashPoint" inverted title="Less admin. More badminton." description="Everything around the game is designed to get out of your way." />
          <ol className="grid gap-5 md:grid-cols-2">
            {whyChooseUs.map((w, i) => (
              <li key={w.title} className="flex gap-5 rounded-[var(--radius-card)] border border-line bg-white p-6 text-ink shadow-md">
                <span className="font-display text-5xl font-semibold leading-none text-brand">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-2xl font-semibold">{w.title}</h3>
                  <p className="mt-2 text-muted">{w.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ── Coaches ──────────────────────────────────────────────────────── */}
      <Section id="coaches">
        <SectionHeading
          index="05"
          eyebrow="Meet the coaches"
          title="Specialists, not generalists."
          description="Every coach owns a specialty — footwork, doubles, kids or conditioning — so you learn each skill from the best person for it."
          action={
            <ButtonLink href="/coaches" variant="outline">
              All coaches <ArrowRight className="size-4" />
            </ButtonLink>
          }
        />
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {coaches.slice(0, 4).map((c, i) => (
            <div key={c.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
              <CoachCard coach={c} index={i} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── Booking CTA ──────────────────────────────────────────────────── */}
      <Section className="pt-0 md:pt-0">
        <div className="bg-ink relative overflow-hidden rounded-[2rem] border border-line p-8 text-white shadow-lg md:p-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <Eyebrow inverted index="06">
                Court booking
              </Eyebrow>
              <h2 className="mt-4 text-5xl font-semibold leading-[0.92] md:text-7xl">
                Pick a slot. <br />
                Pay. <span className="text-brand-200">Play.</span>
              </h2>
              <p className="mt-5 max-w-lg text-lg text-white/80">Live availability for all courts, transparent peak pricing and instant confirmation with a digital receipt.</p>
              <ButtonLink href="/book" size="xl" className="mt-8">
                Check availability <ArrowUpRight className="size-5" />
              </ButtonLink>
            </div>
            <ol className="grid gap-3">
              {[
                { icon: CalendarCheck, title: "Choose date, court & time", body: "See every open slot at a glance." },
                { icon: CreditCard, title: "Pay securely online", body: "UPI, cards & netbanking." },
                { icon: Timer, title: "Show up & play", body: "Confirmation + reminder on WhatsApp." },
              ].map((step, i) => (
                <li key={step.title} className="flex items-center gap-4 rounded-2xl border border-white bg-white p-4 text-ink" style={{ marginLeft: `${i * 1.25}rem` }}>
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-brand text-white">
                    <step.icon className="size-6" />
                  </span>
                  <span>
                    <span className="block font-display text-lg font-semibold">{step.title}</span>
                    <span className="text-sm text-muted">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ── Membership ───────────────────────────────────────────────────── */}
      <Section id="membership" className="border-y border-line bg-white/70">
        <SectionHeading
          index="07"
          eyebrow="Membership plans"
          align="center"
          title="Pick a plan. Commit to the grind."
          description="All plans include coaching in your batch, skill assessments, QR check-in and the student dashboard."
        />
        <div className="grid gap-6 pt-3 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} ctaHref={`/membership#${p.slug}`} />
          ))}
        </div>
      </Section>

      {/* ── Events ───────────────────────────────────────────────────────── */}
      <Section id="events">
        <SectionHeading
          index="08"
          eyebrow="Upcoming events"
          title="Tournaments, camps & match days."
          action={
            <ButtonLink href="/events" variant="outline">
              All events <ArrowRight className="size-4" />
            </ButtonLink>
          }
        />
        {events.length ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <EmptyState title="No upcoming events" description="New tournaments and camps are announced every month." />
        )}
      </Section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <Section className="border-y border-line bg-white/70">
        <SectionHeading index="09" eyebrow="Testimonials" title="Heard on court." />
        <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <div key={t.name} className="w-[85%] shrink-0 snap-start md:w-auto">
              <TestimonialCard {...t} index={i} />
            </div>
          ))}
        </div>
      </Section>

      {/* ── FAQ + Contact ────────────────────────────────────────────────── */}
      <Section id="faq">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <Eyebrow index="10">FAQ</Eyebrow>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.95] sm:text-5xl lg:text-6xl">Questions, answered.</h2>
            <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-brand p-6 text-white shadow-md">
              <p className="font-display text-2xl font-semibold leading-tight">Still curious? Talk to a human.</p>
              <p className="mt-2 text-white/80">Our front desk replies within an hour, 6 AM – 7 PM.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <ButtonLink href="/contact" variant="outline" size="sm">
                  Contact us
                </ButtonLink>
                <a href={site.contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-white px-3.5 text-sm font-medium hover:bg-white/10">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
                <a href={site.contact.phoneHref} className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-white px-3.5 text-sm font-medium hover:bg-white/10">
                  <Phone className="size-4" /> Call
                </a>
              </div>
            </div>
          </div>
          <Faq items={faqs} />
        </div>
      </Section>

      <Container>
        <Link href="/book" className="group flex items-center justify-between gap-6 rounded-[2rem] border border-line bg-warning px-6 py-8 shadow-md transition md:px-12">
          <p className="font-display text-3xl font-semibold leading-none md:text-5xl">Ready when you are. Courts open at 4 AM.</p>
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-line bg-ink text-white transition group-hover:rotate-12 md:size-20">
            <ArrowUpRight className="size-8" />
          </span>
        </Link>
      </Container>
    </>
  );
}
