import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { CapacityBar } from "@/components/ui/meters";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDays, formatMoney, formatTimeRange, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/server/auth/guards";
import { listBatches } from "@/server/queries/batches";
import { getCoachForUser } from "@/server/queries/viewer";

export const metadata = { title: "Batches" };

export default async function BatchesPage() {
  const user = await requirePermission("batches:view");
  const coach = user.role === "COACH" ? await getCoachForUser(user.id) : null;
  const rows = await listBatches(coach?.id);
  return (
    <>
      <PageHeader
        title="Batches"
        description={coach ? "Batches assigned to you." : `${rows.filter((b) => b.isActive).length} active batches · ${rows.reduce((a, b) => a + b.enrolled, 0)} enrolments`}
        actions={
          can(user.role, "batches:manage") ? (
            <ButtonLink href="/dashboard/batches/new" icon={<Plus className="size-4" />}>
              Add batch
            </ButtonLink>
          ) : null
        }
      />
      {rows.length ? (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Batch</TH>
                <TH>Schedule</TH>
                <TH>Court</TH>
                <TH>Coach</TH>
                <TH>Students</TH>
                <TH>Fee</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((b) => (
                <TR key={b.id} className={b.isActive ? "" : "opacity-60"}>
                  <TD>
                    <Link href={`/dashboard/batches/${b.id}`} className="font-medium hover:text-brand">
                      {b.name}
                    </Link>
                    <span className="mt-0.5 flex gap-1.5">
                      <Badge tone="outline">{titleCase(b.level)}</Badge>
                      {!b.isActive ? <Badge tone="neutral">Inactive</Badge> : null}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-sm">
                    <span className="font-medium">{formatDays(b.daysOfWeek)}</span>
                    <span className="block text-muted">{formatTimeRange(b.startMinute, b.endMinute)}</span>
                  </TD>
                  <TD className="text-sm">{b.courtName ?? "—"}</TD>
                  <TD className="text-sm">{b.coachName ?? "—"}</TD>
                  <TD>
                    <CapacityBar used={b.enrolled} total={b.capacity} />
                  </TD>
                  <TD className="font-medium">{formatMoney(b.monthlyFee)}/mo</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState title="No batches yet" />
      )}
    </>
  );
}
