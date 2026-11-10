import Link from "next/link";
import { BookLink } from "@/components/booking/selection-context";
import { Wordmark } from "@/components/brand/wordmark";
import { mailHref, site, telHref } from "@/content/site";
import { SPORTS_CONTENT } from "@/content/sports";
import { ContactValue } from "./contact-value";

const POLICIES = [
  { href: "/terms", label: "Terms & conditions" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/cancellation-policy", label: "Cancellation & refund policy" },
];

const linkClass = "text-white/80 transition-colors hover:text-neon";

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-line bg-ink-2 text-white print:hidden">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 md:col-span-1">
            <Wordmark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-muted">{site.descriptor}. Book a court online, pay securely and play — or ask about monthly plans and coaching.</p>
            <p className="mt-4 font-display text-base font-bold text-white italic">{site.motto}</p>
          </div>

          <div>
            <h2 className="eyebrow text-ink-subtle">Sports</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {SPORTS_CONTENT.map((s) => (
                <li key={s.slug}>
                  <BookLink sport={s.slug} className={linkClass} aria-label={`Book ${s.name}`}>
                    {s.name}
                  </BookLink>
                </li>
              ))}
              <li>
                <Link href="/#pricing" className={linkClass}>
                  Court rental rates
                </Link>
              </li>
              <li>
                <Link href="/#coaching" className={linkClass}>
                  Coaching
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="eyebrow text-ink-subtle">Contact</h2>
            <address className="mt-4 space-y-2.5 text-sm not-italic text-white/80">
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
          </div>

          <div>
            <h2 className="eyebrow text-ink-subtle">Policies</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {POLICIES.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-ink-line pt-6 text-xs text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>Online payments are processed securely by Razorpay. Terms and conditions apply.</p>
        </div>
      </div>
    </footer>
  );
}
