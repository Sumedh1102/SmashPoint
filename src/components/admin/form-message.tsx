"use client";

import { Alert } from "@/components/ui/field";

type Result = { ok: true; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> } | null;

export function FormMessage({ state }: { state: Result }) {
  if (!state) return null;
  if (state.ok) return state.message ? <Alert tone="success">{state.message}</Alert> : null;
  return <Alert tone="danger">{state.error}</Alert>;
}

export function fieldError(state: Result, name: string) {
  return state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined;
}
