import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { EventMeta } from "@/components/marketing/cards";
import { Container } from "@/components/marketing/section";
import { EventRegistrationForm } from "@/components/forms/event-registration-form";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/ui/form";
import { Breadcrumbs } from "@/components/ui/misc";
import { formatDate, formatMoney } from "@/lib/format";
import { todayInTz } from "@/lib/time";
import { getCurrentUser } from "@/server/auth/guards";
import { getEventBySlug } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: event.name,
    description: event.summary || event.description.slice(0, 160),
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { title: event.name, description: event.summary, url: `/events/${event.slug}`, type: "article" },
  };
}

const CATEGORY_LABEL: Record<string, string> = { TOURNAMENT: "Tournament", WORKSHOP: "Workshop", CAMP: "Camp", SOCIAL: "Social", TRIAL: "Free trial" };

export default async function EventPage({ params, searchParams }: PageProps<"/events/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const [event, user] = await Promise.all([getEventBySlug(slug), getCurrentUser()]);
  if (!event) notFound();

  const today = todayInTz();
  const over = (event.endDate ?? event.date) < today || event.status === "COMPLETED";
  const deadlinePassed = !!event.registrationDeadline && today > event.registrationDeadline;
  const closedReason =
    event.status === "CANCELLED" ? "This event has been cancelled." : over ? "This event has finished." : deadlinePassed ? "Registrations have closed." : null;
  const spotsLeft = event.registrationLimit ? Math.max(0, event.registrationLimit - event.registered) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.name,
    description: event.summary,
    startDate: event.date,
    endDate: event.endDate ?? event.date,
    eventStatus: event.status === "CANCELLED" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    location: { "@type": "Place", name: event.venue, address: "Mahim Road, Palghar, Maharashtra 401404" },
    offers: { "@type": "Offer", price: event.fee / 100, priceCurrency: "INR" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="border-b border-line">
        <Container className="py-12 md:py-16">
          <Breadcrumbs items={[{ label: "Events", href: "/events" }, { label: event.name }]} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="ink">{CATEGORY_LABEL[event.category]}</Badge>
            {event.format ? <Badge tone="outline">{event.format.replace("_", " ")}</Badge> : null}
            {spotsLeft !== null && !closedReason ? <Badge tone={spotsLeft <= 10 ? "yellow" : "blue"}>{spotsLeft} spots left</Badge> : null}
          </div>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.92] md:text-7xl">{event.name}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted md:text-xl">{event.summary}</p>
        </Container>
      </section>
      <Container className="grid gap-10 py-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {sp.payment === "success" ? <div className="mb-6"><FormMessage tone="success">Payment received — your registration is confirmed. Check your email for details.</FormMessage></div> : null}
          {sp.payment === "failed" ? <div className="mb-6"><FormMessage tone="error">Payment didn&apos;t go through. You can try registering again below.</FormMessage></div> : null}
          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm md:p-8">
            <h2 className="text-2xl font-semibold">About this event</h2>
            <div className="mt-4 space-y-4 whitespace-pre-line leading-relaxed text-ink-soft">{event.description}</div>
            {event.divisions.length ? (
              <>
                <h3 className="mt-8 text-lg font-semibold">Categories</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {event.divisions.map((d) => (
                    <li key={d} className="rounded-lg border border-line bg-brand-50 px-2.5 py-1 text-sm font-medium">
                      {d}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] border border-line bg-white shadow-md">
            <div className="border-b border-line bg-brand p-6 text-white">
              <p className="font-mono text-xs font-medium uppercase tracking-widest text-white/80">Entry fee</p>
              <p className="font-display text-5xl font-semibold leading-none">{event.fee ? formatMoney(event.fee) : "Free"}</p>
              {event.registrationDeadline ? <p className="mt-2 text-sm font-semibold text-white/85">Register by {formatDate(event.registrationDeadline, "long")}</p> : null}
            </div>
            <div className="p-6">
              <EventMeta event={event} />
              {event.registrationLimit ? (
                <p className="mt-3 flex items-center gap-2.5 text-sm font-semibold">
                  <Users className="size-4" /> {event.registered} / {event.registrationLimit} registered
                </p>
              ) : null}
              <div className="my-6 h-[3px] bg-ink" />
              <h2 className="mb-4 text-xl font-semibold">Register</h2>
              <EventRegistrationForm
                eventId={event.id}
                divisions={event.divisions}
                fee={event.fee}
                closedReason={closedReason}
                defaults={user ? { name: user.name, email: user.email, phone: user.phone } : undefined}
              />
            </div>
          </div>
        </aside>
      </Container>
    </>
  );
}
