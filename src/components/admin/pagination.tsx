import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="px-5 py-4 text-sm text-muted">{total} {total === 1 ? "result" : "results"}</p>;
  const link = (p: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="rounded-full border border-line px-4 py-2 text-sm text-subtle">{label}</span>
    ) : (
      <Link href={hrefFor(p)} className={cn("rounded-full border border-line-strong px-4 py-2 text-sm font-medium hover:border-ink")}>
        {label}
      </Link>
    );
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
      <span className="text-muted">
        Page {page} of {pages} · {total} results
      </span>
      <span className="flex gap-2">
        {link(page - 1, "Previous", page <= 1)}
        {link(page + 1, "Next", page >= pages)}
      </span>
    </nav>
  );
}
