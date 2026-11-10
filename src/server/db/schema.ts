/**
 * On The Sol Sports Academy database schema (PostgreSQL + Drizzle ORM): courts and their rental
 * prices, guest bookings, Razorpay payments and the administrator accounts that manage them.
 *
 * Conventions
 * - Money columns are integers in minor units (paise). ₹400.00 → 40000.
 * - Facility-local calendar dates are `date` (YYYY-MM-DD, Asia/Kolkata) and times of day are
 *   minutes from midnight (`start_minute`, `end_minute`). Booking hours never cross midnight.
 * - Instants (created_at, paid_at, …) are `timestamptz`.
 *
 * Double bookings are prevented at three levels:
 *   1. the UI only offers free slots,
 *   2. the booking service re-validates inside a transaction holding a row lock on the court,
 *   3. PostgreSQL itself: the `bookings_no_overlap` EXCLUDE constraint
 *      (drizzle/0001_booking_constraints.sql) and the `bookings_enforce_rules` trigger
 *      (drizzle/0005_rental_pricing.sql: booking hours from the `booking` settings row,
 *      1–2 h durations on the hour, sport/court match).
 *
 * Tables from the earlier academy-management app (students, coaches, attendance, memberships,
 * events, …) were moved to the `legacy_archive` schema by migration 0004; nothing here uses them.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ────────────────────────────────────────────────────────────────────────── */
/* Enums                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Only ADMIN accounts can sign in. The other values belong to accounts from the earlier
 * academy app; migration 0004 deactivated those accounts and kept the rows so audit trails
 * that reference them stay intact.
 */
export const userRole = pgEnum("user_role", ["ADMIN", "MANAGER", "COACH", "RECEPTION", "CUSTOMER"]);
export const courtStatus = pgEnum("court_status", ["ACTIVE", "MAINTENANCE", "INACTIVE"]);
export const courtBlockType = pgEnum("court_block_type", ["MAINTENANCE", "BLOCKED"]);
export const bookingStatus = pgEnum("booking_status", [
  "PENDING",
  "PAYMENT_INITIATED",
  "PAID",
  "CONFIRMED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
]);
export const bookingSource = pgEnum("booking_source", ["ONLINE", "WALK_IN", "ADMIN"]);
export const paymentStatus = pgEnum("payment_status", ["CREATED", "INITIATED", "PAID", "FAILED", "REFUNDED"]);
/** Every new payment is a BOOKING; the other values describe historical rows. */
export const paymentPurpose = pgEnum("payment_purpose", ["BOOKING", "MEMBERSHIP", "EVENT", "BATCH_FEE", "OTHER"]);
export const paymentMethod = pgEnum("payment_method", ["ONLINE", "CASH", "UPI", "CARD", "BANK_TRANSFER"]);
export const notificationChannel = pgEnum("notification_channel", ["IN_APP", "EMAIL", "SMS", "WHATSAPP"]);
export const deliveryStatus = pgEnum("delivery_status", ["QUEUED", "SENT", "FAILED", "SKIPPED"]);

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ────────────────────────────────────────────────────────────────────────── */
/* Administrators                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    /** scrypt hash (see server/auth/password.ts). Null = cannot sign in until a password is set. */
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("ADMIN"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_key").on(sql`lower(${t.email})`), index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Fixed-window rate-limit counters, shared by every app instance. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Sports & courts                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

export const sports = pgTable(
  "sports",
  {
    id: id(),
    /** badminton | pickleball | basketball — booking rules are keyed by slug (lib/booking/rules.ts). */
    slug: varchar("slug", { length: 60 }).notNull().unique(),
    name: varchar("name", { length: 60 }).notNull(),
    tagline: varchar("tagline", { length: 160 }),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sports_sort_idx").on(t.sortOrder)],
);

export const courts = pgTable(
  "courts",
  {
    id: id(),
    sportId: uuid("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "restrict" }),
    /** Stable URL key, e.g. badminton-court-1 (used to pre-select a court in the booking flow). */
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 60 }).notNull(),
    description: text("description"),
    status: courtStatus("status").notNull().default("ACTIVE"),
    /** Playing surface shown to customers, e.g. "Green Mat (5 mm)". */
    surface: varchar("surface", { length: 80 }),
    /**
     * Rental price (minor units) for a one-hour booking. Prices are flat: the same at every
     * time of day, with no peak surcharge.
     */
    price1h: integer("price_1h").notNull(),
    /** Rental price for a two-hour booking: a package price, not necessarily 2 × price_1h. */
    price2h: integer("price_2h").notNull(),
    /**
     * Monthly rental plans (minor units; Monday–Saturday). Shown on the website with an
     * enquiry button — they are arranged with the facility, not bought through online checkout.
     * Null = plan not offered for this court.
     */
    monthlyPrice1m: integer("monthly_price_1m"),
    monthlyPrice3m: integer("monthly_price_3m"),
    monthlyPrice6m: integer("monthly_price_6m"),
    monthlyPrice12m: integer("monthly_price_12m"),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "courts_prices_valid",
      sql`${t.price1h} >= 0 AND ${t.price2h} >= 0 AND coalesce(${t.monthlyPrice1m}, 0) >= 0 AND coalesce(${t.monthlyPrice3m}, 0) >= 0 AND coalesce(${t.monthlyPrice6m}, 0) >= 0 AND coalesce(${t.monthlyPrice12m}, 0) >= 0`,
    ),
    index("courts_sort_idx").on(t.sortOrder),
    index("courts_sport_idx").on(t.sportId),
  ],
);

