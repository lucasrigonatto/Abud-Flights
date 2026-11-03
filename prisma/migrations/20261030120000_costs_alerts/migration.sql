ALTER TYPE "public"."alert_type" ADD VALUE IF NOT EXISTS 'PERCENT_DROP';
ALTER TYPE "public"."alert_type" ADD VALUE IF NOT EXISTS 'NEW_LOW';
ALTER TYPE "public"."alert_type" ADD VALUE IF NOT EXISTS 'ALTERNATE_SAVINGS';
ALTER TYPE "public"."alert_type" ADD VALUE IF NOT EXISTS 'DAILY_DIGEST';

ALTER TABLE "public"."users"
  ADD COLUMN "quiet_start_hour" INTEGER,
  ADD COLUMN "quiet_end_hour" INTEGER,
  ADD COLUMN "digest_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "public"."monitors"
  ADD COLUMN "extra_bag_amount_minor" INTEGER;

ALTER TABLE "public"."alert_rules"
  ADD COLUMN "percent_points" INTEGER,
  ADD COLUMN "min_savings_minor" INTEGER;

CREATE TABLE "public"."ground_costs" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "airport" TEXT NOT NULL,
    "transfer_amount_minor" INTEGER,
    "transfer_minutes" INTEGER,
    "lodging_amount_minor" INTEGER,
    "fees_amount_minor" INTEGER,

    CONSTRAINT "ground_costs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ground_costs_monitor_id_airport_key" ON "public"."ground_costs"("monitor_id", "airport");

ALTER TABLE "public"."ground_costs"
  ADD CONSTRAINT "ground_costs_monitor_id_fkey"
  FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
