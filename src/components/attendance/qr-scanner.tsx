"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CircleCheck, Keyboard, TriangleAlert } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Result =
  | { kind: "ok"; name: string; code: string; photoUrl: string | null; status: string; alreadyMarked: boolean; markedAt: string; batchName: string }
  | { kind: "error"; message: string };

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

function time(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

/** Student scans QR → identity verified → attendance marked (duplicates are rejected server-side). */
export function QrScanner({ batches }: { batches: { id: string; label: string }[] }) {
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "");
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [log, setLog] = useState<Extract<Result, { kind: "ok" }>[]>([]);
  const [manual, setManual] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const lastToken = useRef<{ token: string; at: number } | null>(null);

  const submit = useCallback(
    async (token: string) => {
      if (!batchId || busy.current) return;
      const now = Date.now();
      if (lastToken.current && lastToken.current.token === token && now - lastToken.current.at < 4000) return;
      lastToken.current = { token, at: now };
      busy.current = true;
      try {
        const res = await fetch("/api/attendance/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, batchId }) });
        const data = await res.json();
        if (!res.ok) {
          setResult({ kind: "error", message: data.error ?? "Scan failed" });
        } else {
          const ok = { kind: "ok" as const, name: data.student.name, code: data.student.studentCode, photoUrl: data.student.photoUrl, status: data.status, alreadyMarked: data.alreadyMarked, markedAt: data.markedAt, batchName: data.batchName };
          setResult(ok);
          if (!data.alreadyMarked) setLog((l) => [ok, ...l].slice(0, 12));
          if ("vibrate" in navigator) navigator.vibrate?.(data.alreadyMarked ? [60, 60, 60] : 120);
        }
      } catch {
        setResult({ kind: "error", message: "Network error — try again." });
      } finally {
        setTimeout(() => (busy.current = false), 1200);
      }
    },
    [batchId],
  );

  useEffect(() => {
    if (!camera) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
        const jsQR = detector ? null : (await import("jsqr")).default;
        const tick = async () => {
          if (stopped) return;
          if (video.readyState >= 2 && !busy.current) {
            let value: string | null = null;
            if (detector) {
              const codes = await detector.detect(video).catch(() => []);
              value = codes[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              value = jsQR(img.data, img.width, img.height)?.data ?? null;
            }
            if (value) await submit(value);
          }
          raf = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setCameraError("Camera unavailable. Allow camera access, or use a USB scanner / manual entry below.");
        setCamera(false);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, submit]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid content-start gap-4">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Batch</span>
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </Select>
        </label>

        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-ink shadow-sm">
          <video ref={videoRef} className={cn("size-full object-cover", !camera && "hidden")} muted playsInline />
          {camera ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="size-1/2 rounded-2xl border border-white/90 shadow-[0_0_0_2000px_rgba(11,11,15,0.35)]" />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
              <div>
                <Camera className="mx-auto size-10" />
                <p className="mt-3 font-display text-xl font-semibold">Scan student QR codes</p>
                <p className="mt-1 text-sm text-white/70">Point the camera at the code on the student&apos;s phone or ID card.</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setCamera((c) => !c)} variant={camera ? "outline" : "primary"} icon={camera ? <CameraOff className="size-4" /> : <Camera className="size-4" />} disabled={!batchId}>
            {camera ? "Stop camera" : "Start camera"}
          </Button>
        </div>
        {cameraError ? <p className="text-sm font-semibold text-danger">{cameraError}</p> : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) void submit(manual.trim());
            setManual("");
          }}
          className="flex gap-2"
        >
          <label className="relative flex-1">
            <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="USB scanner / paste QR value" className="pl-9" aria-label="QR code value" />
          </label>
          <Button type="submit" variant="dark" disabled={!batchId}>
            Check in
          </Button>
        </form>
      </div>

      <div className="grid content-start gap-4" aria-live="polite">
        {result ? (
          result.kind === "ok" ? (
            <div className={cn("animate-pop rounded-2xl border border-line p-5 shadow-sm", result.alreadyMarked ? "bg-warning-soft" : "bg-success-soft")}>
              <div className="flex items-center gap-4">
                <Avatar name={result.name} src={result.photoUrl} size={64} />
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold uppercase">
                    {result.alreadyMarked ? <TriangleAlert className="size-4" /> : <CircleCheck className="size-4 text-success" />}
                    {result.alreadyMarked ? "Already marked" : "Identity verified"}
                  </p>
                  <p className="font-display text-2xl font-semibold leading-tight">{result.name}</p>
                  <p className="font-mono text-xs font-medium text-muted">{result.code}</p>
                </div>
              </div>
              <p className="mt-3 font-medium">
                {result.alreadyMarked ? `Checked in at ${time(result.markedAt)} (${result.status.toLowerCase()}). No duplicate recorded.` : `Marked ${result.status.toLowerCase()} for ${result.batchName} at ${time(result.markedAt)}.`}
              </p>
            </div>
          ) : (
            <div className="animate-pop rounded-2xl border border-line bg-danger-soft p-5 shadow-sm">
              <p className="flex items-center gap-2 font-display text-xl font-semibold">
                <TriangleAlert className="size-5" /> Not checked in
              </p>
              <p className="mt-1 font-semibold">{result.message}</p>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm font-semibold text-muted">Scan results appear here.</div>
        )}

        <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
          <p className="mb-2 text-sm font-semibold">This session · {log.length} checked in</p>
          <ul className="grid gap-1.5 text-sm">
            {log.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate font-semibold">{l.name}</span>
                <span className="shrink-0 font-mono text-xs font-medium text-muted">
                  {time(l.markedAt)} · {l.status === "LATE" ? "late" : "on time"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
