import Link from "next/link";
import { IdCard, Plus } from "lucide-react";
import { FilterBar, SearchInput } from "@/components/admin/filter-bar";
import { PlanForm } from "@/components/memberships/plan-form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { LinkTabs } from "@/components/ui/tabs";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/lib/rbac";
import { diffDays, todayInTz } from "@/lib/time";
import { hrefWith, param } from "@/lib/url";
import { createPlan, updatePlan } from "@/server/actions/memberships";
import { requirePermission } from "@/server/auth/guards";
import { getAllPlans, listMemberships } from "@/server/queries/memberships";

export const metadata = { title: "Memberships" };

export default async function MembershipsAdminPage({ searchParams }: PageProps<"/dashboard/memberships">) {
  const user = await requirePermission("memberships:view");
  const sp = await searchParams;
  const today = todayInTz();
  const tab = param(sp.tab) ?? "members";
  const filter = param(sp.filter) ?? "active";
  const manage = can(user.role, "memberships:manage");

  return (
    <>
      <PageHeader
        title="Memberships"
        description="Plans, subscriptions, expiries and renewals."
        actions={
          manage ? (
            <ButtonLink href="/dashboard/memberships/assign" icon={<IdCard className="size-4" />}>
              Assign / renew
            </ButtonLink>
          ) : null
        }
      />
      <LinkTabs
        className="mb-5"
        active={tab}
        tabs={[
          { id: "members", label: "Subscriptions", href: "/dashboard/memberships" },
          { id: "plans", label: "Plans", href: "/dashboard/memberships?tab=plans" },
        ]}
      />
      {tab === "plans" ? <Plans manage={manage} /> : <Members sp={sp} filter={filter} today={today} manage={manage} />}
    </>
  );
}

async function Members({ sp, filter, today, manage }: { sp: Record<string, string | string[] | undefined>; filter: string; today: string; manage: boolean }) {
  const result = await listMemberships({ filter, q: param(sp.q), page: Number(param(sp.page) ?? 1), today });
  const filters = [
    { id: "active", label: "Active" },
    { id: "expiring", label: "Expiring ≤ 7 days" },
    { id: "expired", label: "Expired" },
    { id: "pending", label: "Pending payment" },
    { id: "all", label: "All" },
  ];
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Link key={f.id} href={hrefWith("/dashboard/memberships", {}, { filter: f.id, q: param(sp.q) })} className={f.id === filter ? "rounded-lg border border-line bg-ink px-3 py-1.5 text-sm font-medium text-white" : "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-brand-50"}>
            {f.label}
          </Link>
        ))}
      </div>
      <FilterBar action="/dashboard/memberships" resetHref={`/dashboard/memberships?filter=${filter}`} hidden={{ filter }}>
        <SearchInput defaultValue={param(sp.q)} placeholder="Search student name or code…" />
      </FilterBar>
      {result.rows.length ? (
        <>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>Student</TH>
                  <TH>Plan</TH>
                  <TH>Start</TH>
                  <TH>Expiry</TH>
                  <TH>Status</TH>
                  <TH>Payment</TH>
                  <TH>Price</TH>
                  {manage ? <TH className="text-right">Renewal</TH> : null}
                </tr>
              </THead>
              <tbody>
                {result.rows.map((m) => {
                  const left = diffDays(today, m.endDate);
                  const expired = m.endDate < today;
                  return (
                    <TR key={m.id}>
                      <TD>
                        <Link href={`/dashboard/students/${m.studentId}`} className="font-medium hover:text-brand">
                          {m.studentName}
                        </Link>
                        <span className="block font-mono text-xs text-muted">{m.studentCode}</span>
                      </TD>
                      <TD className="font-semibold">{m.planName}</TD>
                      <TD className="whitespace-nowrap text-sm">{formatDate(m.startDate)}</TD>
                      <TD className="whitespace-nowrap text-sm">
                        {formatDate(m.endDate)}
                        {!expired && left <= 7 && m.status === "ACTIVE" ? <Badge tone="yellow" className="ml-2">{left}d left</Badge> : null}
                      </TD>
                      <TD>
                        <StatusBadge status={expired && m.status === "ACTIVE" ? "EXPIRED" : m.status} />
                      </TD>
                      <TD>
                        <StatusBadge status={m.paymentStatus} />
                      </TD>
                      <TD className="font-medium">{formatMoney(m.price)}</TD>
                      {manage ? (
                        <TD className="text-right">
                          <Link href={`/dashboard/memberships/assign?student=${m.studentId}`} className="text-sm font-medium text-brand">
                            Renew
                          </Link>
                        </TD>
                      ) : null}
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} label="memberships" hrefFor={(p) => hrefWith("/dashboard/memberships", sp, { page: p })} />
        </>
      ) : (
        <EmptyState title="Nothing here" description="No memberships match this filter." />
      )}
    </>
  );
}

async function Plans({ manage }: { manage: boolean }) {
  const plans = await getAllPlans();
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {plans.map((p) => (
        <Card key={p.id} className={p.isActive ? "" : "opacity-70"}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {p.name} {p.isFeatured ? <Badge tone="yellow">Featured</Badge> : null} {!p.isActive ? <Badge tone="neutral">Hidden</Badge> : null}
              </span>
            }
            description={`${formatMoney(p.price)} · ${p.durationMonths} month${p.durationMonths > 1 ? "s" : ""} · ${p.courtDiscountPercent}% court discount`}
          />
          <CardBody>
            {manage ? (
              <PlanForm action={updatePlan.bind(null, p.id)} defaults={p} submitLabel="Save plan" />
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {p.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ))}
      {manage ? (
        <Card tone="brand-soft">
          <CardHeader title="Create plan" icon={<Plus className="size-5" />} />
          <CardBody>
            <PlanForm action={createPlan} defaults={{ sortOrder: plans.length + 1 }} submitLabel="Create plan" />
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
