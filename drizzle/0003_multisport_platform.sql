CREATE TYPE "public"."booking_type" AS ENUM('SINGLE', 'MONTHLY', 'QUARTERLY');--> statement-breakpoint
CREATE TYPE "public"."equipment_pricing" AS ENUM('PER_BOOKING', 'PER_HOUR');--> statement-breakpoint
CREATE TYPE "public"."rental_status" AS ENUM('RESERVED', 'ISSUED', 'RETURNED', 'CANCELLED', 'DAMAGED', 'LOST');--> statement-breakpoint
CREATE TABLE "booking_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"type" "booking_type" NOT NULL,
	"sport_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"user_id" uuid,
	"customer_name" varchar(120) NOT NULL,
	"customer_phone" varchar(20) NOT NULL,
	"customer_email" varchar(180),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days_of_week" smallint[] NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"session_count" smallint NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"equipment_total" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"source" "booking_source" DEFAULT 'ONLINE' NOT NULL,
	"notes" text,
	"hold_expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" varchar(300),
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_series_code_unique" UNIQUE("code"),
	CONSTRAINT "booking_series_dates" CHECK ("booking_series"."end_date" >= "booking_series"."start_date"),
	CONSTRAINT "booking_series_time_order" CHECK ("booking_series"."end_minute" > "booking_series"."start_minute"),
	CONSTRAINT "booking_series_amounts" CHECK ("booking_series"."total" >= 0 AND "booking_series"."subtotal" >= 0 AND "booking_series"."discount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "coaching_ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(120) NOT NULL,
	"summary" varchar(240) NOT NULL,
	"description" text,
	"sport_id" uuid,
	"coach_id" uuid,
	"image_url" text,
	"image_asset_id" uuid,
	"skill_level" varchar(60),
	"age_range" varchar(60),
	"timing" varchar(120),
	"highlights" text[] DEFAULT '{}'::text[] NOT NULL,
	"cta_label" varchar(40) DEFAULT 'Enquire now' NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coaching_ads_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "equipment_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport_id" uuid,
	"name" varchar(120) NOT NULL,
	"category" varchar(40) NOT NULL,
	"description" text,
	"size" varchar(40),
	"image_url" text,
	"image_asset_id" uuid,
	"total_quantity" integer NOT NULL,
	"damaged_quantity" integer DEFAULT 0 NOT NULL,
	"rental_price" integer NOT NULL,
	"pricing" "equipment_pricing" DEFAULT 'PER_BOOKING' NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_quantities" CHECK ("equipment_items"."total_quantity" >= 0 AND "equipment_items"."damaged_quantity" >= 0 AND "equipment_items"."damaged_quantity" <= "equipment_items"."total_quantity"),
	CONSTRAINT "equipment_prices" CHECK ("equipment_items"."rental_price" >= 0 AND "equipment_items"."deposit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "equipment_rentals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"booking_id" uuid,
	"user_id" uuid,
	"customer_name" varchar(120),
	"date" date NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	"quantity" smallint NOT NULL,
	"unit_price" integer NOT NULL,
	"amount" integer NOT NULL,
	"deposit" integer DEFAULT 0 NOT NULL,
	"status" "rental_status" DEFAULT 'RESERVED' NOT NULL,
	"issued_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"notes" varchar(300),
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipment_rentals_quantity" CHECK ("equipment_rentals"."quantity" > 0),
	CONSTRAINT "equipment_rentals_time_order" CHECK ("equipment_rentals"."end_minute" > "equipment_rentals"."start_minute")
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(40) NOT NULL,
	"description" text,
	"image_url" text,
	"image_asset_id" uuid,
	"availability" varchar(120),
	"price" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(40) NOT NULL,
	"description" text,
	"image_url" text,
	"image_asset_id" uuid,
	"price" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_items_price" CHECK ("food_items"."price" IS NULL OR "food_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(40) NOT NULL,
	"caption" varchar(200),
	"image_url" text NOT NULL,
	"image_asset_id" uuid,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(20) NOT NULL,
	"bucket" varchar(63) NOT NULL,
	"path" varchar(300) NOT NULL,
	"url" text NOT NULL,
	"folder" varchar(40) NOT NULL,
	"content_type" varchar(60) NOT NULL,
	"byte_size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(60) NOT NULL,
	"name" varchar(60) NOT NULL,
	"tagline" varchar(160),
	"description" text,
	"image_url" text,
	"image_asset_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_amounts";--> statement-breakpoint
-- Customers were called students; rename in place so existing rows keep their role.
ALTER TYPE "public"."user_role" RENAME VALUE 'STUDENT' TO 'CUSTOMER';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'::"public"."user_role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "sport_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "equipment_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "sport_id" uuid;--> statement-breakpoint
-- Existing courts were all badminton: create that sport and attach them (and their bookings).
INSERT INTO "sports" ("slug", "name", "tagline", "sort_order")
  SELECT 'badminton', 'Badminton', 'Professional courts with premium PU mats', 1 WHERE EXISTS (SELECT 1 FROM "courts");--> statement-breakpoint
UPDATE "courts" SET "sport_id" = (SELECT "id" FROM "sports" WHERE "slug" = 'badminton') WHERE "sport_id" IS NULL;--> statement-breakpoint
ALTER TABLE "courts" ALTER COLUMN "sport_id" SET NOT NULL;--> statement-breakpoint
UPDATE "bookings" SET "sport_id" = "courts"."sport_id" FROM "courts" WHERE "courts"."id" = "bookings"."court_id";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "sport_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "image_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "durations" smallint[] DEFAULT '{60,120}'::smallint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "booking_types" "booking_type"[] DEFAULT '{SINGLE}'::booking_type[] NOT NULL;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "open_minute" smallint;--> statement-breakpoint
ALTER TABLE "courts" ADD COLUMN "close_minute" smallint;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "firebase_uid" varchar(128);--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_series" ADD CONSTRAINT "booking_series_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_ads" ADD CONSTRAINT "coaching_ads_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_ads" ADD CONSTRAINT "coaching_ads_coach_id_coaches_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaching_ads" ADD CONSTRAINT "coaching_ads_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_item_id_equipment_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."equipment_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_rentals" ADD CONSTRAINT "equipment_rentals_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sports" ADD CONSTRAINT "sports_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_series_user_idx" ON "booking_series" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "booking_series_court_idx" ON "booking_series" USING btree ("court_id","start_date");--> statement-breakpoint
CREATE INDEX "coaching_ads_order_idx" ON "coaching_ads" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE INDEX "equipment_items_sport_idx" ON "equipment_items" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "equipment_rentals_item_date_idx" ON "equipment_rentals" USING btree ("item_id","date");--> statement-breakpoint
CREATE INDEX "equipment_rentals_booking_idx" ON "equipment_rentals" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "equipment_rentals_user_idx" ON "equipment_rentals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "facilities_category_idx" ON "facilities" USING btree ("category","sort_order");--> statement-breakpoint
CREATE INDEX "food_items_category_idx" ON "food_items" USING btree ("category","sort_order");--> statement-breakpoint
CREATE INDEX "gallery_items_order_idx" ON "gallery_items" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_location_key" ON "media_assets" USING btree ("provider","bucket","path");--> statement-breakpoint
CREATE INDEX "media_assets_folder_idx" ON "media_assets" USING btree ("folder");--> statement-breakpoint
CREATE INDEX "sports_sort_idx" ON "sports" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_series_id_booking_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."booking_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_image_asset_id_media_assets_id_fk" FOREIGN KEY ("image_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_series_id_booking_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."booking_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_sport_date_idx" ON "bookings" USING btree ("sport_id","date");--> statement-breakpoint
CREATE INDEX "bookings_series_idx" ON "bookings" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "courts_sport_idx" ON "courts" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "payments_series_idx" ON "payments" USING btree ("series_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_amounts" CHECK ("bookings"."total" >= 0 AND "bookings"."discount" >= 0 AND "bookings"."subtotal" >= 0 AND "bookings"."equipment_total" >= 0);--> statement-breakpoint
ALTER TABLE "courts" ADD CONSTRAINT "courts_hours" CHECK (("courts"."open_minute" IS NULL AND "courts"."close_minute" IS NULL) OR ("courts"."open_minute" IS NOT NULL AND "courts"."close_minute" > "courts"."open_minute"));