import Link from "next/link";
import { UserPlus } from "lucide-react";
import { FilterBar, FilterSelect, SearchInput } from "@/components/admin/filter-bar";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Avatar, EmptyState, PageHeader, Pagination } from "@/components/ui/misc";
import { SortableTH, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { ageFromDob, formatDate, titleCase } from "@/lib/format";
import { can } from "@/lib/rbac";
import { todayInTz } from "@/lib/time";
import { hrefWith, param } from "@/lib/url";
import { requirePermission } from "@/server/auth/guards";
import { getCoachStudentIds } from "@/server/queries/coach";
import { getBatchOptions, getCoachOptions, listStudents } from "@/server/queries/students";
import { getCoachForUser } from "@/server/queries/viewer";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: PageProps<"/dashboard/students">) {
  const user = await requirePermission("students:view");
  const sp = await searchParams;
  const today = todayInTz();

  let scopeIds: string[] | null = null;
  if (user.role === "COACH") {
    const coach = await getCoachForUser(user.id);
    scopeIds = coach ? await getCoachStudentIds(coach.id) : [];
  }

  const [result, coaches, batches] = await Promise.all([
    listStudents({
      q: param(sp.q),
      status: param(sp.status),
      level: param(sp.level),
      batch: param(sp.batch),
      coach: param(sp.coach),
      membership: param(sp.membership),
      sort: param(sp.sort),
      dir: sp.dir === "desc" ? "desc" : "asc",
      page: Number(param(sp.page) ?? 1),
      scopeIds,
      today,
    }),
    getCoachOptions(),
    getBatchOptions(),
  ]);

  const sortHref = (sort: string, dir: "asc" | "desc") => hrefWith("/dashboard/students", sp, { sort, dir, page: null });
  const sort = param(sp.sort) ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";

  return (
    <>
      <PageHeader
        title="Students"
        description={user.role === "COACH" ? "Students in your batches." : `${result.total} students match your filters.`}
        actions={
          can(user.role, "students:manage") ? (
            <ButtonLink href="/dashboard/students/new" icon={<UserPlus className="size-4" />}>
              Add student
            </ButtonLink>
          ) : null
        }
      />
      <FilterBar action="/dashboard/students" resetHref="/dashboard/students" hidden={{ sort: param(sp.sort), dir: param(sp.dir) }}>
        <SearchInput defaultValue={param(sp.q)} placeholder="Search name, code, phone or parent…" />
        <FilterSelect name="status" label="Status" defaultValue={param(sp.status)} options={["ACTIVE", "INACTIVE", "SUSPENDED"].map((v) => ({ value: v, label: titleCase(v) }))} />
        <FilterSelect name="level" label="Level" defaultValue={param(sp.level)} options={["BEGINNER", "INTERMEDIATE", "ADVANCED"].map((v) => ({ value: v, label: titleCase(v) }))} />
        <FilterSelect name="batch" label="Batch" defaultValue={param(sp.batch)} options={batches.map((b) => ({ value: b.id, label: b.name }))} />
        {user.role !== "COACH" ? <FilterSelect name="coach" label="Coach" defaultValue={param(sp.coach)} options={coaches.map((c) => ({ value: c.id, label: c.name }))} /> : null}
        <FilterSelect
          name="membership"
          label="Membership"
          defaultValue={param(sp.membership)}
          options={[
            { value: "active", label: "Active" },
            { value: "expiring", label: "Expiring ≤ 7 days" },
            { value: "expired", label: "Expired / none" },
          ]}
        />
      </FilterBar>

      {result.rows.length ? (
        <>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <SortableTH label="Student" field="name" sort={sort} dir={dir} hrefFor={sortHref} />
                  <SortableTH label="Level" field="level" sort={sort} dir={dir} hrefFor={sortHref} />
                  <TH>Batch</TH>
                  <TH>Coach</TH>
                  <TH>Membership</TH>
                  <TH>Payment</TH>
                  <TH>Contact</TH>
                  <SortableTH label="Joined" field="joined" sort={sort} dir={dir} hrefFor={sortHref} />
                </tr>
              </THead>
              <tbody>
                {result.rows.map((s) => {
                  const age = ageFromDob(s.dateOfBirth, today);
                  const m = s.membership;
                  const expired = !m || m.endDate < today;
                  return (
                    <TR key={s.id}>
                      <TD>
                        <Link href={`/dashboard/students/${s.id}`} className="flex items-center gap-3 font-medium hover:text-brand">
                          <Avatar name={s.name} src={s.photoUrl} size={36} />
                          <span>
                            <span className="block">{s.name}</span>
                            <span className="font-mono text-xs text-muted">
                              {s.studentCode}
                              {age !== null ? ` · ${age} yrs` : ""}
                            </span>
                          </span>
                        </Link>
                      </TD>
                      <TD>
                        <span className="text-sm font-semibold">{titleCase(s.level)}</span>
                        {s.status !== "ACTIVE" ? <StatusBadge status={s.status} className="ml-2" /> : null}
                      </TD>
                      <TD className="max-w-48 text-sm">{s.batchNames.length ? s.batchNames.join(", ") : <span className="text-muted">—</span>}</TD>
                      <TD className="text-sm">{s.coachName ?? "—"}</TD>
                      <TD className="text-sm">
                        {m ? (
                          <>
                            <span className="font-medium">{m.plan}</span>
                            <span className={expired ? "block text-xs font-medium text-danger" : "block text-xs text-muted"}>
                              {expired ? "Expired" : "Until"} {formatDate(m.endDate, "short")}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                      </TD>
                      <TD>{m ? <StatusBadge status={m.paymentStatus} /> : <span className="text-muted">—</span>}</TD>
                      <TD className="whitespace-nowrap text-sm">
                        {s.phone ?? s.parentPhone ?? "—"}
                        {s.parentName ? <span className="block text-xs text-muted">{s.parentName}</span> : null}
                      </TD>
                      <TD className="whitespace-nowrap text-sm">{formatDate(s.joiningDate)}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
          <Pagination page={result.page} pageCount={result.pageCount} total={result.total} label="students" hrefFor={(p) => hrefWith("/dashboard/students", sp, { page: p })} />
        </>
      ) : (
        <EmptyState title="No students found" description="Try clearing a filter or searching for a different name." action={<ButtonLink href="/dashboard/students" variant="outline">Clear filters</ButtonLink>} />
      )}
    </>
  );
}
