import { readFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_UPLOAD_DIR } from "@/server/storage/drivers";
import { sniffImage } from "@/server/storage/image";

/** Serves locally stored uploads in development (production uses Supabase public URLs). */
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const { path: parts } = await ctx.params;
  const file = path.resolve(LOCAL_UPLOAD_DIR, ...parts);
  if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(file);
    const image = sniffImage(bytes);
    if (!image) return new Response("Not found", { status: 404 });
    return new Response(bytes, { headers: { "Content-Type": image.contentType, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
