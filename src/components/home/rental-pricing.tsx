import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BookLink } from "@/components/booking/selection-context";
import { SportIcon } from "@/components/booking/sport-icon";
import { buttonClass } from "@/components/ui/button";
import { mailHref, site, telHref } from "@/content/site";
import { twoHourSaving } from "@/lib/booking/engine";
import { formatMoney } from "@/lib/format";
import { HOURLY_TERMS, MONTHLY_TERMS, tariffRows, type TariffRow } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PublicCourt } from "@/server/queries/public";
import { SectionHeading } from "./section-heading";

/** The rate card's "Important notes", word for word. */
export const RENTAL_NOTES = [
  { text: "Monthly rentals are valid from Monday to Saturday." },
  { text: "Timings and availability are subject to change." },
  { text: "Advance booking is recommended." },
  { text: "Terms and conditions apply.", href: "/terms" },
] as const;

/** Where "Enquire" goes: email (with a subject) or phone once they are set, else the contact section. */
export function enquiryHref(subject: string) {
  return mailHref(site.contact.email, subject) ?? telHref(site.contact.phone) ?? "/#contact";
}

const price = (v: number | null) => (v === null ? "—" : formatMoney(v));
const rowName = (row: TariffRow) => `${row.sportName}${row.courtLabel ? ` ${row.courtLabel}` : ""}`;

function RowLabel({ row }: { row: TariffRow }) {
  return (
    <span className="flex items-start gap-3">
      <SportIcon sport={row.sportSlug} className="mt-0.5 size-7 shrink-0 text-neon" />
      <span className="min-w-0">
        <span className="display block text-[1.45rem] leading-none">{row.sportName}</span>
        {row.courtLabel || row.surface ? <span className="mt-1.5 block text-sm font-semibold">{[row.courtLabel, row.surface].filter(Boolean).join(" – ")}</span> : null}
        {row.sportSlug === "pickleball" ? <span className="mt-1 block text-xs text-ink-muted">Paddle included · ball purchased separately</span> : null}
      </span>
    </span>
  );
}

function bookTarget(row: TariffRow) {
  const bookable = row.courts.filter((c) => c.bookable);
  if (!bookable.length) return null;
  // A row that is one court of a sport books that court; a sport-wide row books the sport.
  return row.courtLabel && bookable.length === 1 ? { court: bookable[0]!.slug } : { sport: row.sportSlug };
}

