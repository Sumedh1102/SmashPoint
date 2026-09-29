import Link from "next/link";
import { ArrowUpRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SOCIAL_ICONS } from "@/components/brand/social-icons";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/content/site";
import { PUBLIC_NAV } from "./nav-links";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-line bg-ink text-white" data-print-hide>
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6">
        <div className="grid gap-10 border-b border-white/15 py-14 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Logo inverted />
            <p className="mt-5 max-w-sm text-white/75">{site.description}</p>
            <div className="mt-6 flex gap-3">
              {site.socials.map((s) => {
                const Icon = SOCIAL_ICONS[s.label];
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${site.shortName} on ${s.label}`}
                    className="grid size-11 place-items-center rounded-xl border border-white bg-white/5 transition hover:bg-brand"
                  >
                    {Icon ? <Icon className="size-5" /> : null}
                  </a>
                );
              })}
            </div>
          </div>
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">Explore</h2>
            <ul className="grid gap-2">
              {PUBLIC_NAV.slice(1).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="font-semibold hover:text-brand-200 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">Visit</h2>
            <ul className="grid gap-3 text-white/85">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>{site.contact.addressLines.join(", ")}</span>
              </li>
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0" />
                <span>Every day · 4:00 AM – 7:00 PM</span>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 size-4 shrink-0" />
                <a href={site.contact.phoneHref} className="hover:underline">
                  {site.contact.phone}
                </a>
              </li>
              <li className="flex gap-2.5">
                <Mail className="mt-0.5 size-4 shrink-0" />
                <a href={`mailto:${site.contact.email}`} className="hover:underline">
                  {site.contact.email}
                </a>
              </li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white bg-brand p-6 shadow-[6px_6px_0_0_#fff]">
            <p className="font-display text-2xl font-semibold leading-tight">Courts open at 4 AM. Your slot is one tap away.</p>
            <ButtonLink href="/book" variant="outline" className="mt-5 w-full">
              Book a Court <ArrowUpRight className="size-4" />
            </ButtonLink>
          </div>
        </div>
        <div className="flex flex-col gap-2 py-6 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p>Made for players in Palghar, Maharashtra.</p>
        </div>
      </div>
    </footer>
  );
}
