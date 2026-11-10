-- Rental pricing from the facility's published rate card (On The Sol Sports Academy).
--
-- 1. Courts get exact prices per booking length instead of an off-peak/peak hourly rate:
--    price_1h (one hour) and price_2h (two hours — a package price, not 2 × price_1h).
--    There is no peak surcharge any more. Monthly rental plans (1/3/6/12 months) and a
--    playing-surface label are added for the website's rate card.
--    Existing rows keep their previous off-peak pricing (price_1h = hourly_rate,
--    price_2h = 2 × hourly_rate); the catalogue courts are then moved to the published rates
--    by the release step (scripts/lib/setup.ts, catalogue revision 2), matched by slug.
--    The old columns are copied to legacy_archive.court_rates before they are dropped.
-- 2. The rules trigger no longer hard-codes a badminton academy closure (5–7 PM): the facility
--    hasn't confirmed it. A confirmed closure is set up as court blocks in /admin/courts.
-- 3. Booking hours are read from the `booking` settings row (openMinute / closeMinute), the
--    same values the application uses (normalizeBookingHours in src/lib/booking/rules.ts),
--    defaulting to 7:00 AM – 10:00 PM.
CREATE SCHEMA IF NOT EXISTS "legacy_archive";
--> statement-breakpoint
CREATE TABLE "legacy_archive"."court_rates" AS
  SELECT "id" AS "court_id", "slug", "hourly_rate", "peak_hourly_rate", now() AS "archived_at" FROM "courts";
--> statement-breakpoint
ALTER TABLE "courts"
  ADD COLUMN "surface" varchar(80),
  ADD COLUMN "price_1h" integer,
  ADD COLUMN "price_2h" integer,
  ADD COLUMN "monthly_price_1m" integer,
  ADD COLUMN "monthly_price_3m" integer,
  ADD COLUMN "monthly_price_6m" integer,
  ADD COLUMN "monthly_price_12m" integer;
--> statement-breakpoint
UPDATE "courts" SET "price_1h" = "hourly_rate", "price_2h" = "hourly_rate" * 2;
--> statement-breakpoint
ALTER TABLE "courts" ALTER COLUMN "price_1h" SET NOT NULL, ALTER COLUMN "price_2h" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "courts" DROP CONSTRAINT IF EXISTS "courts_rates_positive";
--> statement-breakpoint
ALTER TABLE "courts" DROP COLUMN "hourly_rate", DROP COLUMN "peak_hourly_rate";
--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_prices_valid" CHECK ("courts"."price_1h" >= 0 AND "courts"."price_2h" >= 0 AND coalesce("courts"."monthly_price_1m", 0) >= 0 AND coalesce("courts"."monthly_price_3m", 0) >= 0 AND coalesce("courts"."monthly_price_6m", 0) >= 0 AND coalesce("courts"."monthly_price_12m", 0) >= 0);
--> statement-breakpoint

-- Peak windows no longer exist; drop them from the stored booking settings.
UPDATE "settings" SET "value" = "value" - 'peakWindows' WHERE "key" = 'booking' AND jsonb_typeof("value") = 'object';
--> statement-breakpoint

-- Booking rules enforced by the database (the booking service checks the same rules first,
-- with friendly messages; see src/lib/booking/rules.ts):
--   * a booking lies within the booking hours (settings.booking openMinute–closeMinute,
--     default 07:00–22:00; invalid settings fall back to the default, exactly as in
--     normalizeBookingHours),
--   * it starts on the hour and lasts 60 or 120 minutes,
--   * the booking's sport matches its court's sport.
-- Only active bookings are checked, and only when they are created or moved, so status
-- changes on historical rows keep working.
CREATE OR REPLACE FUNCTION "enforce_booking_rules"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  court_sport uuid;
  cfg jsonb;
  open_json jsonb;
  close_json jsonb;
  open_m numeric;
  close_m numeric;
  open_minute integer := 420;
  close_minute integer := 1320;
BEGIN
  IF NEW."status" NOT IN ('PENDING', 'PAYMENT_INITIATED', 'PAID', 'CONFIRMED') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW."court_id" = OLD."court_id" AND NEW."date" = OLD."date"
     AND NEW."start_minute" = OLD."start_minute" AND NEW."end_minute" = OLD."end_minute" THEN
    RETURN NEW;
  END IF;

  SELECT "value" INTO cfg FROM "settings" WHERE "key" = 'booking';
  open_json := coalesce(cfg -> 'openMinute', to_jsonb(420));
  close_json := coalesce(cfg -> 'closeMinute', to_jsonb(1320));
  IF jsonb_typeof(open_json) = 'number' AND jsonb_typeof(close_json) = 'number' THEN
    open_m := (open_json #>> '{}')::numeric;
    close_m := (close_json #>> '{}')::numeric;
    IF open_m = trunc(open_m) AND close_m = trunc(close_m)
       AND open_m >= 0 AND close_m <= 1440 AND mod(open_m, 60) = 0 AND mod(close_m, 60) = 0
       AND close_m - open_m >= 60 THEN
      open_minute := open_m::integer;
      close_minute := close_m::integer;
    END IF;
  END IF;

  IF NEW."start_minute" < open_minute OR NEW."end_minute" > close_minute THEN
    RAISE EXCEPTION 'That time is outside the booking hours.' USING ERRCODE = 'SP001';
  END IF;
  IF NEW."start_minute" % 60 <> 0 OR (NEW."end_minute" - NEW."start_minute") NOT IN (60, 120) THEN
    RAISE EXCEPTION 'Bookings start on the hour and last one or two hours.' USING ERRCODE = 'SP002';
  END IF;

  SELECT c."sport_id" INTO court_sport FROM "courts" c WHERE c."id" = NEW."court_id";
  IF court_sport IS DISTINCT FROM NEW."sport_id" THEN
    RAISE EXCEPTION 'The booking''s sport does not match its court.' USING ERRCODE = 'SP004';
  END IF;
  RETURN NEW;
END $$;
