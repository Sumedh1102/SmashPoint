"use client";

import { useState } from "react";
import { Building2, CreditCard, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const METHODS = [
  { id: "upi", label: "UPI", icon: Smartphone, hint: "smashpoint@okaxis · any UPI app" },
  { id: "card", label: "Card", icon: CreditCard, hint: "4111 1111 1111 1111 · 12/30 · 123" },
  { id: "netbanking", label: "Netbanking", icon: Building2, hint: "All major Indian banks" },
] as const;

export function MockCheckout({ paymentId, amountLabel }: { paymentId: string; amountLabel: string }) {
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("upi");
  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const toast = useToast();

  async function complete(outcome: "success" | "failure") {
    setBusy(outcome);
    const res = await fetch("/api/payments/mock/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, outcome }),
    });
    const data = await res.json();
    if (res.ok && data.redirect) {
      if (outcome === "success") toast.success("Payment successful", "Confirming your booking…");
      window.location.assign(data.redirect);
    } else {
      toast.error("Payment error", data.error ?? "Please try again");
      setBusy(null);
    }
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={method === m.id}
            onClick={() => setMethod(m.id)}
            className={cn("flex flex-col items-center gap-1 rounded-xl border border-line py-3 text-sm font-medium transition", method === m.id ? "bg-ink text-white" : "bg-white hover:bg-paper")}
          >
            <m.icon className="size-5" />
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-paper px-3 py-2 font-mono text-xs font-medium text-muted">
        Test details: {METHODS.find((m) => m.id === method)!.hint}
      </p>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => complete("success")}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl border border-line bg-success font-display text-lg font-semibold text-white shadow-xs transition hover:shadow-sm disabled:opacity-60"
      >
        {busy === "success" ? <LoaderCircle className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
        Pay {amountLabel}
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => complete("failure")}
        className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
      >
        {busy === "failure" ? "Declining…" : "Simulate a failed payment"}
      </button>
    </div>
  );
}
