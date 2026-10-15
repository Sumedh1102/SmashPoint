import { ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { ContactValue } from "@/components/site/contact-value";
import { mailHref, mapHref, site, telHref } from "@/content/site";

export function ContactSection() {
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
            <a href={directions} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-court hover:underline">
              Get directions <ArrowUpRight aria-hidden className="size-4" />
            </a>
          ) : null}
        </>
      ),
    },
    { icon: Clock3, label: "Hours", content: <span>{site.hours}</span> },
  ];

  return (
    <section id="contact" aria-labelledby="contact-title" className="border-t border-line bg-white py-24 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
        <div data-reveal>
          <p className="eyebrow text-court">Contact</p>
          <h2 id="contact-title" className="display mt-4 text-[clamp(2.6rem,6vw,4.75rem)]">
            Questions?
            <br />
            Talk to us.
          </h2>
          <p className="mt-5 max-w-md text-muted">
            For changes to a booking, mention your booking reference (it starts with <span className="font-semibold text-ink">SP-</span>) so we can find it quickly.
          </p>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2">
          {items.map(({ icon: Icon, label, content }, i) => (
            <li key={label} data-reveal style={{ ["--reveal-delay" as string]: `${i * 70}ms` }} className="bg-white p-6 sm:p-7">
              <Icon aria-hidden className="size-5 text-court" strokeWidth={1.8} />
              <p className="eyebrow mt-5 text-subtle">{label}</p>
              <div className="mt-2 text-[1.05rem] leading-relaxed font-medium text-ink">{content}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
