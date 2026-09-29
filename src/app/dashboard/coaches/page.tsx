import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { can } from "@/lib/rbac";
import { todayInTz } from "@/lib/time";
import { requirePermission } from "@/server/auth/guards";
import { listCoachesWithStats } from "@/server/queries/coaches";

export const metadata = { title: "Coaches" };

export default async function CoachesAdminPage() {
  const user = await requirePermission("coaches:view");
  const coaches = await listCoachesWithStats(`${todayInTz().slice(0, 7)}-01`);
  return (
    <>
      <PageHeader
        title="Coaches"
        description={`${coaches.filter((c) => c.isActive).length} active coaches`}
        actions={
          can(user.role, "coaches:manage") ? (
            <ButtonLink href="/dashboard/coaches/new" icon={<UserPlus className="size-4" />}>
              Add coach
            </ButtonLink>
          ) : null
        }
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {coaches.map((c) => (
          <Link key={c.id} href={`/dashboard/coaches/${c.id}`} className="block rounded-[var(--radius-card)]">
            <Card interactive className={c.isActive ? "p-5" : "p-5 opacity-60"}>
              <div className="flex items-start gap-4">
                <Avatar name={c.name} src={c.photoUrl} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-tight">{c.name}</p>
                  <p className="text-sm font-medium text-brand">{c.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{c.specialization}</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Batches", c.batchCount],
                  ["Students", Math.max(c.studentCount, c.primaryStudents)],
                  ["Sessions (mo)", c.sessionsThisMonth],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-line bg-paper px-2 py-2">
                    <dd className="font-display text-2xl font-semibold leading-none">{v}</dd>
                    <dt className="mt-1 text-[11px] font-medium uppercase text-muted">{k}</dt>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="outline">{c.experienceYears} yrs</Badge>
                {!c.isPublic ? <Badge tone="neutral">Hidden from site</Badge> : null}
                {!c.isActive ? <Badge tone="red">Deactivated</Badge> : null}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
