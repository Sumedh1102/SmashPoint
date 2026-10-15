import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Privacy policy", description: `How ${site.name} handles personal information from court bookings.` };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="15 October 2026">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>When you book: your name, email address, mobile number, an optional note, and the details of your booking.</li>
          <li>When you pay: Razorpay processes your payment. We receive and store payment references (order and payment IDs), the amount and its status — never your card, UPI or bank details.</li>
          <li>Basic technical logs (such as IP address) to keep the service secure and prevent abuse.</li>
        </ul>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To reserve your court, confirm your booking, send confirmation and reminder emails, and process refunds.</li>
          <li>To contact you about your booking if something changes.</li>
          <li>We don&apos;t sell your information or use it for advertising.</li>
        </ul>
      </section>
      <section>
        <h2>Who we share it with</h2>
        <ul>
          <li>Razorpay, to process payments and refunds (governed by Razorpay&apos;s own privacy policy).</li>
          <li>Our email delivery provider, to send booking emails.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          The public website doesn&apos;t use tracking or advertising cookies. A sign-in cookie is used only for {site.name} administrators. Razorpay Checkout may set its own cookies
          while you pay.
        </p>
      </section>
      <section>
        <h2>Keeping and deleting data</h2>
        <p>[State how long booking and payment records are kept, and how customers can ask for their data to be corrected or deleted.] Contact: {site.contact.email}.</p>
      </section>
    </LegalPage>
  );
}
