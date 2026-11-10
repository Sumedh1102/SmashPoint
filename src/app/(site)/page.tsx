import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { AboutSection } from "@/components/home/about-section";
import { ContactSection } from "@/components/home/contact-section";
import { CourtListing } from "@/components/home/court-listing";
import { RentalPricing } from "@/components/home/rental-pricing";
import { SectionHeading } from "@/components/home/section-heading";
import { SportsHero } from "@/components/home/sports-hero";
import { SportsOverview } from "@/components/home/sports-overview";
import { isPlaceholder, site } from "@/content/site";
import { SPORT_SLUGS } from "@/lib/booking/rules";
import { courtDisplayName, lowestHourlyBySport, tariffRows } from "@/lib/pricing";
import { getHomeData } from "@/server/queries/public";

// Live availability on every request.
export const dynamic = "force-dynamic";

// Only the canonical URL here: an `openGraph` key would replace (not extend) the root layout's
// Open Graph metadata, including the share image.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** schema.org description of the academy with its hourly court-rental offers (from the live rate card). */
function structuredData(data: Awaited<ReturnType<typeof getHomeData>>) {
  const rupees = (paise: number) => (paise / 100).toFixed(2);
  const offers = tariffRows(data.courts).flatMap((row) => {
    const what = row.courtLabel || row.surface ? `${row.sportName} ${[row.courtLabel, row.surface].filter(Boolean).join(" – ")}` : row.sportName;
    return [
      { "@type": "Offer", name: `${what} court rental — 1 hour`, price: rupees(row.price1h), priceCurrency: "INR", category: "Hourly court rental" },
      { "@type": "Offer", name: `${what} court rental — 2 hours`, price: rupees(row.price2h), priceCurrency: "INR", category: "Hourly court rental" },
    ];
  });
  const address = site.contact.addressLines.filter((l) => !isPlaceholder(l));
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: site.name,
    slogan: site.motto,
    description: site.description,
    url: site.url,
    image: `${site.url}/opengraph-image.jpg`,
    sport: ["Badminton", "Pickleball", "Basketball"],
    ...(isPlaceholder(site.contact.phone) ? {} : { telephone: site.contact.phone }),
    ...(isPlaceholder(site.contact.email) ? {} : { email: site.contact.email }),
    ...(address.length ? { address: { "@type": "PostalAddress", streetAddress: address.join(", "), addressCountry: "IN" } } : {}),
    amenityFeature: data.courts.map((c) => ({ "@type": "LocationFeatureSpecification", name: courtDisplayName(c), value: true })),
    makesOffer: offers,
  };
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { court, sport } = await searchParams;
  const data = await getHomeData();
  const initialCourt = typeof court === "string" ? court : null;
  const initialSport = typeof sport === "string" && (SPORT_SLUGS as readonly string[]).includes(sport) ? sport : null;
  const jsonLd = JSON.stringify(structuredData(data)).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SportsHero fromPrices={lowestHourlyBySport(data.courts)} hours={data.hours} />
      <SportsOverview courts={data.courts} />

      <section id="courts" aria-labelledby="courts-title" className="scroll-mt-16 bg-ink-2 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="courts-title"
            eyebrow="The courts"
            title="Pick your court."
            intro="Availability below is live — straight from the booking system. Choose a court to start booking."
          />
          <div className="mt-10">
            <CourtListing courts={data.courts} today={data.window.today} />
          </div>
          <p className="mt-6 text-xs text-ink-subtle">Court images are illustrative 3D renders.</p>
        </div>
      </section>

      <RentalPricing courts={data.courts} />
      <AboutSection />

      <section id="book" aria-labelledby="book-title" className="scroll-mt-16 bg-ink-2 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="book-title"
            eyebrow="Book a court"
            title="Find your slot."
            intro="Choose a sport, court, date and time. You'll pay securely with Razorpay, and your court is confirmed the moment the payment is verified."
            className="mb-12"
          />
          <BookingWizard
            courts={data.courts}
            today={data.window.today}
            lastDate={data.window.lastDate}
            holdMinutes={data.holdMinutes}
            hours={data.hours}
            paymentsEnabled={data.paymentsEnabled}
            initialCourtSlug={initialCourt}
            initialSportSlug={initialSport}
          />
        </div>
      </section>

      <ContactSection hours={data.hours} />
    </>
  );
}
