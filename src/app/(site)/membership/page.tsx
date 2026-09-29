import type { Metadata } from "next";
import { BadgePercent, CalendarClock, QrCode, RefreshCw } from "lucide-react";
import { Faq, PlanCard } from "@/components/marketing/cards";
import { Mark, PageHero, Section, SectionHeading } from "@/components/marketing/section";
import { EmptyState } from "@/components/ui/misc";
import { getMembershipPlans } from "@/server/queries/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Membership Plans",
  description: "Monthly, Quarterly, Half-Yearly and Annual badminton academy memberships in Palghar — coaching access, court discounts and member-only benefits.",
  alternates: { canonical: "/membership" },
  openGraph: { title: "Membership Plans · SmashPoint", url: "/membership" },
};

const MEMBERSHIP_FAQ = [
  { q: "When does my membership start?", a: "On the day your payment is confirmed. Renewals made before expiry start the day after your current plan ends — you never lose days." },
  { q: "Can I switch batches?", a: "Yes. Quarterly and longer plans get priority batch transfers; monthly members can switch at the start of a new month, subject to capacity." },
  { q: "How do court discounts work?", a: "Log in before booking a court and the member discount is applied automatically at checkout while your membership is active." },
  { q: "What if I miss sessions?", a: "Sessions marked as Leave (informed at least 12 hours before) can be made up in another batch at your level within the same month." },
] as const;

export default async function MembershipPage() {
  const plans = await getMembershipPlans();
  return (
    <>
      <PageHero
        eyebrow="Membership"
        title={
          <>
            One membership. <Mark>Every</Mark> advantage.
          </>
        }
        description="Choose how long you want to commit — longer plans unlock court discounts, coach reviews and tournament perks. Buy or renew online in a minute."
      />
      <Section>
        {plans.length ? (
          <div className="grid gap-6 pt-4 md:grid-cols-2 xl:grid-cols-4">
            {plans.map((p) => (
              <div key={p.id} id={p.slug} className="scroll-mt-28">
                <PlanCard plan={p} ctaHref={`/dashboard/membership?plan=${p.slug}`} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Plans are being updated" />
        )}
        <p className="mt-8 text-center text-sm font-semibold text-muted">Prices include taxes. Sign in or create an account to purchase — parents can buy for their children.</p>
      </Section>

      <Section className="border-y border-line bg-white/70">
        <SectionHeading index="01" eyebrow="Every membership includes" title="The admin handles itself." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: QrCode, title: "QR check-in", body: "Scan in at the desk. Attendance lands in your dashboard instantly." },
            { icon: CalendarClock, title: "Expiry tracking", body: "See start & expiry dates, and get reminders 7 days before renewal." },
            { icon: RefreshCw, title: "One-tap renewal", body: "Renew online; the new term starts right after the current one ends." },
            { icon: BadgePercent, title: "Member pricing", body: "Up to 15% off court bookings and member rates on events." },
          ].map((f) => (
            <div key={f.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
              <span className="grid size-12 place-items-center rounded-xl border border-line bg-brand text-white">
                <f.icon className="size-6" />
              </span>
              <h3 className="mt-4 text-xl font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <SectionHeading index="02" eyebrow="Membership FAQ" title="Good to know." className="mb-0" />
          <Faq items={MEMBERSHIP_FAQ} />
        </div>
      </Section>
    </>
  );
}
