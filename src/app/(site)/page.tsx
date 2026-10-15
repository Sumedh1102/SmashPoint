import { BookingWizard } from "@/components/booking/booking-wizard";
import { BookingSelectionProvider } from "@/components/booking/selection-context";
import { ContactSection } from "@/components/home/contact-section";
import { CourtListing } from "@/components/home/court-listing";
import { FacilityHighlights } from "@/components/home/facility-highlights";
import { SportsHero } from "@/components/home/sports-hero";
import { site } from "@/content/site";
import { getHomeData } from "@/server/queries/public";

// Live availability on every request.
export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { court } = await searchParams;
  const data = await getHomeData();
  const initialCourt = typeof court === "string" ? court : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: site.name,
    description: site.description,
    url: site.url,
    openingHours: "Mo-Su 07:00-22:00",
  };

  return (
    <BookingSelectionProvider>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SportsHero />

      <section id="courts" aria-labelledby="courts-title" className="bg-paper py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div data-reveal>
              <p className="eyebrow text-court">The courts</p>
              <h2 id="courts-title" className="display mt-4 text-[clamp(2.8rem,7vw,5.5rem)]">
                Pick your court.
              </h2>
            </div>
            <p data-reveal className="max-w-md text-muted lg:text-right">
              Two badminton, two pickleball and one basketball court. Availability below is live — straight from the booking system.
            </p>
          </div>
          <div className="mt-10">
            <CourtListing courts={data.courts} today={data.window.today} />
          </div>
          <p className="mt-6 text-xs text-subtle">Court images are illustrative 3D renders.</p>
        </div>
      </section>

      <FacilityHighlights />

      <section id="book" aria-labelledby="book-title" className="scroll-mt-16 bg-paper py-24 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div data-reveal>
              <p className="eyebrow text-court">Book a court</p>
              <h2 id="book-title" className="display mt-4 text-[clamp(2.8rem,7vw,5.5rem)]">
                Find your slot.
              </h2>
            </div>
            <p data-reveal className="max-w-md text-muted lg:text-right">
              Choose a sport, court, date and time. You&apos;ll pay securely with Razorpay, and your court is confirmed the moment the payment is verified.
            </p>
          </div>
          <BookingWizard
            courts={data.courts}
            today={data.window.today}
            lastDate={data.window.lastDate}
            holdMinutes={data.holdMinutes}
            paymentsEnabled={data.paymentsEnabled}
            initialCourtSlug={initialCourt}
          />
        </div>
      </section>

      <ContactSection />
    </BookingSelectionProvider>
  );
}
