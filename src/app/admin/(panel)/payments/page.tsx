import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/page-header";
import { Pagination } from "@/components/admin/pagination";
import { PaymentStatusBadge } from "@/components/admin/status-badge";
import { buttonClass } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { formatDateTime, formatMoney } from "@/lib/format";
import { listPayments } from "@/server/queries/admin";

export const metadata = { title: "Payments" };

const one = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function AdminPaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const sp = await searchParams;
  const filters = { q: one(sp.q)?.slice(0, 100), status: one(sp.status), page: Number(one(sp.page) ?? 1) || 1 };
  const result = await listPayments(filters);
  const hrefFor = (page: number) => `/admin/payments?${new URLSearchParams(Object.entries({ ...filters, page: String(page) }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every Razorpay checkout and its verified status. Statuses come from payments the server has verified with Razorpay — never from the browser alone. Card and bank details are never stored."
      />
      <form method="get" role="search" className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-line bg-white p-4 sm:grid-cols-[1.6fr_1fr_auto]">
        <label className="relative">
          <span className="sr-only">Search payments</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <Input name="q" defaultValue={filters.q} placeholder="Receipt, order_…, pay_…, name, SP-…" className="h-11 pl-10" />
        </label>
        <label>
          <span className="sr-only">Status</span>
          <Select name="status" defaultValue={filters.status ?? ""} className="h-11">
            <option value="">All statuses</option>
            <option value="PAID">Paid</option>
            <option value="INITIATED">Checkout open</option>
            <option value="FAILED">Failed</option>
            <option value="refund-pending">Refund pending</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonClass({ variant: "dark" }, "h-11 flex-1")}>
            Filter
          </button>
          <Link href="/admin/payments" className={buttonClass({ variant: "ghost" }, "h-11")}>
            Clear
          </Link>
        </div>
      </form>

      <Panel>
        {result.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-subtle">
                  {["Created", "Booking", "Payer", "Amount", "Razorpay order", "Razorpay payment", "Status"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map(({ payment: p, bookingCode }) => (
                  <tr key={p.id} className="hover:bg-paper">
                    <td className="px-4 py-3 pl-5 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      {bookingCode ? (
                        <Link href={`/admin/bookings/${bookingCode}`} className="font-semibold text-neon-ink hover:underline">
                          {bookingCode}
                        </Link>
                      ) : (
                        <span className="text-muted">{p.purpose === "BOOKING" ? "—" : p.purpose.toLowerCase()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{p.payerName}</td>
                    <td className="tabular px-4 py-3">{formatMoney(p.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.providerOrderId ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.providerPaymentId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} refundStatus={p.refundStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted">No payments match these filters.</p>
        )}
        <div className="border-t border-line">
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={hrefFor} />
        </div>
      </Panel>
    </>
  );
}
