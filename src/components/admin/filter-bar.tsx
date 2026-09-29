import Link from "next/link";
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

/** GET-form filter row: works without JavaScript and keeps filters in the URL. */
export function FilterBar({ action, children, resetHref, hidden }: { action: string; children: ReactNode; resetHref: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={action} method="get" className="mb-5 flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-white p-3 shadow-xs" role="search">
      {hidden
        ? Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))
        : null}
      {children}
      <div className="flex gap-2">
        <Button type="submit" variant="dark" size="md">
          Apply
        </Button>
        <Link href={resetHref} className="inline-flex h-11 items-center gap-1 rounded-[var(--radius-control)] px-3 text-sm font-medium hover:bg-ink/5">
          <X className="size-4" /> Reset
        </Link>
      </div>
    </form>
  );
}

export function SearchInput({ name = "q", defaultValue, placeholder }: { name?: string; defaultValue?: string; placeholder: string }) {
  return (
    <label className="relative min-w-56 flex-1">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} className="pl-9" type="search" />
    </label>
  );
}

export function FilterSelect({ name, label, defaultValue, options }: { name: string; label: string; defaultValue?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="min-w-36">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <Select name={name} defaultValue={defaultValue ?? ""}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function FilterDate({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="min-w-40">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <Input type="date" name={name} defaultValue={defaultValue} />
    </label>
  );
}
