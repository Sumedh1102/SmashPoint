"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonClass } from "@/components/ui/button";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";

export const NAV_LINKS = [
  { href: "/#top", id: "top", label: "Home" },
  { href: "/#sports", id: "sports", label: "Sports" },
  { href: "/#pricing", id: "pricing", label: "Court Rentals" },
  { href: "/#book", id: "book", label: "Book a Court" },
  { href: "/#about", id: "about", label: "About Us" },
  { href: "/#contact", id: "contact", label: "Contact" },
] as const;

/** The home-page section currently in view, for highlighting its link. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string>("top");
  useEffect(() => {
    if (!enabled) return;
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter((el): el is HTMLElement => !!el);
    // The section whose top is closest above a line a third of the way down the screen
    // (sections aren't in the same order on the page as in the menu).
    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      let current = "top";
      let best = Number.NEGATIVE_INFINITY;
      for (const el of sections) {
        const top = el.getBoundingClientRect().top;
        if (top <= line && top > best) {
          best = top;
          current = el.id;
        }
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);
  return active;
}

/**
 * Site navigation. Transparent over the navy hero, solid navy once the page scrolls (or always,
 * on pages without the hero). Below 1280px the links open in a full-screen menu: Escape or a
 * link closes it, focus moves into it when it opens and back to the button when it closes.
 */
export function NavigationBar() {
  const onHome = usePathname() === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const active = useActiveSection(onHome);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) toggle.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    menu.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      // Keep Tab inside the menu and its toggle while it is open.
      if (e.key === "Tab" && menu.current) {
        const items = [toggle.current, ...menu.current.querySelectorAll<HTMLElement>("a")].filter((el): el is HTMLElement => !!el);
        const i = items.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && i === items.length - 1) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filled = !onHome || scrolled || open;

  return (
    <header
      className={cn(
        "surface-dark fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300",
        filled ? "border-b border-white/10 bg-ink/95 shadow-[0_8px_24px_-16px_rgb(0_0_0/0.6)] backdrop-blur-md" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:h-[4.75rem] sm:px-6 lg:px-8">
        <Link href="/#top" className="rounded-lg" aria-label={`${site.name} — home`} onClick={() => setOpen(false)}>
          <Wordmark eager className="max-[359px]:[&_.wordmark]:text-[1.1rem]" />
        </Link>

        <ul className="hidden items-center gap-0.5 xl:flex">
          {NAV_LINKS.map((l) => {
            const current = onHome && active === l.id;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current ? "location" : undefined}
                  className={cn(
                    "relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
                    current ? "text-white" : "text-white/70 hover:text-white",
                    "after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-gold after:transition-transform after:duration-300",
                    current ? "after:scale-x-100" : "after:scale-x-0",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-1.5">
          <Link href="/#book" className={buttonClass({ variant: "primary", size: "md" }, "hidden uppercase tracking-wide sm:inline-flex")}>
            Book Now <ArrowRight aria-hidden className="size-4" />
          </Link>
          <button
            ref={toggle}
            type="button"
            className="grid size-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 xl:hidden"
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
        ref={menu}
        hidden={!open}
        className="court-lines fixed inset-x-0 top-[4.25rem] bottom-0 overflow-y-auto bg-ink px-4 pt-4 pb-10 sm:top-[4.75rem] sm:px-6 xl:hidden"
      >
        <ul className="mx-auto max-w-3xl">
          {NAV_LINKS.map((l, i) => (
            <li key={l.href} className="animate-rise" style={{ animationDelay: `${i * 35}ms` }}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={onHome && active === l.id ? "location" : undefined}
                className="display flex items-center justify-between border-b border-white/10 py-4 text-[2rem] text-white transition-colors hover:text-gold aria-[current=location]:text-gold sm:text-[2.4rem]"
              >
                {l.label}
                <ArrowRight aria-hidden className="size-5 text-white/40" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="mx-auto max-w-3xl">
          <Link href="/#book" onClick={() => setOpen(false)} className={buttonClass({ variant: "primary", size: "lg" }, "mt-8 w-full uppercase tracking-wide")}>
            Book Now
          </Link>
          <p className="mt-6 text-center text-sm text-ink-muted">{site.descriptor}</p>
        </div>
      </div>
    </header>
  );
}
