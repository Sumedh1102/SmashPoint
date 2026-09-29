import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { SOCIAL_ICONS } from "@/components/brand/social-icons";
import { ContactForm } from "@/components/forms/contact-form";
import { Container, Mark, PageHero } from "@/components/marketing/section";
import { FloatingTile } from "@/components/site/floating-tile";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Visit ${site.name} on Mahim Road, Palghar. Call ${site.contact.phone}, WhatsApp us or send a message — open every day 4 AM to 7 PM.`,
  alternates: { canonical: "/contact" },
  openGraph: { title: "Contact · SmashPoint Badminton Academy", url: "/contact" },
};

const TOPIC_MAP: Record<string, string> = {
  trial: "Coaching / Free trial",
  beginner: "Coaching / Free trial",
  intermediate: "Coaching / Free trial",
  advanced: "Coaching / Free trial",
  kids: "Kids Program",
};

export default async function ContactPage({ searchParams }: PageProps<"/contact">) {
  const { topic } = await searchParams;
  const defaultTopic = typeof topic === "string" ? TOPIC_MAP[topic] : undefined;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(site.contact.mapQuery)}&output=embed`;

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={
          <>
            Say hi. We reply <Mark>fast.</Mark>
          </>
        }
        description="Questions about coaching, trials, court bookings or corporate slots? Call, WhatsApp or drop a message — the front desk replies within an hour."
        aside={
          <div className="relative hidden h-44 lg:block">
            <FloatingTile tone="blue" rotate={-10} float className="absolute left-6 top-2" size="lg">
              <MessageCircle />
            </FloatingTile>
            <FloatingTile tone="white" rotate={8} className="absolute left-36 top-16" size="lg">
              <Phone />
            </FloatingTile>
            <FloatingTile tone="ink" rotate={-4} float className="absolute left-64 top-0" size="lg">
              <Mail />
            </FloatingTile>
          </div>
        }
      />

      <Container className="grid gap-8 py-14 lg:grid-cols-[1fr_1.15fr]">
        <div className="grid content-start gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <a href={site.contact.phoneHref} className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm lift-hover">
              <Phone className="size-6 text-brand" />
              <p className="mt-3 text-sm font-medium text-muted">Call us</p>
              <p className="font-display text-xl font-semibold">{site.contact.phone}</p>
            </a>
            <a href={site.contact.whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-[var(--radius-card)] border border-line bg-brand p-5 text-white shadow-sm lift-hover">
              <MessageCircle className="size-6" />
              <p className="mt-3 text-sm font-medium text-white/80">WhatsApp</p>
              <p className="font-display text-xl font-semibold">{site.contact.whatsapp}</p>
            </a>
            <a href={`mailto:${site.contact.email}`} className="rounded-[var(--radius-card)] border border-line bg-white p-5 shadow-sm lift-hover sm:col-span-2">
              <Mail className="size-6 text-brand" />
              <p className="mt-3 text-sm font-medium text-muted">Email</p>
              <p className="font-display text-xl font-semibold">{site.contact.email}</p>
            </a>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
            <div className="flex gap-3">
              <MapPin className="mt-1 size-5 shrink-0 text-brand" />
              <address className="not-italic">
                <p className="font-display text-lg font-semibold">{site.name}</p>
                {site.contact.addressLines.map((l) => (
                  <p key={l} className="text-ink-soft">
                    {l}
                  </p>
                ))}
              </address>
            </div>
            <div className="mt-5 flex gap-3 border-t border-line pt-5">
              <Clock className="mt-1 size-5 shrink-0 text-brand" />
              <dl className="grid w-full gap-1.5 text-sm">
                {site.contact.openingHours.map((h) => (
                  <div key={h.days} className="flex justify-between gap-4">
                    <dt className="font-semibold text-muted">{h.days}</dt>
                    <dd className="font-medium">{h.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
              {site.socials.map((s) => {
                const Icon = SOCIAL_ICONS[s.label];
                return (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium hover:bg-brand hover:text-white">
                    {Icon ? <Icon className="size-4" /> : null} {s.handle}
                  </a>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm">
            <iframe
              title={`Map showing ${site.name}`}
              src={mapSrc}
              className="block h-72 w-full grayscale-[35%]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-md md:p-8 lg:self-start">
          <h2 className="text-3xl font-semibold">Send us a message</h2>
          <p className="mb-6 mt-1 text-muted">We usually reply within a few hours.</p>
          <ContactForm defaultTopic={defaultTopic} />
        </div>
      </Container>
    </>
  );
}
