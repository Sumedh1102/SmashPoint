-- Court-booking focus.
--
-- The application is now a court-booking website (2 badminton, 2 pickleball, 1 basketball
-- court) with a single administrator login. Everything that belonged to the earlier
-- academy-management app (students, parents, coaches, programs, batches, attendance,
-- performance, memberships, events, coupons, monthly series, equipment, gallery/café content,
-- in-app notifications, enquiries, uploads, password-reset tokens) is MOVED into the
-- "legacy_archive" schema instead of being dropped, so no data is lost. Bookings and payments
-- stay where they are. Once the archive has been checked (or exported) it can be removed with:
--     DROP SCHEMA legacy_archive CASCADE;
CREATE SCHEMA IF NOT EXISTS "legacy_archive";
--> statement-breakpoint

-- 1. Remember how kept rows pointed at archived rows before those columns are dropped.
CREATE TABLE "legacy_archive"."booking_links" AS
  SELECT "id" AS "booking_id", "series_id", "user_id", "coupon_id", "equipment_total", "created_by_id"
  FROM "bookings"
  WHERE "series_id" IS NOT NULL OR "user_id" IS NOT NULL OR "coupon_id" IS NOT NULL
     OR "equipment_total" <> 0 OR "created_by_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "legacy_archive"."payment_links" AS
  SELECT "id" AS "payment_id", "user_id", "student_id", "series_id", "membership_id", "event_registration_id"
  FROM "payments"
  WHERE "user_id" IS NOT NULL OR "student_id" IS NOT NULL OR "series_id" IS NOT NULL
     OR "membership_id" IS NOT NULL OR "event_registration_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "legacy_archive"."user_profiles" AS
  SELECT "id" AS "user_id", "role", "is_active", "phone", "avatar_url", "emergency_contact_name",
         "emergency_contact_phone", "preferences", "firebase_uid"
  FROM "users";
--> statement-breakpoint
CREATE TABLE "legacy_archive"."court_details" AS
  SELECT "id" AS "court_id", "surface", "image_url", "image_asset_id", "durations", "booking_types", "open_minute", "close_minute"
  FROM "courts";
--> statement-breakpoint
CREATE TABLE "legacy_archive"."sport_images" AS
  SELECT "id" AS "sport_id", "image_url", "image_asset_id" FROM "sports";
--> statement-breakpoint
CREATE TABLE "legacy_archive"."notification_delivery_links" AS
  SELECT "id" AS "delivery_id", "notification_id", "user_id"
  FROM "notification_deliveries"
  WHERE "notification_id" IS NOT NULL OR "user_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "legacy_archive"."settings" AS SELECT * FROM "settings" WHERE "key" = 'attendance';
--> statement-breakpoint
DELETE FROM "settings" WHERE "key" = 'attendance';
--> statement-breakpoint

-- 2. Cut foreign keys that cross between archived and kept tables, then move the tables.
DO $$
DECLARE
  archived text[] := ARRAY[
    'parents', 'coaches', 'students', 'coupons', 'booking_series', 'equipment_items', 'equipment_rentals',
    'gallery_items', 'facilities', 'food_items', 'coaching_ads', 'programs', 'batches', 'batch_students',
    'attendance_sessions', 'attendance_records', 'performance_records', 'membership_plans', 'memberships',
    'events', 'event_registrations', 'tournament_matches', 'announcements', 'notifications', 'enquiries',
    'media_assets', 'media', 'password_reset_tokens'
  ];
  fk record;
  tbl text;
BEGIN
  FOR fk IN
    SELECT c.conname, c.conrelid::regclass AS src
    FROM pg_constraint c
    JOIN pg_class s ON s.oid = c.conrelid
    JOIN pg_class d ON d.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = s.relnamespace
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND (s.relname = ANY (archived)) <> (d.relname = ANY (archived))
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.src, fk.conname);
  END LOOP;

  FOREACH tbl IN ARRAY archived LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I SET SCHEMA legacy_archive', tbl);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

-- 3. Slim the kept tables.
-- Accounts other than ADMIN (coaches, customers, managers, reception) can no longer sign in.
-- Their rows stay so audit trails that reference them remain intact.
UPDATE "users" SET "is_active" = false WHERE "role" <> 'ADMIN';
--> statement-breakpoint
DELETE FROM "sessions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "role" <> 'ADMIN');
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_firebase_uid_unique";
--> statement-breakpoint
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "phone",
  DROP COLUMN IF EXISTS "firebase_uid",
  DROP COLUMN IF EXISTS "avatar_url",
  DROP COLUMN IF EXISTS "emergency_contact_name",
  DROP COLUMN IF EXISTS "emergency_contact_phone",
  DROP COLUMN IF EXISTS "preferences";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
--> statement-breakpoint

ALTER TABLE "sports" DROP COLUMN IF EXISTS "image_url", DROP COLUMN IF EXISTS "image_asset_id";
--> statement-breakpoint

ALTER TABLE "courts" DROP CONSTRAINT IF EXISTS "courts_hours";
--> statement-breakpoint
ALTER TABLE "courts"
  DROP COLUMN IF EXISTS "surface",
  DROP COLUMN IF EXISTS "image_url",
  DROP COLUMN IF EXISTS "image_asset_id",
  DROP COLUMN IF EXISTS "durations",
  DROP COLUMN IF EXISTS "booking_types",
  DROP COLUMN IF EXISTS "open_minute",
  DROP COLUMN IF EXISTS "close_minute";
