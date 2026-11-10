import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { site } from "@/content/site";

export const metadata: Metadata = { title: "Payments, cancellations & refunds", description: `How payments, cancellations and refunds work for court bookings at ${site.name}.` };

export default function CancellationPolicyPage() {
  return (
    <LegalPage title="Payments, cancellations & refunds" updated="10 November 2026">
      <section>
        <h2>Paying for a booking</h2>
        <ul>
          <li>Court bookings are paid online in Indian rupees through Razorpay. The price shown before you pay is the total charged.</li>
          <li>When you continue to payment, your slot is held for you for a few minutes (shown during checkout). If the payment isn&apos;t completed in that time, the slot is released.</li>
          <li>A booking is confirmed only after Razorpay&apos;s payment has been verified by our system. You&apos;ll see a confirmation page with your booking reference and receive a confirmation email.</li>
          <li>If money is debited but the booking can&apos;t be confirmed (for example, the payment arrived after the hold ran out and the slot had been taken), the full amount is refunded automatically.</li>
        </ul>
      </section>
      <section>
        <h2>Cancelling a booking</h2>
        <ul>
          <li>[Describe your cancellation terms here — for example, how many hours before the start time a customer may cancel and how much is refunded.]</li>
          <li>To request a cancellation, contact {site.name} with your booking reference (it starts with SP-).</li>
          <li>If {site.name} has to cancel your booking (for example for maintenance or an emergency closure), you receive a full refund.</li>
        </ul>
      </section>
      <section>
        <h2>Refunds</h2>
        <ul>
          <li>Refunds are made to the original payment method through Razorpay.</li>
          <li>Once issued, refunds usually reach your account within 5–7 working days, depending on your bank.</li>
          <li>Your booking page shows the refund&apos;s status and Razorpay reference.</li>
        </ul>
      </section>
      <section>
        <h2>Monthly rental plans</h2>
        <p>Monthly plans are arranged directly with the academy, so their payment and cancellation terms are agreed when the plan is set up. [Add the academy&apos;s monthly plan terms here.]</p>
      </section>
    </LegalPage>
  );
}
