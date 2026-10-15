import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { logout } from "@/server/actions/admin";
import { requireAdmin } from "@/server/auth/guards";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell adminName={admin.name} logout={logout}>
      {children}
    </AdminShell>
  );
}
