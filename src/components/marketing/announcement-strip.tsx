import { Megaphone } from "lucide-react";
import { getWebsiteAnnouncements } from "@/server/queries/public";

export async function AnnouncementStrip() {
  const items = await getWebsiteAnnouncements();
  const top = items[0];
  if (!top) return null;
  return (
    <div className="border-b border-line bg-ink text-white" role="region" aria-label="Announcement">
      <div className="mx-auto flex max-w-[88rem] items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-brand">
          <Megaphone className="size-4" />
        </span>
        <p className="min-w-0 truncate">
          <span className="font-semibold">{top.title}</span>
          <span className="hidden text-white/75 sm:inline"> — {top.body}</span>
        </p>
      </div>
    </div>
  );
}
