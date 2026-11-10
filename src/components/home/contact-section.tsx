import { ArrowUpRight, CalendarClock, Clock3, Mail, MapPin, MessageSquareText, Phone } from "lucide-react";
import { ContactValue } from "@/components/site/contact-value";
import { mailHref, mapHref, site, telHref } from "@/content/site";
import { describeHours, type BookingHours } from "@/lib/booking/rules";
import { SectionHeading } from "./section-heading";

export function ContactSection({ hours }: { hours: BookingHours }) {
  const directions = mapHref(site.contact.mapQuery);
  const items = [
    { icon: Phone, label: "Call", content: <ContactValue value={site.contact.phone} href={telHref(site.contact.phone)} /> },
    { icon: Mail, label: "Email", content: <ContactValue value={site.contact.email} href={mailHref(site.contact.email)} className="break-all" /> },
    {
      icon: MapPin,
      label: "Visit",
      content: (
        <>
          {site.contact.addressLines.map((l) => (
            <span key={l} className="block">
              <ContactValue value={l} href={null} />
            </span>
          ))}
          {directions ? (
            <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-royal hover:underline">
              Get directions <ArrowUpRight aria-hidden className="size-4" />
            </a>
          ) : null}
        </>
      ),
    },
    {
      icon: Clock3,
      label: "Opening hours",
      content: (
        <>
          <ContactValue value={site.openingHours} href={null} />
          <span className="mt-1.5 flex items-center gap-1.5 text-sm font-normal text-muted">
            <CalendarClock aria-hidden className="size-4 shrink-0" /> Online booking: {describeHours(hours)}, daily
          </span>
        </>
      ),
    },
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-16 border-t border-line bg-paper py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading
              id="contact-title"
              eyebrow="Contact"
              title={
                <>
                  Questions?
                  <br />
                  <span className="text-royal">Talk to us.</span>
                </>
              }
            />
            <p data-reveal className="mt-5 max-w-md text-muted">
              For monthly rental plans, coaching or changes to a booking, get in touch. Mention your booking reference (it starts with{" "}
              <span className="font-semibold text-ink">SP-</span>) so we can find it quickly.
            </p>
            <p data-reveal className="mt-6 flex max-w-md items-start gap-3 rounded-2xl border border-line bg-white p-4 text-sm text-muted">
              <MessageSquareText aria-hidden className="mt-0.5 size-5 shrink-0 text-gold-700" />
              Timings and availability are subject to change. Advance booking is recommended.
            </p>
          </div>
          <ul className="grid gap-px self-start overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2">
            {items.map(({ icon: Icon, label, content }, i) => (
              <li key={label} data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }} className="bg-white p-6 sm:p-7">
                <span className="grid size-10 place-items-center rounded-xl bg-royal-50 text-royal">
                  <Icon aria-hidden className="size-5" strokeWidth={1.8} />
                </span>
                <p className="eyebrow mt-5 text-subtle">{label}</p>
                <div className="mt-2 text-[1.05rem] leading-relaxed font-medium text-ink">{content}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
