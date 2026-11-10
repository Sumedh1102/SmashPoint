import "server-only";
import { db } from "@/server/db";
import { notificationDeliveries } from "@/server/db/schema";
import { getSetting } from "@/server/settings";

/**
 * Transactional email through Resend (https://resend.com). Optional: without RESEND_API_KEY,
 * or with emails turned off in the notification settings, messages are skipped and logged.
 * Every attempt is recorded in notification_deliveries.
 */
export async function sendEmail(message: { to: string | null | undefined; subject: string; text: string }) {
  if (!message.to) return;
  const enabled = (await getSetting("notifications")).email;
  const apiKey = process.env.RESEND_API_KEY;
  const base = { channel: "EMAIL" as const, recipient: message.to.slice(0, 180), provider: "resend" };

  if (!enabled || !apiKey) {
    await log({ ...base, status: "SKIPPED", error: !enabled ? "Email notifications are turned off" : "RESEND_API_KEY not set" });
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "On The Sol Sports Academy <bookings@example.com>", to: message.to, subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}`);
    const json = (await res.json()) as { id?: string };
    await log({ ...base, status: "SENT", providerMessageId: json.id ?? null, sentAt: new Date() });
  } catch (err) {
    console.error("[email] send failed", err);
    await log({ ...base, status: "FAILED", error: err instanceof Error ? err.message.slice(0, 300) : "Unknown error" });
  }
}

async function log(row: typeof notificationDeliveries.$inferInsert) {
  try {
    await db.insert(notificationDeliveries).values(row);
  } catch (err) {
    console.error("[email] could not log delivery", err);
  }
}
