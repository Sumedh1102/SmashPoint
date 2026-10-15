import "server-only";
import { revalidatePath } from "next/cache";

/**
 * Public pages read live data (availability changes every booking), so they are rendered per
 * request and nothing needs tag invalidation. After an admin edits courts, refresh any page
 * the client router may still hold.
 */
export function refreshPublicPages() {
  revalidatePath("/", "layout");
}
