import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";

export class AuthError extends Error {
  constructor(message = "You are not allowed to do that.") {
    super(message);
    this.name = "AuthError";
  }
}

export async function getAdmin(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** For admin pages and layouts: redirects to the admin login when signed out. */
export async function requireAdmin(): Promise<SessionUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertAdmin(): Promise<SessionUser> {
  const admin = await getAdmin();
  if (!admin) throw new AuthError("Your admin session has ended. Please sign in again.");
  return admin;
}
