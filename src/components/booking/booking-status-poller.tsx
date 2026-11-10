"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/button";

/**
 * While a payment is still settling (the browser callback hasn't confirmed it yet, or we're
 * waiting for Razorpay's webhook), poll the booking's status and refresh the page when it
 * changes. Stops after ~3 minutes.
 */
export function BookingStatusPoller({ code, token, status }: { code: string; token: string; status: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  const tries = useRef(0);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      tries.current++;
      try {
        const res = await fetch(`/api/bookings/${code}?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = (await res.json()) as { status?: string };
        if (data.status && data.status !== status) {
          router.refresh();
          return;
        }
      } catch {
        // network blip — keep trying
      }
      if (tries.current >= 60) setGaveUp(true);
      else setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 2000);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [code, token, status, router]);

  return gaveUp ? (
    <p className="text-sm text-ink-muted">Still waiting for Razorpay. Refresh this page in a few minutes — or contact us with your booking reference.</p>
  ) : (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
      <Spinner className="text-neon" /> Checking for your payment confirmation…
    </p>
  );
}