/**
 * Operational closures set by an administrator: maintenance windows and blocked slots.
 * A row applies to every day between start_date and end_date (inclusive). When the minute
 * columns are null the whole day is closed.
 */
export const courtBlocks = pgTable(
  "court_blocks",
  {
    id: id(),
    courtId: uuid("court_id")
      .notNull()
      .references(() => courts.id, { onDelete: "cascade" }),
    type: courtBlockType("type").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    startMinute: smallint("start_minute"),
    endMinute: smallint("end_minute"),
    reason: varchar("reason", { length: 200 }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("court_blocks_range_idx").on(t.courtId, t.startDate, t.endDate),
    check("court_blocks_dates", sql`${t.endDate} >= ${t.startDate}`),
    check(
      "court_blocks_minutes",
      sql`(${t.startMinute} IS NULL AND ${t.endMinute} IS NULL) OR (${t.startMinute} IS NOT NULL AND ${t.endMinute} > ${t.startMinute})`,
    ),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Bookings                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * One row per court reservation. A new booking starts as a PENDING hold with
 * `hold_expires_at`; it only becomes CONFIRMED after a verified payment. Holds that run out
 * are marked EXPIRED and stop occupying the slot.
 */
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    /** Human-friendly, non-sequential reference, e.g. SP-7K3D9Q. */
    code: varchar("code", { length: 16 }).notNull().unique(),
    sportId: uuid("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "restrict" }),
    courtId: uuid("court_id")
      .notNull()
      .references(() => courts.id, { onDelete: "restrict" }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 180 }),
    date: date("date", { mode: "string" }).notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    /** Court price computed by the server. */
    subtotal: integer("subtotal").notNull(),
    /** Historical discounts (coupons/memberships of the earlier app); 0 for new bookings. */
    discount: integer("discount").notNull().default(0),
    /** Amount charged: subtotal − discount. */
    total: integer("total").notNull(),
    status: bookingStatus("status").notNull().default("PENDING"),
    source: bookingSource("source").notNull().default("ONLINE"),
    notes: text("notes"),
    /** Unpaid holds stop occupying the slot after this instant. */
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: varchar("cancel_reason", { length: 300 }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bookings_court_date_idx").on(t.courtId, t.date),
    index("bookings_date_idx").on(t.date),
    index("bookings_status_idx").on(t.status),
    index("bookings_phone_idx").on(t.customerPhone),
    index("bookings_sport_date_idx").on(t.sportId, t.date),
    index("bookings_hold_idx").on(t.status, t.holdExpiresAt),
    index("bookings_created_idx").on(t.createdAt),
    check("bookings_time_order", sql`${t.endMinute} > ${t.startMinute}`),
    check("bookings_amounts", sql`${t.total} >= 0 AND ${t.discount} >= 0 AND ${t.subtotal} >= 0`),
  ],
);

/** Lifecycle audit trail: Pending → Payment initiated → Paid → Confirmed (→ Cancelled → Refunded). */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: id(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    status: bookingStatus("status").notNull(),
    note: varchar("note", { length: 300 }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("booking_events_booking_idx").on(t.bookingId, t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Payments                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * One row per checkout attempt (= one Razorpay order). Only references and amounts are
 * stored — never card or bank details.
 */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    receiptNumber: varchar("receipt_number", { length: 24 }).notNull().unique(),
    purpose: paymentPurpose("purpose").notNull().default("BOOKING"),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    payerName: varchar("payer_name", { length: 120 }).notNull(),
    payerEmail: varchar("payer_email", { length: 180 }),
    payerPhone: varchar("payer_phone", { length: 20 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    status: paymentStatus("status").notNull().default("CREATED"),
    method: paymentMethod("method").notNull().default("ONLINE"),
    /** razorpay (or "offline" for historical desk payments). */
    provider: varchar("provider", { length: 30 }).notNull(),
    /** Razorpay order id (order_…). */
    providerOrderId: varchar("provider_order_id", { length: 100 }),
    /** Razorpay payment id (pay_…), set once a payment is verified. */
    providerPaymentId: varchar("provider_payment_id", { length: 100 }),
    providerSignature: text("provider_signature"),
    failureReason: varchar("failure_reason", { length: 300 }),
    /** Razorpay refund id (rfnd_…). */
    refundReference: varchar("refund_reference", { length: 100 }),
    /** Razorpay refund status: pending | processed | failed. */
    refundStatus: varchar("refund_status", { length: 20 }),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    recordedById: uuid("recorded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("payments_booking_idx").on(t.bookingId),
    index("payments_status_idx").on(t.status),
    index("payments_created_idx").on(t.createdAt),
    index("payments_provider_payment_idx").on(t.providerPaymentId),
    uniqueIndex("payments_provider_order_key").on(t.provider, t.providerOrderId),
    check("payments_amount_positive", sql`${t.amount} >= 0`),
  ],
);

/** Webhook deliveries already processed (Razorpay retries and may send an event twice). */
export const paymentWebhookEvents = pgTable("payment_webhook_events", {
  /** x-razorpay-event-id */
  id: varchar("id", { length: 100 }).primaryKey(),
  provider: varchar("provider", { length: 30 }).notNull(),
  event: varchar("event", { length: 60 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Platform                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * JSON documents: `booking` (hold minutes, advance days, booking hours — read by the rules
 * trigger too), `notifications`, `catalogue` (applied catalogue revision, scripts/lib/setup.ts)
 * and, on demo databases only, `demo_data`.
 */
export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Outbound email log (booking confirmations, reminders, refunds). */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: id(),
    channel: notificationChannel("channel").notNull(),
    recipient: varchar("recipient", { length: 180 }).notNull(),
    status: deliveryStatus("status").notNull().default("QUEUED"),
    provider: varchar("provider", { length: 40 }),
    providerMessageId: varchar("provider_message_id", { length: 120 }),
    error: varchar("error", { length: 300 }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_deliveries_created_idx").on(t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(),
    entity: varchar("entity", { length: 60 }).notNull(),
    entityId: varchar("entity_id", { length: 60 }),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entity, t.entityId)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Relations (for the relational query API)                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const sportsRelations = relations(sports, ({ many }) => ({
  courts: many(courts),
}));

export const courtsRelations = relations(courts, ({ one, many }) => ({
  sport: one(sports, { fields: [courts.sportId], references: [sports.id] }),
  bookings: many(bookings),
  blocks: many(courtBlocks),
}));

export const courtBlocksRelations = relations(courtBlocks, ({ one }) => ({
  court: one(courts, { fields: [courtBlocks.courtId], references: [courts.id] }),
  createdBy: one(users, { fields: [courtBlocks.createdById], references: [users.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  sport: one(sports, { fields: [bookings.sportId], references: [sports.id] }),
  court: one(courts, { fields: [bookings.courtId], references: [courts.id] }),
  events: many(bookingEvents),
  payments: many(payments),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, { fields: [bookingEvents.bookingId], references: [bookings.id] }),
  actor: one(users, { fields: [bookingEvents.actorId], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

/* ────────────────────────────────────────────────────────────────────────── */
/* Row types                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type Court = typeof courts.$inferSelect;
export type CourtStatus = (typeof courtStatus.enumValues)[number];
export type CourtBlock = typeof courtBlocks.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type Payment = typeof payments.$inferSelect;
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
