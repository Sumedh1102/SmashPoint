"use client";

import { AlertTriangle, ArrowLeft, Check, Clock3, Info, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Alert, Field, Input, Textarea } from "@/components/ui/field";
import { Button, Spinner } from "@/components/ui/button";
import { PICKLEBALL_NOTICE } from "@/content/sports";
import { formatDate, formatDuration, formatMinutes, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api, ApiError } from "./api";
import { openRazorpay, type CheckoutParams, type RazorpaySuccess } from "./razorpay-checkout";

export type CheckoutSelection = {
  courtId: string;
  courtName: string;
  courtSurface: string | null;
  sportName: string;
  sportSlug: string;
  date: string;
  startMinute: number;
  duration: number;
  /** Rate-card price shown in the wizard; the server computes the amount actually charged. */
  price: number;
};

type Session = { code: string; token: string; receiptUrl: string; amount: number; holdExpiresAt: string | null; checkout: CheckoutParams };
type Step = "details" | "review" | "verifying" | "notPaid" | "expired" | "error";
type Customer = { name: string; email: string; phone: string; notes: string };
type Errors = Partial<Record<keyof Customer, string>>;

/** Steps 6–8 of the booking flow (1–5 are on the page; 9 is the confirmation page). */
const STEPS = [
  { key: "details", label: "Your details" },
  { key: "review", label: "Summary" },
  { key: "pay", label: "Pay" },
] as const;

/** Client-side checks for instant feedback; the server validates everything again. */
function validate(c: Customer): Errors {
  const errors: Errors = {};
  if (c.name.trim().replace(/\s+/g, " ").length < 2) errors.name = "Enter your full name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim())) errors.email = "Enter a valid email address.";
  if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(c.phone.replace(/[\s()-]/g, ""))) errors.phone = "Enter a valid 10-digit Indian mobile number.";
  if (c.notes.length > 300) errors.notes = "Keep notes under 300 characters.";
  return errors;
}

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
}

