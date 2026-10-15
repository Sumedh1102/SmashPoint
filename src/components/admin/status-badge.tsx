import { Badge, type BadgeTone } from "@/components/ui/badge";

const BOOKING: Record<string, [BadgeTone, string]> = {
  PENDING: ["warning", "Held · unpaid"],
  PAYMENT_INITIATED: ["warning", "Awaiting payment"],
  PAID: ["success", "Paid"],
  CONFIRMED: ["success", "Confirmed"],
  CANCELLED: ["danger", "Cancelled"],
  REFUNDED: ["neutral", "Refunded"],
  EXPIRED: ["neutral", "Expired"],
};

export function BookingStatusBadge({ status, holdExpiresAt }: { status: string; holdExpiresAt?: Date | null }) {
  // An unpaid hold that has run out is effectively expired even before the job marks it.
  if ((status === "PENDING" || status === "PAYMENT_INITIATED") && holdExpiresAt && holdExpiresAt.getTime() < Date.now()) {
    return <Badge tone="neutral">Hold expired</Badge>;
  }
  const [tone, label] = BOOKING[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}

/**
 * Payment status as verified on the server. A refund only reads "Refunded" once Razorpay has
 * processed it; before that it shows as pending.
 */
export function PaymentStatusBadge({ status, refundStatus }: { status: string | null | undefined; refundStatus?: string | null }) {
  if (!status) return <Badge tone="neutral">No payment</Badge>;
  if (refundStatus === "requested" || refundStatus === "pending") return <Badge tone="warning">Refund pending</Badge>;
  if (refundStatus === "failed") return <Badge tone="danger">Refund failed</Badge>;
  const map: Record<string, [BadgeTone, string]> = {
    CREATED: ["neutral", "Created"],
    INITIATED: ["info", "Checkout open"],
    PAID: ["success", "Paid"],
    FAILED: ["danger", "Failed"],
    REFUNDED: ["neutral", "Refunded"],
  };
  const [tone, label] = map[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}
