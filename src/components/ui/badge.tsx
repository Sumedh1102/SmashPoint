import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "blue" | "green" | "yellow" | "red" | "ink" | "outline" | "brand";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-paper-2 text-ink-soft",
  blue: "bg-brand-50 text-brand-700",
  brand: "bg-brand text-white",
  green: "bg-success-soft text-success",
  yellow: "bg-warning-soft text-warning",
  red: "bg-danger-soft text-danger",
  ink: "bg-ink text-white",
  outline: "bg-white text-ink-soft ring-1 ring-inset ring-line",
};

export function Badge({ tone = "neutral", dot, className, children, ...props }: ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  // bookings
  PENDING: "yellow",
  PAYMENT_INITIATED: "yellow",
  PAID: "blue",
  CONFIRMED: "green",
  CANCELLED: "red",
  REFUNDED: "neutral",
  EXPIRED: "neutral",
  // payments
  CREATED: "neutral",
  INITIATED: "yellow",
  FAILED: "red",
  // memberships / students / catalogue
  ACTIVE: "green",
  INACTIVE: "neutral",
  SUSPENDED: "red",
  // attendance
  PRESENT: "green",
  ABSENT: "red",
  LATE: "yellow",
  LEAVE: "blue",
  // events
  DRAFT: "neutral",
  PUBLISHED: "green",
  COMPLETED: "neutral",
  WAITLISTED: "yellow",
  // courts
  MAINTENANCE: "yellow",
  // enquiries
  NEW: "blue",
  IN_PROGRESS: "yellow",
  CLOSED: "neutral",
  // equipment rentals
  RESERVED: "blue",
  ISSUED: "yellow",
  RETURNED: "green",
  DAMAGED: "red",
  LOST: "red",
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_INITIATED: "Payment initiated",
  IN_PROGRESS: "In progress",
  INITIATED: "Payment initiated",
  CREATED: "Pending",
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status] ?? "neutral"} dot className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
