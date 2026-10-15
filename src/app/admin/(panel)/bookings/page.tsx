import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/admin/status-badge";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { formatDate, formatMinutes, formatMoney } from "@/lib/format";
import { isValidISODate } from "@/lib/time";
import { listBookings } from "@/server/queries/admin";

export const metadata = { title: "Bookings" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function AdminBookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const sp = await searchParams;
  const filters = {
    q: one(sp.q)?.slice(0, 100),
    status: one(sp.status),
    sport: one(sp.sport),
    from: one(sp.from) && isValidISODate(one(sp.from)!) ? one(sp.from) : undefined,
    to: one(sp.to) && isValidISODate(one(sp.to)!) ? one(sp.to) : undefined,
    page: Number(one(sp.page) ?? 1) || 1,
  };
  const result = await listBookings(filters);
  const hrefFor = (page: number) => {
    const p = new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v !== undefined && v !== "") as [string, string][]);
    return `/admin/bookings?${p}`;
  };

  return (
    <>
      <PageHeader title="Bookings" description="Search by reference, customer name, email or phone. Open a booking to see its payments and history, or to cancel it." />

      <form method="get" className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)_auto]" role="search">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search bookings</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input name="q" defaultValue={filters.q} placeholder="SP-…, name, email, phone" className="h-11 pl-10" />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <Select name="status" defaultValue={filters.status ?? ""} className="h-11">
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed / paid</option>
            <option value="pending">Awaiting payment</option>
            <option value="cancelled">Cancelled / refunded</option>
            <option value="expired">Expired holds</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">Sport</span>
          <Select name="sport" defaultValue={filters.sport ?? ""} className="h-11">
            <option value="">All sports</option>
            <option value="badminton">Badminton</option>
            <option value="pickleball">Pickleball</option>
            <option value="basketball">Basketball</option>
          </Select>
        </label>
        <label>
          <span className="sr-only">From date</span>
          <Input type="date" name="from" defaultValue={filters.from} className="h-11" aria-label="From date" />
        </label>
        <label>
          <span className="sr-only">To date</span>
          <Input type="date" name="to" defaultValue={filters.to} className="h-11" aria-label="To date" />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass({ variant: "dark" }, "h-11 flex-1")}>
            Filter
          </button>
          <Link href="/admin/bookings" className={buttonClass({ variant: "ghost" }, "h-11")}>
            Clear
          </Link>
        </div>
      </form>

      <Panel>
        {result.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  {["Reference", "Customer", "Sport", "Court", "Date", "Start", "End", "Amount", "Booking", "Payment"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map((b) => (
                  <tr key={b.id} className="hover:bg-paper">
                    <td className="px-4 py-3 pl-5 font-semibold">
                      <Link href={`/admin/bookings/${b.code}`} className="tabular text-court hover:underline">
                        {b.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{b.customerName}</span>
                      <span className="block text-xs text-muted">{b.customerPhone}</span>
                    </td>
                    <td className="px-4 py-3">{b.sport}</td>
                    <td className="px-4 py-3">{b.court}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(b.date, "weekday")}</td>
                    <td className="tabular px-4 py-3 whitespace-nowrap">{formatMinutes(b.startMinute)}</td>
                    <td className="tabular px-4 py-3 whitespace-nowrap">{formatMinutes(b.endMinute)}</td>
                    <td className="tabular px-4 py-3">{formatMoney(b.total)}</td>
                    <td className="px-4 py-3">
                      <BookingStatusBadge status={b.status} holdExpiresAt={b.holdExpiresAt} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={b.paymentStatus} refundStatus={b.refundStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted">No bookings match these filters.</p>
        )}
        <div className="border-t border-line">
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={hrefFor} />
        </div>
      </Panel>
    </>
  );
}
