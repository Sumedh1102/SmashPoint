import Link from "next/link";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";
import { FilterBar, FilterDate, FilterSelect, SearchInput } from "@/components/admin/filter-bar";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { SortableTH, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { LinkTabs } from "@/components/ui/tabs";
import { formatDate, formatMoney, formatTimeRange, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { todayInTz } from "@/lib/time";
import { hrefWith, param } from "@/lib/url";
import { requireUser } from "@/server/auth/guards";
import { bookingReceiptPath } from "@/server/payments/service";
import { getCourtOptions, listBookings } from "@/server/queries/bookings";
import { getUserBookings } from "@/server/queries/student";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: PageProps<"/dashboard/bookings">) {
  const user = await requireUser();
  const sp = await searchParams;
  if (!can(user.role, "bookings:manage")) return <MyBookings userId={user.id} tab={param(sp.tab) ?? "upcoming"} />;

  const today = todayInTz();
  const [result, courts] = await Promise.all([
    listBookings({
      q: param(sp.q),
      from: param(sp.from),
      to: param(sp.to),
      court: param(sp.court),
      status: param(sp.status),
      source: param(sp.source),
      sort: param(sp.sort),
      dir: sp.dir === "asc" ? "asc" : "desc",
      page: Number(param(sp.page) ?? 1),
    }),
    getCourtOptions(),
  ]);
  const sort = param(sp.sort) ?? "date";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const sortHref = (s: string, d: "asc" | "desc") => hrefWith("/dashboard/bookings", sp, { sort: s, dir: d, page: null });

  return (
    <>
      <PageHeader
        title="Bookings"
        description={`${result.total} bookings · ${formatMoney(result.revenue)} total value`}
        actions={
          <>
            {can(user.role, "reports:view") ? (
              <ButtonLink href={hrefWith("/api/reports/export", { report: "bookings", format: "csv", from: param(sp.from), to: param(sp.to) })} variant="outline" icon={<Download className="size-4" />} prefetch={false}>
                Export CSV
              </ButtonLink>
            ) : null}
            <ButtonLink href="/dashboard/bookings/new" icon={<CalendarPlus className="size-4" />}>
              New booking
            </ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={hrefWith("/dashboard/bookings", {}, { from: today, to: today })} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-50">Today</Link>
        <Link href={hrefWith("/dashboard/bookings", {}, { from: today, status: "ACTIVE", dir: "asc" })} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-50">Upcoming</Link>
        <Link href={hrefWith("/dashboard/bookings", {}, { status: "PAYMENT_INITIATED" })} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-50">Awaiting payment</Link>
        <Link href={hrefWith("/dashboard/bookings", {}, { status: "CANCELLED" })} className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-50">Cancelled</Link>
      </div>
      <FilterBar action="/dashboard/bookings" resetHref="/dashboard/bookings">
        <SearchInput defaultValue={param(sp.q)} placeholder="Booking ID, name, phone or email…" />
        <FilterDate name="from" label="From" defaultValue={param(sp.from)} />
        <FilterDate name="to" label="To" defaultValue={param(sp.to)} />
        <FilterSelect name="court" label="Court" defaultValue={param(sp.court)} options={courts.map((c) => ({ value: c.id, label: c.name }))} />
        <FilterSelect
          name="status"
          label="Status"
          defaultValue={param(sp.status)}
          options={[{ value: "ACTIVE", label: "All active" }, ...["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED", "CANCELLED", "REFUNDED", "EXPIRED"].map((s) => ({ value: s, label: titleCase(s) }))]}
        />
        <FilterSelect name="source" label="Source" defaultValue={param(sp.source)} options={["ONLINE", "WALK_IN", "ADMIN"].map((s) => ({ value: s, label: titleCase(s) }))} />
      </FilterBar>

      {result.rows.length ? (
        <>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Booking</TH>
                  <SortableTH label="Date & time" field="date" sort={sort} dir={dir} hrefFor={sortHref} />
                  <TH>Court</TH>
                  <TH>Customer</TH>
                  <SortableTH label="Amount" field="amount" sort={sort} dir={dir} hrefFor={sortHref} />
                  <TH>Status</TH>
                  <TH>Source</TH>
                </tr>
              </THead>
              <tbody>
                {result.rows.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <Link href={`/dashboard/bookings/${b.id}`} className="font-mono font-medium hover:text-brand">
                        {b.code}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap text-sm">
                      <span className="font-medium">{formatDate(b.date, "weekday")}</span>
                      <span className="block text-muted">{formatTimeRange(b.startMinute, b.endMinute)}</span>
                    </TD>
                    <TD className="font-semibold">{b.courtName}</TD>
                    <TD className="text-sm">
                      <span className="font-medium">{b.customerName}</span>
                      <span className="block text-muted">{b.customerPhone}</span>
                    </TD>
                    <TD className="font-display font-semibold">{formatMoney(b.total)}</TD>
                    <TD>
                      <StatusBadge status={b.status} />
                    </TD>
                    <TD className="text-sm">{titleCase(b.source)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} label="bookings" hrefFor={(p) => hrefWith("/dashboard/bookings", sp, { page: p })} />
        </>
      ) : (
        <EmptyState title="No bookings match" description="Adjust the filters or create a booking for a walk-in customer." />
      )}
    </>
  );
}

async function MyBookings({ userId, tab }: { userId: string; tab: string }) {
  const today = todayInTz();
  const all = await getUserBookings(userId, { today, limit: 100 });
  const upcoming = all.filter((b) => b.date >= today && ["PENDING", "PAYMENT_INITIATED", "PAID", "CONFIRMED"].includes(b.status)).reverse();
  const past = all.filter((b) => !upcoming.includes(b));
  const list = tab === "past" ? past : upcoming;
  return (
    <>
      <PageHeader
        title="My bookings"
        description="Court bookings made with your account."
        actions={
          <ButtonLink href="/book" icon={<CalendarPlus className="size-4" />}>
            Book a court
          </ButtonLink>
        }
      />
      <LinkTabs
        className="mb-5"
        active={tab}
        tabs={[
          { id: "upcoming", label: "Upcoming", href: "/dashboard/bookings", count: upcoming.length },
          { id: "past", label: "Past & cancelled", href: "/dashboard/bookings?tab=past", count: past.length },
        ]}
      />
      {list.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-medium text-muted">{b.code}</p>
                  <p className="font-display text-2xl font-semibold leading-tight">{b.court.name}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-2 font-medium">{formatDate(b.date, "long")}</p>
              <p className="text-sm text-muted">{formatTimeRange(b.startMinute, b.endMinute)}</p>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="font-display text-xl font-semibold">{formatMoney(b.total)}</span>
                <Link href={bookingReceiptPath(b.code)} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
                  Receipt & options <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={tab === "past" ? "No past bookings" : "No upcoming bookings"} description="Courts open daily from 4 AM." action={<ButtonLink href="/book">Book a court</ButtonLink>} />
      )}
    </>
  );
}
