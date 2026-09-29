"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, LayoutDashboard, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PUBLIC_NAV } from "./nav-links";

function subscribe() {
  return () => {};
}

/** Reads the non-sensitive `sp_signed_in` hint cookie so static pages can show "Dashboard". */
function useSignedIn() {
  return useSyncExternalStore(
    subscribe,
    () => document.cookie.split("; ").some((c) => c === "sp_signed_in=1"),
    () => false,
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const signedIn = useSignedIn();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85" data-print-hide>
      <div className="mx-auto flex h-18 max-w-[88rem] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center xl:flex">
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-[14.5px] font-medium transition hover:bg-ink/5",
                isActive(item.href) && "bg-ink text-white hover:bg-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <ButtonLink href="/dashboard" variant="outline" size="sm" className="hidden sm:inline-flex" icon={<LayoutDashboard className="size-4" />}>
              Dashboard
            </ButtonLink>
          ) : (
            <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-ink/5 sm:inline-flex">
              Login
            </Link>
          )}
          <ButtonLink href="/book" size="sm" className="hidden sm:inline-flex">
            Book a Court
            <ArrowUpRight className="size-4" />
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-xl border border-line bg-white shadow-xs xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-[4.7rem] z-40 overflow-y-auto border-t border-line bg-paper xl:hidden">
          <nav aria-label="Mobile" className="mx-auto grid max-w-lg gap-2 p-4">
            {PUBLIC_NAV.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between rounded-2xl border border-line bg-white px-5 py-3.5 font-display text-xl font-semibold shadow-xs",
                  isActive(item.href) && "bg-brand text-white",
                )}
              >
                {item.label}
                <span className="font-mono text-xs opacity-60">{String(i + 1).padStart(2, "0")}</span>
              </Link>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ButtonLink href={signedIn ? "/dashboard" : "/login"} variant="outline" size="lg">
                {signedIn ? "Dashboard" : "Login"}
              </ButtonLink>
              <ButtonLink href="/book" size="lg">
                Book a Court
              </ButtonLink>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
