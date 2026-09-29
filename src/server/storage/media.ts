import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { mediaAssets, type MediaAsset } from "@/server/db/schema";
import { DomainError } from "@/server/errors";
import { randomToken } from "@/server/security";
import { can, type Role } from "@/lib/rbac";
import { getStorage } from "./drivers";
import { MAX_UPLOAD_BYTES, MEDIA_FOLDERS, type MediaFolder } from "./folders";
import { sniffImage } from "./image";

export function canUploadTo(role: Role, folder: MediaFolder) {
  const permission = MEDIA_FOLDERS[folder];
  return permission === null || can(role, permission);
}

/**
 * Validates an image (size + magic bytes), stores it in object storage under
 * `<folder>/<yyyy>/<mm>/<random>.<ext>` and records its metadata. Returns the asset row.
 */
export async function storeUpload(input: { bytes: Uint8Array; folder: MediaFolder; uploadedById: string }): Promise<MediaAsset> {
  if (input.bytes.byteLength === 0) throw new DomainError("Choose an image to upload.");
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) throw new DomainError("Images must be 4 MB or smaller.");
  const image = sniffImage(input.bytes);
  if (!image) throw new DomainError("Upload a JPG, PNG or WebP image.");
  if ((image.width ?? 0) > 12000 || (image.height ?? 0) > 12000) throw new DomainError("That image is too large.");

  const storage = getStorage();
  if (!storage) throw new DomainError("Image uploads aren't configured on this site yet (Supabase Storage).", "FORBIDDEN", 503);

  const now = new Date();
  const objectPath = `${input.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomToken(12)}.${image.ext}`;
  const stored = await storage.put(objectPath, input.bytes, image.contentType);
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      provider: stored.provider,
      bucket: stored.bucket,
      path: stored.path,
      url: stored.url,
      folder: input.folder,
      contentType: image.contentType,
      byteSize: input.bytes.byteLength,
      width: image.width,
      height: image.height,
      uploadedById: input.uploadedById,
    })
    .returning();
  return asset!;
}

/** Deletes assets from storage and the database (e.g. after an image is replaced). */
export async function deleteAssets(ids: (string | null | undefined)[]) {
  const wanted = ids.filter((id): id is string => !!id);
  if (!wanted.length) return;
  const rows = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, wanted));
  const storage = getStorage();
  for (const provider of ["supabase", "local"] as const) {
    const paths = rows.filter((r) => r.provider === provider).map((r) => r.path);
    if (paths.length && storage?.provider === provider) {
      await storage.remove(paths).catch((err) => console.error("[media] delete failed", err));
    }
  }
  if (rows.length) await db.delete(mediaAssets).where(inArray(mediaAssets.id, rows.map((r) => r.id)));
}

/** Resolves an asset id submitted with a form to its public URL (and checks it exists). */
export async function assetUrl(id: string | null | undefined): Promise<{ id: string; url: string } | null> {
  if (!id) return null;
  const [row] = await db.select({ id: mediaAssets.id, url: mediaAssets.url }).from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  if (!row) throw new DomainError("That image upload has expired. Please upload it again.");
  return row;
}
