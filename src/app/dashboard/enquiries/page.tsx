import { desc } from "drizzle-orm";
import { Mail, Phone } from "lucide-react";
import { ActionButton } from "@/components/forms/confirm-action";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { setEnquiryStatus } from "@/server/actions/communication";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { enquiries } from "@/server/db/schema";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage() {
  await requirePermission("enquiries:view");
  const rows = await db.select().from(enquiries).orderBy(desc(enquiries.createdAt)).limit(100);
  return (
    <>
      <PageHeader title="Enquiries" description="Messages from the website contact form." />
      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((e) => (
            <Card key={e.id} className={e.status === "CLOSED" ? "p-5 opacity-60" : "p-5"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-brand">{e.subject}</p>
                  <p className="text-lg font-semibold">{e.name}</p>
                  <p className="text-xs font-semibold text-muted">{formatDateTime(e.createdAt)}</p>
                </div>
                <StatusBadge status={e.status} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{e.message}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm font-medium">
                <a href={`mailto:${e.email}?subject=${encodeURIComponent(`Re: ${e.subject}`)}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:bg-brand-50">
                  <Mail className="size-4" /> {e.email}
                </a>
                {e.phone ? (
                  <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 hover:bg-brand-50">
                    <Phone className="size-4" /> {e.phone}
                  </a>
                ) : null}
                <span className="ml-auto flex gap-1">
                  {e.status !== "IN_PROGRESS" && e.status !== "CLOSED" ? (
                    <ActionButton action={setEnquiryStatus.bind(null, e.id, "IN_PROGRESS")} variant="ghost">
                      Mark in progress
                    </ActionButton>
                  ) : null}
                  {e.status !== "CLOSED" ? (
                    <ActionButton action={setEnquiryStatus.bind(null, e.id, "CLOSED")} variant="outline">
                      Close
                    </ActionButton>
                  ) : (
                    <ActionButton action={setEnquiryStatus.bind(null, e.id, "NEW")} variant="ghost">
                      Reopen
                    </ActionButton>
                  )}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Inbox zero" description="No enquiries from the website yet." />
      )}
    </>
  );
}
