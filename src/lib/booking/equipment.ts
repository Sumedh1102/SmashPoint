/** Equipment rental pricing and stock arithmetic (pure). */

export type RentalPricing = "PER_BOOKING" | "PER_HOUR";

/** Charge for renting `quantity` units for a booking of `durationMinutes`. */
export function rentalCharge(item: { rentalPrice: number; pricing: RentalPricing }, quantity: number, durationMinutes: number): number {
  const units = item.pricing === "PER_HOUR" ? Math.ceil(durationMinutes / 60) : 1;
  return item.rentalPrice * quantity * units;
}

/** Units that can still be rented for a window, given units already held for overlapping windows. */
export function availableUnits(item: { totalQuantity: number; damagedQuantity: number }, reservedOverlapping: number): number {
  return Math.max(0, item.totalQuantity - item.damagedQuantity - reservedOverlapping);
}

export const PRICING_LABELS: Record<RentalPricing, string> = { PER_BOOKING: "per booking", PER_HOUR: "per hour" };
