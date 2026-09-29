import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Check, Download, ExternalLink, X } from "lucide-react";
import { EventForm } from "@/components/events/event-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cancelRegistration, confirmRegistration, updateEvent } from "@/server/actions/events";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { eventRegistrations, events } from "@/server/db/schema";

export const metadata = { title: "Event" };

export default async function EventAdminPage({ params, searchParams }: PageProps<"/dashboard/events/[id]">) {
  await requirePermission("events:manage");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [event] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  if (!event) notFound();
  const regs = await db.select().from(eventRegistrations).where(eq(eventRegistrations.eventId, id)).orderBy(desc(eventRegistrations.createdAt));
  const active = regs.filter((r) => r.status !== "CANCELLED");
  const byDivision = new Map<string, number>();
  for (const r of active) byDivision.set(r.division ?? "General", (byDivision.get(r.division ?? "General") ?? 0) + 1);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Events", href: "/dashboard/events" }, { label: event.name }]}
        title={event.name}
        eyebrow={<StatusBadge status={event.status} />}
        description={`${active.length} registrations${event.registrationLimit ? ` of ${event.registrationLimit}` : ""} · ${formatMoney(active.filter((r) => r.paymentStatus === "PAID").reduce((a, r) => a + r.amount, 0))} collected`}
        actions={
          <>
            <ButtonLink href={`/api/reports/export?report=event-registrations&event=${event.id}&format=csv`} variant="outline" icon={<Download className="size-4" />} prefetch={false}>
              Registrations CSV
            </ButtonLink>
            {event.status !== "DRAFT" ? (
              <Link href={`/events/${event.slug}`} target="_blank" className="inline-flex items-center gap-1 px-2 text-sm font-medium text-brand">
                View public page <ExternalLink className="size-4" />
              </Link>
            ) : null}
          </>
        }
      />
      {sp.created ? (
        <div className="mb-6">
          <FormMessage tone="success">Event created{event.status === "PUBLISHED" ? " and published — members have been notified" : " as a draft"}.</FormMessage>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="grid content-start gap-6 xl:col-span-3">
          <Card>
            <CardHeader title="Registrations" description={[...byDivision.entries()].map(([d, n]) => `${d}: ${n}`).join(" · ") || "No registrations yet"} />
            <CardBody className="p-0">
              {regs.length ? (
                <TableWrap className="rounded-none border-0 shadow-none">
                  <Table>
                    <THead>
                      <tr>
                        <TH>Participant</TH>
                        <TH>Category</TH>
                        <TH>Status</TH>
                        <TH>Payment</TH>
                        <TH className="text-right">Actions</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {regs.map((r) => (
                        <TR key={r.id} className={r.status === "CANCELLED" ? "opacity-50" : ""}>
                          <TD className="text-sm">
                            <span className="font-medium">{r.participantName}</span>
                            <span className="block text-muted">
                              {r.email} · {r.phone}
                            </span>
                            <span className="block text-xs text-subtle">{formatDateTime(r.createdAt)}</span>
                          </TD>
                          <TD className="text-sm">{r.division ?? "—"}</TD>
                          <TD>
                            <StatusBadge status={r.status} />
                          </TD>
                          <TD>{r.amount ? <StatusBadge status={r.paymentStatus} /> : <span className="text-sm text-muted">Free</span>}</TD>
                          <TD className="text-right">
                            <div className="flex justify-end gap-1">
                              {r.status === "WAITLISTED" || r.status === "PENDING" ? (
                                <ActionButton action={confirmRegistration.bind(null, r.id, event.id)} variant="ghost" icon={<Check className="size-4" />}>
                                  Confirm
                                </ActionButton>
                              ) : null}
                              {r.status !== "CANCELLED" ? (
                                <ActionButton action={cancelRegistration.bind(null, r.id, event.id)} variant="ghost" icon={<X className="size-4" />} confirm={{ title: `Cancel ${r.participantName}'s registration?`, confirmLabel: "Cancel registration", danger: true }}>
                                  Cancel
                                </ActionButton>
                              ) : null}
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              ) : (
                <div className="p-5">
                  <EmptyState title="No registrations yet" description="Share the public event page to start collecting entries." />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        <Card className="xl:col-span-2">
          <CardHeader title="Edit event" />
          <CardBody className="p-6">
            <EventForm action={updateEvent.bind(null, event.id)} defaults={event} submitLabel="Save event" />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
