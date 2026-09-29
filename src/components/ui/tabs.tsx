"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const listCls = "inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-line bg-paper-2/60 p-1 scrollbar-none";
const tabCls =
  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted transition focus-visible:outline-2 focus-visible:outline-brand";

/** Client-side tabs for in-page content switching. */
export function Tabs({ tabs, defaultTab, className }: { tabs: { id: string; label: ReactNode; content: ReactNode }[]; defaultTab?: string; className?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const base = useId();
  return (
    <div className={className}>
      <div role="tablist" className={listCls}>
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            onClick={() => setActive(t.id)}
            className={cn(tabCls, active === t.id ? "bg-white text-ink shadow-xs" : "hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-panel-${t.id}`} aria-labelledby={`${base}-tab-${t.id}`} hidden={active !== t.id} className="mt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** URL-driven tabs (server friendly): each tab is a link. */
export function LinkTabs({ tabs, active, className }: { tabs: { id: string; label: ReactNode; href: string; count?: number }[]; active: string; className?: string }) {
  return (
    <nav className={cn(listCls, className)} aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={active === t.id ? "page" : undefined} className={cn(tabCls, "inline-flex items-center gap-1.5", active === t.id ? "bg-white text-ink shadow-xs" : "hover:text-ink")}>
          {t.label}
          {t.count !== undefined ? (
            <span className={cn("rounded-md px-1.5 text-xs", active === t.id ? "bg-paper-2" : "bg-white/70")}>{t.count}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
