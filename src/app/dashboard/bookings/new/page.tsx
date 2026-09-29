import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { ActionForm, SelectField, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { formatMinutes } from "@/lib/format";
import { minutesToHHMM, todayInTz } from "@/lib/time";
import { staffCreateBooking } from "@/server/actions/bookings";
import { requirePermission } from "@/server/auth/guards";
import { getCourtOptions } from "@/server/queries/bookings";
import { getBookingSettings } from "@/server/settings";

export const metadata = { title: "New booking" };

export default async function NewBookingPage() {
  await requirePermission("bookings:manage");
  const [courts, settings] = await Promise.all([getCourtOptions(), getBookingSettings()]);
  const times: string[] = [];
  for (let m = settings.openMinute; m < settings.closeMinute; m += 30) times.push(minutesToHHMM(m));
  const today = todayInTz();

  return (
    <>
      <PageHeader
        title="New booking"
        breadcrumbs={[{ label: "Bookings", href: "/dashboard/bookings" }, { label: "New" }]}
        description="For walk-ins and phone bookings. Availability is checked on save — double bookings are rejected."
        actions={
          <Link href={`/book?date=${today}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-brand">
            Open availability grid <ExternalLink className="size-4" />
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <CardBody className="p-6">
          <ActionForm action={staffCreateBooking} className="grid gap-4 md:grid-cols-2">
            <SelectField name="courtId" label="Court" required options={courts.filter((c) => c.status === "ACTIVE").map((c) => ({ value: c.id, label: c.name }))} />
            <TextField name="date" label="Date" type="date" required defaultValue={today} />
            <SelectField name="startTime" label="Start time" required options={times.map((t) => ({ value: t, label: formatMinutes(Number(t.slice(0, 2)) * 60 + Number(t.slice(3))) }))} />
            <SelectField name="duration" label="Duration" defaultValue={String(settings.defaultDuration)} options={[30, 60, 90, 120].map((d) => ({ value: String(d), label: `${d} minutes` }))} />
            <TextField name="name" label="Customer name" required />
            <TextField name="phone" label="Phone" type="tel" required />
            <TextField name="email" label="Email" type="email" hint="Optional — for the receipt" className="md:col-span-2" />
            <SelectField
              name="payment"
              label="Payment"
              options={[
                { value: "CASH", label: "Paid now — Cash" },
                { value: "UPI", label: "Paid now — UPI" },
                { value: "CARD", label: "Paid now — Card" },
                { value: "LINK", label: "Send online payment link (slot held)" },
              ]}
            />
            <SelectField name="source" label="Source" options={[{ value: "WALK_IN", label: "Walk-in" }, { value: "ADMIN", label: "Phone / admin" }]} />
            <TextareaField name="notes" label="Notes" rows={2} className="md:col-span-2" />
            <div className="md:col-span-2">
              <SubmitButton size="lg">Create booking</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