/** Desktop: one aligned table with hourly and monthly column groups. */
function PricingTable({ rows }: { rows: TariffRow[] }) {
  return (
    <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-ink-line lg:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Court rental prices in Indian rupees: hourly rental (1 or 2 hours) and monthly rental plans (Monday to Saturday)</caption>
        <colgroup>
          <col className="w-[28%]" />
          <col span={2} className="bg-white/[0.035]" />
          <col span={4} />
          <col className="w-[9rem]" />
        </colgroup>
        <thead className="bg-ink-2">
          <tr>
            <th scope="col" rowSpan={2} className="eyebrow px-6 py-4 align-bottom text-ink-subtle">
              Sport / court
            </th>
            <th scope="colgroup" colSpan={2} className="border-l border-ink-line px-4 pt-4 pb-1 text-center">
              <span className="eyebrow text-neon">Hourly rental</span>
              <span className="block text-[0.7rem] text-ink-subtle">Book online</span>
            </th>
            <th scope="colgroup" colSpan={4} className="border-l border-ink-line px-4 pt-4 pb-1 text-center">
              <span className="eyebrow">Monthly rental</span>
              <span className="block text-[0.7rem] text-ink-subtle">Monday – Saturday · enquire</span>
            </th>
            <th scope="col" rowSpan={2} className="border-l border-ink-line px-4">
              <span className="sr-only">Book</span>
            </th>
          </tr>
          <tr className="text-[0.72rem] font-semibold tracking-[0.12em] text-ink-muted uppercase">
            {HOURLY_TERMS.map((t, i) => (
              <th key={t.key} scope="col" className={cn("px-2 pt-1 pb-3 text-center whitespace-nowrap", i === 0 && "border-l border-ink-line")}>
                {t.label}
              </th>
            ))}
            {MONTHLY_TERMS.map((t, i) => (
              <th key={t.key} scope="col" className={cn("px-2 pt-1 pb-3 text-center whitespace-nowrap", i === 0 && "border-l border-ink-line")}>
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-line border-t border-ink-line">
          {rows.map((row) => {
            const target = bookTarget(row);
            const saving = twoHourSaving(row);
            return (
              <tr key={row.key} id={`price-${row.key.replace(/[^a-z0-9-]/g, "-")}`}>
                <th scope="row" className="px-6 py-5 font-normal">
                  <RowLabel row={row} />
                </th>
                <td className="border-l border-ink-line px-4 py-5 text-center">
                  <span className="tabular text-xl font-bold">{formatMoney(row.price1h)}</span>
                </td>
                <td className="px-4 py-5 text-center">
                  <span className="tabular block text-xl font-bold">{formatMoney(row.price2h)}</span>
                  {saving > 0 ? <span className="mt-1 block text-[0.7rem] font-bold text-neon">Save {formatMoney(saving)}</span> : null}
                </td>
                {MONTHLY_TERMS.map((t, i) => (
                  <td key={t.key} className={cn("px-4 py-5 text-center", i === 0 && "border-l border-ink-line")}>
                    <span className="tabular text-[1.05rem] font-semibold text-white/90">{price(row.monthly[t.key])}</span>
                  </td>
                ))}
                <td className="border-l border-ink-line px-4 py-5 text-center">
                  {target ? (
                    <BookLink {...target} className={buttonClass({ variant: "light", size: "sm" })} aria-label={`Book ${rowName(row)}`}>
                      Book <ArrowRight aria-hidden className="size-3.5" />
                    </BookLink>
                  ) : (
                    <span className="text-xs text-ink-subtle">Unavailable</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Phones and tablets: one card per rate-card row. */
function PricingCards({ rows }: { rows: TariffRow[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:hidden">
      {rows.map((row) => {
        const target = bookTarget(row);
        const saving = twoHourSaving(row);
        return (
          <li key={row.key} className="flex flex-col rounded-[var(--radius-card)] border border-ink-line bg-ink-3">
            <div className="border-b border-ink-line p-5">
              <RowLabel row={row} />
            </div>
            <dl className="grid grid-cols-2 divide-x divide-ink-line border-b border-ink-line">
              {HOURLY_TERMS.map((t) => (
                <div key={t.key} className="px-5 py-4">
                  <dt className="eyebrow text-[0.66rem] text-ink-subtle">{t.label}</dt>
                  <dd className="tabular mt-1 text-2xl font-bold">{formatMoney(row[t.key])}</dd>
                  {t.key === "price2h" && saving > 0 ? <dd className="mt-0.5 text-xs font-bold text-neon">Save {formatMoney(saving)}</dd> : null}
                </div>
              ))}
            </dl>
            <div className="px-5 pt-4 pb-5">
              <p className="eyebrow text-[0.66rem] text-ink-subtle">Monthly · Mon – Sat</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2">
                {MONTHLY_TERMS.map((t) => (
                  <div key={t.key} className="flex items-baseline justify-between gap-2 border-b border-ink-line pb-2">
                    <dt className="text-sm text-ink-muted">{t.label}</dt>
                    <dd className="tabular text-[0.98rem] font-bold">{price(row.monthly[t.key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2.5 px-5 pb-5">
              <a href={enquiryHref(`Monthly rental enquiry: ${rowName(row)}`)} className={buttonClass({ variant: "ghostLight", size: "md" })}>
                Enquire
              </a>
              {target ? (
                <BookLink {...target} className={buttonClass({ variant: "light", size: "md" })} aria-label={`Book ${rowName(row)} by the hour`}>
                  Book hourly <ArrowRight aria-hidden className="size-4" />
                </BookLink>
              ) : (
                <span className={buttonClass({ variant: "ghostLight", size: "md" }, "pointer-events-none opacity-50")}>Unavailable</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function RentalPricing({ courts }: { courts: PublicCourt[] }) {
  const rows = tariffRows(courts);
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 border-t border-ink-line bg-ink py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="pricing-title"
          eyebrow="Court rentals"
          title={
            <>
              Rental rates
              <br />& plans.
            </>
          }
          intro="Book a court by the hour online, or take a monthly plan for a regular slot. The same price applies at every time of day."
        />

        <div className="mt-12">
          {rows.length ? (
            <>
              <PricingTable rows={rows} />
              <PricingCards rows={rows} />
            </>
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-ink-line p-8 text-center text-ink-muted">Prices will be published soon.</p>
          )}
        </div>
        <p className="mt-4 text-xs text-ink-subtle">All prices in Indian rupees. The two-hour price is a package price for two consecutive hours.</p>

        {/* Hourly or monthly: what to do next. */}
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-ink-line bg-ink-line md:grid-cols-2">
          <div className="flex flex-col items-start bg-ink-2 p-6 sm:p-8">
            <p className="eyebrow text-neon">Hourly rental</p>
            <h3 className="display mt-3 text-[2rem]">Book online in minutes</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
              Choose a sport, court, date and a one- or two-hour slot, and pay securely with Razorpay. Your court is confirmed as soon as the payment is verified.
            </p>
            <a href="#book" className={buttonClass({ variant: "primary", size: "lg" }, "mt-6")}>
              Book a court <ArrowRight aria-hidden className="size-4" />
            </a>
          </div>
          <div className="flex flex-col items-start bg-ink-2 p-6 sm:p-8">
            <p className="eyebrow text-neon">Monthly rental plans</p>
            <h3 className="display mt-3 text-[2rem]">1, 3, 6 or 12 months</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted">
              Regular slot, regular game. Monthly plans are valid Monday to Saturday and are arranged directly with the academy — get in touch to set one up.
            </p>
            <a href={enquiryHref("Monthly court rental enquiry")} className={buttonClass({ variant: "ghostLight", size: "lg" }, "mt-6 h-auto min-h-13 py-3 text-center whitespace-normal")}>
              Enquire about monthly plans
            </a>
          </div>
        </div>

        {/* Important notes from the rate card. */}
        <div className="mt-12">
          <h3 className="eyebrow text-ink-subtle">Important notes</h3>
          <ul className="mt-4 grid gap-x-8 gap-y-3 border-t border-ink-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {RENTAL_NOTES.map((note, i) => (
              <li key={note.text} className="flex gap-3 text-sm leading-relaxed">
                <span aria-hidden className="tabular font-semibold text-neon">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {"href" in note ? (
                  <Link href={note.href} className="underline decoration-ink-line-strong underline-offset-4 transition-colors hover:decoration-neon">
                    {note.text}
                  </Link>
                ) : (
                  <span>{note.text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
