import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { getCurrentUser } from "@/server/auth/guards";
import { demoSignInEnabled } from "@/server/auth/demo";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Sign in to manage your bookings, rentals and payments.</p>
      <LoginForm next={typeof next === "string" ? next : undefined} />
      {demoSignInEnabled() ? <DemoAccounts /> : null}
    </div>
  );
}
