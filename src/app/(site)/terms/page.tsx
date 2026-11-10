import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Terms & conditions", description: `Terms for booking courts at ${site.name}.` };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & conditions" updated="10 November 2026">
      <section>
        <h2>About these terms</h2>
        <p>
          These terms apply to court bookings made on this website, operated by {site.legalName} (&ldquo;{site.name}&rdquo;). By making a booking you agree to them and to our{" "}
          <a href="/cancellation-policy" className="underline underline-offset-2">payments, cancellations &amp; refunds policy</a>.
        </p>
      </section>
      <section>
        <h2>Bookings</h2>
        <ul>
          <li>Courts can be booked online for one or two hours, starting on the hour, within the online booking hours shown on the booking page.</li>
          <li>The price of a booking is the court&apos;s published one-hour or two-hour rental price, shown before you pay. The two-hour price is a package price for two consecutive hours.</li>
          <li>Pickleball rentals include paddles. Balls need to be purchased separately.</li>
          <li>Monthly rental plans (1, 3, 6 or 12 months) are valid Monday to Saturday and are arranged directly with the academy; they are not sold through online checkout.</li>
          <li>Timings and availability are subject to change. Advance booking is recommended.</li>
          <li>A booking reserves one court for the booked time only. Please arrive on time; the court must be vacated at the end of your slot.</li>
          <li>A booking is confirmed only once payment has been verified. Bring your booking reference.</li>
        </ul>
      </section>
      <section>
        <h2>Using the facility</h2>
        <ul>
          <li>[Add your facility rules — e.g. footwear, equipment, number of players per court, conduct.]</li>
          <li>[Add your liability, safety and damage terms.]</li>
        </ul>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>We may update these terms; the version on this page applies to bookings made after it is published. [Add governing law and jurisdiction.]</p>
      </section>
    </LegalPage>
  );
}
