import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Terms & conditions", description: `Terms for booking courts at ${site.name}.` };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & conditions" updated="15 October 2026">
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
          <li>Courts can be booked for one or two hours, starting on the hour, between 7:00 AM and 10:00 PM. Every booking ends by 10:00 PM.</li>
          <li>Badminton courts can&apos;t be booked from 5:00 PM to 7:00 PM, when academy sessions use them.</li>
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
