/** Domain errors carry a user-safe message and a machine-readable code. */
export class DomainError extends Error {
  constructor(
    message: string,
    public code:
      | "SLOT_UNAVAILABLE"
      | "INVALID_INPUT"
      | "NOT_FOUND"
      | "FORBIDDEN"
      | "EXPIRED"
      | "PAYMENT_FAILED"
      | "CAPACITY_FULL"
      | "NOT_RELEASED"
      | "EQUIPMENT_UNAVAILABLE"
      | "EMAIL_NOT_VERIFIED"
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

function pgCode(err: unknown): string | undefined {
  let e: unknown = err;
  // Drizzle wraps driver errors; walk the cause chain.
  for (let i = 0; i < 4 && e; i++) {
    if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code: unknown }).code === "string") {
      return (e as { code: string }).code;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}
