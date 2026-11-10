import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow text-royal">{eyebrow}</p> : null}
        <h1 className="display mt-2 text-[clamp(2.2rem,5vw,3.25rem)]">{title}</h1>
        {description ? <div className="mt-2 max-w-2xl text-sm text-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--radius-card)] border border-line bg-white ${className ?? ""}`}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="display text-[1.4rem]">{title}</h2>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
