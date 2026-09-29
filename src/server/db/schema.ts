/**
 * SmashPoint database schema (PostgreSQL + Drizzle ORM).
 *
 * Conventions
 * - All money columns are integers in minor units (paise for INR). ₹400.00 → 40000.
 * - Academy-local calendar dates are stored as `date` (YYYY-MM-DD strings) and times of
 *   day as minutes from midnight (`start_minute`, `end_minute`). Operating hours never
 *   cross midnight, which keeps availability maths and overlap constraints simple and
 *   timezone-proof.
 * - Instants (created_at, paid_at, …) are `timestamptz`.
 *
 * Booking conflicts are prevented at three levels:
 *   1. the UI only offers free slots,
 *   2. the booking service re-validates inside a transaction holding a row lock on the court,
 *   3. a PostgreSQL EXCLUDE constraint (see drizzle/0001_booking_constraints.sql) makes an
 *      overlapping active booking physically impossible.
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
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

export const userRole = pgEnum("user_role", ["ADMIN", "MANAGER", "COACH", "RECEPTION", "CUSTOMER"]);
export const gender = pgEnum("gender", ["MALE", "FEMALE", "OTHER"]);
export const studentStatus = pgEnum("student_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const skillLevel = pgEnum("skill_level", ["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export const programLevel = pgEnum("program_level", ["BEGINNER", "INTERMEDIATE", "ADVANCED", "KIDS"]);
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
/** Single visit, or a recurring block of sessions paid up front. */
export const bookingType = pgEnum("booking_type", ["SINGLE", "MONTHLY", "QUARTERLY"]);
export const bookingSource = pgEnum("booking_source", ["ONLINE", "WALK_IN", "ADMIN"]);
export const paymentStatus = pgEnum("payment_status", ["CREATED", "INITIATED", "PAID", "FAILED", "REFUNDED"]);
export const paymentPurpose = pgEnum("payment_purpose", ["BOOKING", "MEMBERSHIP", "EVENT", "BATCH_FEE", "OTHER"]);
export const paymentMethod = pgEnum("payment_method", ["ONLINE", "CASH", "UPI", "CARD", "BANK_TRANSFER"]);
export const membershipStatus = pgEnum("membership_status", ["PENDING", "ACTIVE", "EXPIRED", "CANCELLED"]);
export const attendanceStatus = pgEnum("attendance_status", ["PRESENT", "ABSENT", "LATE", "LEAVE"]);
export const attendanceSource = pgEnum("attendance_source", ["MANUAL", "QR"]);
export const eventCategory = pgEnum("event_category", ["TOURNAMENT", "WORKSHOP", "CAMP", "SOCIAL", "TRIAL"]);
export const eventStatus = pgEnum("event_status", ["DRAFT", "PUBLISHED", "CANCELLED", "COMPLETED"]);
export const registrationStatus = pgEnum("registration_status", ["PENDING", "CONFIRMED", "WAITLISTED", "CANCELLED"]);
export const notificationType = pgEnum("notification_type", [
  "BOOKING_CONFIRMED",
  "BOOKING_REMINDER",
  "BOOKING_CANCELLED",
  "MEMBERSHIP_EXPIRY",
  "PAYMENT_RECEIVED",
  "ANNOUNCEMENT",
  "CLASS_REMINDER",
  "EVENT",
  "GENERAL",
]);
export const notificationChannel = pgEnum("notification_channel", ["IN_APP", "EMAIL", "SMS", "WHATSAPP"]);
export const deliveryStatus = pgEnum("delivery_status", ["QUEUED", "SENT", "FAILED", "SKIPPED"]);
export const announcementAudience = pgEnum("announcement_audience", ["EVERYONE", "STUDENTS", "STAFF"]);
export const couponType = pgEnum("coupon_type", ["PERCENT", "FLAT"]);
export const couponScope = pgEnum("coupon_scope", ["ALL", "BOOKING", "MEMBERSHIP", "EVENT"]);
export const enquiryStatus = pgEnum("enquiry_status", ["NEW", "IN_PROGRESS", "CLOSED"]);
export const equipmentPricing = pgEnum("equipment_pricing", ["PER_BOOKING", "PER_HOUR"]);
export const rentalStatus = pgEnum("rental_status", ["RESERVED", "ISSUED", "RETURNED", "CANCELLED", "DAMAGED", "LOST"]);

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

