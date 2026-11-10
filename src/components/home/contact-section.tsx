import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ContactValue } from "@/components/site/contact-value";
import { mailHref, mapHref, site, telHref } from "@/content/site";
import { describeHours, type BookingHours } from "@/lib/booking/rules";

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
            <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-neon hover:underline">
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
          <span className="mt-1.5 block text-sm font-normal text-ink-muted">Online booking: {describeHours(hours)}, daily</span>
        </>
      ),
    },
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-16 border-t border-ink-line bg-ink py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <div>
          <p className="eyebrow text-neon">Contact</p>
          <h2 id="contact-title" className="display mt-4 text-[clamp(2.75rem,6.5vw,5rem)]">
            Questions?
            <br />
            Talk to us.
          </h2>
          <p className="mt-5 max-w-md leading-relaxed text-ink-muted">
            For monthly rental plans, coaching or changes to a booking, get in touch. Mention your booking reference (it starts with{" "}
            <span className="font-semibold text-white">SP-</span>) so we can find it quickly.
          </p>
          <p className="mt-4 max-w-md text-sm text-ink-subtle">Timings and availability are subject to change. Advance booking is recommended.</p>
        </div>
        <ul className="grid gap-px self-start overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-ink-line sm:grid-cols-2">
          {items.map(({ icon: Icon, label, content }) => (
            <li key={label} className="bg-ink-2 p-6 sm:p-7">
              <Icon aria-hidden className="size-5 text-neon" strokeWidth={1.8} />
              <p className="eyebrow mt-5 text-ink-subtle">{label}</p>
              <div className="mt-2 text-[1.05rem] leading-relaxed font-medium">{content}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
