import { desc, eq } from "drizzle-orm";
import { Globe, Megaphone, Pin, Trash2 } from "lucide-react";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextField, TextareaField } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDateTime, titleCase } from "@/lib/format";
import { createAnnouncement, deleteAnnouncement } from "@/server/actions/communication";
import { requirePermission } from "@/server/auth/guards";
import { db } from "@/server/db";
import { announcements, users } from "@/server/db/schema";

export const metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  await requirePermission("announcements:manage");
  const rows = await db
    .select({ a: announcements, author: users.name })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.createdById))
    .orderBy(desc(announcements.isPinned), desc(announcements.publishedAt))
    .limit(50);
  const now = new Date();
  return (
    <>
      <PageHeader title="Announcements" description="Shown on the website, student dashboards and the notification centre." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid content-start gap-4 xl:col-span-2">
          {rows.length ? (
            rows.map(({ a, author }) => {
              const expired = a.expiresAt && a.expiresAt < now;
              return (
                <Card key={a.id} className={expired ? "p-5 opacity-60" : "p-5"}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        <Badge tone="outline">{titleCase(a.audience)}</Badge>
                        {a.isPinned ? (
                          <Badge tone="brand">
                            <Pin className="size-3" /> Pinned
                          </Badge>
                        ) : null}
                        {a.showOnWebsite ? (
                          <Badge tone="blue">
                            <Globe className="size-3" /> Website
                          </Badge>
                        ) : null}
                        {expired ? <Badge tone="neutral">Expired</Badge> : null}
                      </div>
                      <h2 className="text-xl font-semibold">{a.title}</h2>
                      <p className="mt-1 whitespace-pre-line text-ink-soft">{a.body}</p>
                      <p className="mt-2 text-xs font-semibold text-muted">
                        {formatDateTime(a.publishedAt)} · {author ?? "Academy"}
                        {a.expiresAt ? ` · until ${formatDateTime(a.expiresAt)}` : ""}
                      </p>
                    </div>
                    <ActionButton action={deleteAnnouncement.bind(null, a.id)} variant="ghost" icon={<Trash2 className="size-4" />} confirm={{ title: "Delete this announcement?", confirmLabel: "Delete", danger: true }}>
                      Delete
                    </ActionButton>
                  </div>
                </Card>
              );
            })
          ) : (
            <EmptyState title="No announcements yet" icon={<Megaphone className="size-6" />} />
          )}
        </div>
        <Card tone="brand-soft" className="self-start">
          <CardHeader title="New announcement" icon={<Megaphone className="size-5" />} />
          <CardBody>
            <ActionForm action={createAnnouncement} className="grid gap-3" resetOnSuccess>
              <TextField name="title" label="Title" required placeholder="Academy closed on 2 October" />
              <TextareaField name="body" label="Message" required rows={4} placeholder="Academy closed on 2 October due to maintenance." />
              <SelectField name="audience" label="Audience" options={[{ value: "EVERYONE", label: "Everyone" }, { value: "STUDENTS", label: "Students & parents" }, { value: "STAFF", label: "Staff only" }]} />
              <TextField name="expiresOn" label="Hide after" type="date" hint="Optional" />
              <CheckboxField name="isPinned" label="Pin to the top" />
              <CheckboxField name="showOnWebsite" label="Show on the website" description="Only for 'Everyone' announcements" defaultChecked />
              <CheckboxField name="notify" label="Send to notification centre" defaultChecked />
              <SubmitButton>Publish</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
