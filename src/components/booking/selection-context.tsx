"use client";

import { createContext, useCallback, useContext, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** What a "Book" button elsewhere on the page asked the booking wizard to select. */
export type BookingRequest = { kind: "court" | "sport"; slug: string; nonce: number };
type Ctx = { request: BookingRequest | null; bookCourt: (slug: string) => void; bookSport: (slug: string) => void };

const SelectionContext = createContext<Ctx>({ request: null, bookCourt: () => {}, bookSport: () => {} });

function scrollToBooking() {
  const target = document.getElementById("book");
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/**
 * Lets court cards, sport cards and price rows hand a court or sport to the booking wizard on
 * the same page: the wizard pre-selects it, and the page scrolls to the wizard. The URL keeps
 * the choice (?court=… or ?sport=…), so a reload or a shared link opens the same selection.
 */
export function BookingSelectionProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<BookingRequest | null>(null);
  const select = useCallback((kind: BookingRequest["kind"], slug: string) => {
    setRequest((prev) => ({ kind, slug, nonce: (prev?.nonce ?? 0) + 1 }));
    scrollToBooking();
    const url = new URL(window.location.href);
    url.searchParams.delete(kind === "court" ? "sport" : "court");
    url.searchParams.set(kind, slug);
    url.hash = "book";
    window.history.replaceState(null, "", url);
  }, []);
  const bookCourt = useCallback((slug: string) => select("court", slug), [select]);
  const bookSport = useCallback((slug: string) => select("sport", slug), [select]);
  const value = useMemo(() => ({ request, bookCourt, bookSport }), [request, bookCourt, bookSport]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useBookingSelection() {
  return useContext(SelectionContext);
}

/**
 * A link to the booking wizard with a sport or court pre-selected. Works without JavaScript
 * (plain link to /?sport=…#book); with it, selects in place without reloading the page.
 */
export function BookLink({
  sport,
  court,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  sport?: string;
  court?: string;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const { bookCourt, bookSport } = useBookingSelection();
  const href = court ? `/?court=${encodeURIComponent(court)}#book` : sport ? `/?sport=${encodeURIComponent(sport)}#book` : "/#book";
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || !document.getElementById("book")) return;
    e.preventDefault();
    if (court) bookCourt(court);
    else if (sport) bookSport(sport);
    else scrollToBooking();
  };
  return (
    <a href={href} onClick={onClick} className={cn(className)} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
