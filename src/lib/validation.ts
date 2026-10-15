import { z } from "zod";

/** Shared input schemas (server actions and API routes; safe to import on the client). */

/** Trims, collapses whitespace and strips control characters. */
const cleanText = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
    .pipe(z.string().max(max));

export const nameSchema = cleanText(120).pipe(z.string().min(2, "Enter your full name"));
export const emailSchema = z.string().trim().toLowerCase().max(180).pipe(z.email("Enter a valid email address"));

/** Mobile number: 10 digits, optionally with +91 / 0 prefix and spaces or dashes. Stored as +91XXXXXXXXXX. */
export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .refine((v) => /^(\+91|91|0)?[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number")
  .transform((v) => `+91${v.slice(-10)}`);

export const optionalText = (max = 500) =>
  cleanText(max)
    .optional()
    .transform((v) => v || null);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");
export const uuid = z.uuid();
export const durationSchema = z.coerce.number().pipe(z.union([z.literal(60), z.literal(120)], { error: "Bookings are for one or two hours" }));

/** What the booking form sends. Price, end time and status are always computed by the server. */
export const bookingRequestSchema = z.object({
  courtId: uuid,
  date: isoDate,
  startMinute: z.number().int().min(0).max(1439),
  duration: durationSchema,
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  notes: optionalText(300),
});

export const availabilityQuerySchema = z.object({
  date: isoDate,
  duration: durationSchema.default(60),
  court: z.string().max(80).optional(),
  sport: z.enum(["badminton", "pickleball", "basketball"]).optional(),
});

export const bookingCodeSchema = z.string().regex(/^SP-[2-9A-HJ-NP-Z]{6}$/, "Invalid booking reference");

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
