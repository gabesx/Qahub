-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'cancelled', 'trial');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- CreateEnum
CREATE TYPE "TestCaseDefectStage" AS ENUM ('pre_development', 'development', 'post_development', 'release_production');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "TestRunResultStatus" AS ENUM ('passed', 'failed', 'skipped', 'blocked');

-- CreateEnum
CREATE TYPE "DocumentEngagementType" AS ENUM ('like', 'star', 'view');

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255),
    "subdomain" VARCHAR(255),
    "plan" "TenantPlan" NOT NULL DEFAULT 'free',
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_projects" INTEGER NOT NULL DEFAULT 3,
    "features" JSONB,
    "billing_email" VARCHAR(255),
    "subscription_id" VARCHAR(255),
    "trial_ends_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_users" (
    "tenant_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'member',
    "invited_by" BIGINT,
    "joined_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("tenant_id","user_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "google_id" VARCHAR(255),
    "google_avatar" VARCHAR(500),
    "auth_provider" VARCHAR(50) NOT NULL DEFAULT 'email',
    "role" VARCHAR(50),
    "avatar" VARCHAR(500),
    "last_login_at" TIMESTAMP,
    "password_changed_at" TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMP,
    "password" VARCHAR(255) NOT NULL,
    "job_role" VARCHAR(100),
    "remember_token" VARCHAR(100),
    "preferences" JSONB,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "user_id" BIGINT,
    "token" VARCHAR(255) NOT NULL,
    "used_at" TIMESTAMP,
    "expires_at" TIMESTAMP,
    "created_at" TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_access_tokens" (
    "id" BIGSERIAL NOT NULL,
    "tokenable_type" VARCHAR(255) NOT NULL,
    "tokenable_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "token_hash" VARCHAR(64),
    "abilities" TEXT,
    "last_used_at" TIMESTAMP,
    "last_used_ip" VARCHAR(45),
    "last_used_user_agent" VARCHAR(500),
    "expires_at" TIMESTAMP,
    "revoked_at" TIMESTAMP,
    "revoked_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "personal_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_history" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "password_reset_id" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_invitations" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "tenant_id" BIGINT,
    "invited_by" BIGINT NOT NULL,
    "role" VARCHAR(50) DEFAULT 'member',
    "accepted_at" TIMESTAMP,
    "expires_at" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "guard_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "guard_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "user_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","permission_id")
);