function SummaryRows({ s, amount }: { s: CheckoutSelection; amount: number }) {
  const rows: [string, string][] = [
    ["Sport", s.sportName],
    ["Court", s.courtName],
    ...(s.courtSurface ? ([["Surface", s.courtSurface]] as [string, string][]) : []),
    ["Date", formatDate(s.date, "long")],
    ["Start time", formatMinutes(s.startMinute)],
    ["End time", formatMinutes(s.startMinute + s.duration)],
    ["Duration", formatDuration(s.duration)],
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 px-4 py-2.5">
          <dt className="text-muted">Court rental · {formatDuration(s.duration)}</dt>
          <dd className="tabular text-right font-medium">{formatMoney(amount)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 bg-ink px-4 py-3 text-white">
          <dt className="font-semibold">Total payable</dt>
          <dd className="display tabular text-[1.85rem] leading-none text-gold">{formatMoney(amount)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function CheckoutDialog({
  open,
  selection,
  holdMinutes,
  onClose,
  onSlotUnavailable,
  onReleased,
}: {
  open: boolean;
  selection: CheckoutSelection | null;
  holdMinutes: number;
  onClose: () => void;
  /** The slot was taken or closed meanwhile: refresh availability and clear the selection. */
  onSlotUnavailable: (message: string) => void;
  /** A hold was given up or ran out: refresh availability. */
  onReleased: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [customer, setCustomer] = useState<Customer>({ name: "", email: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; slotLost?: boolean } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [razorpayOpen, setRazorpayOpen] = useState(false);
  const [lastFailure, setLastFailure] = useState<string | null>(null);
  const secondsLeft = useCountdown(session?.holdExpiresAt ?? null);

  // A fresh selection starts a fresh checkout (customer details are kept for convenience).
  useEffect(() => {
    if (!open) return;
    setStep("details");
    setProblem(null);
    setSession(null);
    setLastFailure(null);
    setBusy(false);
  }, [open, selection?.courtId, selection?.date, selection?.startMinute, selection?.duration]);

  useEffect(() => {
    if (secondsLeft === 0 && session && (step === "notPaid" || step === "review")) setStep("expired");
  }, [secondsLeft, session, step]);

  if (!selection) return null;
  const amount = session?.amount ?? selection.price;

  // Resolves once the server has answered, so the slot grid refreshes after the hold is gone.
  const release = (): Promise<unknown> => {
    if (!session) return Promise.resolve();
    return api(`/api/bookings/${session.code}/release?t=${encodeURIComponent(session.token)}`, { method: "POST" }).catch(() => {});
  };

  const close = () => {
    if (busy || step === "verifying") return;
    // Free a held slot the customer walked away from (never after a payment that may have gone through).
    if (session && (step === "notPaid" || step === "review")) {
      void release().then(onReleased);
    }
    if (step === "expired") onReleased();
    onClose();
  };

  const launch = async (params: CheckoutParams, s: Session) => {
    setRazorpayOpen(true);
    try {
      await openRazorpay(params, {
        onSuccess: (r) => {
          setRazorpayOpen(false);
          void verify(r, s);
        },
        onDismiss: () => {
          setRazorpayOpen(false);
          setStep("notPaid");
        },
        onFailure: (reason) => {
          setLastFailure(reason);
          void api("/api/payments/failed", { method: "POST", body: { code: s.code, token: s.token, orderId: params.orderId, reason: reason.slice(0, 300) } }).catch(() => {});
        },
      });
    } catch (err) {
      setRazorpayOpen(false);
      setProblem({ message: err instanceof Error ? err.message : "Couldn't open the payment window." });
      setStep("notPaid");
    }
  };

  const verify = async (r: RazorpaySuccess, s: Session) => {
    setStep("verifying");
    try {
      const result = await api<{ status: string; receiptUrl: string }>("/api/payments/verify", { method: "POST", body: { code: s.code, token: s.token, ...r } });
      router.push(result.receiptUrl);
    } catch (err) {
      setProblem({ message: err instanceof ApiError ? err.message : "We couldn't confirm the payment yet." });
      setStep("error");
    }
  };

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(customer);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`checkout-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setProblem(null);
    setStep("review");
  };

  const pay = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const s = await api<Session>("/api/bookings", {
        method: "POST",
        body: {
          courtId: selection.courtId,
          date: selection.date,
          startMinute: selection.startMinute,
          duration: selection.duration,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes || undefined,
        },
      });
      setSession(s);
      setBusy(false);
      await launch(s.checkout, s);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
          setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, v]) => [k, v?.[0]])) as Errors);
          setStep("details");
          return;
        }
        setProblem({ message: err.message, slotLost: err.status === 409 || err.code === "RULE_VIOLATION" });
      } else {
        setProblem({ message: "Something went wrong. Please try again." });
      }
    }
  };

  const retry = async () => {
    if (!session) return;
    setBusy(true);
    setProblem(null);
    try {
      const { checkout } = await api<{ checkout: CheckoutParams }>(`/api/bookings/${session.code}/checkout?t=${encodeURIComponent(session.token)}`, { method: "POST" });
      setBusy(false);
      await launch(checkout, session);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 410) setStep("expired");
      else setProblem({ message: err instanceof Error ? err.message : "Couldn't reopen the payment window." });
    }
  };

  const chooseAnother = () => {
    void release().then(onReleased);
    onClose();
  };

  const stepIndex = step === "details" ? 0 : step === "review" ? 1 : 2;
  const mmss = secondsLeft !== null ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : null;
  const titles: Record<Step, string> = {
    details: "Your details",
    review: "Review booking",
    verifying: "Confirming payment",
    notPaid: "Payment not completed",
    expired: "Slot released",
    error: "Payment check pending",
  };

  return (
    <Dialog
      open={open && !razorpayOpen}
      onClose={close}
      dismissible={!busy && step !== "verifying"}
      title={titles[step]}
      description={
        <ol className="mt-1 flex items-center gap-2" aria-label="Checkout progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2" aria-current={i === stepIndex ? "step" : undefined}>
              <span className={cn("grid size-6 place-items-center rounded-full text-[0.68rem] font-bold", i < stepIndex ? "bg-royal text-white" : i === stepIndex ? "bg-gold text-ink" : "bg-paper-2 text-subtle")}>
                {i < stepIndex ? <Check className="size-3.5" strokeWidth={3} /> : i + 6}
              </span>
              <span className={cn("text-xs font-semibold", i === stepIndex ? "text-ink" : "text-subtle")}>{s.label}</span>
              {i < STEPS.length - 1 ? <span aria-hidden className="h-px w-5 bg-line-strong" /> : null}
            </li>
          ))}
        </ol>
      }
      footer={
        step === "details" ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {selection.courtName} · {formatMinutes(selection.startMinute)}
            </p>
            <Button type="submit" form="checkout-details" size="lg">
              Review booking
            </Button>
          </div>
        ) : step === "review" ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => setStep("details")} disabled={busy} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-ink">
              <ArrowLeft className="size-4" /> Edit details
            </button>
            {problem?.slotLost ? (
              <Button size="lg" variant="dark" onClick={() => onSlotUnavailable(problem.message)}>
                Choose another time
              </Button>
            ) : (
              <Button size="lg" onClick={pay} disabled={busy} className="w-full sm:w-auto">
                {busy ? <Spinner /> : <Lock className="size-4" />}
                {busy ? "Reserving your slot…" : `Pay ${formatMoney(amount)} securely`}
              </Button>
            )}
          </div>
        ) : step === "notPaid" ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="outline" size="lg" onClick={chooseAnother} disabled={busy}>
              Choose another slot
            </Button>
            <Button size="lg" onClick={retry} disabled={busy}>
              {busy ? <Spinner /> : <RotateCcw className="size-4" />} Try payment again
            </Button>
          </div>
        ) : step === "expired" ? (
          <div className="flex justify-end">
            <Button size="lg" variant="dark" onClick={() => onSlotUnavailable("Your hold ran out, so the slot was released. Please choose a slot again.")}>
              Pick a slot again
            </Button>
          </div>
        ) : step === "error" && session ? (
          <div className="flex justify-end">
            <Link href={session.receiptUrl} className="inline-flex h-13 items-center justify-center rounded-full bg-ink px-7 text-sm font-semibold text-white hover:bg-ink-3">
              View booking status
            </Link>
          </div>
        ) : null
      }
    >
      {step === "details" ? (
        <form id="checkout-details" noValidate onSubmit={submitDetails} className="space-y-4">
          <p className="text-sm text-muted">We only use these to send your confirmation and contact you about this booking. No account needed.</p>
          <Field id="checkout-name" label="Full name" error={errors.name}>
            <Input
              autoFocus
              id="checkout-name"
              name="name"
              autoComplete="name"
              value={customer.name}
              maxLength={120}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "checkout-name-error" : undefined}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
          </Field>
          <Field id="checkout-email" label="Email address" hint="Your confirmation is sent here." error={errors.email}>
            <Input
              id="checkout-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={customer.email}
              maxLength={180}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "checkout-email-error" : "checkout-email-hint"}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            />
          </Field>
          <Field id="checkout-phone" label="Mobile number" error={errors.phone}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[0.95rem] text-muted">
                +91
              </span>
              <Input
                id="checkout-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={customer.phone}
                maxLength={16}
                className="pl-12"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "checkout-phone-error" : undefined}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              />
            </div>
          </Field>
          <Field id="checkout-notes" label="Note for the facility" optional error={errors.notes}>
            <Textarea id="checkout-notes" name="notes" rows={2} maxLength={300} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </Field>
        </form>
      ) : null}

      {step === "review" ? (
        <div className="space-y-4">
          <SummaryRows s={selection} amount={amount} />
          {selection.sportSlug === "pickleball" ? (
            <p className="flex gap-2.5 rounded-xl border border-gold/50 bg-gold-50 px-4 py-3 text-sm font-medium text-ink">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-700" />
              {PICKLEBALL_NOTICE}
            </p>
          ) : null}
          <div className="rounded-xl border border-line bg-white px-4 py-3 text-sm">
            <p className="font-semibold">{customer.name}</p>
            <p className="text-muted">
              {customer.email} · +91 {customer.phone.replace(/[\s()-]/g, "").slice(-10)}
            </p>
          </div>
          {problem ? (
            <Alert tone="danger" title={problem.slotLost ? "This slot is no longer available" : "Couldn't start the payment"}>
              {problem.message}
            </Alert>
          ) : (
            <p className="flex gap-2.5 text-sm text-muted">
              <Clock3 aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                When you continue, the slot is held for you for {holdMinutes} minutes while you pay with Razorpay. It's confirmed only after the payment is verified.
              </span>
            </p>
          )}
          <p className="flex items-center gap-2 text-xs text-subtle">
            <ShieldCheck aria-hidden className="size-4 shrink-0 text-success" />
            Payments are processed securely by Razorpay. We never see your card or bank details.
          </p>
          <p className="text-xs text-subtle">
            By paying you agree to the{" "}
            <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-ink">
              terms
            </Link>{" "}
            and the{" "}
            <Link href="/cancellation-policy" target="_blank" className="underline underline-offset-2 hover:text-ink">
              cancellation &amp; refund policy
            </Link>
            .
          </p>
        </div>
      ) : null}

      {step === "verifying" ? (
        <div role="status" className="flex flex-col items-center gap-4 py-8 text-center">
          <Spinner className="size-8 text-royal" />
          <p className="font-semibold">Verifying your payment with Razorpay…</p>
          <p className="max-w-sm text-sm text-muted">Please keep this page open. Your booking is confirmed only after this check.</p>
        </div>
      ) : null}

      {step === "notPaid" ? (
        <div className="space-y-4">
          <Alert tone="warning" title="Your booking isn't confirmed yet">
            {lastFailure ? `Last attempt: ${lastFailure} ` : "The payment window was closed before the payment completed. "}
            No booking is made unless the payment succeeds.
          </Alert>
          {problem ? <Alert tone="danger">{problem.message}</Alert> : null}
          {mmss ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Clock3 aria-hidden className="size-4" />
              <span>
                Slot held for <span className="tabular font-semibold text-ink">{mmss}</span> more.
              </span>
            </p>
          ) : null}
          <SummaryRows s={selection} amount={amount} />
        </div>
      ) : null}

      {step === "expired" ? (
        <Alert tone="warning" title="The payment window ran out">
          We held the slot for {holdMinutes} minutes and it has now been released. You haven't been charged for a confirmed booking — if money left your account, it's refunded automatically.
        </Alert>
      ) : null}

      {step === "error" ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
            <p className="text-sm">
              {problem?.message} If the payment went through, your booking is confirmed automatically once Razorpay reports it — check its status below. Otherwise you'll be refunded automatically.
            </p>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
