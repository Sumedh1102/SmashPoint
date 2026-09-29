import { and, asc, gte } from "drizzle-orm";
import { Ban, Clock, Flame, Plus, Trash2, Wrench } from "lucide-react";
import { ActionForm, CheckboxField, DaysField, SelectField, SubmitButton, TextField } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, formatDays, formatMinutes, formatMoney, formatTimeRange } from "@/lib/format";
import { can } from "@/lib/rbac";
import { minutesToHHMM, todayInTz } from "@/lib/time";
import { addCourtBlock, createCourt, deleteCourtBlock, saveBookingRules, updateCourt } from "@/server/actions/courts";
import { requirePermission } from "@/server/auth/guards";
import type { ActionResult } from "@/server/actions/result";
import { db } from "@/server/db";
import { courtBlocks, courts } from "@/server/db/schema";
import { getBookingSettings } from "@/server/settings";

export const metadata = { title: "Courts" };

export default async function CourtsPage() {
  const user = await requirePermission("courts:view");
  const manage = can(user.role, "courts:manage");
  const today = todayInTz();
  const [courtRows, settings, blocks] = await Promise.all([
    db.select().from(courts).orderBy(asc(courts.sortOrder), asc(courts.name)),
    getBookingSettings(),
    db.query.courtBlocks.findMany({ where: and(gte(courtBlocks.endDate, today)), with: { court: { columns: { name: true } } }, orderBy: [asc(courtBlocks.startDate)] }),
  ]);

  return (
    <>
      <PageHeader title="Courts" description={`${courtRows.filter((c) => c.status === "ACTIVE").length} of ${courtRows.length} courts open for booking · ${formatMinutes(settings.openMinute)} – ${formatMinutes(settings.closeMinute)}`} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {courtRows.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <h2 className="text-xl font-semibold">{c.name}</h2>
                  <p className="text-sm text-muted">{c.description ?? c.surface}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="outline">{formatMoney(c.hourlyRate)}/hr</Badge>
                  <Badge tone="blue">
                    <Flame className="size-3" /> {formatMoney(c.peakHourlyRate)}/hr peak
                  </Badge>
                  <StatusBadge status={c.status} />
                </div>
              </div>
              {manage ? (
                <details className="group">
                  <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium text-brand hover:bg-brand-50 [&::-webkit-details-marker]:hidden">Edit court, pricing & status</summary>
                  <div className="border-t border-line p-5">
                    <CourtForm action={updateCourt.bind(null, c.id)} defaults={c} submitLabel="Save court" />
                  </div>
                </details>
              ) : null}
            </Card>
          ))}

          {manage ? (
            <Card tone="brand-soft">
              <CardHeader title="Add a court" icon={<Plus className="size-5" />} />
              <CardBody>
                <CourtForm action={createCourt} defaults={{ name: `Court ${courtRows.length + 1}`, surface: "Synthetic PU mat", hourlyRate: 40000, peakHourlyRate: 60000, status: "ACTIVE", sortOrder: courtRows.length + 1 }} submitLabel="Add court" />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Hours & pricing rules" icon={<Clock className="size-5" />} description="Changes apply to the booking page immediately." />
            <CardBody>
              {manage ? (
                <ActionForm action={saveBookingRules} className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <TextField name="openTime" label="Opens" type="time" defaultValue={minutesToHHMM(settings.openMinute)} />
                    <TextField name="closeTime" label="Closes" type="time" defaultValue={minutesToHHMM(settings.closeMinute)} />
                  </div>
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium">Slot durations</legend>
                    <div className="flex flex-wrap gap-3">
                      {[30, 60, 90, 120].map((d) => (
                        <Checkbox key={d} name="durations" value={d} label={`${d} min`} defaultChecked={settings.durations.includes(d)} />
                      ))}
                    </div>
                  </fieldset>
                  <SelectField name="defaultDuration" label="Default duration" defaultValue={String(settings.defaultDuration)} options={[30, 60, 90, 120].map((d) => ({ value: String(d), label: `${d} minutes` }))} />
                  <div className="rounded-xl border border-line bg-paper p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                      <Flame className="size-4 text-brand" /> Peak windows
                    </p>
                    <p className="mb-3 text-xs text-muted">Peak rates apply inside these windows; everything else is non-peak. Leave a row empty to remove it.</p>
                    {[0, 1, 2].map((i) => {
                      const w = settings.peakWindows[i];
                      return (
                        <div key={i} className="mb-3 grid gap-2 border-b border-line pb-3 last:mb-0 last:border-0 last:pb-0">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                            <TextField name={`peak_label_${i}`} label="Label" defaultValue={w?.label ?? ""} placeholder="e.g. Evening peak" />
                            <TextField name={`peak_start_${i}`} label="From" type="time" defaultValue={w ? minutesToHHMM(w.startMinute) : ""} />
                            <TextField name={`peak_end_${i}`} label="To" type="time" defaultValue={w ? minutesToHHMM(w.endMinute) : ""} />
                          </div>
                          <DaysField name={`peak_days_${i}`} label="Days (none = every day)" defaultValue={w?.days ?? []} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <TextField name="holdMinutes" label="Hold (min)" type="number" defaultValue={settings.holdMinutes} />
                    <TextField name="advanceDays" label="Advance days" type="number" defaultValue={settings.advanceDays} />
                    <TextField name="cancellationCutoffHours" label="Cancel cutoff (h)" type="number" defaultValue={settings.cancellationCutoffHours} />
                  </div>
                  <CheckboxField name="allowGuestBooking" label="Allow guest bookings" description="Customers can book without creating an account" defaultChecked={settings.allowGuestBooking} />
                  <SubmitButton>Save rules</SubmitButton>
                </ActionForm>
              ) : (
                <ul className="grid gap-2 text-sm">
                  <li>
                    Open {formatMinutes(settings.openMinute)} – {formatMinutes(settings.closeMinute)}
                  </li>
                  {settings.peakWindows.map((w) => (
                    <li key={w.label}>
                      {w.label}: {formatTimeRange(w.startMinute, w.endMinute)} {w.days.length ? `(${formatDays(w.days)})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Maintenance & blocked slots</h2>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            {blocks.length ? (
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Court</TH>
                      <TH>Type</TH>
                      <TH>Dates</TH>
                      <TH>Time</TH>
                      <TH>Reason</TH>
                      {manage ? <TH className="text-right">Action</TH> : null}
                    </tr>
                  </THead>
                  <tbody>
                    {blocks.map((b) => (
                      <TR key={b.id}>
                        <TD className="font-medium">{b.court.name}</TD>
                        <TD>
                          {b.type === "MAINTENANCE" ? (
                            <Badge tone="yellow">
                              <Wrench className="size-3" /> Maintenance
                            </Badge>
                          ) : (
                            <Badge tone="neutral">
                              <Ban className="size-3" /> Blocked
                            </Badge>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap text-sm">
                          {formatDate(b.startDate, "dayMonth")}
                          {b.endDate !== b.startDate ? ` – ${formatDate(b.endDate, "dayMonth")}` : ""}
                        </TD>
                        <TD className="whitespace-nowrap text-sm">{b.startMinute !== null && b.endMinute !== null ? formatTimeRange(b.startMinute, b.endMinute) : "All day"}</TD>
                        <TD className="text-sm">{b.reason ?? "—"}</TD>
                        {manage ? (
                          <TD className="text-right">
                            <ActionButton action={deleteCourtBlock.bind(null, b.id)} variant="ghost" icon={<Trash2 className="size-4" />} confirm={{ title: "Remove this block?", description: "The slots become bookable again.", confirmLabel: "Remove", danger: true }}>
                              Remove
                            </ActionButton>
                          </TD>
                        ) : null}
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState title="No upcoming blocks" description="All courts follow normal operating hours." />
            )}
          </div>
          {manage ? (
            <Card>
              <CardHeader title="Block slots / maintenance" icon={<Wrench className="size-5" />} />
              <CardBody>
                <ActionForm action={addCourtBlock} className="grid gap-3" resetOnSuccess>
                  <SelectField name="courtId" label="Court" options={[{ value: "ALL", label: "All courts" }, ...courtRows.map((c) => ({ value: c.id, label: c.name }))]} defaultValue={courtRows[0]?.id} />
                  <SelectField name="type" label="Type" options={[{ value: "MAINTENANCE", label: "Maintenance" }, { value: "BLOCKED", label: "Blocked (event / private use)" }]} />
                  <div className="grid grid-cols-2 gap-2">
                    <TextField name="startDate" label="From" type="date" defaultValue={today} />
                    <TextField name="endDate" label="To" type="date" defaultValue={today} />
                  </div>
                  <CheckboxField name="wholeDay" label="Whole day" description="Untick to block specific hours" defaultChecked />
                  <div className="grid grid-cols-2 gap-2">
                    <TextField name="startTime" label="Start time" type="time" />
                    <TextField name="endTime" label="End time" type="time" />
                  </div>
                  <TextField name="reason" label="Reason" placeholder="e.g. Floor resurfacing" />
                  <SubmitButton variant="dark">Save block</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </section>
    </>
  );
}

function CourtForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults: { name: string; description?: string | null; surface: string; hourlyRate: number; peakHourlyRate: number; status: string; sortOrder: number };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-3 md:grid-cols-2">
      <TextField name="name" label="Name" defaultValue={defaults.name} required />
      <TextField name="surface" label="Surface" defaultValue={defaults.surface} />
      <TextField name="description" label="Description" defaultValue={defaults.description} className="md:col-span-2" />
      <TextField name="hourlyRate" label="Non-peak rate (₹/hr)" type="number" min={0} defaultValue={defaults.hourlyRate / 100} />
      <TextField name="peakHourlyRate" label="Peak rate (₹/hr)" type="number" min={0} defaultValue={defaults.peakHourlyRate / 100} />
      <SelectField name="status" label="Status" defaultValue={defaults.status} options={[{ value: "ACTIVE", label: "Active" }, { value: "MAINTENANCE", label: "Maintenance mode (not bookable)" }, { value: "INACTIVE", label: "Inactive (hidden)" }]} />
      <TextField name="sortOrder" label="Display order" type="number" defaultValue={defaults.sortOrder} />
      <div className="md:col-span-2">
        <SubmitButton variant="dark">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
