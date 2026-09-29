"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FormMessage } from "@/components/ui/form";
import { DEMO_ACCOUNTS } from "@/lib/demo";

/** One-click sign-in as a seeded account (public demo and local development only). */
export function DemoAccounts() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(email: string) {
    setPending(email);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not sign in.");
      router.replace(data.redirect ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setPending(null);
    }
  }

  return (
    <div className="mt-8 rounded-lg border border-dashed border-line-strong bg-paper/60 p-4">
      <p className="text-sm font-medium">Explore the demo</p>
      <p className="mb-3 mt-0.5 text-xs text-muted">Sign in instantly as a sample account. No password needed.</p>
      <div className="grid grid-cols-3 gap-2">
        {DEMO_ACCOUNTS.map((d) => (
          <button
            key={d.email}
            type="button"
            disabled={!!pending}
            onClick={() => signIn(d.email)}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-line bg-white px-2 text-xs font-medium transition hover:border-line-strong hover:bg-paper disabled:opacity-60"
          >
            {pending === d.email ? <LoaderCircle className="size-3 animate-spin" aria-hidden /> : null}
            {d.role}
          </button>
        ))}
      </div>
      {error ? (
        <div className="mt-3">
          <FormMessage>{error}</FormMessage>
        </div>
      ) : null}
    </div>
  );
}
