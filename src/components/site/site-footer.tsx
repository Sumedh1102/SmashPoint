import Link from "next/link";
import { BookLink } from "@/components/booking/selection-context";
import { Wordmark } from "@/components/brand/wordmark";
import { mailHref, site, telHref } from "@/content/site";
import { SPORTS_CONTENT } from "@/content/sports";
import { ContactValue } from "./contact-value";

const EXPLORE = [
  { href: "/#top", label: "Home" },
  { href: "/#sports", label: "Sports" },
  { href: "/#pricing", label: "Court rentals & pricing" },
  { href: "/#book", label: "Book a court" },
  { href: "/#coaching", label: "Coaching" },
  { href: "/#about", label: "About us" },
  { href: "/#contact", label: "Contact" },
];

const POLICIES = [
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/cancellation-policy", label: "Cancellation & refund policy" },
];

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="eyebrow text-gold">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function SiteFooter() {
  const linkClass = "text-white/75 transition-colors hover:text-white";
  return (
    <footer className="surface-dark relative overflow-hidden bg-ink text-white">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--color-royal),var(--color-gold),var(--color-sky))]" />
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr_1.1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Wordmark size="lg" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-muted">
              {site.descriptor}. Court rentals by the hour or month, and coaching by state-certified coaches.
            </p>
            <p className="mt-4 font-display text-lg font-bold text-gold italic">{site.motto}</p>
          </div>

          <Column title="Explore">
            <ul className="space-y-2.5 text-sm">
              {EXPLORE.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>

          <Column title="Sports">
            <ul className="space-y-2.5 text-sm">
              {SPORTS_CONTENT.map((s) => (
                <li key={s.slug}>
                  <BookLink sport={s.slug} className={linkClass} aria-label={`Book ${s.name}`}>
                    {s.name}
                  </BookLink>
                </li>
              ))}
              <li>
                <Link href="/#pricing" className={linkClass}>
                  Rental pricing
                </Link>
              </li>
            </ul>
          </Column>

          <Column title="Contact">
            <address className="space-y-2.5 text-sm not-italic text-white/80">
              <p>
                <ContactValue value={site.contact.phone} href={telHref(site.contact.phone)} />
              </p>
              <p>
                <ContactValue value={site.contact.email} href={mailHref(site.contact.email)} className="break-all" />
              </p>
              {site.contact.addressLines.map((line) => (
                <p key={line}>
                  <ContactValue value={line} href={null} />
                </p>
              ))}
            </address>
          </Column>

          <Column title="Policies">
            <ul className="space-y-2.5 text-sm">
              {POLICIES.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Column>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>Online payments are processed securely by Razorpay. Terms and conditions apply.</p>
        </div>
      </div>
    </footer>
  );
}
