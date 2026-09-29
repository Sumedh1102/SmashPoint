import "server-only";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_BUCKET } from "./folders";

export type StoredObject = { provider: "supabase" | "local"; bucket: string; path: string; url: string };

export interface StorageDriver {
  readonly provider: StoredObject["provider"];
  put(objectPath: string, bytes: Uint8Array, contentType: string): Promise<StoredObject>;
  remove(objectPaths: string[]): Promise<void>;
}

/** Supabase Storage over its REST API with the service-role key (server only). */
export function supabaseDriver(opts: { url: string; serviceKey: string; bucket?: string; fetchImpl?: typeof fetch }): StorageDriver {
  const base = opts.url.replace(/\/+$/, "");
  const bucket = opts.bucket ?? MEDIA_BUCKET;
  const f = opts.fetchImpl ?? fetch;
  const headers = { Authorization: `Bearer ${opts.serviceKey}`, apikey: opts.serviceKey };
  const encode = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  return {
    provider: "supabase",
    async put(objectPath, bytes, contentType) {
      const res = await f(`${base}/storage/v1/object/${bucket}/${encode(objectPath)}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": contentType, "Cache-Control": "max-age=31536000, immutable", "x-upsert": "false" },
        body: bytes as unknown as BodyInit,
      });
      if (!res.ok) throw new Error(`Supabase upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
      return { provider: "supabase", bucket, path: objectPath, url: `${base}/storage/v1/object/public/${bucket}/${encode(objectPath)}` };
    },
    async remove(objectPaths) {
      if (!objectPaths.length) return;
      const res = await f(`${base}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: objectPaths }),
      });
      if (!res.ok && res.status !== 404) throw new Error(`Supabase delete failed (${res.status})`);
    },
  };
}

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

/** Development only: files on local disk, served by /uploads/…. */
export function localDriver(): StorageDriver {
  return {
    provider: "local",
    async put(objectPath, bytes) {
      const file = path.join(LOCAL_UPLOAD_DIR, objectPath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes);
      return { provider: "local", bucket: MEDIA_BUCKET, path: objectPath, url: `/uploads/${objectPath}` };
    },
    async remove(objectPaths) {
      await Promise.all(objectPaths.map((p) => rm(path.join(LOCAL_UPLOAD_DIR, p), { force: true })));
    },
  };
}

export const isSupabaseConfigured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Supabase when configured; local disk in development; otherwise none (uploads disabled). */
export function getStorage(): StorageDriver | null {
  if (isSupabaseConfigured()) return supabaseDriver({ url: process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY! });
  if (process.env.NODE_ENV !== "production") return localDriver();
  return null;
}
