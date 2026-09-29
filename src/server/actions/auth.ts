"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/server/auth/session";

/**
 * Signs out of the app session. Identity (sign-in, registration, password reset) is handled
 * by Firebase in the browser; see src/components/auth and /api/auth/session.
 */
export async function logout() {
  await destroySession();
  redirect("/");
}
