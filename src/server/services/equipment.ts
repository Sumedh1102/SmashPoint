import "server-only";
import { and, asc, eq, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { db, type DbOrTx, type Transaction } from "@/server/db";
import { bookings, equipmentItems, equipmentRentals, type EquipmentItem } from "@/server/db/schema";
import { availableUnits, rentalCharge } from "@/lib/booking/equipment";
import { DomainError } from "@/server/errors";

export type EquipmentRequest = { itemId: string; quantity: number };

export type EquipmentLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  deposit: number;
  available: number;
};

const MAX_UNITS_PER_ITEM = 20;

/** Merges duplicate items and drops zero quantities. */
export function normalizeEquipment(items: EquipmentRequest[] | undefined | null): EquipmentRequest[] {
  const merged = new Map<string, number>();
  for (const i of items ?? []) {
    if (!i?.itemId || !Number.isInteger(i.quantity) || i.quantity <= 0) continue;
    merged.set(i.itemId, (merged.get(i.itemId) ?? 0) + i.quantity);
  }
  for (const [id, qty] of merged) {
    if (qty > MAX_UNITS_PER_ITEM) throw new DomainError(`You can rent at most ${MAX_UNITS_PER_ITEM} of one item per booking.`);
    merged.set(id, qty);
  }
  return [...merged].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/**
 * Peak number of units of each item held during [start, end) on a date. Rentals tied to a
 * booking only count while that booking occupies its slot (paid, or an unexpired hold).
 */
export async function reservedUnits(
  conn: DbOrTx,
  itemIds: string[],
  window: { date: string; startMinute: number; endMinute: number },
  opts: { excludeBookingIds?: string[] } = {},
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!itemIds.length) return result;
  const rows = await conn
    .select({ itemId: equipmentRentals.itemId, start: equipmentRentals.startMinute, end: equipmentRentals.endMinute, quantity: equipmentRentals.quantity })
    .from(equipmentRentals)
    .leftJoin(bookings, eq(bookings.id, equipmentRentals.bookingId))
    .where(
      and(
        inArray(equipmentRentals.itemId, itemIds),
        eq(equipmentRentals.date, window.date),
        inArray(equipmentRentals.status, ["RESERVED", "ISSUED"]),
        sql`${equipmentRentals.startMinute} < ${window.endMinute} AND ${equipmentRentals.endMinute} > ${window.startMinute}`,
        or(
          isNull(equipmentRentals.bookingId),
          inArray(bookings.status, ["PAID", "CONFIRMED"]),
          and(inArray(bookings.status, ["PENDING", "PAYMENT_INITIATED"]), or(isNull(bookings.holdExpiresAt), sql`${bookings.holdExpiresAt} > now()`)),
        ),
        opts.excludeBookingIds?.length ? or(isNull(equipmentRentals.bookingId), notInArray(equipmentRentals.bookingId, opts.excludeBookingIds)) : undefined,
      ),
    );

  // Sweep: the peak concurrent quantity within the window happens at some rental's start.
  const byItem = new Map<string, typeof rows>();
  for (const r of rows) byItem.set(r.itemId, [...(byItem.get(r.itemId) ?? []), r]);
  for (const [itemId, list] of byItem) {
    const points = new Set([window.startMinute, ...list.map((r) => Math.max(r.start, window.startMinute))]);
    let peak = 0;
    for (const p of points) {
      const load = list.filter((r) => r.start <= p && r.end > p).reduce((a, r) => a + r.quantity, 0);
      peak = Math.max(peak, load);
    }
    result.set(itemId, peak);
  }
  return result;
}

/** Active items usable for a sport (sport-specific plus shared items). */
export async function rentableItems(conn: DbOrTx, sportId: string) {
  return conn
    .select()
    .from(equipmentItems)
    .where(and(eq(equipmentItems.isActive, true), or(eq(equipmentItems.sportId, sportId), isNull(equipmentItems.sportId))))
    .orderBy(asc(equipmentItems.sortOrder), asc(equipmentItems.name));
}

/** Rentable items with the number of units free for a window (for the booking UI). */
export async function equipmentAvailability(sportId: string, window: { date: string; startMinute: number; endMinute: number }) {
  const items = await rentableItems(db, sportId);
  const reserved = await reservedUnits(db, items.map((i) => i.id), window);
  const duration = window.endMinute - window.startMinute;
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    size: item.size,
    imageUrl: item.imageUrl,
    pricing: item.pricing,
    rentalPrice: item.rentalPrice,
    deposit: item.deposit,
    chargeForOne: rentalCharge(item, 1, duration),
    available: availableUnits(item, reserved.get(item.id) ?? 0),
  }));
}

