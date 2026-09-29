"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { ImagePlus, LoaderCircle, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_EDGE = 2560;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export type UploadedImage = { id: string; url: string };

/** Downsizes large photos in the browser so uploads stay under the server limit. */
async function prepare(file: File): Promise<Blob> {
  if (file.size <= MAX_BYTES && file.size < 1.5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= MAX_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.86, 0.78, 0.68]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  return file;
}

function upload(blob: Blob, folder: string, onProgress: (pct: number) => void): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("folder", folder);
    body.append("file", blob, blob instanceof File ? blob.name : "image.webp");
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const data = xhr.response as { id?: string; url?: string; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && data?.id && data.url) resolve({ id: data.id, url: data.url });
      else reject(new Error(data?.error ?? "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error while uploading. Please try again."));
    xhr.send(body);
  });
}

/**
 * Drag-and-drop image field. Uploads immediately to /api/uploads (Supabase Storage on the
 * server) and submits the new asset id in a hidden input named `name`; "remove" clears the
 * saved image; an empty value leaves it unchanged. Read on the server with imageFromForm().
 */
export function ImageUpload({
  name,
  folder,
  defaultUrl,
  label = "Image",
  hint = "JPG, PNG or WebP, up to 4 MB. Large photos are resized automatically.",
  aspect = "aspect-[16/10]",
  className,
  onChange,
}: {
  name: string;
  folder: string;
  defaultUrl?: string | null;
  label?: string;
  hint?: string;
  aspect?: string;
  className?: string;
  onChange?: (image: UploadedImage | null) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(defaultUrl ?? null);
  const [value, setValue] = useState("");
  const [fresh, setFresh] = useState<UploadedImage | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const localUrl = useRef<string | null>(null);

  useEffect(() => () => void (localUrl.current && URL.revokeObjectURL(localUrl.current)), []);

  const discardFresh = (image: UploadedImage | null) => {
    if (image) void fetch(`/api/uploads/${image.id}`, { method: "DELETE" }).catch(() => {});
  };

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!ACCEPT.includes(file.type)) return setError("Please choose a JPG, PNG or WebP image.");
    if (file.size > MAX_SOURCE_BYTES) return setError("That file is too large. Please choose an image under 25 MB.");
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = URL.createObjectURL(file);
    const previous = preview;
    setPreview(localUrl.current);
    setProgress(0);
    try {
      const blob = await prepare(file);
      if (blob.size > MAX_BYTES) throw new Error("This image is still larger than 4 MB after resizing. Please choose a smaller one.");
      const image = await upload(blob, folder, setProgress);
      discardFresh(fresh);
      setFresh(image);
      setValue(image.id);
      setPreview(image.url);
      onChange?.(image);
    } catch (err) {
      setPreview(previous);
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove() {
    discardFresh(fresh);
    setFresh(null);
    setPreview(null);
    setValue(defaultUrl ? "remove" : "");
    setError(null);
    onChange?.(null);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handle(e.dataTransfer.files?.[0]);
  };

  const busy = progress !== null;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-soft">
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <input ref={fileRef} id={inputId} type="file" accept={ACCEPT.join(",")} className="sr-only" onChange={(e) => handle(e.target.files?.[0])} disabled={busy} />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative overflow-hidden rounded-lg border bg-paper/60 transition",
          aspect,
          dragging ? "border-brand bg-brand-50 ring-3 ring-brand/15" : preview ? "border-line" : "border-dashed border-line-strong",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview of a local file or an uploaded asset
          <img src={preview} alt="" className={cn("absolute inset-0 size-full object-cover", busy && "opacity-60")} />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted hover:text-ink"
          >
            <ImagePlus className="size-6 text-subtle" strokeWidth={1.5} />
            <span>
              <span className="font-medium text-brand">Browse</span> or drag an image here
            </span>
          </button>
        )}
        {busy ? (
          <div className="absolute inset-x-0 bottom-0 bg-white/90 px-3 py-2 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              Uploading… {progress}%
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-brand transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : preview ? (
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white/95 px-2.5 text-xs font-medium shadow-sm hover:bg-white">
              <RefreshCw className="size-3.5" /> Replace
            </button>
            <button type="button" onClick={remove} className="grid size-8 place-items-center rounded-md bg-white/95 text-danger shadow-sm hover:bg-white" aria-label="Remove image">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}
