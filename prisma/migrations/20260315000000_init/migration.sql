-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('personal', 'starter', 'growth', 'scale', 'enterprise');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'paused');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('connected', 'disconnected', 'error', 'pending');

-- CreateEnum
CREATE TYPE "BidStrategy" AS ENUM ('target_rank', 'target_cpc', 'target_roas', 'max_conversion', 'time_based', 'manual');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('active', 'paused', 'ended', 'draft');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('WEB_SITE', 'SHOPPING', 'BRAND_SEARCH', 'PERFORMANCE_MAX');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('exact', 'phrase', 'broad');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('pc', 'mobile');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('bid_change', 'report_sent', 'api_error', 'budget_alert', 'system_notice', 'anomaly_detected', 'competitor_change', 'churn_prediction');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('urgent', 'high', 'normal', 'low');

-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('bid_adjustment', 'keyword_recommendation', 'report_generation', 'anomaly_alert', 'creative_suggestion');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'EXPORT');

-- CreateEnum
CREATE TYPE "ChangedBy" AS ENUM ('ai', 'manual', 'system');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('weekly', 'monthly');

-- CreateEnum
CREATE TYPE "FraudStatus" AS ENUM ('pending', 'confirmed', 'dismissed');

-- CreateEnum
CREATE TYPE "BlockReason" AS ENUM ('rule_based', 'ml_detected', 'manual');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "plan_type" "PlanType" NOT NULL DEFAULT 'starter',
    "total_ad_spend" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "business_number" VARCHAR(20),
    "contact_email" VARCHAR(255),
    "max_accounts" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'viewer',
    "organization_id" TEXT NOT NULL,
    "avatar_url" TEXT,
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "monthly_price" INTEGER NOT NULL,
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "payment_provider" VARCHAR(50),
    "payment_provider_id" VARCHAR(255),
    "canceled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naver_accounts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" VARCHAR(100) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "api_key_encrypted" TEXT NOT NULL,
    "secret_key_encrypted" TEXT NOT NULL,
    "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'pending',
    "last_sync_at" TIMESTAMPTZ,
    "daily_budget" INTEGER,
    "monthly_spend" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "commission_rate" DECIMAL(5,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "naver_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "naver_account_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_campaign_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'active',
    "campaign_type" "CampaignType",
    "daily_budget" INTEGER,
    "total_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_groups" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_ad_group_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "daily_budget" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "ad_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keywords" (
    "id" TEXT NOT NULL,
    "ad_group_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_keyword_id" VARCHAR(100) NOT NULL,
    "keyword_text" VARCHAR(500) NOT NULL,
    "current_bid" INTEGER NOT NULL DEFAULT 0,
    "target_rank" INTEGER,
    "bid_strategy" "BidStrategy" NOT NULL DEFAULT 'manual',
    "match_type" "MatchType" NOT NULL DEFAULT 'exact',
    "quality_index" INTEGER,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cpc" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "conversion_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "roas" DECIMAL(7,2),
    "is_auto_managed" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_sync_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" TEXT NOT NULL,
    "ad_group_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_ad_id" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255),
    "description" TEXT,
    "display_url" VARCHAR(500),
    "landing_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "conversion_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "test_group_id" VARCHAR(100),
    "is_control" BOOLEAN NOT NULL DEFAULT false,
    "test_status" VARCHAR(20),

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid_history" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "keyword_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "old_bid" INTEGER NOT NULL,
    "new_bid" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "changed_by" "ChangedBy" NOT NULL DEFAULT 'ai',
    "current_rank" INTEGER,
    "target_rank" INTEGER,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rank_snapshots" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "keyword_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "rank" INTEGER,
    "page" INTEGER,
    "device" "DeviceType" NOT NULL DEFAULT 'pc',
    "captured_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rank_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profitability" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "ad_spend" DECIMAL(15,2) NOT NULL,
    "agency_fee" DECIMAL(15,2) NOT NULL,
    "back_margin" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "labor_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_profit" DECIMAL(15,2) NOT NULL,
    "margin_rate" DECIMAL(5,4) NOT NULL,
    "period" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profitability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "kpi_config" JSONB NOT NULL DEFAULT '{}',
    "layout_config" JSONB NOT NULL DEFAULT '{}',
    "schedule_type" "ScheduleType" DEFAULT 'weekly',
    "recipient_emails" JSONB NOT NULL DEFAULT '[]',
    "naver_account_ids" JSONB NOT NULL DEFAULT '[]',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "file_url" TEXT,
    "sent_at" TIMESTAMPTZ,
    "sent_to" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitive_intel" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_account_id" TEXT,
    "keyword_text" VARCHAR(500) NOT NULL,
    "top5_ads" JSONB NOT NULL DEFAULT '[]',
    "estimated_bid_low" INTEGER,
    "estimated_bid_high" INTEGER,
    "competitor_count" INTEGER NOT NULL DEFAULT 0,
    "crawled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitive_intel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'normal',
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "channels" JSONB NOT NULL DEFAULT '["in_app"]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_action_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "action_type" "AiActionType" NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "input_data" JSONB NOT NULL DEFAULT '{}',
    "output_data" JSONB NOT NULL DEFAULT '{}',
    "confidence" DECIMAL(3,2),
    "is_approved" BOOLEAN,
    "approved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_fraud_events" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "naver_account_id" TEXT NOT NULL,
    "keyword_id" TEXT,
    "campaign_id" TEXT,
    "click_timestamp" TIMESTAMPTZ NOT NULL,
    "ip_hash" VARCHAR(64) NOT NULL,
    "user_agent" TEXT,
    "device_fingerprint" VARCHAR(64),
    "geo_country" VARCHAR(2),
    "geo_region" VARCHAR(20),
    "session_id" VARCHAR(64),
    "landing_url" TEXT,
    "dwell_time_ms" INTEGER,
    "fraud_score" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "triggered_rules" JSONB NOT NULL DEFAULT '[]',
    "status" "FraudStatus" NOT NULL DEFAULT 'pending',
    "action_taken" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "click_fraud_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_ips" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_account_id" TEXT NOT NULL,
    "ip_hash" VARCHAR(64) NOT NULL,
    "ip_masked" VARCHAR(15),
    "block_reason" "BlockReason" NOT NULL,
    "triggered_rules" JSONB NOT NULL DEFAULT '[]',
    "fraud_count" INTEGER NOT NULL DEFAULT 0,
    "estimated_loss" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "blocked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,
    "unblocked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_ips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_fraud_daily_summary" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "naver_account_id" TEXT NOT NULL,
    "summary_date" DATE NOT NULL,
    "total_clicks" INTEGER NOT NULL DEFAULT 0,
    "fraud_clicks" INTEGER NOT NULL DEFAULT 0,
    "fraud_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "estimated_loss" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "blocked_ips_count" INTEGER NOT NULL DEFAULT 0,
    "refund_requested" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refund_approved" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_fraud_daily_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_org" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_subs_org" ON "subscriptions"("organization_id");

-- CreateIndex
CREATE INDEX "idx_subs_status" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "idx_naver_acc_org" ON "naver_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "naver_accounts_customer_id_organization_id_key" ON "naver_accounts"("customer_id", "organization_id");

-- CreateIndex
CREATE INDEX "idx_camps_account" ON "campaigns"("naver_account_id");

-- CreateIndex
CREATE INDEX "idx_camps_status" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "idx_camps_org_status" ON "campaigns"("organization_id", "status");

-- CreateIndex
CREATE INDEX "idx_camps_org_deleted_status" ON "campaigns"("organization_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "idx_adgroups_campaign" ON "ad_groups"("campaign_id");

-- CreateIndex
CREATE INDEX "idx_adgroups_org" ON "ad_groups"("organization_id");

-- CreateIndex
CREATE INDEX "idx_kw_adgroup_deleted" ON "keywords"("ad_group_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_kw_org_strategy" ON "keywords"("organization_id", "bid_strategy");

-- CreateIndex
CREATE INDEX "idx_kw_text" ON "keywords"("keyword_text");

-- CreateIndex
CREATE INDEX "idx_kw_org_deleted" ON "keywords"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_kw_org_deleted_auto" ON "keywords"("organization_id", "deleted_at", "is_auto_managed");

-- CreateIndex
CREATE INDEX "idx_ads_adgroup_deleted" ON "ads"("ad_group_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_ads_org" ON "ads"("organization_id");

-- CreateIndex
CREATE INDEX "idx_ads_test_group" ON "ads"("test_group_id");

-- CreateIndex
CREATE INDEX "idx_bidh_keyword_date_desc" ON "bid_history"("keyword_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_bidh_org_date_by" ON "bid_history"("organization_id", "changed_at", "changed_by");

-- CreateIndex
CREATE INDEX "idx_rank_kw_device_date_desc" ON "rank_snapshots"("keyword_id", "device", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "idx_rank_org" ON "rank_snapshots"("organization_id");

-- CreateIndex
CREATE INDEX "idx_profit_org_period" ON "profitability"("organization_id", "period");

-- CreateIndex
CREATE INDEX "idx_profit_account" ON "profitability"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "profitability_organization_id_account_id_period_key" ON "profitability"("organization_id", "account_id", "period");

-- CreateIndex
CREATE INDEX "idx_rpt_tmpl_org" ON "report_templates"("organization_id");

-- CreateIndex
CREATE INDEX "idx_reports_org" ON "reports"("organization_id");

-- CreateIndex
CREATE INDEX "idx_reports_period" ON "reports"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "idx_ci_org_kw" ON "competitive_intel"("organization_id", "keyword_text");

-- CreateIndex
CREATE INDEX "idx_ci_crawled" ON "competitive_intel"("crawled_at");

-- CreateIndex
CREATE INDEX "idx_notif_user_read_created" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "idx_notif_org" ON "notifications"("organization_id");

-- CreateIndex
CREATE INDEX "idx_notif_created" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "idx_notif_read_readat" ON "notifications"("is_read", "read_at");

-- CreateIndex
CREATE INDEX "idx_ai_log_org" ON "ai_action_logs"("organization_id");

-- CreateIndex
CREATE INDEX "idx_ai_log_type" ON "ai_action_logs"("action_type");

-- CreateIndex
CREATE INDEX "idx_ai_log_entity" ON "ai_action_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_expires" ON "audit_logs"("expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_org_date_action" ON "audit_logs"("organization_id", "created_at", "action");

-- CreateIndex
CREATE INDEX "idx_cfe_org" ON "click_fraud_events"("organization_id");

-- CreateIndex
CREATE INDEX "idx_cfe_account" ON "click_fraud_events"("naver_account_id");

-- CreateIndex
CREATE INDEX "idx_cfe_ip_time" ON "click_fraud_events"("ip_hash", "click_timestamp");

-- CreateIndex
CREATE INDEX "idx_cfe_fingerprint" ON "click_fraud_events"("device_fingerprint");

-- CreateIndex
CREATE INDEX "idx_cfe_status" ON "click_fraud_events"("status");

-- CreateIndex
CREATE INDEX "idx_cfe_org_status_time" ON "click_fraud_events"("organization_id", "status", "click_timestamp");

-- CreateIndex
CREATE INDEX "idx_blocked_org" ON "blocked_ips"("organization_id");

-- CreateIndex
CREATE INDEX "idx_blocked_account" ON "blocked_ips"("naver_account_id");

-- CreateIndex
CREATE INDEX "idx_blocked_ip" ON "blocked_ips"("ip_hash");

-- CreateIndex
CREATE INDEX "idx_blocked_org_active" ON "blocked_ips"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_ips_organization_id_ip_hash_key" ON "blocked_ips"("organization_id", "ip_hash");

-- CreateIndex
CREATE INDEX "idx_cfds_org_date" ON "click_fraud_daily_summary"("organization_id", "summary_date");

-- CreateIndex
CREATE INDEX "idx_cfds_account" ON "click_fraud_daily_summary"("naver_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "click_fraud_daily_summary_organization_id_naver_account_id__key" ON "click_fraud_daily_summary"("organization_id", "naver_account_id", "summary_date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naver_accounts" ADD CONSTRAINT "naver_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_naver_account_id_fkey" FOREIGN KEY ("naver_account_id") REFERENCES "naver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_groups" ADD CONSTRAINT "ad_groups_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_groups" ADD CONSTRAINT "ad_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_group_id_fkey" FOREIGN KEY ("ad_group_id") REFERENCES "ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_history" ADD CONSTRAINT "bid_history_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid_history" ADD CONSTRAINT "bid_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rank_snapshots" ADD CONSTRAINT "rank_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profitability" ADD CONSTRAINT "profitability_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profitability" ADD CONSTRAINT "profitability_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "naver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitive_intel" ADD CONSTRAINT "competitive_intel_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitive_intel" ADD CONSTRAINT "competitive_intel_naver_account_id_fkey" FOREIGN KEY ("naver_account_id") REFERENCES "naver_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_action_logs" ADD CONSTRAINT "ai_action_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_fraud_events" ADD CONSTRAINT "click_fraud_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_fraud_events" ADD CONSTRAINT "click_fraud_events_naver_account_id_fkey" FOREIGN KEY ("naver_account_id") REFERENCES "naver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_fraud_events" ADD CONSTRAINT "click_fraud_events_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_fraud_events" ADD CONSTRAINT "click_fraud_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_ips" ADD CONSTRAINT "blocked_ips_naver_account_id_fkey" FOREIGN KEY ("naver_account_id") REFERENCES "naver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_fraud_daily_summary" ADD CONSTRAINT "click_fraud_daily_summary_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_fraud_daily_summary" ADD CONSTRAINT "click_fraud_daily_summary_naver_account_id_fkey" FOREIGN KEY ("naver_account_id") REFERENCES "naver_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
