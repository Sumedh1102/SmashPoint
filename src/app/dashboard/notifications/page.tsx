import Link from "next/link";
import { Bell, CalendarCheck2, CreditCard, IdCard, Megaphone, Trophy, UsersRound } from "lucide-react";
import { ActionButton } from "@/components/forms/confirm-action";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead } from "@/server/actions/communication";
import { requireUser } from "@/server/auth/guards";
import { markNotificationsRead } from "@/server/notifications";
import { getAnnouncementsFor, getNotifications } from "@/server/queries/viewer";
import { isStaff } from "@/lib/rbac";

export const metadata = { title: "Notifications" };

const ICONS = {
  BOOKING_CONFIRMED: CalendarCheck2,
  BOOKING_REMINDER: CalendarCheck2,
  BOOKING_CANCELLED: CalendarCheck2,
  MEMBERSHIP_EXPIRY: IdCard,
  PAYMENT_RECEIVED: CreditCard,
  ANNOUNCEMENT: Megaphone,
  CLASS_REMINDER: UsersRound,
  EVENT: Trophy,
  GENERAL: Bell,
} as const;

export default async function NotificationsPage() {
  const user = await requireUser();
  const [items, announcements] = await Promise.all([getNotifications(user.id, 60), getAnnouncementsFor(isStaff(user.role) ? "STAFF" : "STUDENTS", 5)]);
  const unread = items.filter((n) => !n.readAt).length;
  // Opening the centre marks items as seen (the list still highlights what was new this visit).
  if (unread) await markNotificationsRead(user.id);

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} new since your last visit` : "You're all caught up."}
        actions={unread ? <ActionButton action={markAllNotificationsRead}>Mark all read</ActionButton> : null}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {items.length ? (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  const body = (
                    <div className={cn("flex gap-4 px-5 py-4", !n.readAt && "bg-brand-50")}>
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border border-line", !n.readAt ? "bg-brand text-white" : "bg-white")}>
                        <Icon className="size-5" strokeWidth={2.4} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-semibold">
                          {n.title}
                          {!n.readAt ? <span className="rounded bg-brand px-1.5 text-[10px] font-semibold uppercase text-white">New</span> : null}
                        </p>
                        <p className="text-sm text-ink-soft">{n.body}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">{formatRelative(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                  return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-paper">{body}</Link> : body}</li>;
                })}
              </ul>
            </Card>
          ) : (
            <EmptyState title="No notifications yet" description="Booking confirmations, reminders and announcements will show up here." icon={<Bell className="size-6" />} />
          )}
        </div>
        <div className="grid content-start gap-3">
          <h2 className="text-lg font-semibold">Announcements</h2>
          {announcements.map((a) => (
            <Card key={a.id} tone={a.isPinned ? "ink" : "white"} className="p-4">
              <p className="flex items-center gap-2 font-semibold">
                <Megaphone className="size-4" /> {a.title}
              </p>
              <p className={cn("mt-1 text-sm", a.isPinned ? "text-white/80" : "text-ink-soft")}>{a.body}</p>
              <p className={cn("mt-2 text-xs font-semibold", a.isPinned ? "text-white/60" : "text-muted")}>{formatRelative(a.publishedAt)}</p>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
