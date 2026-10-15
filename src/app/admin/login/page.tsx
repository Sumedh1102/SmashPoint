import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { Wordmark } from "@/components/brand/wordmark";
import { getAdmin } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ink px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="mx-auto mb-8 flex w-fit">
          <Wordmark />
        </Link>
        <div className="rounded-[var(--radius-card)] bg-paper p-6 shadow-lg sm:p-8">
          <p className="eyebrow text-court">Administrator</p>
          <h1 className="display mt-2 text-[2.5rem]">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-muted">For facility staff only. There is no public sign-up.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
