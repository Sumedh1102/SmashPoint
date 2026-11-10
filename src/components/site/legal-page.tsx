import type { ReactNode } from "react";
import { isPlaceholder, site } from "@/content/site";

/** Shared layout for the policy pages. Shows a notice while the policies still contain placeholders. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="bg-ink pt-28 pb-24 sm:pt-36">
      <article className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="eyebrow text-neon">{site.name}</p>
        <h1 className="display mt-3 text-[clamp(2.6rem,8vw,4.5rem)]">{title}</h1>
        <p className="mt-3 text-sm text-ink-subtle">Last updated {updated}</p>
        {isPlaceholder(site.legalName) ? (
          <p className="mt-6 rounded-[var(--radius-control)] border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
            Template: text in [square brackets] is a placeholder for the facility to complete (see src/content/site.ts and this page) before taking payments.
          </p>
        ) : null}
        <div className="mt-10 space-y-8 border-t border-ink-line pt-10 text-[0.98rem] leading-relaxed text-white/80 [&_a]:text-white [&_a:hover]:text-neon [&_h2]:display [&_h2]:text-[1.7rem] [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_li]:marker:text-ink-subtle [&_ul]:mt-3 [&_ul]:space-y-2">
          {children}
        </div>
      </article>
    </div>
  );
}
