CREATE TYPE "trip_type" AS ENUM ('ROUND_TRIP', 'ONE_WAY');

ALTER TABLE "monitors" ADD COLUMN "trip_type" "trip_type" NOT NULL DEFAULT 'ROUND_TRIP';
ALTER TABLE "monitors" ADD COLUMN "has_children" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "monitors" ALTER COLUMN "return_date" DROP NOT NULL;
ALTER TABLE "monitors" ALTER COLUMN "max_stops" DROP NOT NULL;
UPDATE "monitors" SET "has_children" = cardinality("child_ages") > 0;

ALTER TABLE "monitor_revisions" ADD COLUMN "trip_type" "trip_type" NOT NULL DEFAULT 'ROUND_TRIP';
ALTER TABLE "monitor_revisions" ADD COLUMN "has_children" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "monitor_revisions" ALTER COLUMN "return_date" DROP NOT NULL;
ALTER TABLE "monitor_revisions" ALTER COLUMN "max_stops" DROP NOT NULL;
UPDATE "monitor_revisions" SET "has_children" = cardinality("child_ages") > 0;

ALTER TABLE "search_definitions" ADD COLUMN "has_children" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "search_definitions" ALTER COLUMN "return_date" DROP NOT NULL;
ALTER TABLE "search_definitions" ALTER COLUMN "max_stops" DROP NOT NULL;
UPDATE "search_definitions" SET "has_children" = cardinality("child_ages") > 0;

ALTER TABLE "price_observations" ADD COLUMN "has_children" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "price_observations" ALTER COLUMN "return_date" DROP NOT NULL;
UPDATE "price_observations" SET "has_children" = cardinality("child_ages") > 0;