export type UserPreferences = {
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  bookingReminders: boolean;
  classReminders: boolean;
  marketing: boolean;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Identity                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    /** Firebase Authentication uid. Identity lives in Firebase; this row holds the profile and role. */
    firebaseUid: varchar("firebase_uid", { length: 128 }).unique(),
    /** Legacy scrypt hash from before Firebase (kept only so accounts can be imported into Firebase). */
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("CUSTOMER"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    emergencyContactName: varchar("emergency_contact_name", { length: 120 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
    preferences: jsonb("preferences").$type<UserPreferences>(),
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

export const parents = pgTable(
  "parents",
  {
    id: id(),
    userId: uuid("user_id")
      .unique()
      .references(() => users.id, { onDelete: "set null" }),
    name: varchar("name", { length: 120 }).notNull(),
    relation: varchar("relation", { length: 40 }).notNull().default("Parent"),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 180 }),
    occupation: varchar("occupation", { length: 120 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("parents_phone_idx").on(t.phone)],
);

export const coaches = pgTable(
  "coaches",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 120 }).notNull(),
    experienceYears: smallint("experience_years").notNull().default(0),
    specialization: varchar("specialization", { length: 200 }).notNull(),
    certifications: text("certifications").array().notNull().default(sql`'{}'::text[]`),
    achievements: text("achievements").array().notNull().default(sql`'{}'::text[]`),
    bio: text("bio").notNull().default(""),
    photoUrl: text("photo_url"),
    isPublic: boolean("is_public").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
);

export const students = pgTable(
  "students",
  {
    id: id(),
    userId: uuid("user_id")
      .unique()
      .references(() => users.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references(() => parents.id, { onDelete: "set null" }),
    studentCode: varchar("student_code", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    photoUrl: text("photo_url"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    gender: gender("gender"),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 180 }),
    address: text("address"),
    emergencyContactName: varchar("emergency_contact_name", { length: 120 }),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
    joiningDate: date("joining_date", { mode: "string" }).notNull().defaultNow(),
    level: skillLevel("level").notNull().default("BEGINNER"),
    status: studentStatus("status").notNull().default("ACTIVE"),
    coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
    /** Random token encoded in the student's check-in QR code. Rotatable by staff. */
    qrToken: varchar("qr_token", { length: 48 }).notNull().unique(),
    medicalNotes: text("medical_notes"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("students_name_idx").on(sql`lower(${t.name})`),
    index("students_status_idx").on(t.status),
    index("students_coach_idx").on(t.coachId),
    index("students_parent_idx").on(t.parentId),
    index("students_joining_idx").on(t.joiningDate),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Courts & bookings                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export const sports = pgTable(
  "sports",
  {
    id: id(),
    slug: varchar("slug", { length: 60 }).notNull().unique(),
    name: varchar("name", { length: 60 }).notNull(),
    tagline: varchar("tagline", { length: 160 }),
    description: text("description"),
    imageUrl: text("image_url"),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
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
    name: varchar("name", { length: 60 }).notNull(),
    description: text("description"),
    surface: varchar("surface", { length: 80 }).notNull().default("Synthetic PU mat"),
    status: courtStatus("status").notNull().default("ACTIVE"),
    imageUrl: text("image_url"),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    /** Bookable durations in minutes, e.g. {60,120}. */
    durations: smallint("durations").array().notNull().default(sql`'{60,120}'::smallint[]`),
    /** Which booking types this court accepts. */
    bookingTypes: bookingType("booking_types").array().notNull().default(sql`'{SINGLE}'::booking_type[]`),
    /** Optional per-court opening hours; null falls back to the academy-wide hours. */
    openMinute: smallint("open_minute"),
    closeMinute: smallint("close_minute"),
    /** Non-peak price per hour (minor units). */
    hourlyRate: integer("hourly_rate").notNull(),
    /** Peak price per hour (minor units). Peak windows live in settings. */
    peakHourlyRate: integer("peak_hourly_rate").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("courts_rates_positive", sql`${t.hourlyRate} >= 0 AND ${t.peakHourlyRate} >= 0`),
    check(
      "courts_hours",
      sql`(${t.openMinute} IS NULL AND ${t.closeMinute} IS NULL) OR (${t.openMinute} IS NOT NULL AND ${t.closeMinute} > ${t.openMinute})`,
    ),
    index("courts_sort_idx").on(t.sortOrder),
    index("courts_sport_idx").on(t.sportId),
  ],
);

/**
 * Court slot overrides: maintenance windows and admin-blocked slots.
 * A row applies to every day between start_date and end_date (inclusive). When the
 * minute columns are null the whole day is unavailable.
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

export const coupons = pgTable("coupons", {
  id: id(),
  code: varchar("code", { length: 30 }).notNull().unique(),
  description: varchar("description", { length: 200 }),
  type: couponType("type").notNull(),
  /** Percent (1–100) for PERCENT coupons, minor units for FLAT coupons. */
  value: integer("value").notNull(),
  scope: couponScope("scope").notNull().default("ALL"),
  minAmount: integer("min_amount").notNull().default(0),
  maxDiscount: integer("max_discount"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  validFrom: date("valid_from", { mode: "string" }),
  validUntil: date("valid_until", { mode: "string" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

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
    /** Set for sessions that belong to a monthly/quarterly booking. */
    seriesId: uuid("series_id").references((): AnyPgColumn => bookingSeries.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 180 }),
    date: date("date", { mode: "string" }).notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    /** Court price before discounts. */
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    /** Equipment rental charges (not discounted). */
    equipmentTotal: integer("equipment_total").notNull().default(0),
    /** subtotal − discount + equipmentTotal */
    total: integer("total").notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    status: bookingStatus("status").notNull().default("PENDING"),
    source: bookingSource("source").notNull().default("ONLINE"),
    notes: text("notes"),
    /** Unpaid holds are released after this instant. */
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: varchar("cancel_reason", { length: 300 }),
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bookings_court_date_idx").on(t.courtId, t.date),
    index("bookings_date_idx").on(t.date),
    index("bookings_user_idx").on(t.userId),
    index("bookings_status_idx").on(t.status),
    index("bookings_phone_idx").on(t.customerPhone),
    index("bookings_sport_date_idx").on(t.sportId, t.date),
    index("bookings_series_idx").on(t.seriesId),
    check("bookings_time_order", sql`${t.endMinute} > ${t.startMinute}`),
    check("bookings_amounts", sql`${t.total} >= 0 AND ${t.discount} >= 0 AND ${t.subtotal} >= 0 AND ${t.equipmentTotal} >= 0`),
  ],
);

/**
 * A monthly or quarterly booking: the same court and time on chosen weekdays between two
 * dates, paid up front. Each session is a row in `bookings` (with series_id), so the
 * overlap constraint protects every session exactly like a single booking.
 */
export const bookingSeries = pgTable(
  "booking_series",
  {
    id: id(),
    code: varchar("code", { length: 16 }).notNull().unique(),
    type: bookingType("type").notNull(),
    sportId: uuid("sport_id")
      .notNull()
      .references(() => sports.id, { onDelete: "restrict" }),
    courtId: uuid("court_id")
      .notNull()
      .references(() => courts.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 20 }).notNull(),
    customerEmail: varchar("customer_email", { length: 180 }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    /** 0 = Sunday … 6 = Saturday */
    daysOfWeek: smallint("days_of_week").array().notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    sessionCount: smallint("session_count").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    equipmentTotal: integer("equipment_total").notNull().default(0),
    total: integer("total").notNull(),
    status: bookingStatus("status").notNull().default("PENDING"),
    source: bookingSource("source").notNull().default("ONLINE"),
    notes: text("notes"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: varchar("cancel_reason", { length: 300 }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("booking_series_user_idx").on(t.userId),
    index("booking_series_court_idx").on(t.courtId, t.startDate),
    check("booking_series_dates", sql`${t.endDate} >= ${t.startDate}`),
    check("booking_series_time_order", sql`${t.endMinute} > ${t.startMinute}`),
    check("booking_series_amounts", sql`${t.total} >= 0 AND ${t.subtotal} >= 0 AND ${t.discount} >= 0`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Equipment                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const equipmentItems = pgTable(
  "equipment_items",
  {
    id: id(),
    /** Null = usable for every sport. */
    sportId: uuid("sport_id").references(() => sports.id, { onDelete: "set null" }),
    name: varchar("name", { length: 120 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    description: text("description"),
    size: varchar("size", { length: 40 }),
    imageUrl: text("image_url"),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    totalQuantity: integer("total_quantity").notNull(),
    /** Units out of service (damaged / under repair); not rentable. */
    damagedQuantity: integer("damaged_quantity").notNull().default(0),
    rentalPrice: integer("rental_price").notNull(),
    pricing: equipmentPricing("pricing").notNull().default("PER_BOOKING"),
    /** Refundable deposit collected at the desk (minor units). */
    deposit: integer("deposit").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("equipment_items_sport_idx").on(t.sportId),
    check("equipment_quantities", sql`${t.totalQuantity} >= 0 AND ${t.damagedQuantity} >= 0 AND ${t.damagedQuantity} <= ${t.totalQuantity}`),
    check("equipment_prices", sql`${t.rentalPrice} >= 0 AND ${t.deposit} >= 0`),
  ],
);

/**
 * Units of an item held for a time window. Rentals attached to a booking follow its lifecycle;
 * staff can also record walk-in rentals without a booking.
 */
export const equipmentRentals = pgTable(
  "equipment_rentals",
  {
    id: id(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => equipmentItems.id, { onDelete: "restrict" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 120 }),
    date: date("date", { mode: "string" }).notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    quantity: smallint("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    amount: integer("amount").notNull(),
    deposit: integer("deposit").notNull().default(0),
    status: rentalStatus("status").notNull().default("RESERVED"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    notes: varchar("notes", { length: 300 }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("equipment_rentals_item_date_idx").on(t.itemId, t.date),
    index("equipment_rentals_booking_idx").on(t.bookingId),
    index("equipment_rentals_user_idx").on(t.userId),
    check("equipment_rentals_quantity", sql`${t.quantity} > 0`),
    check("equipment_rentals_time_order", sql`${t.endMinute} > ${t.startMinute}`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Public content                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: id(),
    category: varchar("category", { length: 40 }).notNull(),
    caption: varchar("caption", { length: 200 }),
    imageUrl: text("image_url").notNull(),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("gallery_items_order_idx").on(t.isPublished, t.sortOrder)],
);

export const facilities = pgTable(
  "facilities",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    /** SPORTS | EQUIPMENT | FOOD_BEVERAGE | AMENITY */
    category: varchar("category", { length: 40 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    availability: varchar("availability", { length: 120 }),
    price: integer("price"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("facilities_category_idx").on(t.category, t.sortOrder)],
);

/** Café menu. Informational today; price + availability are stored so ordering can be added later. */
export const foodItems = pgTable(
  "food_items",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    category: varchar("category", { length: 40 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    price: integer("price"),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("food_items_category_idx").on(t.category, t.sortOrder), check("food_items_price", sql`${t.price} IS NULL OR ${t.price} >= 0`)],
);

/** Coaching is advertised only; enquiries go through the contact form. */
export const coachingAds = pgTable(
  "coaching_ads",
  {
    id: id(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    title: varchar("title", { length: 120 }).notNull(),
    summary: varchar("summary", { length: 240 }).notNull(),
    description: text("description"),
    sportId: uuid("sport_id").references(() => sports.id, { onDelete: "set null" }),
    coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
    imageUrl: text("image_url"),
    imageAssetId: uuid("image_asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    skillLevel: varchar("skill_level", { length: 60 }),
    ageRange: varchar("age_range", { length: 60 }),
    timing: varchar("timing", { length: 120 }),
    highlights: text("highlights").array().notNull().default(sql`'{}'::text[]`),
    ctaLabel: varchar("cta_label", { length: 40 }).notNull().default("Enquire now"),
    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("coaching_ads_order_idx").on(t.isPublished, t.sortOrder)],
);

/** Lifecycle audit trail: Pending → Payment Initiated → Paid → Confirmed (→ Cancelled → Refunded). */
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
/* Programs, batches, attendance, performance                                */
/* ────────────────────────────────────────────────────────────────────────── */

export const programs = pgTable("programs", {
  id: id(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  level: programLevel("level").notNull(),
  tagline: varchar("tagline", { length: 200 }).notNull(),
  description: text("description").notNull(),
  ageGroup: varchar("age_group", { length: 60 }).notNull(),
  frequency: varchar("frequency", { length: 80 }).notNull(),
  sessionDuration: varchar("session_duration", { length: 60 }).notNull(),
  programLength: varchar("program_length", { length: 60 }).notNull(),
  coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
  monthlyFee: integer("monthly_fee").notNull(),
  highlights: text("highlights").array().notNull().default(sql`'{}'::text[]`),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const batches = pgTable(
  "batches",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
    courtId: uuid("court_id").references(() => courts.id, { onDelete: "set null" }),
    /** 0 = Sunday … 6 = Saturday */
    daysOfWeek: smallint("days_of_week").array().notNull(),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute").notNull(),
    capacity: smallint("capacity").notNull().default(16),
    monthlyFee: integer("monthly_fee").notNull().default(0),
    level: programLevel("level").notNull().default("BEGINNER"),
    isActive: boolean("is_active").notNull().default(true),
    startDate: date("start_date", { mode: "string" }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("batches_coach_idx").on(t.coachId),
    index("batches_court_idx").on(t.courtId),
    check("batches_time_order", sql`${t.endMinute} > ${t.startMinute}`),
    check("batches_capacity", sql`${t.capacity} > 0`),
  ],
);

export const batchStudents = pgTable(
  "batch_students",
  {
    id: id(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    joinedOn: date("joined_on", { mode: "string" }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    uniqueIndex("batch_students_unique").on(t.batchId, t.studentId),
    index("batch_students_student_idx").on(t.studentId),
  ],
);

/** One attendance sheet per batch per day ("Attendance"). Holds the coach's class notes. */
export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: id(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    notes: text("notes"),
    markedById: uuid("marked_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("attendance_sessions_batch_date").on(t.batchId, t.date), index("attendance_sessions_date_idx").on(t.date)],
);

/** One row per student per session — the unique index prevents duplicate attendance. */
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull(),
    source: attendanceSource("source").notNull().default("MANUAL"),
    remarks: varchar("remarks", { length: 200 }),
    markedById: uuid("marked_by_id").references(() => users.id, { onDelete: "set null" }),
    markedAt: timestamp("marked_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("attendance_records_unique").on(t.sessionId, t.studentId),
    index("attendance_records_student_idx").on(t.studentId),
  ],
);

export const performanceRecords = pgTable(
  "performance_records",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    coachId: uuid("coach_id").references(() => coaches.id, { onDelete: "set null" }),
    assessedOn: date("assessed_on", { mode: "string" }).notNull(),
    footwork: smallint("footwork").notNull(),
    smash: smallint("smash").notNull(),
    drop: smallint("drop").notNull(),
    serve: smallint("serve").notNull(),
    defense: smallint("defense").notNull(),
    agility: smallint("agility").notNull(),
    stamina: smallint("stamina").notNull(),
    matchPerformance: smallint("match_performance").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("performance_student_idx").on(t.studentId, t.assessedOn),
    check(
      "performance_scores_range",
      sql`${t.footwork} BETWEEN 1 AND 10 AND ${t.smash} BETWEEN 1 AND 10 AND ${t.drop} BETWEEN 1 AND 10 AND ${t.serve} BETWEEN 1 AND 10 AND ${t.defense} BETWEEN 1 AND 10 AND ${t.agility} BETWEEN 1 AND 10 AND ${t.stamina} BETWEEN 1 AND 10 AND ${t.matchPerformance} BETWEEN 1 AND 10`,
    ),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Memberships & payments                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export const membershipPlans = pgTable("membership_plans", {
  id: id(),
  name: varchar("name", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  description: varchar("description", { length: 300 }).notNull().default(""),
  durationMonths: smallint("duration_months").notNull(),
  price: integer("price").notNull(),
  trainingAccess: varchar("training_access", { length: 160 }).notNull(),
  benefits: text("benefits").array().notNull().default(sql`'{}'::text[]`),
  courtDiscountPercent: smallint("court_discount_percent").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: smallint("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => membershipPlans.id, { onDelete: "restrict" }),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    status: membershipStatus("status").notNull().default("PENDING"),
    paymentStatus: paymentStatus("payment_status").notNull().default("CREATED"),
    /** Price snapshot at purchase time (minor units). */
    price: integer("price").notNull(),
    autoRenew: boolean("auto_renew").notNull().default(false),
    renewedFromId: uuid("renewed_from_id"),
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("memberships_student_idx").on(t.studentId),
    index("memberships_end_idx").on(t.endDate),
    index("memberships_status_idx").on(t.status),
    check("memberships_dates", sql`${t.endDate} >= ${t.startDate}`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Events & tournaments                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const events = pgTable(
  "events",
  {
    id: id(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    name: varchar("name", { length: 160 }).notNull(),
    category: eventCategory("category").notNull(),
    summary: varchar("summary", { length: 240 }).notNull().default(""),
    description: text("description").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    startMinute: smallint("start_minute").notNull(),
    endMinute: smallint("end_minute"),
    venue: varchar("venue", { length: 160 }).notNull().default("SmashPoint Arena, Palghar"),
    fee: integer("fee").notNull().default(0),
    registrationLimit: integer("registration_limit"),
    registrationDeadline: date("registration_deadline", { mode: "string" }),
    divisions: text("divisions").array().notNull().default(sql`'{}'::text[]`),
    /** Reserved for tournament brackets (e.g. KNOCKOUT, ROUND_ROBIN). */
    format: varchar("format", { length: 40 }),
    status: eventStatus("status").notNull().default("DRAFT"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("events_date_idx").on(t.date), index("events_status_idx").on(t.status)],
);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    participantName: varchar("participant_name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    division: varchar("division", { length: 80 }),
    status: registrationStatus("status").notNull().default("PENDING"),
    paymentStatus: paymentStatus("payment_status").notNull().default("CREATED"),
    amount: integer("amount").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("event_registrations_event_idx").on(t.eventId),
    uniqueIndex("event_registrations_unique").on(t.eventId, sql`lower(${t.email})`, sql`lower(${t.participantName})`),
  ],
);

/**
 * Tournament bracket foundation. Not yet surfaced in the UI — brackets and results can be
 * built on top of this table without further migrations.
 */
export const tournamentMatches = pgTable(
  "tournament_matches",
  {
    id: id(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    division: varchar("division", { length: 80 }),
    round: smallint("round").notNull(),
    matchNumber: smallint("match_number").notNull(),
    player1RegistrationId: uuid("player1_registration_id").references(() => eventRegistrations.id, { onDelete: "set null" }),
    player2RegistrationId: uuid("player2_registration_id").references(() => eventRegistrations.id, { onDelete: "set null" }),
    winnerRegistrationId: uuid("winner_registration_id").references(() => eventRegistrations.id, { onDelete: "set null" }),
    score: varchar("score", { length: 80 }),
    courtId: uuid("court_id").references(() => courts.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tournament_matches_slot").on(t.eventId, t.division, t.round, t.matchNumber)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Payments                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const payments = pgTable(
  "payments",
  {
    id: id(),
    receiptNumber: varchar("receipt_number", { length: 24 }).notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    studentId: uuid("student_id").references(() => students.id, { onDelete: "set null" }),
    purpose: paymentPurpose("purpose").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    seriesId: uuid("series_id").references(() => bookingSeries.id, { onDelete: "set null" }),
    membershipId: uuid("membership_id").references(() => memberships.id, { onDelete: "set null" }),
    eventRegistrationId: uuid("event_registration_id").references(() => eventRegistrations.id, { onDelete: "set null" }),
    payerName: varchar("payer_name", { length: 120 }).notNull(),
    payerEmail: varchar("payer_email", { length: 180 }),
    payerPhone: varchar("payer_phone", { length: 20 }),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    status: paymentStatus("status").notNull().default("CREATED"),
    method: paymentMethod("method").notNull().default("ONLINE"),
    provider: varchar("provider", { length: 30 }).notNull(),
    providerOrderId: varchar("provider_order_id", { length: 100 }),
    providerPaymentId: varchar("provider_payment_id", { length: 100 }),
    providerSignature: text("provider_signature"),
    failureReason: varchar("failure_reason", { length: 300 }),
    refundReference: varchar("refund_reference", { length: 100 }),
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
    index("payments_series_idx").on(t.seriesId),
    index("payments_membership_idx").on(t.membershipId),
    index("payments_user_idx").on(t.userId),
    index("payments_student_idx").on(t.studentId),
    index("payments_status_idx").on(t.status),
    index("payments_created_idx").on(t.createdAt),
    uniqueIndex("payments_provider_order_key").on(t.provider, t.providerOrderId),
    check("payments_amount_positive", sql`${t.amount} >= 0`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Communication                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    audience: announcementAudience("audience").notNull().default("EVERYONE"),
    isPinned: boolean("is_pinned").notNull().default(false),
    showOnWebsite: boolean("show_on_website").notNull().default(true),
    publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_published_idx").on(t.publishedAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    link: varchar("link", { length: 300 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt), index("notifications_unread_idx").on(t.userId, t.readAt)],
);

/** Outbound delivery log for email / SMS / WhatsApp adapters. */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: id(),
    notificationId: uuid("notification_id").references(() => notifications.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
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

export const enquiries = pgTable(
  "enquiries",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    subject: varchar("subject", { length: 120 }).notNull(),
    message: text("message").notNull(),
    status: enquiryStatus("status").notNull().default("NEW"),
    createdAt: createdAt(),
  },
  (t) => [index("enquiries_created_idx").on(t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Platform                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const settings = pgTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Files in object storage (Supabase). Only the path, public URL and metadata live here. */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: id(),
    /** supabase | local */
    provider: varchar("provider", { length: 20 }).notNull(),
    bucket: varchar("bucket", { length: 63 }).notNull(),
    path: varchar("path", { length: 300 }).notNull(),
    url: text("url").notNull(),
    folder: varchar("folder", { length: 40 }).notNull(),
    contentType: varchar("content_type", { length: 60 }).notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("media_assets_location_key").on(t.provider, t.bucket, t.path), index("media_assets_folder_idx").on(t.folder)],
);

/** Legacy in-database images (pre–object storage). Served read-only and migrated by scripts/migrate-media.ts. */
export const media = pgTable("media", {
  id: id(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  contentType: varchar("content_type", { length: 60 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

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

export const usersRelations = relations(users, ({ one, many }) => ({
  coach: one(coaches, { fields: [users.id], references: [coaches.userId] }),
  student: one(students, { fields: [users.id], references: [students.userId] }),
  parent: one(parents, { fields: [users.id], references: [parents.userId] }),
  notifications: many(notifications),
  bookings: many(bookings),
}));

export const parentsRelations = relations(parents, ({ one, many }) => ({
  user: one(users, { fields: [parents.userId], references: [users.id] }),
  children: many(students),
}));

export const coachesRelations = relations(coaches, ({ one, many }) => ({
  user: one(users, { fields: [coaches.userId], references: [users.id] }),
  batches: many(batches),
  students: many(students),
  programs: many(programs),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, { fields: [students.userId], references: [users.id] }),
  parent: one(parents, { fields: [students.parentId], references: [parents.id] }),
  coach: one(coaches, { fields: [students.coachId], references: [coaches.id] }),
  batchLinks: many(batchStudents),
  memberships: many(memberships),
  attendance: many(attendanceRecords),
  performance: many(performanceRecords),
  payments: many(payments),
}));

export const sportsRelations = relations(sports, ({ many }) => ({
  courts: many(courts),
  equipment: many(equipmentItems),
}));

export const courtsRelations = relations(courts, ({ one, many }) => ({
  sport: one(sports, { fields: [courts.sportId], references: [sports.id] }),
  bookings: many(bookings),
  blocks: many(courtBlocks),
  batches: many(batches),
}));

export const courtBlocksRelations = relations(courtBlocks, ({ one }) => ({
  court: one(courts, { fields: [courtBlocks.courtId], references: [courts.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  sport: one(sports, { fields: [bookings.sportId], references: [sports.id] }),
  series: one(bookingSeries, { fields: [bookings.seriesId], references: [bookingSeries.id] }),
  rentals: many(equipmentRentals),
  court: one(courts, { fields: [bookings.courtId], references: [courts.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  coupon: one(coupons, { fields: [bookings.couponId], references: [coupons.id] }),
  events: many(bookingEvents),
  payments: many(payments),
}));

export const bookingSeriesRelations = relations(bookingSeries, ({ one, many }) => ({
  sport: one(sports, { fields: [bookingSeries.sportId], references: [sports.id] }),
  court: one(courts, { fields: [bookingSeries.courtId], references: [courts.id] }),
  user: one(users, { fields: [bookingSeries.userId], references: [users.id] }),
  bookings: many(bookings),
  payments: many(payments),
}));

export const equipmentItemsRelations = relations(equipmentItems, ({ one, many }) => ({
  sport: one(sports, { fields: [equipmentItems.sportId], references: [sports.id] }),
  rentals: many(equipmentRentals),
}));

export const equipmentRentalsRelations = relations(equipmentRentals, ({ one }) => ({
  item: one(equipmentItems, { fields: [equipmentRentals.itemId], references: [equipmentItems.id] }),
  booking: one(bookings, { fields: [equipmentRentals.bookingId], references: [bookings.id] }),
}));

export const coachingAdsRelations = relations(coachingAds, ({ one }) => ({
  sport: one(sports, { fields: [coachingAds.sportId], references: [sports.id] }),
  coach: one(coaches, { fields: [coachingAds.coachId], references: [coaches.id] }),
}));

export const bookingEventsRelations = relations(bookingEvents, ({ one }) => ({
  booking: one(bookings, { fields: [bookingEvents.bookingId], references: [bookings.id] }),
}));

export const programsRelations = relations(programs, ({ one, many }) => ({
  coach: one(coaches, { fields: [programs.coachId], references: [coaches.id] }),
  batches: many(batches),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  program: one(programs, { fields: [batches.programId], references: [programs.id] }),
  coach: one(coaches, { fields: [batches.coachId], references: [coaches.id] }),
  court: one(courts, { fields: [batches.courtId], references: [courts.id] }),
  students: many(batchStudents),
  sessions: many(attendanceSessions),
}));

export const batchStudentsRelations = relations(batchStudents, ({ one }) => ({
  batch: one(batches, { fields: [batchStudents.batchId], references: [batches.id] }),
  student: one(students, { fields: [batchStudents.studentId], references: [students.id] }),
}));

export const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
  batch: one(batches, { fields: [attendanceSessions.batchId], references: [batches.id] }),
  records: many(attendanceRecords),
  markedBy: one(users, { fields: [attendanceSessions.markedById], references: [users.id] }),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  session: one(attendanceSessions, { fields: [attendanceRecords.sessionId], references: [attendanceSessions.id] }),
  student: one(students, { fields: [attendanceRecords.studentId], references: [students.id] }),
}));

export const performanceRecordsRelations = relations(performanceRecords, ({ one }) => ({
  student: one(students, { fields: [performanceRecords.studentId], references: [students.id] }),
  coach: one(coaches, { fields: [performanceRecords.coachId], references: [coaches.id] }),
}));

export const membershipPlansRelations = relations(membershipPlans, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  student: one(students, { fields: [memberships.studentId], references: [students.id] }),
  plan: one(membershipPlans, { fields: [memberships.planId], references: [membershipPlans.id] }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  registrations: many(eventRegistrations),
  matches: many(tournamentMatches),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, { fields: [eventRegistrations.eventId], references: [events.id] }),
  user: one(users, { fields: [eventRegistrations.userId], references: [users.id] }),
  student: one(students, { fields: [eventRegistrations.studentId], references: [students.id] }),
}));

export const tournamentMatchesRelations = relations(tournamentMatches, ({ one }) => ({
  event: one(events, { fields: [tournamentMatches.eventId], references: [events.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  student: one(students, { fields: [payments.studentId], references: [students.id] }),
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
  series: one(bookingSeries, { fields: [payments.seriesId], references: [bookingSeries.id] }),
  membership: one(memberships, { fields: [payments.membershipId], references: [memberships.id] }),
  eventRegistration: one(eventRegistrations, {
    fields: [payments.eventRegistrationId],
    references: [eventRegistrations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

/* ────────────────────────────────────────────────────────────────────────── */
/* Row types                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type Role = (typeof userRole.enumValues)[number];
export type Student = typeof students.$inferSelect;
export type Coach = typeof coaches.$inferSelect;
export type Sport = typeof sports.$inferSelect;
export type Court = typeof courts.$inferSelect;
export type BookingSeries = typeof bookingSeries.$inferSelect;
export type BookingType = (typeof bookingType.enumValues)[number];
export type EquipmentItem = typeof equipmentItems.$inferSelect;
export type EquipmentRental = typeof equipmentRentals.$inferSelect;
export type RentalStatus = (typeof rentalStatus.enumValues)[number];
export type GalleryItem = typeof galleryItems.$inferSelect;
export type Facility = typeof facilities.$inferSelect;
export type FoodItem = typeof foodItems.$inferSelect;
export type CoachingAd = typeof coachingAds.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type CourtBlock = typeof courtBlocks.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type BookingStatus = (typeof bookingStatus.enumValues)[number];
export type Payment = typeof payments.$inferSelect;
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type AttendanceStatus = (typeof attendanceStatus.enumValues)[number];
export type Event = typeof events.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type NotificationType = (typeof notificationType.enumValues)[number];