function priceLines(items: EquipmentItem[], requests: EquipmentRequest[], reserved: Map<string, number>, duration: number, sportId: string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return requests.map<EquipmentLine & { item: EquipmentItem }>((req) => {
    const item = byId.get(req.itemId);
    if (!item || !item.isActive) throw new DomainError("One of the selected items is no longer available for rent.", "EQUIPMENT_UNAVAILABLE", 409);
    if (item.sportId && item.sportId !== sportId) throw new DomainError(`${item.name} can't be rented for this sport.`);
    const available = availableUnits(item, reserved.get(item.id) ?? 0);
    const amount = rentalCharge(item, req.quantity, duration);
    return { item, itemId: item.id, name: item.name, quantity: req.quantity, unitPrice: amount / req.quantity, amount, deposit: item.deposit * req.quantity, available };
  });
}

/** Price + availability of requested items without reserving anything (quotes). */
export async function quoteEquipment(conn: DbOrTx, sportId: string, window: { date: string; startMinute: number; endMinute: number }, requests: EquipmentRequest[]) {
  const items = normalizeEquipment(requests);
  if (!items.length) return { lines: [] as EquipmentLine[], total: 0, deposit: 0 };
  const rows = await conn.select().from(equipmentItems).where(inArray(equipmentItems.id, items.map((i) => i.itemId)));
  const reserved = await reservedUnits(conn, rows.map((r) => r.id), window);
  const lines = priceLines(rows, items, reserved, window.endMinute - window.startMinute, sportId).map(({ item: _i, ...l }) => l);
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0), deposit: lines.reduce((a, l) => a + l.deposit, 0) };
}

/**
 * Reserves equipment for a booking inside its transaction. Item rows are locked (in id
 * order, after the court lock) so two concurrent bookings can never over-rent an item.
 */
export async function reserveEquipment(
  tx: Transaction,
  booking: { id: string; sportId: string; date: string; startMinute: number; endMinute: number; userId?: string | null; customerName: string },
  requests: EquipmentRequest[],
  actorId?: string | null,
) {
  const items = normalizeEquipment(requests);
  if (!items.length) return { total: 0, lines: [] as EquipmentLine[] };
  const ids = items.map((i) => i.itemId).sort();
  const rows = await tx.select().from(equipmentItems).where(inArray(equipmentItems.id, ids)).orderBy(asc(equipmentItems.id)).for("update");
  const reserved = await reservedUnits(tx, ids, booking, { excludeBookingIds: [booking.id] });
  const lines = priceLines(rows, items, reserved, booking.endMinute - booking.startMinute, booking.sportId);
  for (const line of lines) {
    if (line.quantity > line.available) {
      throw new DomainError(
        line.available === 0
          ? `${line.name} is fully rented out for that time.`
          : `Only ${line.available} × ${line.name} ${line.available === 1 ? "is" : "are"} available for that time.`,
        "EQUIPMENT_UNAVAILABLE",
        409,
      );
    }
  }
  await tx.insert(equipmentRentals).values(
    lines.map((l) => ({
      itemId: l.itemId,
      bookingId: booking.id,
      userId: booking.userId ?? null,
      customerName: booking.customerName,
      date: booking.date,
      startMinute: booking.startMinute,
      endMinute: booking.endMinute,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      deposit: l.deposit,
      status: "RESERVED" as const,
      createdById: actorId ?? booking.userId ?? null,
    })),
  );
  return { total: lines.reduce((a, l) => a + l.amount, 0), lines: lines.map(({ item: _i, ...l }) => l) };
}

/** Releases units held by bookings that ended up cancelled, expired or refunded. */
export async function cancelRentals(conn: DbOrTx, bookingIds: string[]) {
  if (!bookingIds.length) return;
  await conn
    .update(equipmentRentals)
    .set({ status: "CANCELLED" })
    .where(and(inArray(equipmentRentals.bookingId, bookingIds), eq(equipmentRentals.status, "RESERVED")));
}

/** Moves a booking's rentals to a new window after checking stock there (reschedule). */
export async function moveRentals(tx: Transaction, bookingId: string, window: { date: string; startMinute: number; endMinute: number }) {
  const rentals = await tx
    .select()
    .from(equipmentRentals)
    .where(and(eq(equipmentRentals.bookingId, bookingId), inArray(equipmentRentals.status, ["RESERVED", "ISSUED"])));
  if (!rentals.length) return;
  const ids = [...new Set(rentals.map((r) => r.itemId))].sort();
  const items = await tx.select().from(equipmentItems).where(inArray(equipmentItems.id, ids)).orderBy(asc(equipmentItems.id)).for("update");
  const reserved = await reservedUnits(tx, ids, window, { excludeBookingIds: [bookingId] });
  for (const item of items) {
    const want = rentals.filter((r) => r.itemId === item.id).reduce((a, r) => a + r.quantity, 0);
    if (want > availableUnits(item, reserved.get(item.id) ?? 0)) {
      throw new DomainError(`Not enough ${item.name} free at the new time. Remove the rental or pick another slot.`, "EQUIPMENT_UNAVAILABLE", 409);
    }
  }
  await tx
    .update(equipmentRentals)
    .set({ date: window.date, startMinute: window.startMinute, endMinute: window.endMinute })
    .where(and(eq(equipmentRentals.bookingId, bookingId), ne(equipmentRentals.status, "CANCELLED")));
}
