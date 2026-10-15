import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { mailHref, site, telHref } from "@/content/site";
import { ContactValue } from "./contact-value";

const SPORTS = [
  { name: "Badminton", courts: 2 },
  { name: "Pickleball", courts: 2 },
  { name: "Basketball", courts: 1 },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">{site.descriptor}. Book online, pay securely and play.</p>
            <p className="mt-6 text-sm text-white/80">{site.hours}</p>
          </div>

          <div>
            <h2 className="eyebrow text-ink-muted">Sports</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {SPORTS.map((s) => (
                <li key={s.name}>
                  <Link href="/#courts" className="text-white/85 hover:text-white">
                    {s.name}
                  </Link>{" "}
                  <span className="text-ink-muted">
                    · {s.courts} {s.courts === 1 ? "court" : "courts"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="eyebrow text-ink-muted">Contact</h2>
            <address className="mt-4 space-y-2.5 text-sm not-italic text-white/85">
              <p>
                <ContactValue value={site.contact.phone} href={telHref(site.contact.phone)} />
              </p>
              <p>
                <ContactValue value={site.contact.email} href={mailHref(site.contact.email)} />
              </p>
              {site.contact.addressLines.map((line) => (
                <p key={line}>
                  <ContactValue value={line} href={null} />
                </p>
              ))}
            </address>
          </div>

          <div>
            <h2 className="eyebrow text-ink-muted">Policies</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link href="/cancellation-policy" className="text-white/85 hover:text-white">
                  Payments, cancellations &amp; refunds
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-white/85 hover:text-white">
                  Terms &amp; conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-white/85 hover:text-white">
                  Privacy policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>Online payments are processed securely by Razorpay.</p>
        </div>
      </div>
    </footer>
  );
}
