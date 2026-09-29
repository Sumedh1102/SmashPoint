import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, LoaderCircle } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { ButtonLink } from "./button";

/* ── Avatar ─────────────────────────────────────────────────────────────── */
const AVATAR_TONES = ["bg-brand-50 text-brand-700", "bg-paper-2 text-ink-soft", "bg-success-soft text-success", "bg-warning-soft text-warning", "bg-ink text-white"];

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
      aria-hidden={!src}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads served from our API; sizes are tiny
        <img src={src} alt={name} className="size-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ── Page header & breadcrumbs ──────────────────────────────────────────── */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-ink">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold leading-tight md:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/* ── Empty / loading / error states ─────────────────────────────────────── */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-white/60 px-6 py-12 text-center", className)}>
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-paper-2 text-muted">
        {icon ?? <Inbox className="size-5" />}
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-danger/20 bg-danger-soft/60 px-6 py-12 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-white text-danger">
        <AlertTriangle className="size-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <LoaderCircle className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-ink/[0.06]", className)} aria-hidden />;
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-card)]" />
        ))}
      </div>
      <div className="space-y-3 rounded-[var(--radius-card)] border border-line bg-white/60 p-5">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}

/* ── Pagination (URL based) ─────────────────────────────────────────────── */
export function Pagination({
  page,
  pageCount,
  total,
  hrefFor,
  label = "results",
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  if (pageCount <= 1) {
    return <p className="mt-4 text-sm text-muted">{total} {label}</p>;
  }
  const pages = pageWindow(page, pageCount);
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted">
        Page {page} of {pageCount} · {total} {label}
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-muted">
              …
            </span>
          ) : (
            <PageLink key={p} href={hrefFor(p)} active={p === page}>
              {p}
            </PageLink>
          ),
        )}
        <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, active, disabled, children, ...rest }: { href: string; active?: boolean; disabled?: boolean; children: ReactNode; "aria-label"?: string }) {
  const cls = cn(
    "grid h-8 min-w-8 place-items-center rounded-md border px-2 text-sm font-medium transition",
    active ? "border-line bg-ink text-white" : "border-line bg-white hover:border-line-strong hover:bg-paper",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) return <span className={cls} aria-disabled {...rest}>{children}</span>;
  return (
    <Link href={href} className={cls} aria-current={active ? "page" : undefined} {...rest}>
      {children}
    </Link>
  );
}

function pageWindow(page: number, count: number): (number | "…")[] {
  const set = new Set([1, count, page - 1, page, page + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/* ── Stat card ──────────────────────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "white",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "white" | "blue" | "ink" | "soft";
  href?: string;
}) {
  const tones = {
    white: "border-line bg-white",
    blue: "border-brand bg-brand text-white",
    ink: "border-line bg-ink text-white",
    soft: "border-brand-100 bg-brand-50",
  };
  const body = (
    <div className={cn("flex h-full flex-col justify-between gap-3 rounded-[var(--radius-card)] border p-4 shadow-sm sm:p-5", tones[tone], href && "lift-hover")}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-sm font-medium", tone === "white" || tone === "soft" ? "text-muted" : "text-white/80")}>{label}</p>
        {icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tone === "white" || tone === "soft" ? "bg-paper text-muted" : "bg-white/10")}>
            {icon}
          </span>
        ) : null}
      </div>
      <div>
        <p className="font-display text-2xl font-semibold leading-none tracking-tight sm:text-[1.75rem]">{value}</p>
        {hint ? <p className={cn("mt-1.5 text-xs", tone === "white" || tone === "soft" ? "text-muted" : "text-white/75")}>{hint}</p> : null}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-[var(--radius-card)]">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function KeyValue({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="text-muted">{item.label}</dt>
          <dd className="text-right font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { ButtonLink };
