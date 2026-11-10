"use client";

import { Menu, X } from "lucide-react";
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
  { href: "/#courts", id: "courts", label: "Courts" },
  { href: "/#pricing", id: "pricing", label: "Court Rentals" },
  { href: "/#about", id: "about", label: "About Us" },
  { href: "/#contact", id: "contact", label: "Contact" },
] as const;

/** Sections tracked for the active link; the booking section has the button instead of a link. */
const TRACKED = [...NAV_LINKS.map((l) => l.id), "book"];

/** The home-page section currently in view, for highlighting its link. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string>("top");
  useEffect(() => {
    if (!enabled) return;
    const sections = TRACKED.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    // The section whose top is closest above a line a third of the way down the screen.
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
 * Site navigation. Transparent over the hero, solid black once the page scrolls (or always, on
 * pages without the hero). Below 1280px the links open in a full-screen menu: Escape or a link
 * closes it, focus moves into it when it opens and back to the button when it closes.
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
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-300 print:hidden",
        filled ? "border-b border-ink-line bg-ink" : "border-b border-transparent bg-transparent",
      )}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        <Link href="/#top" className="rounded-lg" aria-label={`${site.name} — home`} onClick={() => setOpen(false)}>
          <Wordmark eager className="max-[359px]:[&_.wordmark]:text-[1.05rem]" />
        </Link>

        <ul className="hidden items-center gap-1 xl:flex">
          {NAV_LINKS.map((l) => {
            const current = onHome && active === l.id;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current ? "location" : undefined}
                  className={cn("rounded-full px-3.5 py-2 text-sm font-medium transition-colors", current ? "text-neon" : "text-ink-muted hover:text-white")}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/#book" className={buttonClass({ variant: "primary", size: "md" }, "hidden sm:inline-flex")}>
            Book a Court
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

      <div id="mobile-menu" ref={menu} hidden={!open} className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto bg-ink px-4 pt-4 pb-10 sm:top-[4.5rem] sm:px-6 xl:hidden">
        <ul className="mx-auto max-w-3xl">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={onHome && active === l.id ? "location" : undefined}
                className="display block border-b border-ink-line py-4 text-[2.4rem] text-white transition-colors hover:text-neon aria-[current=location]:text-neon"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mx-auto max-w-3xl">
          <Link href="/#book" onClick={() => setOpen(false)} className={buttonClass({ variant: "primary", size: "lg" }, "mt-8 w-full")}>
            Book a Court
          </Link>
          <p className="mt-6 text-center text-sm text-ink-subtle">{site.descriptor}</p>
        </div>
      </div>
    </header>
  );
}
