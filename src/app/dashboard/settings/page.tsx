import Link from "next/link";
import { desc, inArray, eq } from "drizzle-orm";
import { ArrowRight, BadgePercent, Bell, ClipboardCheck, History, Plug, ShieldCheck, UserPlus } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, SwitchField, TextField } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/rbac";
import { createCoupon, createStaff, saveAttendanceSettings, saveNotificationSettings, setUserActive, toggleCoupon } from "@/server/actions/settings";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { auditLogs, coupons, users } from "@/server/db/schema";
import { adapters } from "@/server/notifications/channels";
import { activePaymentProviderId } from "@/server/payments";
import { getSetting } from "@/server/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requirePermission("settings:manage");
  const [notif, attendance, couponRows, staff, logs] = await Promise.all([
    getSetting("notifications"),
    getSetting("attendance"),
    db.select().from(coupons).orderBy(desc(coupons.createdAt)),
    db.select().from(users).where(inArray(users.role, ["ADMIN", "MANAGER", "RECEPTION", "COACH"])).orderBy(users.role, users.name),
    db.select({ log: auditLogs, actor: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).orderBy(desc(auditLogs.createdAt)).limit(15),
  ]);
  const provider = activePaymentProviderId();

  return (
    <>
      <PageHeader title="Settings" description="Academy-wide configuration. Court hours & pricing live under Courts." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-6 xl:col-span-2">
          <Card>
            <CardHeader title="Staff accounts" icon={<ShieldCheck className="size-5" />} description="Coaches are managed from the Coaches page." />
            <CardBody className="p-0">
              <TableWrap className="rounded-none border-0 shadow-none">
                <Table>
                  <THead>
                    <tr>
                      <TH>Name</TH>
                      <TH>Role</TH>
                      <TH>Last sign-in</TH>
                      <TH className="text-right">Access</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {staff.map((u) => (
                      <TR key={u.id} className={u.isActive ? "" : "opacity-60"}>
                        <TD className="text-sm">
                          <span className="font-medium">{u.name}</span>
                          <span className="block text-muted">{u.email}</span>
                        </TD>
                        <TD>
                          <Badge tone={u.role === "ADMIN" ? "ink" : "outline"}>{ROLE_LABELS[u.role]}</Badge>
                        </TD>
                        <TD className="text-sm">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}</TD>
                        <TD className="text-right">
                          {u.id === me.id ? (
                            <span className="text-xs font-medium text-muted">You</span>
                          ) : (
                            <ActionButton action={setUserActive.bind(null, u.id, !u.isActive)} variant={u.isActive ? "ghost" : "outline"} confirm={u.isActive ? { title: `Deactivate ${u.name}?`, description: "They are signed out immediately.", danger: true, confirmLabel: "Deactivate" } : undefined}>
                              {u.isActive ? "Deactivate" : "Reactivate"}
                            </ActionButton>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <details className="border-t border-line">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium text-brand hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
                  <UserPlus className="size-4" /> Add staff account
                </summary>
                <div className="px-5 pb-5">
                  <ActionForm action={createStaff} className="grid gap-3 md:grid-cols-2" resetOnSuccess>
                    <TextField name="name" label="Name" required />
                    <TextField name="email" label="Email" type="email" required />
                    <TextField name="phone" label="Phone" type="tel" required />
                    <SelectField name="role" label="Role" options={[{ value: "RECEPTION", label: "Reception" }, { value: "MANAGER", label: "Manager" }, { value: "ADMIN", label: "Admin / Owner" }]} />
                    <TextField name="password" label="Temporary password" type="password" required className="md:col-span-2" />
                    <div className="md:col-span-2">
                      <SubmitButton variant="dark">Create account</SubmitButton>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Coupons" icon={<BadgePercent className="size-5" />} />
            <CardBody className="p-0">
              <TableWrap className="rounded-none border-0 shadow-none">
                <Table>
                  <THead>
                    <tr>
                      <TH>Code</TH>
                      <TH>Discount</TH>
                      <TH>Applies to</TH>
                      <TH>Used</TH>
                      <TH>Valid until</TH>
                      <TH className="text-right">Status</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {couponRows.map((c) => (
                      <TR key={c.id}>
                        <TD>
                          <span className="font-mono font-medium">{c.code}</span>
                          {c.description ? <span className="block text-xs text-muted">{c.description}</span> : null}
                        </TD>
                        <TD className="text-sm font-medium">
                          {c.type === "PERCENT" ? `${c.value}%` : formatMoney(c.value)}
                          {c.maxDiscount ? <span className="block text-xs font-semibold text-muted">max {formatMoney(c.maxDiscount)}</span> : null}
                        </TD>
                        <TD className="text-sm">{c.scope === "ALL" ? "Everything" : c.scope.charAt(0) + c.scope.slice(1).toLowerCase()}</TD>
                        <TD className="text-sm">
                          {c.usedCount}
                          {c.maxUses ? ` / ${c.maxUses}` : ""}
                        </TD>
                        <TD className="text-sm">{c.validUntil ? formatDate(c.validUntil) : "—"}</TD>
                        <TD className="text-right">
                          <ActionButton action={toggleCoupon.bind(null, c.id, !c.isActive)} variant={c.isActive ? "soft" : "outline"}>
                            {c.isActive ? "Active" : "Disabled"}
                          </ActionButton>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
              <div className="border-t border-line p-5">
                <p className="mb-3 font-semibold">New coupon</p>
                <ActionForm action={createCoupon} className="grid gap-3 md:grid-cols-4" resetOnSuccess>
                  <TextField name="code" label="Code" required placeholder="SMASH10" />
                  <SelectField name="type" label="Type" options={[{ value: "PERCENT", label: "Percent" }, { value: "FLAT", label: "Flat ₹" }]} />
                  <TextField name="value" label="Value" type="number" required />
                  <SelectField name="scope" label="Applies to" options={[{ value: "BOOKING", label: "Court bookings" }, { value: "MEMBERSHIP", label: "Memberships" }, { value: "EVENT", label: "Events" }, { value: "ALL", label: "Everything" }]} />
                  <TextField name="minAmount" label="Min order (₹)" type="number" defaultValue={0} />
                  <TextField name="maxDiscount" label="Max discount (₹)" type="number" />
                  <TextField name="maxUses" label="Max uses" type="number" />
                  <TextField name="validUntil" label="Valid until" type="date" />
                  <TextField name="description" label="Description" className="md:col-span-3" />
                  <div className="flex items-end">
                    <SubmitButton variant="dark" className="w-full">
                      Create
                    </SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Audit log" icon={<History className="size-5" />} description="Recent sensitive changes" />
            <CardBody className="p-0">
              <ul className="divide-y divide-line text-sm">
                {logs.map(({ log, actor }) => (
                  <li key={log.id} className="flex flex-wrap justify-between gap-2 px-5 py-2.5">
                    <span>
                      <span className="font-mono font-medium">{log.action}</span> <span className="text-muted">by {actor ?? "system"}</span>
                    </span>
                    <span className="text-xs font-semibold text-muted">{formatDateTime(log.createdAt)}</span>
                  </li>
                ))}
                {logs.length === 0 ? <li className="px-5 py-4 text-muted">No changes recorded yet.</li> : null}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-6">
          <Link href="/dashboard/courts" className="flex items-center justify-between rounded-2xl border border-line bg-brand p-5 font-display text-lg font-semibold text-white shadow-sm">
            Court hours, pricing & maintenance <ArrowRight className="size-5" />
          </Link>
          <Card>
            <CardHeader title="Notifications" icon={<Bell className="size-5" />} />
            <CardBody>
              <ActionForm action={saveNotificationSettings} className="grid gap-4">
                <SwitchField name="email" label="Email" description={adapters.EMAIL.configured ? "Provider connected" : "Not configured — logged only"} defaultChecked={notif.email} />
                <SwitchField name="whatsapp" label="WhatsApp" description={adapters.WHATSAPP.configured ? "Provider connected" : "Not configured — logged only"} defaultChecked={notif.whatsapp} />
                <SwitchField name="sms" label="SMS" description={adapters.SMS.configured ? "Provider connected" : "Not configured — logged only"} defaultChecked={notif.sms} />
                <TextField name="bookingReminderHours" label="Booking reminder (hours before)" type="number" defaultValue={notif.bookingReminderHours} />
                <TextField name="membershipExpiryReminderDays" label="Membership expiry reminder (days before)" type="number" defaultValue={notif.membershipExpiryReminderDays} />
                <SubmitButton variant="dark">Save</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Attendance" icon={<ClipboardCheck className="size-5" />} />
            <CardBody>
              <ActionForm action={saveAttendanceSettings} className="grid gap-4">
                <SwitchField name="qrEnabled" label="QR check-in" description="Students check in by scanning their code" defaultChecked={attendance.qrEnabled} />
                <TextField name="lateAfterMinutes" label="Mark late after (minutes)" type="number" defaultValue={attendance.lateAfterMinutes} />
                <SubmitButton variant="dark">Save</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Integrations" icon={<Plug className="size-5" />} />
            <CardBody className="grid gap-2 text-sm">
              <p className="flex justify-between">
                <span className="font-semibold text-muted">Payment gateway</span>
                <Badge tone={provider === "mock" ? "yellow" : "green"}>{provider === "mock" ? "Sandbox" : provider}</Badge>
              </p>
              {(["EMAIL", "WHATSAPP", "SMS"] as const).map((c) => (
                <p key={c} className="flex justify-between">
                  <span className="font-semibold text-muted">{c.charAt(0) + c.slice(1).toLowerCase()}</span>
                  <Badge tone={adapters[c].configured ? "green" : "neutral"}>{adapters[c].configured ? "Connected" : "Not set"}</Badge>
                </p>
              ))}
              <p className="mt-2 text-xs text-muted">Configure providers with environment variables — see README.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