--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "slug" varchar(80);
--> statement-breakpoint
UPDATE "courts"
  SET "slug" = coalesce(nullif(trim(both '-' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'court');
--> statement-breakpoint
UPDATE "courts" c
  SET "slug" = c."slug" || '-' || left(c."id"::text, 8)
  WHERE EXISTS (SELECT 1 FROM "courts" d WHERE d."slug" = c."slug" AND d."id" < c."id");
--> statement-breakpoint
ALTER TABLE "courts" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_slug_unique" UNIQUE ("slug");
--> statement-breakpoint

ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_amounts";
--> statement-breakpoint
ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "series_id",
  DROP COLUMN IF EXISTS "user_id",
  DROP COLUMN IF EXISTS "coupon_id",
  DROP COLUMN IF EXISTS "equipment_total",
  DROP COLUMN IF EXISTS "created_by_id";
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amounts" CHECK ("bookings"."total" >= 0 AND "bookings"."discount" >= 0 AND "bookings"."subtotal" >= 0);
--> statement-breakpoint
CREATE INDEX "bookings_hold_idx" ON "bookings" USING btree ("status", "hold_expires_at");
--> statement-breakpoint
CREATE INDEX "bookings_created_idx" ON "bookings" USING btree ("created_at");
--> statement-breakpoint

ALTER TABLE "payments"
  DROP COLUMN IF EXISTS "user_id",
  DROP COLUMN IF EXISTS "student_id",
  DROP COLUMN IF EXISTS "series_id",
  DROP COLUMN IF EXISTS "membership_id",
  DROP COLUMN IF EXISTS "event_registration_id";
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refund_status" varchar(20);
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "purpose" SET DEFAULT 'BOOKING';
--> statement-breakpoint
CREATE INDEX "payments_provider_payment_idx" ON "payments" USING btree ("provider_payment_id");
--> statement-breakpoint

ALTER TABLE "notification_deliveries" DROP COLUMN IF EXISTS "notification_id", DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint

-- 4. Enum types only the archived tables use.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gender', 'student_status', 'skill_level', 'program_level', 'booking_type', 'membership_status',
    'attendance_status', 'attendance_source', 'event_category', 'event_status', 'registration_status',
    'notification_type', 'announcement_audience', 'coupon_type', 'coupon_scope', 'enquiry_status',
    'equipment_pricing', 'rental_status'
  ] LOOP
    IF to_regtype(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('ALTER TYPE public.%I SET SCHEMA legacy_archive', t);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

-- 5. Razorpay webhook deliveries already processed.
CREATE TABLE "payment_webhook_events" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"provider" varchar(30) NOT NULL,
	"event" varchar(60) NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- 6. Booking rules enforced by the database (the booking service checks the same rules
--    first, with friendly messages; see src/lib/booking/rules.ts):
--      * a booking runs between 07:00 and 22:00 (minutes 420–1320),
--      * it starts on the hour and lasts 60 or 120 minutes,
--      * badminton courts cannot be booked 17:00–19:00 (academy sessions),
--      * the booking's sport matches its court's sport.
--    Only active bookings are checked, and only when they are created or moved, so status
--    changes on historical rows keep working.
CREATE OR REPLACE FUNCTION "enforce_booking_rules"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  court_sport uuid;
  sport_slug text;
BEGIN
  IF NEW."status" NOT IN ('PENDING', 'PAYMENT_INITIATED', 'PAID', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW."court_id" = OLD."court_id" AND NEW."date" = OLD."date"
     AND NEW."start_minute" = OLD."start_minute" AND NEW."end_minute" = OLD."end_minute" THEN
    RETURN NEW;
  END IF;

  IF NEW."start_minute" < 420 OR NEW."end_minute" > 1320 THEN
    RAISE EXCEPTION 'Bookings must start at or after 7:00 AM and end by 10:00 PM.' USING ERRCODE = 'SP001';
  END IF;
  IF NEW."start_minute" % 60 <> 0 OR (NEW."end_minute" - NEW."start_minute") NOT IN (60, 120) THEN
    RAISE EXCEPTION 'Bookings start on the hour and last one or two hours.' USING ERRCODE = 'SP002';
  END IF;

  SELECT c."sport_id", s."slug" INTO court_sport, sport_slug
  FROM "courts" c JOIN "sports" s ON s."id" = c."sport_id"
  WHERE c."id" = NEW."court_id";
  IF court_sport IS DISTINCT FROM NEW."sport_id" THEN
    RAISE EXCEPTION 'The booking''s sport does not match its court.' USING ERRCODE = 'SP004';
  END IF;
  IF sport_slug = 'badminton' AND NEW."start_minute" < 1140 AND NEW."end_minute" > 1020 THEN
    RAISE EXCEPTION 'Badminton courts are reserved for academy sessions from 5:00 PM to 7:00 PM.' USING ERRCODE = 'SP003';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "bookings_enforce_rules"
  BEFORE INSERT OR UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION "enforce_booking_rules"();
