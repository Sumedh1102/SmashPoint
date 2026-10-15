"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Request = { slug: string; nonce: number };
type Ctx = { request: Request | null; bookCourt: (slug: string) => void };

const SelectionContext = createContext<Ctx>({ request: null, bookCourt: () => {} });

/**
 * Lets a court card hand its court to the booking wizard on the same page: the wizard
 * pre-selects the sport and court, and the page scrolls to it.
 */
export function BookingSelectionProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  const bookCourt = useCallback((slug: string) => {
    setRequest((prev) => ({ slug, nonce: (prev?.nonce ?? 0) + 1 }));
    const target = document.getElementById("book");
    if (target) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    const url = new URL(window.location.href);
    url.searchParams.set("court", slug);
    url.hash = "book";
    window.history.replaceState(null, "", url);
  }, []);
  const value = useMemo(() => ({ request, bookCourt }), [request, bookCourt]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useBookingSelection() {
  return useContext(SelectionContext);
}
