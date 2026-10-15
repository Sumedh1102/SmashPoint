"use client";

/** Server-provided Checkout parameters (see CheckoutParams in server/payments/service.ts). */
export type CheckoutParams = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  timeoutSeconds: number;
};

export type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayFailure = { error?: { description?: string; reason?: string; metadata?: { order_id?: string } } };

type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (r: RazorpayFailure) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

/** Loads Razorpay Standard Checkout once (only when the visitor is about to pay). */
export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.Razorpay ? resolve() : reject(new Error("Razorpay unavailable")));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't load Razorpay Checkout. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout for a server-created order. Exactly one of the callbacks ends the
 * attempt: onSuccess (payment authorised — must still be verified by the server) or onDismiss
 * (window closed without paying). onFailure reports each failed try; Checkout lets the
 * customer retry inside the same window.
 */
export async function openRazorpay(
  params: CheckoutParams,
  handlers: { onSuccess: (r: RazorpaySuccess) => void; onDismiss: () => void; onFailure: (reason: string) => void },
) {
  await loadRazorpay();
  const rzp = new window.Razorpay!({
    key: params.keyId,
    order_id: params.orderId,
    amount: params.amount,
    currency: params.currency,
    name: params.name,
    description: params.description,
    prefill: params.prefill,
    theme: { color: "#1d6a48" },
    timeout: params.timeoutSeconds,
    retry: { enabled: true },
    modal: { ondismiss: handlers.onDismiss, escape: true, confirm_close: true, backdropclose: false },
    handler: handlers.onSuccess,
  });
  rzp.on("payment.failed", (r) => handlers.onFailure(r.error?.description || r.error?.reason || "The payment didn't go through."));
  rzp.open();
}
