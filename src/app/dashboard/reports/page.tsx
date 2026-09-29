import Link from "next/link";
import { Download } from "lucide-react";
import { FilterBar, FilterDate, FilterSelect } from "@/components/admin/filter-bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AttendanceBar, BarChart, HBarList } from "@/components/ui/charts";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDate, formatMinutes, formatMoney, formatNumber, titleCase } from "@/lib/format";
import { addDays, todayInTz } from "@/lib/time";
import { hrefWith, param } from "@/lib/url";
import { requirePermission } from "@/server/auth/guards";
import { bookingReport, coachReport, revenueReport, studentReport, type Period } from "@/server/queries/reports";

export const metadata = { title: "Reports" };

const PERIODS: Period[] = ["daily", "weekly", "monthly", "yearly"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ExportLinks({ report, from, to, period }: { report: string; from: string; to: string; period?: string }) {
  return (
    <span className="flex gap-1.5">
      {(["csv", "xlsx"] as const).map((f) => (
        <Link key={f} prefetch={false} href={hrefWith("/api/reports/export", {}, { report, from, to, period, format: f })} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold uppercase hover:bg-brand-50">
          <Download className="size-3.5" /> {f === "csv" ? "CSV" : "Excel"}
        </Link>
      ))}
    </span>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/dashboard/reports">) {
  await requirePermission("reports:view");
  const sp = await searchParams;
  const today = todayInTz();
  const to = param(sp.to) ?? today;
  const period = (PERIODS.includes(sp.period as Period) ? sp.period : "daily") as Period;
  const defaultFrom = period === "yearly" ? addDays(today, -730) : period === "monthly" ? addDays(today, -365) : period === "weekly" ? addDays(today, -90) : addDays(today, -29);
  const from = param(sp.from) ?? defaultFrom;

  const [revenue, bookings, studentsR, coaches] = await Promise.all([revenueReport(from, to, period), bookingReport(from, to), studentReport(from, to, today), coachReport(from, to)]);
  const bucketLabel = (b: string) => (period === "yearly" ? b.slice(0, 4) : period === "monthly" ? formatDate(b, "dayMonth").split(" ")[1]! + " " + b.slice(2, 4) : formatDate(b, "dayMonth"));

  return (
    <>
      <PageHeader title="Reports & analytics" description={`${formatDate(from)} – ${formatDate(to)}`} />
      <div className="mb-3 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link key={p} href={hrefWith("/dashboard/reports", {}, { period: p })} className={p === period ? "rounded-lg border border-line bg-ink px-3 py-1.5 text-sm font-medium text-white" : "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-50"}>
            {titleCase(p)}
          </Link>
        ))}
      </div>
      <FilterBar action="/dashboard/reports" resetHref="/dashboard/reports">
        <FilterSelect name="period" label="Group by" defaultValue={period} options={PERIODS.map((p) => ({ value: p, label: titleCase(p) }))} />
        <FilterDate name="from" label="From" defaultValue={from} />
        <FilterDate name="to" label="To" defaultValue={to} />
      </FilterBar>

      {/* Revenue */}
      <section className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue" description={`${titleCase(period)} · ${formatMoney(revenue.total)} collected · ${formatMoney(revenue.refunded)} refunded`} action={<ExportLinks report="revenue" from={from} to={to} period={period} />} />
          <CardBody>
            {revenue.series.length ? (
              <BarChart format="money" caption={`${period} revenue`} data={revenue.series.map((s) => ({ label: bucketLabel(s.bucket), value: s.total, detail: `${bucketLabel(s.bucket)} · ${s.count} payments` }))} />
            ) : (
              <p className="text-sm text-muted">No revenue in this range.</p>
            )}
          </CardBody>
        </Card>
        <div className="grid content-start gap-3">
          <StatCard label="Court bookings" value={formatMoney(revenue.byPurpose.BOOKING)} tone="blue" />
          <StatCard label="Memberships" value={formatMoney(revenue.byPurpose.MEMBERSHIP)} />
          <StatCard label="Events" value={formatMoney(revenue.byPurpose.EVENT)} />
        </div>
      </section>

      {/* Bookings */}
      <h2 className="mb-4 mt-10 flex items-center justify-between text-2xl font-semibold">
        Bookings <ExportLinks report="bookings" from={from} to={to} />
      </h2>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total bookings" value={formatNumber(bookings.total)} tone="ink" />
        <StatCard label="Hours played" value={formatNumber(bookings.hoursBooked)} />
        <StatCard label="Cancellation rate" value={`${bookings.cancellationRate}%`} hint={`${bookings.cancelled} cancelled`} />
        <StatCard label="Peak hour" value={bookings.peakHour !== null ? formatMinutes(bookings.peakHour * 60) : "—"} />
        <StatCard label="Most used court" value={bookings.mostUsedCourt ?? "—"} hint={`${bookings.onlineShare}% booked online`} />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Bookings by start time" description="Confirmed bookings — spot your peak hours" />
          <CardBody>
            <BarChart caption="Bookings by start hour" data={bookings.byHour.map((h) => ({ label: formatMinutes(h.hour * 60).replace(":00", ""), value: h.count, detail: `${formatMinutes(h.hour * 60)} starts` }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Court usage" description="Bookings per court" />
          <CardBody className="grid gap-6">
            <HBarList caption="Bookings per court" data={bookings.byCourt.map((c) => ({ label: c.court, value: c.count, detail: `${c.hours} hours · ${formatMoney(c.revenue)}` }))} />
            <HBarList caption="Bookings per weekday" data={bookings.byWeekday.map((d) => ({ label: WEEKDAYS[d.dow - 1]!, value: d.count }))} />
          </CardBody>
        </Card>
      </div>

      {/* Students */}
      <h2 className="mb-4 mt-10 flex items-center justify-between text-2xl font-semibold">
        Students <ExportLinks report="students" from={from} to={to} />
      </h2>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active students" value={studentsR.active} tone="blue" />
        <StatCard label="New students" value={studentsR.newStudents} hint="Joined in range" />
        <StatCard label="Active memberships" value={studentsR.activeMemberships} />
        <StatCard label="Expired memberships" value={studentsR.expiredMemberships} hint="Not yet renewed" />
      </section>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attendance statistics" description={`${studentsR.attendancePct}% attended across all batches`} action={<ExportLinks report="attendance" from={from} to={to} />} />
          <CardBody>
            <AttendanceBar counts={studentsR.attendance} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Students by level" />
          <CardBody>
            <HBarList caption="Students by level" data={studentsR.byLevel.map((l) => ({ label: titleCase(l.level), value: l.count }))} />
          </CardBody>
        </Card>
      </div>

      {/* Coaches */}
      <h2 className="mb-4 mt-10 flex items-center justify-between text-2xl font-semibold">
        Coaches <ExportLinks report="coaches" from={from} to={to} />
      </h2>
      <TableWrap>
        <Table>
          <THead>
            <tr>
              <TH>Coach</TH>
              <TH>Active batches</TH>
              <TH>Sessions conducted</TH>
              <TH>Students assigned</TH>
              <TH>Attendance handled</TH>
              <TH>Attendance rate</TH>
            </tr>
          </THead>
          <tbody>
            {coaches.map((c) => (
              <TR key={c.id}>
                <TD>
                  <span className="font-medium">{c.name}</span>
                  <span className="block text-xs text-muted">{c.title}</span>
                </TD>
                <TD className="font-medium">{c.batches}</TD>
                <TD className="font-medium">{c.sessions}</TD>
                <TD className="font-medium">{c.studentsAssigned}</TD>
                <TD className="font-medium">{c.attendanceHandled}</TD>
                <TD className="font-medium">{c.counted ? `${Math.round((c.attended / c.counted) * 100)}%` : "—"}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
