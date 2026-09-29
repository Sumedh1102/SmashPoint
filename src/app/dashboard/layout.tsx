import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { mobileNavFor, navFor } from "@/components/app/nav-config";
import { ROLE_LABELS } from "@/lib/rbac";
import { logout } from "@/server/actions/auth";
import { requireUser } from "@/server/auth/guards";
import { getUnreadCount, getViewerStudents } from "@/server/queries/viewer";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · SmashPoint Dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, students] = await Promise.all([getUnreadCount(user.id), user.role === "CUSTOMER" ? getViewerStudents(user) : Promise.resolve([])]);
  const opts = { hasTraining: students.length > 0 };
  return (
    <AppShell
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role], avatarUrl: user.avatarUrl }}
      nav={navFor(user.role, opts)}
      mobileNav={mobileNavFor(user.role, opts)}
      unread={unread}
      logoutAction={logout}
    >
      {children}
    </AppShell>
  );
}
