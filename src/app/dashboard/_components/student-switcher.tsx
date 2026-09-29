import Link from "next/link";
import { Avatar } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** Parents with several children switch context via ?student=<id>. */
export function StudentSwitcher({ students, activeId, basePath }: { students: { id: string; name: string; photoUrl: string | null }[]; activeId: string; basePath: string }) {
  if (students.length < 2) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Choose child">
      <span className="mr-1 text-sm font-medium text-muted">Viewing</span>
      {students.map((s) => (
        <Link
          key={s.id}
          role="tab"
          aria-selected={s.id === activeId}
          href={`${basePath}?student=${s.id}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border border-line py-1 pl-1 pr-3 text-sm font-medium transition",
            s.id === activeId ? "bg-ink text-white shadow-xs" : "bg-white",
          )}
        >
          <Avatar name={s.name} src={s.photoUrl} size={28} className="rounded-lg" />
          {s.name}
        </Link>
      ))}
    </div>
  );
}

export function pickStudent<T extends { id: string }>(students: T[], requested: string | string[] | undefined) {
  return students.find((s) => s.id === requested) ?? students[0] ?? null;
}
