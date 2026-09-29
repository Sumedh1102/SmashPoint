import { z } from "zod";

/** Shared input schemas (used by server actions/API routes; safe to import on the client). */

const PHONE_RE = /^\+?[\d\s()-]{10,18}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_RE, "Enter a valid phone number")
  .refine((v) => v.replace(/\D/g, "").length >= 10, "Enter a valid phone number");

export const nameSchema = z.string().trim().min(2, "Enter at least 2 characters").max(120);
export const emailSchema = z.string().trim().toLowerCase().max(180).pipe(z.email("Enter a valid email address"));
export const optionalEmail = z.union([z.literal(""), emailSchema]).optional().transform((v) => v || null);
export const optionalText = (max = 500) => z.string().trim().max(max).optional().transform((v) => v || null);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");
export const uuid = z.uuid();

const equipmentSelection = z
  .array(z.object({ itemId: uuid, quantity: z.coerce.number().int().min(0).max(20) }))
  .max(20)
  .optional()
  .default([]);

/** What the booking review step prices: a single slot or a monthly/quarterly plan. */
export const bookingPlanSchema = z.object({
  type: z.enum(["SINGLE", "MONTHLY", "QUARTERLY"]).default("SINGLE"),
  courtId: uuid,
  /** The slot date, or the first day of a monthly/quarterly plan. */
  date: isoDate,
  startMinute: z.coerce.number().int().min(0).max(1439),
  duration: z.coerce.number().int().min(30).max(240),
  /** Monthly/quarterly only: 0 = Sunday … 6 = Saturday. */
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional().default([]),
  equipment: equipmentSelection,
  couponCode: z.string().trim().max(30).optional(),
});

export const bookingRequestSchema = bookingPlanSchema.extend({
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema,
  notes: optionalText(300),
});

export const enquirySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: z.union([z.literal(""), phoneSchema]).optional().transform((v) => v || null),
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(2000),
  website: z.string().max(0).optional(), // honeypot
});

export const eventRegistrationSchema = z.object({
  eventId: uuid,
  participantName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  division: z.string().trim().max(80).optional().transform((v) => v || null),
});

export type FieldErrors = Record<string, string[] | undefined>;

export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  return z.flattenError(error).fieldErrors as FieldErrors;
}
