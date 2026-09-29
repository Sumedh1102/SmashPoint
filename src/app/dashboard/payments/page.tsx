import Link from "next/link";
import { Download, Undo2 } from "lucide-react";
import { FilterBar, FilterDate, FilterSelect, SearchInput } from "@/components/admin/filter-bar";
import { ActionButton } from "@/components/forms/confirm-action";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Pagination, StatCard } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { formatDateTime, formatMoney, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { hrefWith, param } from "@/lib/url";
import { refundPaymentAction } from "@/server/actions/payments";
import { requirePermission } from "@/server/auth/guards";
import { listPayments } from "@/server/queries/payments";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ searchParams }: PageProps<"/dashboard/payments">) {
  const user = await requirePermission("payments:view");
  const sp = await searchParams;
  const result = await listPayments({
    q: param(sp.q),
    status: param(sp.status),
    purpose: param(sp.purpose),
    method: param(sp.method),
    from: param(sp.from),
    to: param(sp.to),
    page: Number(param(sp.page) ?? 1),
  });
  const canRefund = can(user.role, "payments:refund");

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every rupee in and out — bookings, memberships and events."
        actions={
          can(user.role, "reports:view") ? (
            <ButtonLink href={hrefWith("/api/reports/export", { report: "payments", format: "xlsx", from: param(sp.from), to: param(sp.to) })} variant="outline" icon={<Download className="size-4" />} prefetch={false}>
              Export Excel
            </ButtonLink>
          ) : null
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(result.collected)} tone="blue" hint="Paid, matching filters" />
        <StatCard label="Refunded" value={formatMoney(result.refunded)} />
        <StatCard label="Transactions" value={result.total} />
        <StatCard label="Failed attempts" value={result.failed} />
      </section>
      <FilterBar action="/dashboard/payments" resetHref="/dashboard/payments">
        <SearchInput defaultValue={param(sp.q)} placeholder="Receipt, payer, phone, gateway ID…" />
        <FilterSelect name="status" label="Status" defaultValue={param(sp.status)} options={["PAID", "INITIATED", "FAILED", "REFUNDED", "CREATED"].map((s) => ({ value: s, label: titleCase(s) }))} />
        <FilterSelect name="purpose" label="For" defaultValue={param(sp.purpose)} options={["BOOKING", "MEMBERSHIP", "EVENT"].map((s) => ({ value: s, label: titleCase(s) }))} />
        <FilterSelect name="method" label="Method" defaultValue={param(sp.method)} options={["ONLINE", "UPI", "CASH", "CARD", "BANK_TRANSFER"].map((s) => ({ value: s, label: titleCase(s) }))} />
        <FilterDate name="from" label="From" defaultValue={param(sp.from)} />
        <FilterDate name="to" label="To" defaultValue={param(sp.to)} />
      </FilterBar>
      {result.rows.length ? (
        <>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Receipt</TH>
                  <TH>Payer</TH>
                  <TH>For</TH>
                  <TH>Method</TH>
                  <TH>Date</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  {canRefund ? <TH className="text-right">Action</TH> : null}
                </tr>
              </THead>
              <tbody>
                {result.rows.map((p) => (
                  <TR key={p.id}>
                    <TD className="font-mono text-sm font-medium">{p.receiptNumber}</TD>
                    <TD className="text-sm">
                      <span className="font-medium">{p.payerName}</span>
                      <span className="block text-muted">{p.payerPhone ?? p.payerEmail ?? ""}</span>
                    </TD>
                    <TD className="text-sm">
                      {p.bookingId ? (
                        <Link href={`/dashboard/bookings/${p.bookingId}`} className="font-semibold underline">
                          Booking
                        </Link>
                      ) : p.studentId ? (
                        <Link href={`/dashboard/students/${p.studentId}`} className="font-semibold underline">
                          {titleCase(p.purpose)}
                        </Link>
                      ) : (
                        titleCase(p.purpose)
                      )}
                    </TD>
                    <TD className="text-sm">{p.provider === "offline" ? titleCase(p.method) : `Online · ${p.provider}`}</TD>
                    <TD className="whitespace-nowrap text-sm">{formatDateTime(p.paidAt ?? p.createdAt)}</TD>
                    <TD className="font-display font-semibold">{formatMoney(p.amount)}</TD>
                    <TD>
                      <StatusBadge status={p.status} />
                      {p.failureReason && p.status !== "PAID" ? <span className="block max-w-40 truncate text-xs text-muted" title={p.failureReason}>{p.failureReason}</span> : null}
                    </TD>
                    {canRefund ? (
                      <TD className="text-right">
                        {p.status === "PAID" && p.amount > 0 ? (
                          <ActionButton
                            action={refundPaymentAction.bind(null, p.id)}
                            variant="ghost"
                            icon={<Undo2 className="size-4" />}
                            confirm={{ title: `Refund ${formatMoney(p.amount)}?`, description: `Receipt ${p.receiptNumber} for ${p.payerName}. Linked bookings/memberships are cancelled.`, confirmLabel: "Issue refund", danger: true }}
                          >
                            Refund
                          </ActionButton>
                        ) : null}
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} label="payments" hrefFor={(p) => hrefWith("/dashboard/payments", sp, { page: p })} />
        </>
      ) : (
        <EmptyState title="No payments match" />
      )}
    </>
  );
}
