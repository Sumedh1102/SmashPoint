import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, formatMinutes, formatMoney, titleCase } from "@/lib/format";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { eventRegistrations, events } from "@/server/db/schema";

export const metadata = { title: "Events" };

export default async function EventsAdminPage() {
  await requirePermission("events:manage");
  const rows = await db
    .select({
      id: events.id,
      slug: events.slug,
      name: events.name,
      category: events.category,
      date: events.date,
      endDate: events.endDate,
      startMinute: events.startMinute,
      fee: events.fee,
      status: events.status,
      registrationLimit: events.registrationLimit,
      registered: sql<number>`(select count(*)::int from ${eventRegistrations} r where r.event_id = ${events.id} and r.status <> 'CANCELLED')`,
    })
    .from(events)
    .orderBy(desc(events.date));
  return (
    <>
      <PageHeader
        title="Events & tournaments"
        description="Create events, manage registrations and publish to the website."
        actions={
          <ButtonLink href="/dashboard/events/new" icon={<Plus className="size-4" />}>
            Create event
          </ButtonLink>
        }
      />
      {rows.length ? (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH>Event</TH>
                <TH>Date</TH>
                <TH>Category</TH>
                <TH>Fee</TH>
                <TH>Registrations</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((e) => (
                <TR key={e.id}>
                  <TD>
                    <Link href={`/dashboard/events/${e.id}`} className="font-medium hover:text-brand">
                      {e.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted">/events/{e.slug}</span>
                  </TD>
                  <TD className="whitespace-nowrap text-sm">
                    {formatDate(e.date)}
                    {e.endDate ? ` – ${formatDate(e.endDate, "dayMonth")}` : ""}
                    <span className="block text-muted">{formatMinutes(e.startMinute)}</span>
                  </TD>
                  <TD>
                    <Badge tone="outline">{titleCase(e.category)}</Badge>
                  </TD>
                  <TD className="font-medium">{e.fee ? formatMoney(e.fee) : "Free"}</TD>
                  <TD className="font-medium">
                    {e.registered}
                    {e.registrationLimit ? ` / ${e.registrationLimit}` : ""}
                  </TD>
                  <TD>
                    <StatusBadge status={e.status} />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState title="No events yet" action={<ButtonLink href="/dashboard/events/new">Create the first one</ButtonLink>} />
      )}
    </>
  );
}
