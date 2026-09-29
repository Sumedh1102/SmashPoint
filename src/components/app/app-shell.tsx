"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { ArrowUpRight, Bell, CalendarPlus, LogOut, MoreHorizontal, UserRound, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { signOutEverywhere } from "@/components/auth/sign-out";
import { Avatar } from "@/components/ui/misc";
import { Dropdown } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-config";
import { NavIcon } from "./nav-icon";

type ShellUser = { name: string; email: string; roleLabel: string; avatarUrl: string | null };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  const groups: { name: string | undefined; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return (
    <nav aria-label="Dashboard" className="grid gap-5">
      {groups.map((g, i) => (
        <div key={g.name ?? i}>
          {g.name && g.name !== "Overview" ? <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">{g.name}</p> : null}
          <ul className="grid gap-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active ? "bg-paper-2 font-medium text-ink" : "text-muted hover:bg-paper hover:text-ink",
                    )}
                  >
                    <NavIcon name={item.icon} className={cn("size-[18px]", active ? "text-brand" : "text-subtle")} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  user,
  nav,
  mobileNav,
  unread,
  logoutAction,
  children,
}: {
  user: ShellUser;
  nav: NavItem[];
  mobileNav: NavItem[];
  unread: number;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  useEffect(() => setDrawer(false), [pathname]);

  const showMore = nav.length > mobileNav.length;
  const signOut = () => startSignOut(() => signOutEverywhere(logoutAction));

  return (
    <div className="min-h-dvh bg-paper lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-white lg:flex" data-print-hide>
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav items={nav} pathname={pathname} />
        </div>
        <div className="border-t border-line p-3">
          <Link href="/book" className="mb-3 flex items-center justify-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition hover:bg-ink-soft">
            <CalendarPlus className="size-4" /> Book a court
          </Link>
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.name} src={user.avatarUrl} size={34} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="grid size-8 place-items-center rounded-md text-subtle transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6" data-print-hide>
          <div className="flex items-center gap-3 lg:hidden">
            <Logo href="/dashboard" />
          </div>
          <p className="hidden text-sm text-muted lg:block">
            {user.roleLabel} · <span className="text-ink-soft">{user.email}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <Link
              href="/dashboard/notifications"
              className="relative grid size-9 place-items-center rounded-md text-muted transition hover:bg-paper hover:text-ink"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell className="size-[18px]" />
              {unread ? (
                <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>
              ) : null}
            </Link>
            <Dropdown
              label="Account menu"
              trigger={
                <span className="flex cursor-pointer items-center gap-2 rounded-md p-1 pr-2 transition hover:bg-paper">
                  <Avatar name={user.name} src={user.avatarUrl} size={28} />
                  <span className="hidden max-w-28 truncate text-sm font-medium sm:block">{user.name.split(" ")[0]}</span>
                </span>
              }
              items={[
                { href: "/dashboard/profile", label: "Profile & preferences", icon: <UserRound className="size-4" /> },
                { href: "/dashboard/notifications", label: "Notifications", icon: <Bell className="size-4" /> },
                { href: "/", label: "Back to website", icon: <ArrowUpRight className="size-4" /> },
                { type: "separator" },
                { type: "button", label: "Sign out", icon: <LogOut className="size-4" />, danger: true, onSelect: signOut },
              ]}
            />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-[88rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" data-print-hide>
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${mobileNav.length + (showMore ? 1 : 0)}, minmax(0, 1fr))` }}>
          {mobileNav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-1 px-1 py-2.5 text-[11px]", active ? "font-medium text-ink" : "text-muted")}
                >
                  <NavIcon name={item.icon} className={cn("size-5", active && "text-brand")} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {showMore ? (
            <li>
              <button type="button" onClick={() => setDrawer(true)} className="flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11px] text-muted" aria-expanded={drawer}>
                <MoreHorizontal className="size-5" />
                More
              </button>
            </li>
          ) : null}
        </ul>
      </nav>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="animate-fade-in absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} aria-label="Close menu" />
          <div className="animate-pop absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold">Menu</p>
              <button type="button" onClick={() => setDrawer(false)} className="grid size-8 place-items-center rounded-md text-muted hover:bg-paper" aria-label="Close menu">
                <X className="size-4" />
              </button>
            </div>
            <SidebarNav items={nav} pathname={pathname} onNavigate={() => setDrawer(false)} />
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-line py-2.5 text-sm font-medium text-danger"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
