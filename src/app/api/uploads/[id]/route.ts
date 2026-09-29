import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { mediaAssets } from "@/server/db/schema";
import { AuthError, assertUser } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, errorResponse, json } from "@/server/http";
import { canUploadTo, deleteAssets } from "@/server/storage/media";
import { isMediaFolder } from "@/server/storage/folders";

/** Deletes an uploaded image (the uploader, or anyone allowed to manage that folder). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/uploads/[id]">) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    const { id } = await ctx.params;
    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
    if (!asset) throw new DomainError("Image not found.", "NOT_FOUND", 404);
    const allowed = asset.uploadedById === user.id || (isMediaFolder(asset.folder) && asset.folder !== "profiles" && canUploadTo(user.role, asset.folder));
    if (!allowed) throw new AuthError();
    await deleteAssets([asset.id]);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
