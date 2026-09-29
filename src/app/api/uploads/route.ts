import { assertUser } from "@/server/auth/guards";
import { AuthError } from "@/server/auth/guards";
import { DomainError } from "@/server/errors";
import { assertSameOrigin, clientIp, errorResponse, json } from "@/server/http";
import { rateLimit } from "@/server/security";
import { canUploadTo, storeUpload } from "@/server/storage/media";
import { MAX_UPLOAD_BYTES, isMediaFolder } from "@/server/storage/folders";

/** Multipart image upload (field `file`, `folder`). Returns the stored asset. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await assertUser();
    if (!(await rateLimit(`upload:${user.id}:${clientIp(req)}`, 60, 10 * 60_000)).ok) throw new DomainError("Too many uploads. Please wait a moment.", "INVALID_INPUT", 429);
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_UPLOAD_BYTES + 64 * 1024) throw new DomainError("Images must be 4 MB or smaller.", "INVALID_INPUT", 413);

    const form = await req.formData();
    const folder = String(form.get("folder") ?? "");
    const file = form.get("file");
    if (!isMediaFolder(folder)) throw new DomainError("Unknown upload folder.");
    if (!canUploadTo(user.role, folder)) throw new AuthError("You can't upload images here.");
    if (!(file instanceof File)) throw new DomainError("Choose an image to upload.");

    const asset = await storeUpload({ bytes: new Uint8Array(await file.arrayBuffer()), folder, uploadedById: user.id });
    return json({ id: asset.id, url: asset.url, width: asset.width, height: asset.height }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
