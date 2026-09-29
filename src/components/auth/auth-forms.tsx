"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";

type Status = { tone: "error" | "success" | "info"; text: string } | null;

const FIREBASE_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "That email and password don't match. Please try again.",
  "auth/wrong-password": "That email and password don't match. Please try again.",
  "auth/user-not-found": "That email and password don't match. Please try again.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Please contact the facility.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
  "auth/weak-password": "Choose a stronger password (at least 8 characters with a number).",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups and try again.",
  "auth/account-exists-with-different-credential": "This email already uses a different sign-in method. Use email and password instead.",
};

function messageFor(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  return FIREBASE_ERRORS[code] ?? "Something went wrong. Please try again.";
}

/** Swaps a Firebase ID token for the app session; returns where to go next. */
async function exchange(user: FirebaseUser, extra: { name?: string; phone?: string; next?: string } = {}) {
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, ...extra }),
  });
  const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string; code?: string };
  if (res.ok) return { ok: true as const, redirect: data.redirect ?? "/dashboard" };
  return { ok: false as const, error: data.error ?? "Sign-in failed. Please try again.", code: data.code };
}

function NotConfigured() {
  return (
    <FormMessage tone="info">
      Email and Google sign-in aren&apos;t configured on this deployment yet. Add the Firebase settings to enable them.
    </FormMessage>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.55 10.55 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-subtle">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function useSignIn(next?: string) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  async function finish(user: FirebaseUser, extra: { name?: string; phone?: string } = {}) {
    const result = await exchange(user, { ...extra, next });
    if (result.ok) {
      router.replace(result.redirect);
      router.refresh();
      return;
    }
    if (result.code === "EMAIL_NOT_VERIFIED") {
      try {
        const { sendEmailVerification } = await import("firebase/auth");
        await sendEmailVerification(user);
      } catch {
        // Firebase rate-limits verification mails; the message below still applies.
      }
      setStatus({ tone: "info", text: "Please verify your email first. We've sent a verification link to your inbox — open it, then sign in again." });
    } else {
      setStatus({ tone: "error", text: result.error });
    }
    const auth = await getFirebaseAuth();
    if (auth) await (await import("firebase/auth")).signOut(auth);
  }

  async function google() {
    setStatus(null);
    setPending("google");
    try {
      const auth = await getFirebaseAuth();
      if (!auth) return;
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      await finish(cred.user);
    } catch (err) {
      const text = messageFor(err);
      if (text) setStatus({ tone: "error", text });
    } finally {
      setPending(null);
    }
  }

  return { status, setStatus, pending, setPending, finish, google };
}

export function LoginForm({ next }: { next?: string }) {
  const { status, setStatus, pending, setPending, finish, google } = useSignIn(next);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const errs = { email: /\S+@\S+\.\S+/.test(email) ? undefined : "Enter a valid email address.", password: password ? undefined : "Enter your password." };
    setErrors(errs);
    if (errs.email || errs.password) return;
    setStatus(null);
    setPending("email");
    try {
      const auth = await getFirebaseAuth();
      if (!auth) return;
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await finish(cred.user);
    } catch (err) {
      setStatus({ tone: "error", text: messageFor(err) ?? "Sign-in cancelled." });
    } finally {
      setPending(null);
    }
  }

  if (!isFirebaseConfigured) return <NotConfigured />;

  return (
    <div>
      <Button variant="outline" size="lg" className="w-full" onClick={google} loading={pending === "google"} disabled={!!pending} icon={<GoogleIcon />}>
        Continue with Google
      </Button>
      <Divider />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={!!errors.password} />
        </Field>
        <Link href="/forgot-password" className="-mt-2 justify-self-end text-sm text-muted hover:text-ink">
          Forgot password?
        </Link>
        {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
        <Button type="submit" size="lg" loading={pending === "email"} disabled={!!pending}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-medium text-ink hover:text-brand">
          Create an account
        </Link>
      </p>
    </div>
  );
}

const PHONE_RE = /^\+?[\d\s()-]{10,18}$/;

export function RegisterForm({ next }: { next?: string }) {
  const { status, setStatus, pending, setPending, finish, google } = useSignIn(next);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const errs = {
      name: name.length >= 2 ? undefined : "Enter your full name.",
      email: /\S+@\S+\.\S+/.test(email) ? undefined : "Enter a valid email address.",
      phone: !phone || (PHONE_RE.test(phone) && phone.replace(/\D/g, "").length >= 10) ? undefined : "Enter a valid phone number.",
      password: password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) ? undefined : "Use at least 8 characters, with letters and a number.",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setStatus(null);
    setPending("email");
    try {
      const auth = await getFirebaseAuth();
      if (!auth) return;
      const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } = await import("firebase/auth");
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name }).catch(() => {});
      await sendEmailVerification(cred.user).catch(() => {});
      await finish(cred.user, { name, phone });
    } catch (err) {
      setStatus({ tone: "error", text: messageFor(err) ?? "Registration cancelled." });
    } finally {
      setPending(null);
    }
  }

  if (!isFirebaseConfigured) return <NotConfigured />;

  return (
    <div>
      <Button variant="outline" size="lg" className="w-full" onClick={google} loading={pending === "google"} disabled={!!pending} icon={<GoogleIcon />}>
        Sign up with Google
      </Button>
      <Divider />
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name} required>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={!!errors.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email" error={errors.email} required>
            <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!errors.email} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={errors.phone} hint="For booking updates">
            <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" aria-invalid={!!errors.phone} />
          </Field>
        </div>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters, with letters and a number" required>
          <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
        </Field>
        {status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
        <Button type="submit" size="lg" loading={pending === "email"} disabled={!!pending}>
          Create account
        </Button>
        <p className="text-center text-xs text-muted">By creating an account you agree to the facility rules shown at the front desk.</p>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-ink hover:text-brand">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Enter a valid email address.");
    setError(null);
    setPending(true);
    try {
      const auth = await getFirebaseAuth();
      if (!auth) return;
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(auth, email, { url: `${window.location.origin}/login` });
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      // Don't reveal whether an account exists.
      if (code === "auth/user-not-found" || code === "auth/invalid-email") setSent(true);
      else setError(messageFor(err));
    } finally {
      setPending(false);
    }
  }

  if (!isFirebaseConfigured) return <NotConfigured />;

  if (sent) {
    return (
      <div className="rounded-lg border border-success/20 bg-success-soft p-5 text-sm">
        <MailCheck className="mb-2 size-5 text-success" />
        <p className="font-medium text-ink">Check your inbox</p>
        <p className="mt-1 text-muted">If an account exists for that email, you&apos;ll receive a link to set a new password in a minute or two.</p>
        <Link href="/login" className="mt-4 inline-block font-medium text-brand hover:text-brand-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <Field label="Email" htmlFor="email" error={error}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!error} />
      </Field>
      <Button type="submit" size="lg" loading={pending}>
        Send reset link
      </Button>
      <Link href="/login" className="text-center text-sm text-muted hover:text-ink">
        Back to sign in
      </Link>
    </form>
  );
}
