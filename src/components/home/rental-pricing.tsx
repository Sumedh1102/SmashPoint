import { ArrowRight, CalendarCheck2, CalendarDays, Clock3, FileText, Info, Layers, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { BookLink } from "@/components/booking/selection-context";
import { SportIcon } from "@/components/booking/sport-icon";
import { buttonClass } from "@/components/ui/button";
import { mailHref, site, telHref } from "@/content/site";
import { PICKLEBALL_NOTICE } from "@/content/sports";
import { twoHourSaving } from "@/lib/booking/engine";
import { formatMoney } from "@/lib/format";
import { HOURLY_TERMS, MONTHLY_TERMS, tariffRows, type TariffRow } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { PublicCourt } from "@/server/queries/public";
import { SectionHeading } from "./section-heading";

/** The rate card's "Important notes", word for word. */
export const RENTAL_NOTES = [
  { icon: CalendarDays, text: "Monthly rentals are valid from Monday to Saturday." },
  { icon: Clock3, text: "Timings and availability are subject to change." },
  { icon: CalendarCheck2, text: "Advance booking is recommended." },
  { icon: FileText, text: "Terms and conditions apply.", href: "/terms" },
] as const;

/** Where "Enquire" goes: email (with a subject) or phone once they are set, else the contact section. */
export function enquiryHref(subject: string) {
  return mailHref(site.contact.email, subject) ?? telHref(site.contact.phone) ?? "/#contact";
}

const price = (v: number | null) => (v === null ? "—" : formatMoney(v));

function RowLabel({ row, compact = false }: { row: TariffRow; compact?: boolean }) {
  return (
    <span className="flex items-start gap-3">
      <span className={cn("grid shrink-0 place-items-center rounded-full bg-ink text-gold", compact ? "size-10" : "size-11")}>
        <SportIcon sport={row.sportSlug} className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="display block text-[1.45rem] leading-none text-ink">{row.sportName}</span>
        {row.courtLabel || row.surface ? (
          <span className="mt-1.5 block text-sm font-semibold text-ink">
            {[row.courtLabel, row.surface].filter(Boolean).join(" – ")}
          </span>
        ) : null}
        {row.sportSlug === "pickleball" ? <span className="mt-1 block text-xs font-medium text-gold-700">Paddle included · ball purchased separately</span> : null}
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
    <div className="hidden overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-md lg:block">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Court rental prices in Indian rupees: hourly rental (1 or 2 hours) and monthly rental plans (Monday to Saturday)</caption>
        <colgroup>
          <col className="w-[28%]" />
          <col span={2} className="bg-royal-50/60" />
          <col span={4} />
          <col className="w-[9.5rem]" />
        </colgroup>
        <thead>
          <tr className="bg-ink text-white">
            <th scope="col" rowSpan={2} className="px-6 py-4 align-bottom text-xs font-bold tracking-[0.16em] uppercase">
              Sport / court
            </th>
            <th scope="colgroup" colSpan={2} className="border-l border-white/10 px-4 pt-4 pb-2 text-center">
              <span className="eyebrow text-gold">Hourly rental</span>
              <span className="block text-[0.7rem] font-normal text-white/60">Book online</span>
            </th>
            <th scope="colgroup" colSpan={4} className="border-l border-white/10 px-4 pt-4 pb-2 text-center">
              <span className="eyebrow text-gold">Monthly rental</span>
              <span className="block text-[0.7rem] font-normal text-white/60">Monday – Saturday · enquire</span>
            </th>
            <th scope="col" rowSpan={2} className="border-l border-white/10 px-4">
              <span className="sr-only">Book</span>
            </th>
          </tr>
          <tr className="bg-ink-2 text-[0.72rem] font-bold tracking-[0.12em] text-white/85 uppercase">
            {HOURLY_TERMS.map((t, i) => (
              <th key={t.key} scope="col" className={cn("px-4 py-3 text-center", i === 0 && "border-l border-white/10")}>
                {t.label}
              </th>
            ))}
            {MONTHLY_TERMS.map((t, i) => (
              <th key={t.key} scope="col" className={cn("px-4 py-3 text-center", i === 0 && "border-l border-white/10")}>
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const target = bookTarget(row);
            const saving = twoHourSaving(row);
            return (
              <tr key={row.key} id={`price-${row.key.replace(/[^a-z0-9-]/g, "-")}`} className="transition-colors hover:bg-paper/70">
                <th scope="row" className="px-6 py-5 font-normal">
                  <RowLabel row={row} />
                </th>
                <td className="border-l border-line px-4 py-5 text-center">
                  <span className="tabular text-xl font-bold text-ink">{formatMoney(row.price1h)}</span>
                </td>
                <td className="px-4 py-5 text-center">
                  <span className="tabular block text-xl font-bold text-ink">{formatMoney(row.price2h)}</span>
                  {saving > 0 ? <span className="mt-1 inline-block rounded-full bg-success-soft px-2 py-0.5 text-[0.68rem] font-bold text-success">Save {formatMoney(saving)}</span> : null}
                </td>
                {MONTHLY_TERMS.map((t, i) => (
                  <td key={t.key} className={cn("px-4 py-5 text-center", i === 0 && "border-l border-line")}>
                    <span className="tabular text-[1.05rem] font-semibold text-ink">{price(row.monthly[t.key])}</span>
                  </td>
                ))}
                <td className="border-l border-line px-4 py-5 text-center">
                  {target ? (
                    <BookLink {...target} className={buttonClass({ variant: "dark", size: "sm" })} aria-label={`Book ${row.sportName}${row.courtLabel ? ` ${row.courtLabel}` : ""}`}>
                      Book <ArrowRight aria-hidden className="size-3.5" />
                    </BookLink>
                  ) : (
                    <span className="text-xs text-muted">Unavailable</span>
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

/** Phones and tablets: one readable card per rate-card row. */
function PricingCards({ rows }: { rows: TariffRow[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:hidden">
      {rows.map((row) => {
        const target = bookTarget(row);
        const saving = twoHourSaving(row);
        return (
          <li key={row.key} className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-sm">
            <div className="border-b border-line p-5">
              <RowLabel row={row} compact />
            </div>
            <div className="bg-royal-50/60 p-5">
              <p className="eyebrow text-royal-700">Hourly rental</p>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 ring-1 ring-line">
                  <dt className="text-xs font-semibold text-muted">1 Hour</dt>
                  <dd className="tabular mt-0.5 text-2xl font-bold text-ink">{formatMoney(row.price1h)}</dd>
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-line">
                  <dt className="text-xs font-semibold text-muted">2 Hours</dt>
                  <dd className="tabular mt-0.5 text-2xl font-bold text-ink">{formatMoney(row.price2h)}</dd>
                  {saving > 0 ? <dd className="mt-1 text-[0.7rem] font-bold text-success">Save {formatMoney(saving)}</dd> : null}
                </div>
              </dl>
            </div>
            <div className="p-5">
              <p className="eyebrow text-gold-700">Monthly rental · Mon – Sat</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
                {MONTHLY_TERMS.map((t) => (
                  <div key={t.key} className="flex items-baseline justify-between gap-2 border-b border-dashed border-line pb-2">
                    <dt className="text-sm text-muted">{t.label}</dt>
                    <dd className="tabular text-[0.98rem] font-bold text-ink">{price(row.monthly[t.key])}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2.5 px-5 pb-5">
              <a href={enquiryHref(`Monthly rental enquiry: ${row.sportName}${row.courtLabel ? ` ${row.courtLabel}` : ""}`)} className={buttonClass({ variant: "outline", size: "md" })}>
                Enquire
              </a>
              {target ? (
                <BookLink {...target} className={buttonClass({ variant: "dark", size: "md" })} aria-label={`Book ${row.sportName}${row.courtLabel ? ` ${row.courtLabel}` : ""} by the hour`}>
                  Book hourly <ArrowRight aria-hidden className="size-4" />
                </BookLink>
              ) : (
                <span className={buttonClass({ variant: "outline", size: "md" }, "pointer-events-none opacity-50")}>Unavailable</span>
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
  const hasPickleball = rows.some((r) => r.sportSlug === "pickleball");
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-16 bg-paper py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="pricing-title"
          eyebrow="Court rentals"
          title={
            <>
              Court rental
              <br />
              <span className="text-royal">&amp; pricing</span>
            </>
          }
          intro="Flexible court rental options for every player. Choose hourly bookings or long-term rental plans."
        />

        {hasPickleball ? (
          <p data-reveal className="mt-10 flex items-start gap-3 rounded-2xl border border-gold/50 bg-gold-50 px-5 py-4 text-ink sm:items-center">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold text-ink">
              <SportIcon sport="pickleball" className="size-5" />
            </span>
            <span>
              <span className="font-bold">Pickleball: </span>
              {PICKLEBALL_NOTICE}
            </span>
          </p>
        ) : null}

        <div className="mt-6">
          {rows.length ? (
            <>
              <PricingTable rows={rows} />
              <PricingCards rows={rows} />
            </>
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-8 text-center text-muted">Prices will be published soon.</p>
          )}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-subtle">
          <Layers aria-hidden className="size-3.5" />
          All prices in Indian rupees. The two-hour price is a package price for two consecutive hours. The same hourly price applies at every time of day.
        </p>

        {/* Hourly vs monthly: what to do next. */}
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div data-reveal className="surface-dark relative overflow-hidden rounded-[1.25rem] bg-ink p-7 text-white sm:p-8">
            <span aria-hidden className="court-lines absolute inset-0 opacity-60" />
            <div className="relative">
              <p className="eyebrow text-gold">Hourly rental</p>
              <h3 className="display mt-3 text-[2rem]">Book online in minutes</h3>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75">
                Choose a sport, court, date and one- or two-hour slot, and pay securely with Razorpay. Your court is confirmed as soon as the payment is verified.
              </p>
              <a href="#book" className={buttonClass({ variant: "primary", size: "lg" }, "mt-6 h-auto min-h-13 py-3 text-center whitespace-normal uppercase tracking-wide")}>
                Book a court <ArrowRight aria-hidden className="size-4" />
              </a>
            </div>
          </div>
          <div data-reveal style={{ ["--reveal-delay" as string]: "90ms" }} className="rounded-[1.25rem] border border-line bg-white p-7 sm:p-8">
            <p className="eyebrow text-gold-700">Monthly rental plans</p>
            <h3 className="display mt-3 text-[2rem]">1, 3, 6 or 12 months</h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
              Regular slot, regular game. Monthly plans are valid Monday to Saturday and are arranged directly with the academy — get in touch to set one up.
            </p>
            <a href={enquiryHref("Monthly court rental enquiry")} className={buttonClass({ variant: "dark", size: "lg" }, "mt-6 h-auto min-h-13 py-3 text-center whitespace-normal uppercase tracking-wide")}>
              <MessageSquareText aria-hidden className="size-4" /> Enquire about monthly plans
            </a>
          </div>
        </div>

        {/* Important notes from the rate card. */}
        <div className="mt-12 rounded-[1.25rem] border border-line bg-white p-6 sm:p-8">
          <h3 className="flex items-center gap-3 font-display text-lg font-extrabold tracking-[0.12em] text-ink uppercase">
            <Info aria-hidden className="size-5 text-gold-700" /> Important notes
          </h3>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-line">
            {RENTAL_NOTES.map(({ icon: Icon, text, ...rest }) => (
              <li key={text} className="flex items-start gap-3.5 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-gold">
                  <Icon aria-hidden className="size-5" strokeWidth={1.9} />
                </span>
                <span className="pt-1 text-sm leading-relaxed font-medium text-ink">
                  {"href" in rest ? (
                    <Link href={rest.href} className="underline decoration-gold decoration-2 underline-offset-4 hover:text-royal">
                      {text}
                    </Link>
                  ) : (
                    text
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
