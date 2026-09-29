"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, CreditCard, Printer, XCircle } from "lucide-react";
import { runCheckout } from "@/components/payments/checkout";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export function PayNowButton({ code, token, label }: { code: string; token?: string; label: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      size="lg"
      loading={loading}
      icon={<CreditCard className="size-4" />}
      onClick={async () => {
        setLoading(true);
        const res = await fetch(`/api/bookings/${code}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) });
        const data = await res.json();
        if (!res.ok) {
          toast.error("Couldn't start payment", data.error);
          setLoading(false);
          return;
        }
        await runCheckout(data.checkout, {
          onError: (m) => {
            toast.error("Payment not completed", m);
            setLoading(false);
          },
        });
      }}
    >
      {label}
    </Button>
  );
}

export function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const router = useRouter();
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);
  if (left === null) return null;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="font-mono font-medium tabular-nums" aria-live="polite">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function ReceiptToolbar({ icsHref, cancel }: { icsHref: string; cancel?: { code: string; token?: string } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="flex flex-wrap gap-2" data-print-hide>
      <a href={icsHref} className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-white px-4 text-sm font-medium shadow-xs">
        <CalendarPlus className="size-4" /> Add to calendar
      </a>
      <Button variant="outline" icon={<Printer className="size-4" />} onClick={() => window.print()}>
        Print receipt
      </Button>
      {cancel ? (
        <>
          <Button variant="ghost" className="text-danger" icon={<XCircle className="size-4" />} onClick={() => setOpen(true)}>
            Cancel booking
          </Button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="Cancel this booking?"
            description="Paid bookings are refunded in full to the original payment method."
            footer={
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Keep booking
                </Button>
                <Button
                  variant="danger"
                  loading={loading}
                  onClick={async () => {
                    setLoading(true);
                    const res = await fetch(`/api/bookings/${cancel.code}/cancel`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ t: cancel.token }),
                    });
                    const data = await res.json();
                    setLoading(false);
                    if (!res.ok) return toast.error("Couldn't cancel", data.error);
                    setOpen(false);
                    toast.success("Booking cancelled", "Your refund has been initiated.");
                    router.refresh();
                  }}
                >
                  Yes, cancel
                </Button>
              </>
            }
          >
            <p className="text-sm">The slot will be released immediately so someone else can book it.</p>
          </Modal>
        </>
      ) : null}
    </div>
  );
}
