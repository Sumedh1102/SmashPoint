/** Domain errors carry a user-safe message and a machine-readable code. */
export class DomainError extends Error {
  constructor(
    message: string,
    public code:
      | "SLOT_UNAVAILABLE"
      | "RULE_VIOLATION"
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "EXPIRED"
      | "PAYMENT_FAILED"
      | "PAYMENTS_UNAVAILABLE"
      | "RATE_LIMITED"
      | "CONFLICT" = "INVALID_INPUT",
    public status = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return pgCode(err) === "23505";
}

export function isExclusionViolation(err: unknown): boolean {
  return pgCode(err) === "23P01";
}

/**
 * Errors raised by the `bookings_enforce_rules` trigger (drizzle/0004_court_booking_focus.sql):
 * SP001 outside opening hours, SP002 bad duration/alignment, SP003 badminton academy closure,
 * SP004 sport/court mismatch. Returns the trigger's message, or null for other errors.
 */
export function bookingRuleViolation(err: unknown): string | null {
  const code = pgCode(err);
  if (!code || !/^SP00\d$/.test(code)) return null;
  return pgMessage(err) ?? "That booking breaks the facility's booking rules.";
}

function causes(err: unknown): object[] {
  const out: object[] = [];
  let e: unknown = err;
  // Drizzle wraps driver errors; walk the cause chain.
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    out.push(e);
    e = (e as { cause?: unknown }).cause;
  }
  return out;
}

function pgCode(err: unknown): string | undefined {
  for (const e of causes(err)) {
    if ("code" in e && typeof (e as { code: unknown }).code === "string") return (e as { code: string }).code;
  }
  return undefined;
}

function pgMessage(err: unknown): string | undefined {
  for (const e of causes(err)) {
    if ("code" in e && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message;
  }
  return undefined;
}
