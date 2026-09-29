import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { MockCheckout } from "@/components/payments/mock-checkout";
import { formatMoney } from "@/lib/format";
import { db } from "@/server/db";
import { payments } from "@/server/db/schema";
import { paymentReturnUrl } from "@/server/payments/service";
import { site } from "@/content/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Secure checkout", robots: { index: false, follow: false } };

const PURPOSE_LABEL = { BOOKING: "Court booking", MEMBERSHIP: "Membership", EVENT: "Event registration", BATCH_FEE: "Batch fee", OTHER: "Payment" } as const;

export default async function MockCheckoutPage({ params }: PageProps<"/checkout/mock/[paymentId]">) {
  const { paymentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) notFound();
  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!payment || payment.provider !== "mock") notFound();
  if (payment.status !== "INITIATED") redirect(await paymentReturnUrl(payment, payment.status === "PAID" ? "success" : "failed"));

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink/5 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-3 text-center font-mono text-xs font-medium uppercase tracking-widest text-muted">
          <LockKeyhole className="mr-1 inline size-3.5" /> SmashPay sandbox · no real money moves
        </p>
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-md">
          <div className="bg-ink px-6 py-5 text-white">
            <p className="text-sm font-medium text-white/70">Paying</p>
            <p className="font-display text-xl font-semibold">{site.name}</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/60">{PURPOSE_LABEL[payment.purpose]}</p>
                <p className="font-mono text-sm font-medium">{payment.receiptNumber}</p>
              </div>
              <p className="font-display text-4xl font-semibold">{formatMoney(payment.amount)}</p>
            </div>
          </div>
          <div className="p-6">
            <p className="mb-4 text-sm font-semibold text-muted">
              {payment.payerName} · {payment.payerEmail ?? payment.payerPhone}
            </p>
            <MockCheckout paymentId={payment.id} amountLabel={formatMoney(payment.amount)} />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Set PAYMENT_PROVIDER=razorpay to use a live gateway. This page is disabled automatically.</p>
      </div>
    </main>
  );
}
