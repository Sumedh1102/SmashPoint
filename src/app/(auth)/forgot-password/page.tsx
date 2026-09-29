import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { getCurrentUser } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-8 mt-1.5 text-sm text-muted">Enter the email on your account and we&apos;ll send you a secure link to set a new password.</p>
      <ForgotPasswordForm />
    </div>
  );
}