-- CreateTable
CREATE TABLE "role_has_permissions" (
    "permission_id" BIGINT NOT NULL,
    "role_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "role_has_permissions_pkey" PRIMARY KEY ("permission_id","role_id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" VARCHAR(500),
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "prefix" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" BIGSERIAL NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT,
    "type" VARCHAR(50) NOT NULL DEFAULT 'string',
    "category" VARCHAR(100),
    "description" TEXT,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suites" (
    "id" BIGSERIAL NOT NULL,
    "repository_id" BIGINT NOT NULL,
    "parent_id" BIGINT,
    "title" VARCHAR(255) NOT NULL,
    "order" INTEGER,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "suites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "suite_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "labels" VARCHAR(255),
    "automated" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "data" JSON,
    "order" INTEGER,
    "regression" BOOLEAN NOT NULL DEFAULT true,
    "epic_link" VARCHAR(255),
    "linked_issue" VARCHAR(255),
    "jira_key" VARCHAR(45),
    "platform" TEXT,
    "release_version" VARCHAR(100),
    "severity" VARCHAR(45) NOT NULL DEFAULT 'Moderate',
    "defect_stage" "TestCaseDefectStage",
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "deleted_by" BIGINT,
    "deleted_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_plans" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "repository_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "data" TEXT,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_plan_test_cases" (
    "test_plan_id" BIGINT NOT NULL,
    "test_case_id" BIGINT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_plan_test_cases_pkey" PRIMARY KEY ("test_plan_id","test_case_id")
);

-- CreateTable
CREATE TABLE "test_case_comments" (
    "id" BIGSERIAL NOT NULL,
    "test_case_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "parent_id" BIGINT,
    "content" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,
    "deleted_at" TIMESTAMP,

    CONSTRAINT "test_case_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs" (
    "id" BIGSERIAL NOT NULL,
    "test_plan_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "repository_id" BIGINT,
    "title" VARCHAR(255) NOT NULL,
    "status" "TestRunStatus" NOT NULL DEFAULT 'pending',
    "execution_date" DATE,
    "started_at" TIMESTAMP,
    "completed_at" TIMESTAMP,
    "environment" VARCHAR(100),
    "build_version" VARCHAR(100),
    "data" TEXT,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_run_results" (
    "id" BIGSERIAL NOT NULL,
    "test_run_id" BIGINT NOT NULL,
    "test_case_id" BIGINT NOT NULL,
    "status" "TestRunResultStatus" NOT NULL,
    "execution_time" INTEGER,
    "error_message" TEXT,
    "stack_trace" TEXT,
    "screenshots" JSONB,
    "logs" TEXT,
    "defect_found_at_stage" "TestCaseDefectStage",
    "bug_budget_id" BIGINT,
    "defect_severity" VARCHAR(50),
    "executed_by" BIGINT,
    "executed_at" TIMESTAMP,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs_attachments" (
    "id" BIGSERIAL NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "test_run_id" BIGINT NOT NULL,
    "test_case_id" BIGINT NOT NULL,
    "uploaded_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs_comments" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "comments" TEXT NOT NULL,
    "test_run_id" BIGINT NOT NULL,
    "test_plan_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_runs_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "parent_id" BIGINT,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "content_id" BIGINT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" BIGINT,
    "last_edited_by" BIGINT,
    "deleted_by" BIGINT,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "stars_count" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" BIGSERIAL NOT NULL,
    "document_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "created_by" BIGINT,
    "change_summary" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_engagements" (
    "id" BIGSERIAL NOT NULL,
    "document_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "engagement_type" "DocumentEngagementType" NOT NULL,
    "viewed_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "document_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" BIGSERIAL NOT NULL,
    "document_id" BIGINT,
    "document_manager_id" BIGINT,
    "user_id" BIGINT NOT NULL,
    "parent_id" BIGINT,
    "content" TEXT NOT NULL,
    "comment_type" VARCHAR(50) NOT NULL DEFAULT 'general',
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "mentioned_user_ids" JSONB,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,
    "deleted_at" TIMESTAMP,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_storage" (
    "id" BIGSERIAL NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "content_type" VARCHAR(50) NOT NULL,
    "content_size" BIGINT NOT NULL,
    "storage_path" VARCHAR(500),
    "content_data" TEXT,
    "reference_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "content_storage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editor_images" (
    "id" BIGSERIAL NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "editor_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_execution_summary" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "total_runs" INTEGER NOT NULL DEFAULT 0,
    "passed_runs" INTEGER NOT NULL DEFAULT 0,
    "failed_runs" INTEGER NOT NULL DEFAULT 0,
    "skipped_runs" INTEGER NOT NULL DEFAULT 0,
    "blocked_runs" INTEGER NOT NULL DEFAULT 0,
    "automated_count" INTEGER NOT NULL DEFAULT 0,
    "manual_count" INTEGER NOT NULL DEFAULT 0,
    "avg_execution_time" DECIMAL(10,2),
    "total_test_cases" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_execution_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_analytics_daily" (
    "id" BIGSERIAL NOT NULL,
    "project" VARCHAR(255) NOT NULL,
    "project_id" BIGINT,
    "date" DATE NOT NULL,
    "bugs_created" INTEGER NOT NULL DEFAULT 0,
    "bugs_resolved" INTEGER NOT NULL DEFAULT 0,
    "bugs_closed" INTEGER NOT NULL DEFAULT 0,
    "bugs_reopened" INTEGER NOT NULL DEFAULT 0,
    "avg_resolution_hours" DECIMAL(10,2),
    "open_bugs" INTEGER NOT NULL DEFAULT 0,
    "critical_bugs" INTEGER NOT NULL DEFAULT 0,
    "high_priority_bugs" INTEGER NOT NULL DEFAULT 0,
    "medium_priority_bugs" INTEGER NOT NULL DEFAULT 0,
    "low_priority_bugs" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "bug_analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case_analytics" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "repository_id" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "total_cases" INTEGER NOT NULL DEFAULT 0,
    "automated_cases" INTEGER NOT NULL DEFAULT 0,
    "manual_cases" INTEGER NOT NULL DEFAULT 0,
    "high_priority_cases" INTEGER NOT NULL DEFAULT 0,
    "medium_priority_cases" INTEGER NOT NULL DEFAULT 0,
    "low_priority_cases" INTEGER NOT NULL DEFAULT 0,
    "regression_cases" INTEGER NOT NULL DEFAULT 0,
    "last_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_case_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_visibilities" (
    "id" BIGSERIAL NOT NULL,
    "menu_key" VARCHAR(255) NOT NULL,
    "menu_name" VARCHAR(255) NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "parent_key" VARCHAR(255),
    "sort_order" INTEGER,
    "metadata" JSONB,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "menu_visibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "type" VARCHAR(255) NOT NULL,
    "notifiable_type" VARCHAR(255) NOT NULL,
    "notifiable_id" BIGINT NOT NULL,
    "data" TEXT NOT NULL,
    "read_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_runs_view" (
    "id" BIGINT NOT NULL,
    "test_plan_id" BIGINT NOT NULL,
    "test_plan_title" VARCHAR(255) NOT NULL,
    "project_id" BIGINT NOT NULL,
    "project_title" VARCHAR(255) NOT NULL,
    "repository_id" BIGINT NOT NULL,
    "repository_title" VARCHAR(255) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "total_cases" INTEGER NOT NULL DEFAULT 0,
    "passed_cases" INTEGER NOT NULL DEFAULT 0,
    "failed_cases" INTEGER NOT NULL DEFAULT 0,
    "skipped_cases" INTEGER NOT NULL DEFAULT 0,
    "blocked_cases" INTEGER NOT NULL DEFAULT 0,
    "execution_date" DATE,
    "execution_duration" INTEGER,
    "created_by_id" BIGINT,
    "created_by_name" VARCHAR(255),
    "last_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_runs_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "action" VARCHAR(255) NOT NULL,
    "model_type" VARCHAR(255),
    "model_id" BIGINT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_name_key" ON "tenants"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_subdomain_key" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_domain_idx" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "tenants_subdomain_idx" ON "tenants"("subdomain");

-- CreateIndex
CREATE INDEX "tenants_plan_status_idx" ON "tenants"("plan", "status");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "tenant_users_user_id_tenant_id_idx" ON "tenant_users"("user_id", "tenant_id");

-- CreateIndex
CREATE INDEX "tenant_users_tenant_id_role_idx" ON "tenant_users"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "tenant_users_user_id_idx" ON "tenant_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_google_id_idx" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_email_idx" ON "password_resets"("email");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_token_idx" ON "password_resets"("token");

-- CreateIndex
CREATE INDEX "password_resets_created_at_idx" ON "password_resets"("created_at");

-- CreateIndex
CREATE INDEX "password_resets_expires_at_used_at_idx" ON "password_resets"("expires_at", "used_at");

-- CreateIndex
CREATE INDEX "password_resets_user_id_created_at_idx" ON "password_resets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "password_resets_used_at_idx" ON "password_resets"("used_at");

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_tokens_token_key" ON "personal_access_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "personal_access_tokens_token_hash_key" ON "personal_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_revoked__idx" ON "personal_access_tokens"("tokenable_type", "tokenable_id", "revoked_at");

-- CreateIndex
CREATE INDEX "personal_access_tokens_token_hash_idx" ON "personal_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "personal_access_tokens_expires_at_revoked_at_idx" ON "personal_access_tokens"("expires_at", "revoked_at");

-- CreateIndex
CREATE INDEX "password_history_user_id_created_at_idx" ON "password_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "password_history_password_reset_id_idx" ON "password_history"("password_reset_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_invitations_token_key" ON "user_invitations"("token");

-- CreateIndex
CREATE INDEX "user_invitations_email_idx" ON "user_invitations"("email");

-- CreateIndex
CREATE INDEX "user_invitations_token_idx" ON "user_invitations"("token");

-- CreateIndex
CREATE INDEX "user_invitations_tenant_id_idx" ON "user_invitations"("tenant_id");

-- CreateIndex
CREATE INDEX "user_invitations_invited_by_idx" ON "user_invitations"("invited_by");

-- CreateIndex
CREATE INDEX "user_invitations_expires_at_accepted_at_idx" ON "user_invitations"("expires_at", "accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_guard_name_key" ON "permissions"("name", "guard_name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_guard_name_key" ON "roles"("name", "guard_name");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");

-- CreateIndex
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "projects_tenant_id_id_idx" ON "projects"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "projects_tenant_id_created_at_idx" ON "projects"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at");

-- CreateIndex
CREATE INDEX "projects_created_by_idx" ON "projects"("created_by");

-- CreateIndex
CREATE INDEX "projects_title_idx" ON "projects"("title");

-- CreateIndex
CREATE INDEX "repositories_tenant_id_id_idx" ON "repositories"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "repositories_tenant_id_project_id_idx" ON "repositories"("tenant_id", "project_id");

-- CreateIndex
CREATE INDEX "repositories_project_id_idx" ON "repositories"("project_id");

-- CreateIndex
CREATE INDEX "repositories_project_id_created_at_idx" ON "repositories"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "repositories_created_by_idx" ON "repositories"("created_by");

-- CreateIndex
CREATE INDEX "repositories_title_idx" ON "repositories"("title");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_category_idx" ON "settings"("category");

-- CreateIndex
CREATE INDEX "settings_type_category_idx" ON "settings"("type", "category");

-- CreateIndex
CREATE INDEX "settings_created_by_idx" ON "settings"("created_by");

-- CreateIndex
CREATE INDEX "suites_repository_id_idx" ON "suites"("repository_id");

-- CreateIndex
CREATE INDEX "suites_parent_id_idx" ON "suites"("parent_id");

-- CreateIndex
CREATE INDEX "suites_repository_id_parent_id_idx" ON "suites"("repository_id", "parent_id");

-- CreateIndex
CREATE INDEX "suites_created_by_idx" ON "suites"("created_by");

-- CreateIndex
CREATE INDEX "suites_repository_id_order_idx" ON "suites"("repository_id", "order");

-- CreateIndex
CREATE INDEX "test_cases_tenant_id_id_idx" ON "test_cases"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "test_cases_tenant_id_suite_id_idx" ON "test_cases"("tenant_id", "suite_id");

-- CreateIndex
CREATE INDEX "test_cases_suite_id_idx" ON "test_cases"("suite_id");

-- CreateIndex
CREATE INDEX "test_cases_jira_key_idx" ON "test_cases"("jira_key");

-- CreateIndex
CREATE INDEX "test_cases_automated_priority_idx" ON "test_cases"("automated", "priority");

-- CreateIndex
CREATE INDEX "test_cases_created_by_created_at_idx" ON "test_cases"("created_by", "created_at");

-- CreateIndex
CREATE INDEX "test_cases_deleted_at_idx" ON "test_cases"("deleted_at");

-- CreateIndex
CREATE INDEX "test_cases_defect_stage_idx" ON "test_cases"("defect_stage");

-- CreateIndex
CREATE INDEX "test_cases_automated_defect_stage_idx" ON "test_cases"("automated", "defect_stage");

-- CreateIndex
CREATE INDEX "test_plans_project_id_repository_id_idx" ON "test_plans"("project_id", "repository_id");

-- CreateIndex
CREATE INDEX "test_plans_project_id_repository_id_status_idx" ON "test_plans"("project_id", "repository_id", "status");

-- CreateIndex
CREATE INDEX "test_plans_created_by_idx" ON "test_plans"("created_by");

-- CreateIndex
CREATE INDEX "test_plans_title_idx" ON "test_plans"("title");

-- CreateIndex
CREATE INDEX "test_plans_status_idx" ON "test_plans"("status");

-- CreateIndex
CREATE INDEX "test_plan_test_cases_test_plan_id_order_idx" ON "test_plan_test_cases"("test_plan_id", "order");

-- CreateIndex
CREATE INDEX "test_plan_test_cases_test_case_id_idx" ON "test_plan_test_cases"("test_case_id");

-- CreateIndex
CREATE INDEX "test_case_comments_test_case_id_idx" ON "test_case_comments"("test_case_id");

-- CreateIndex
CREATE INDEX "test_case_comments_user_id_idx" ON "test_case_comments"("user_id");

-- CreateIndex
CREATE INDEX "test_case_comments_parent_id_idx" ON "test_case_comments"("parent_id");

-- CreateIndex
CREATE INDEX "test_case_comments_created_at_idx" ON "test_case_comments"("created_at");

-- CreateIndex
CREATE INDEX "test_case_comments_test_case_id_is_resolved_created_at_idx" ON "test_case_comments"("test_case_id", "is_resolved", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_project_id_created_at_idx" ON "test_runs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_test_plan_id_created_at_idx" ON "test_runs"("test_plan_id", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_repository_id_created_at_idx" ON "test_runs"("repository_id", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_created_by_created_at_idx" ON "test_runs"("created_by", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_title_idx" ON "test_runs"("title");

-- CreateIndex
CREATE INDEX "test_runs_status_execution_date_idx" ON "test_runs"("status", "execution_date");

-- CreateIndex
CREATE INDEX "test_runs_execution_date_idx" ON "test_runs"("execution_date");

-- CreateIndex
CREATE INDEX "test_runs_status_started_at_idx" ON "test_runs"("status", "started_at");

-- CreateIndex
CREATE INDEX "test_runs_environment_execution_date_idx" ON "test_runs"("environment", "execution_date");

-- CreateIndex
CREATE INDEX "test_run_results_test_run_id_status_idx" ON "test_run_results"("test_run_id", "status");

-- CreateIndex
CREATE INDEX "test_run_results_test_case_id_status_idx" ON "test_run_results"("test_case_id", "status");

-- CreateIndex
CREATE INDEX "test_run_results_executed_by_executed_at_idx" ON "test_run_results"("executed_by", "executed_at");

-- CreateIndex
CREATE INDEX "test_run_results_test_run_id_executed_at_idx" ON "test_run_results"("test_run_id", "executed_at");

-- CreateIndex
CREATE INDEX "test_run_results_status_executed_at_idx" ON "test_run_results"("status", "executed_at");

-- CreateIndex
CREATE INDEX "test_run_results_defect_found_at_stage_executed_at_idx" ON "test_run_results"("defect_found_at_stage", "executed_at");

-- CreateIndex
CREATE INDEX "test_run_results_bug_budget_id_idx" ON "test_run_results"("bug_budget_id");

-- CreateIndex
CREATE INDEX "test_run_results_status_defect_found_at_stage_idx" ON "test_run_results"("status", "defect_found_at_stage");

-- CreateIndex
CREATE UNIQUE INDEX "test_run_results_test_run_id_test_case_id_key" ON "test_run_results"("test_run_id", "test_case_id");

-- CreateIndex
CREATE INDEX "test_runs_attachments_test_run_id_idx" ON "test_runs_attachments"("test_run_id");

-- CreateIndex
CREATE INDEX "test_runs_attachments_test_case_id_idx" ON "test_runs_attachments"("test_case_id");

-- CreateIndex
CREATE INDEX "test_runs_attachments_test_run_id_test_case_id_idx" ON "test_runs_attachments"("test_run_id", "test_case_id");

-- CreateIndex
CREATE INDEX "test_runs_attachments_uploaded_by_idx" ON "test_runs_attachments"("uploaded_by");

-- CreateIndex
CREATE INDEX "test_runs_comments_test_run_id_created_at_idx" ON "test_runs_comments"("test_run_id", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_comments_test_plan_id_created_at_idx" ON "test_runs_comments"("test_plan_id", "created_at");

-- CreateIndex
CREATE INDEX "test_runs_comments_user_id_created_at_idx" ON "test_runs_comments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_tenant_id_id_idx" ON "documents"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "documents_tenant_id_project_id_created_at_idx" ON "documents"("tenant_id", "project_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_project_id_created_at_idx" ON "documents"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_parent_id_idx" ON "documents"("parent_id");

-- CreateIndex
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");

-- CreateIndex
CREATE INDEX "documents_content_id_idx" ON "documents"("content_id");

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "document_versions"("document_id");

-- CreateIndex
CREATE INDEX "document_versions_version_number_idx" ON "document_versions"("version_number");

-- CreateIndex
CREATE INDEX "document_versions_created_at_idx" ON "document_versions"("created_at");

-- CreateIndex
CREATE INDEX "document_engagements_document_id_idx" ON "document_engagements"("document_id");

-- CreateIndex
CREATE INDEX "document_engagements_user_id_idx" ON "document_engagements"("user_id");

-- CreateIndex
CREATE INDEX "document_engagements_engagement_type_idx" ON "document_engagements"("engagement_type");

-- CreateIndex
CREATE INDEX "document_engagements_viewed_at_idx" ON "document_engagements"("viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_engagements_document_id_user_id_engagement_type_key" ON "document_engagements"("document_id", "user_id", "engagement_type");

-- CreateIndex
CREATE INDEX "document_comments_document_id_idx" ON "document_comments"("document_id");

-- CreateIndex
CREATE INDEX "document_comments_document_manager_id_idx" ON "document_comments"("document_manager_id");

-- CreateIndex
CREATE INDEX "document_comments_user_id_idx" ON "document_comments"("user_id");

-- CreateIndex
CREATE INDEX "document_comments_parent_id_idx" ON "document_comments"("parent_id");

-- CreateIndex
CREATE INDEX "document_comments_created_at_idx" ON "document_comments"("created_at");

-- CreateIndex
CREATE INDEX "document_comments_document_id_created_at_idx" ON "document_comments"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "document_comments_document_manager_id_created_at_idx" ON "document_comments"("document_manager_id", "created_at");

-- CreateIndex
CREATE INDEX "document_comments_is_resolved_created_at_idx" ON "document_comments"("is_resolved", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_storage_content_hash_key" ON "content_storage"("content_hash");

-- CreateIndex
CREATE INDEX "content_storage_content_hash_idx" ON "content_storage"("content_hash");

-- CreateIndex
CREATE INDEX "content_storage_content_type_content_size_idx" ON "content_storage"("content_type", "content_size");

-- CreateIndex
CREATE INDEX "content_storage_reference_count_idx" ON "content_storage"("reference_count");

-- CreateIndex
CREATE INDEX "document_templates_type_is_active_idx" ON "document_templates"("type", "is_active");

-- CreateIndex
CREATE INDEX "document_templates_created_by_idx" ON "document_templates"("created_by");

-- CreateIndex
CREATE INDEX "document_templates_name_idx" ON "document_templates"("name");

-- CreateIndex
CREATE INDEX "editor_images_uploaded_by_created_at_idx" ON "editor_images"("uploaded_by", "created_at");

-- CreateIndex
CREATE INDEX "editor_images_mime_type_idx" ON "editor_images"("mime_type");

-- CreateIndex
CREATE INDEX "editor_images_filename_idx" ON "editor_images"("filename");

-- CreateIndex
CREATE INDEX "test_execution_summary_date_idx" ON "test_execution_summary"("date");

-- CreateIndex
CREATE INDEX "test_execution_summary_project_id_date_last_updated_at_idx" ON "test_execution_summary"("project_id", "date", "last_updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "test_execution_summary_project_id_date_key" ON "test_execution_summary"("project_id", "date");

-- CreateIndex
CREATE INDEX "bug_analytics_daily_date_idx" ON "bug_analytics_daily"("date");

-- CreateIndex
CREATE INDEX "bug_analytics_daily_project_date_last_updated_at_idx" ON "bug_analytics_daily"("project", "date", "last_updated_at");

-- CreateIndex
CREATE INDEX "bug_analytics_daily_project_id_date_last_updated_at_idx" ON "bug_analytics_daily"("project_id", "date", "last_updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "bug_analytics_daily_project_date_key" ON "bug_analytics_daily"("project", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bug_analytics_daily_project_id_date_key" ON "bug_analytics_daily"("project_id", "date");

-- CreateIndex
CREATE INDEX "test_case_analytics_date_idx" ON "test_case_analytics"("date");

-- CreateIndex
CREATE INDEX "test_case_analytics_project_id_date_idx" ON "test_case_analytics"("project_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "test_case_analytics_project_id_repository_id_date_key" ON "test_case_analytics"("project_id", "repository_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "menu_visibilities_menu_key_key" ON "menu_visibilities"("menu_key");

-- CreateIndex
CREATE INDEX "menu_visibilities_parent_key_sort_order_idx" ON "menu_visibilities"("parent_key", "sort_order");

-- CreateIndex
CREATE INDEX "menu_visibilities_is_visible_idx" ON "menu_visibilities"("is_visible");

-- CreateIndex
CREATE INDEX "notifications_notifiable_type_notifiable_id_read_at_created_idx" ON "notifications"("notifiable_type", "notifiable_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_notifiable_type_notifiable_id_type_idx" ON "notifications"("notifiable_type", "notifiable_id", "type");

-- CreateIndex
CREATE INDEX "test_runs_view_project_id_execution_date_idx" ON "test_runs_view"("project_id", "execution_date");

-- CreateIndex
CREATE INDEX "test_runs_view_test_plan_id_execution_date_idx" ON "test_runs_view"("test_plan_id", "execution_date");

-- CreateIndex
CREATE INDEX "test_runs_view_repository_id_execution_date_idx" ON "test_runs_view"("repository_id", "execution_date");

-- CreateIndex
CREATE INDEX "test_runs_view_execution_date_idx" ON "test_runs_view"("execution_date");

-- CreateIndex
CREATE INDEX "test_runs_view_created_by_id_idx" ON "test_runs_view"("created_by_id");

-- CreateIndex
CREATE INDEX "audit_logs_model_type_model_id_created_at_idx" ON "audit_logs"("model_type", "model_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_tokenable_id_fkey" FOREIGN KEY ("tokenable_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_password_reset_id_fkey" FOREIGN KEY ("password_reset_id") REFERENCES "password_resets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_has_permissions" ADD CONSTRAINT "role_has_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_has_permissions" ADD CONSTRAINT "role_has_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suites" ADD CONSTRAINT "suites_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suites" ADD CONSTRAINT "suites_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "suites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_suite_id_fkey" FOREIGN KEY ("suite_id") REFERENCES "suites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plans" ADD CONSTRAINT "test_plans_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plan_test_cases" ADD CONSTRAINT "test_plan_test_cases_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "test_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_plan_test_cases" ADD CONSTRAINT "test_plan_test_cases_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_comments" ADD CONSTRAINT "test_case_comments_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_comments" ADD CONSTRAINT "test_case_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "test_case_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "test_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs" ADD CONSTRAINT "test_runs_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_results" ADD CONSTRAINT "test_run_results_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_results" ADD CONSTRAINT "test_run_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs_attachments" ADD CONSTRAINT "test_runs_attachments_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs_attachments" ADD CONSTRAINT "test_runs_attachments_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "test_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs_comments" ADD CONSTRAINT "test_runs_comments_test_run_id_fkey" FOREIGN KEY ("test_run_id") REFERENCES "test_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_runs_comments" ADD CONSTRAINT "test_runs_comments_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "test_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_storage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_engagements" ADD CONSTRAINT "document_engagements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editor_images" ADD CONSTRAINT "editor_images_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_execution_summary" ADD CONSTRAINT "test_execution_summary_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_analytics_daily" ADD CONSTRAINT "bug_analytics_daily_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_analytics" ADD CONSTRAINT "test_case_analytics_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case_analytics" ADD CONSTRAINT "test_case_analytics_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_visibilities" ADD CONSTRAINT "menu_visibilities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_visibilities" ADD CONSTRAINT "menu_visibilities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
