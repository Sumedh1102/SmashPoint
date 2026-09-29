import { describe, expect, it } from "vitest";
import { sniffImage } from "./image";
import { supabaseDriver } from "./drivers";

function png(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const v = new DataView(b.buffer);
  v.setUint32(16, width);
  v.setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number) {
  // SOI, APP0 (length 16), SOF0 with height/width.
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00,
  ]);
}

function webpVp8x(width: number, height: number) {
  const b = new Uint8Array(30);
  b.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X")]);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return b;
}

describe("sniffImage", () => {
  it("recognises PNG, JPEG and WebP with their size", () => {
    expect(sniffImage(png(1600, 900))).toEqual({ contentType: "image/png", ext: "png", width: 1600, height: 900 });
    expect(sniffImage(jpeg(2400, 1350))).toEqual({ contentType: "image/jpeg", ext: "jpg", width: 2400, height: 1350 });
    expect(sniffImage(webpVp8x(1200, 800))).toEqual({ contentType: "image/webp", ext: "webp", width: 1200, height: 800 });
  });

  it("rejects anything else, whatever the file is called", () => {
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImage(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });
});

describe("supabaseDriver", () => {
  it("uploads with the service key and returns the public URL", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const driver = supabaseDriver({ url: "https://abc.supabase.co/", serviceKey: "service-key", fetchImpl });
    const stored = await driver.put("gallery/2026/09/x y.webp", new Uint8Array([1, 2]), "image/webp");
    expect(stored).toEqual({
      provider: "supabase",
      bucket: "academy-media",
      path: "gallery/2026/09/x y.webp",
      url: "https://abc.supabase.co/storage/v1/object/public/academy-media/gallery/2026/09/x%20y.webp",
    });
    expect(calls[0]!.url).toBe("https://abc.supabase.co/storage/v1/object/academy-media/gallery/2026/09/x%20y.webp");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer service-key");
    expect(headers["Content-Type"]).toBe("image/webp");
    expect(headers["x-upsert"]).toBe("false");

    await driver.remove(["gallery/2026/09/x y.webp"]);
    expect(calls[1]!.init.method).toBe("DELETE");
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ prefixes: ["gallery/2026/09/x y.webp"] });
  });

  it("surfaces upload failures", async () => {
    const fetchImpl = (async () => new Response("Bucket not found", { status: 404 })) as unknown as typeof fetch;
    const driver = supabaseDriver({ url: "https://abc.supabase.co", serviceKey: "k", fetchImpl });
    await expect(driver.put("a.png", new Uint8Array([1]), "image/png")).rejects.toThrow(/404/);
  });
});
