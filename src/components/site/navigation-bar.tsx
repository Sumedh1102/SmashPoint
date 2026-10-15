"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/#top", label: "Home" },
  { href: "/#courts", label: "Courts" },
  { href: "/#facility", label: "About the Facility" },
  { href: "/#contact", label: "Contact" },
] as const;

/**
 * Site navigation. Transparent over the dark hero, solid once the page scrolls (or always,
 * on pages without a hero). On phones the links open in a full-screen menu.
 */
export function NavigationBar() {
  const solid = usePathname() !== "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filled = solid || scrolled || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        filled ? "border-b border-white/8 bg-ink/88 backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        <Link href="/#top" className="rounded-lg" aria-label="SmashPoint — home" onClick={() => setOpen(false)}>
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:text-white">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/#book" className={buttonClass({ variant: "primary", size: "md" }, "hidden sm:inline-flex")}>
            Book a Court
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-ink px-4 pt-6 pb-10 sm:top-[4.5rem] sm:px-6 lg:hidden"
      >
        <ul className="space-y-1">
          {NAV_LINKS.map((l, i) => (
            <li key={l.href} className="animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
              <Link href={l.href} onClick={() => setOpen(false)} className="display block border-b border-white/8 py-4 text-[2.4rem] text-white transition-colors hover:text-lime">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/#book" onClick={() => setOpen(false)} className={buttonClass({ variant: "primary", size: "lg" }, "mt-8 w-full")}>
          Book a Court
        </Link>
      </div>
    </header>
  );
}
