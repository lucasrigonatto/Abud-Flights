-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."monitor_status" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."date_mode" AS ENUM ('FIXED', 'FLEX');

-- CreateEnum
CREATE TYPE "public"."cabin" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');

-- CreateEnum
CREATE TYPE "public"."budget_scope" AS ENUM ('TOTAL', 'PER_PERSON');

-- CreateEnum
CREATE TYPE "public"."run_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'PARTIAL', 'NO_OFFERS');

-- CreateEnum
CREATE TYPE "public"."price_kind" AS ENUM ('DEMONSTRATION', 'LIVE_CURRENT', 'LIVE_INDICATIVE');

-- CreateEnum
CREATE TYPE "public"."notification_channel" AS ENUM ('IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "public"."notification_status" AS ENUM ('DELIVERED', 'RECORDED');

-- CreateEnum
CREATE TYPE "public"."alert_type" AS ENUM ('TARGET_PRICE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "market" TEXT NOT NULL DEFAULT 'BR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."airports" (
    "iata" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "airports_pkey" PRIMARY KEY ("iata")
);

-- CreateTable
CREATE TABLE "public"."monitors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "public"."monitor_status" NOT NULL DEFAULT 'ACTIVE',
    "origins" TEXT[],
    "destinations" TEXT[],
    "date_mode" "public"."date_mode" NOT NULL,
    "depart_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "flex_days" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "child_ages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "cabin" "public"."cabin" NOT NULL,
    "checked_bags" INTEGER,
    "max_stops" INTEGER NOT NULL,
    "max_duration_minutes" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "monitor_until" TIMESTAMP(3) NOT NULL,
    "interval_hours" INTEGER NOT NULL DEFAULT 12,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "pending_scheduled_for" TIMESTAMP(3),
    "filters_version" INTEGER NOT NULL DEFAULT 1,
    "exploration_cursor" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monitor_revisions" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "filters_version" INTEGER NOT NULL,
    "origins" TEXT[],
    "destinations" TEXT[],
    "date_mode" "public"."date_mode" NOT NULL,
    "depart_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "flex_days" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "child_ages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "cabin" "public"."cabin" NOT NULL,
    "checked_bags" INTEGER,
    "currency" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "max_stops" INTEGER NOT NULL,
    "max_duration_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitor_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."search_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "depart_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "child_ages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "cabin" "public"."cabin" NOT NULL,
    "checked_bags" INTEGER,
    "currency" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "max_stops" INTEGER NOT NULL,
    "max_duration_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."monitor_searches" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "search_definition_id" TEXT NOT NULL,
    "filters_version" INTEGER NOT NULL,

    CONSTRAINT "monitor_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."search_runs" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT,
    "user_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "filters_version" INTEGER,
    "request_key" TEXT,
    "status" "public"."run_status" NOT NULL,
    "combinations_planned" INTEGER NOT NULL DEFAULT 0,
    "combinations_queried" INTEGER NOT NULL DEFAULT 0,
    "combinations_skipped" INTEGER NOT NULL DEFAULT 0,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "dates_passed" BOOLEAN NOT NULL DEFAULT false,
    "had_provider_failure" BOOLEAN NOT NULL DEFAULT false,
    "stopped_by_budget" BOOLEAN NOT NULL DEFAULT false,
    "next_cursor" INTEGER NOT NULL DEFAULT 0,
    "offer_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."provider_requests" (
    "id" TEXT NOT NULL,
    "search_run_id" TEXT NOT NULL,
    "search_definition_id" TEXT,
    "user_id" TEXT,
    "monitor_id" TEXT,
    "provider" TEXT NOT NULL,
    "definition_key" TEXT,
    "attempt" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "charged" BOOLEAN NOT NULL,
    "cost_minor" INTEGER NOT NULL DEFAULT 0,
    "cost_currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "offers_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."itineraries" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "stops" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,

    CONSTRAINT "itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."flight_segments" (
    "id" TEXT NOT NULL,
    "itinerary_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "airline_name" TEXT NOT NULL,
    "flight_number" TEXT NOT NULL,
    "depart_local" TEXT NOT NULL,
    "arrive_local" TEXT NOT NULL,

    CONSTRAINT "flight_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."price_observations" (
    "id" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL,
    "source_collected_at" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_version" TEXT NOT NULL,
    "price_kind" "public"."price_kind" NOT NULL,
    "search_definition_id" TEXT NOT NULL,
    "search_run_id" TEXT NOT NULL,
    "monitor_id" TEXT,
    "filters_version" INTEGER,
    "user_id" TEXT,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "depart_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "itinerary_id" TEXT NOT NULL,
    "stops" INTEGER NOT NULL,
    "adults" INTEGER NOT NULL,
    "child_ages" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "cabin" "public"."cabin" NOT NULL,
    "baggage_known" BOOLEAN NOT NULL,
    "baggage_included" BOOLEAN,
    "checked_bags" INTEGER,
    "total_amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "offer_expires_at" TIMESTAMP(3),
    "provider_offer_id" TEXT,
    "provider_link" TEXT,
    "fx_rate" DECIMAL(18,8),
    "fx_quoted_at" TIMESTAMP(3),
    "converted_amount_minor" INTEGER,
    "converted_currency" TEXT,
    "from_cache" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alert_rules" (
    "id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "type" "public"."alert_type" NOT NULL,
    "target_amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "scope" "public"."budget_scope" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monitor_id" TEXT NOT NULL,
    "alert_rule_id" TEXT,
    "observation_id" TEXT,
    "channel" "public"."notification_channel" NOT NULL,
    "status" "public"."notification_status" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."route_daily_stats" (
    "id" TEXT NOT NULL,
    "stat_date" DATE NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "cabin" "public"."cabin" NOT NULL,
    "currency" TEXT NOT NULL,
    "baggage_signature" TEXT NOT NULL,
    "passenger_signature" TEXT NOT NULL,
    "price_kind" "public"."price_kind" NOT NULL,
    "min_amount_minor" INTEGER NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "departure_dates" TEXT[],

    CONSTRAINT "route_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "public"."sessions"("user_id");

-- CreateIndex
CREATE INDEX "monitors_user_id_idx" ON "public"."monitors"("user_id");

-- CreateIndex
CREATE INDEX "monitors_status_next_run_at_idx" ON "public"."monitors"("status", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_revisions_monitor_id_filters_version_key" ON "public"."monitor_revisions"("monitor_id", "filters_version");

-- CreateIndex
CREATE UNIQUE INDEX "search_definitions_key_key" ON "public"."search_definitions"("key");

-- CreateIndex
CREATE INDEX "monitor_searches_monitor_id_filters_version_idx" ON "public"."monitor_searches"("monitor_id", "filters_version");

-- CreateIndex
CREATE UNIQUE INDEX "monitor_searches_monitor_id_search_definition_id_filters_ve_key" ON "public"."monitor_searches"("monitor_id", "search_definition_id", "filters_version");

-- CreateIndex
CREATE UNIQUE INDEX "search_runs_request_key_key" ON "public"."search_runs"("request_key");

-- CreateIndex
CREATE INDEX "search_runs_user_id_idx" ON "public"."search_runs"("user_id");

-- CreateIndex
CREATE INDEX "search_runs_monitor_id_idx" ON "public"."search_runs"("monitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_runs_monitor_id_scheduled_for_filters_version_key" ON "public"."search_runs"("monitor_id", "scheduled_for", "filters_version");

-- CreateIndex
CREATE INDEX "provider_requests_user_id_created_at_idx" ON "public"."provider_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "provider_requests_definition_key_created_at_idx" ON "public"."provider_requests"("definition_key", "created_at");

-- CreateIndex
CREATE INDEX "provider_requests_monitor_id_idx" ON "public"."provider_requests"("monitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "itineraries_key_key" ON "public"."itineraries"("key");

-- CreateIndex
CREATE UNIQUE INDEX "flight_segments_itinerary_id_sequence_key" ON "public"."flight_segments"("itinerary_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "price_observations_dedup_key_key" ON "public"."price_observations"("dedup_key");

-- CreateIndex
CREATE INDEX "price_observations_monitor_id_filters_version_idx" ON "public"."price_observations"("monitor_id", "filters_version");

-- CreateIndex
CREATE INDEX "price_observations_search_run_id_idx" ON "public"."price_observations"("search_run_id");

-- CreateIndex
CREATE INDEX "price_observations_user_id_idx" ON "public"."price_observations"("user_id");

-- CreateIndex
CREATE INDEX "alert_rules_monitor_id_idx" ON "public"."alert_rules"("monitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedup_key_key" ON "public"."notifications"("dedup_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "public"."notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_monitor_id_idx" ON "public"."notifications"("monitor_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_daily_stats_identity" ON "public"."route_daily_stats"("stat_date", "origin", "destination", "cabin", "currency", "baggage_signature", "passenger_signature", "price_kind");

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monitors" ADD CONSTRAINT "monitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monitor_revisions" ADD CONSTRAINT "monitor_revisions_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monitor_searches" ADD CONSTRAINT "monitor_searches_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."monitor_searches" ADD CONSTRAINT "monitor_searches_search_definition_id_fkey" FOREIGN KEY ("search_definition_id") REFERENCES "public"."search_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."search_runs" ADD CONSTRAINT "search_runs_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."search_runs" ADD CONSTRAINT "search_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."provider_requests" ADD CONSTRAINT "provider_requests_search_run_id_fkey" FOREIGN KEY ("search_run_id") REFERENCES "public"."search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."provider_requests" ADD CONSTRAINT "provider_requests_search_definition_id_fkey" FOREIGN KEY ("search_definition_id") REFERENCES "public"."search_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."provider_requests" ADD CONSTRAINT "provider_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."flight_segments" ADD CONSTRAINT "flight_segments_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_observations" ADD CONSTRAINT "price_observations_search_definition_id_fkey" FOREIGN KEY ("search_definition_id") REFERENCES "public"."search_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_observations" ADD CONSTRAINT "price_observations_search_run_id_fkey" FOREIGN KEY ("search_run_id") REFERENCES "public"."search_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_observations" ADD CONSTRAINT "price_observations_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "public"."itineraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alert_rules" ADD CONSTRAINT "alert_rules_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

