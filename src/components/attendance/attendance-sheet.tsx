"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Save } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { FormMessage, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { submitWithoutReset } from "@/components/forms/submit-without-reset";

type Status = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";
type Row = { id: string; name: string; studentCode: string; photoUrl: string | null; status: Status | null; remarks: string | null; source: string | null };
type Result = { ok: true; message?: string } | { ok: false; error: string };

const OPTIONS: { value: Status; label: string; short: string; on: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", on: "bg-success text-white" },
  { value: "LATE", label: "Late", short: "L", on: "bg-warning text-ink" },
  { value: "ABSENT", label: "Absent", short: "A", on: "bg-danger text-white" },
  { value: "LEAVE", label: "Leave", short: "Lv", on: "bg-brand-200 text-ink" },
];

/** Select Batch → View Students → Mark Attendance → Save. */
export function AttendanceSheet({
  students,
  initialNotes,
  action,
  readOnly,
}: {
  students: Row[];
  initialNotes: string | null;
  action: (prev: Result | null, fd: FormData) => Promise<Result>;
  readOnly?: boolean;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => Object.fromEntries(students.map((s) => [s.id, s.status ?? "PRESENT"])));
  const [remarks, setRemarks] = useState<Record<string, string>>(() => Object.fromEntries(students.map((s) => [s.id, s.remarks ?? ""])));
  const [state, formAction, pending] = useActionState(action, null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Attendance saved", state.message);
      router.refresh();
    } else toast.error("Couldn't save attendance", state.error);
  }, [state, toast, router]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 };
    for (const s of Object.values(statuses)) c[s]++;
    return c;
  }, [statuses]);
  const unsaved = students.filter((s) => s.status !== statuses[s.id]).length;
  const records = JSON.stringify(students.map((s) => ({ studentId: s.id, status: statuses[s.id], remarks: remarks[s.id] || undefined })));

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="grid gap-5">
      <input type="hidden" name="records" value={records} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 shadow-xs">
        <div className="flex flex-wrap gap-2 text-sm font-medium">
          {OPTIONS.map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1">
              <span className={cn("grid size-5 place-items-center rounded text-[10px]", o.on)}>{o.short}</span>
              {o.label} <span className="tabular-nums">{counts[o.value]}</span>
            </span>
          ))}
        </div>
        {!readOnly ? (
          <Button variant="outline" size="sm" icon={<CheckCheck className="size-4" />} onClick={() => setStatuses(Object.fromEntries(students.map((s) => [s.id, "PRESENT" as Status])))}>
            Mark all present
          </Button>
        ) : null}
      </div>

      <ul className="grid gap-2">
        {students.map((s) => (
          <li key={s.id} className="grid gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={s.name} src={s.photoUrl} size={40} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.name}</p>
                <p className="font-mono text-xs text-muted">
                  {s.studentCode}
                  {s.source === "QR" ? " · checked in via QR" : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="grid grid-cols-4 gap-1 rounded-xl border border-line bg-paper p-1">
                {OPTIONS.map((o) => {
                  const active = statuses[s.id] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={o.label}
                      disabled={readOnly}
                      onClick={() => setStatuses((prev) => ({ ...prev, [s.id]: o.value }))}
                      className={cn("h-10 min-w-12 rounded-lg px-2 text-sm font-semibold transition", active ? `${o.on} shadow-xs` : "hover:bg-white")}
                    >
                      {o.short}
                    </button>
                  );
                })}
              </div>
              <input
                aria-label={`Remarks for ${s.name}`}
                placeholder="Remark"
                value={remarks[s.id]}
                disabled={readOnly}
                onChange={(e) => setRemarks((prev) => ({ ...prev, [s.id]: e.target.value }))}
                className="h-10 w-full rounded-lg border border-line bg-white px-2 text-sm sm:w-40"
                maxLength={200}
              />
            </div>
          </li>
        ))}
      </ul>

      <div>
        <label htmlFor="class-notes" className="mb-1.5 block text-sm font-medium">
          Class notes
        </label>
        <Textarea id="class-notes" name="notes" rows={3} defaultValue={initialNotes ?? ""} placeholder="What did the batch work on today? Anything to follow up?" disabled={readOnly} />
      </div>

      {state && !state.ok ? <FormMessage>{state.error}</FormMessage> : null}
      {!readOnly ? (
        <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink p-3 text-white shadow-sm lg:bottom-4">
          <p className="text-sm font-medium">{unsaved ? `${unsaved} change${unsaved === 1 ? "" : "s"} not saved` : "All changes saved"}</p>
          <Button type="submit" variant="primary" loading={pending} icon={<Save className="size-4" />}>
            Save attendance
          </Button>
        </div>
      ) : null}
    </form>
  );
}
