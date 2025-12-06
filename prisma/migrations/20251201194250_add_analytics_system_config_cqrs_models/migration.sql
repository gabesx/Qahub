-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'cancelled', 'trial');


-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('free', 'starter', 'professional', 'enterprise');


-- CreateEnum
CREATE TYPE "TestCaseDefectStage" AS ENUM ('pre_development', 'development', 'post_development', 'release_production');


-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');


-- CreateEnum
CREATE TYPE "TestRunResultStatus" AS ENUM ('passed', 'failed', 'skipped', 'blocked', 'inProgress');


-- CreateEnum
CREATE TYPE "DocumentEngagementType" AS ENUM ('like', 'star', 'view');



-- CreateEnum
CREATE TYPE "ScheduledTestRunFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'custom');

-- CreateEnum
CREATE TYPE "ScheduledTestRunStatus" AS ENUM ('active', 'paused', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255),
    "subdomain" VARCHAR(255),
    "plan" "TenantPlan" NOT NULL DEFAULT 'free',
    "status" "TenantStatus" NOT NULL DEFAULT 'active',
    "max_users" INTEGER NOT NULL DEFAULT 150,
    "max_projects" INTEGER NOT NULL DEFAULT 100,
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

    CONSTRAINT "repositories_prefix_key" UNIQUE ("prefix"),

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
    "defect_severity" VARCHAR(50),
    "executed_by" BIGINT,
    "executed_at" TIMESTAMP,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "bug_ticket_url" VARCHAR(500),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_run_results_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "test_runs_attachments" (
    "id" BIGSERIAL NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "test_run_id" BIGINT NOT NULL,
    "test_case_id" BIGINT NOT NULL,
    "comment_id" BIGINT,
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
CREATE TABLE "test_run_templates" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "repository_id" BIGINT,
    "test_plan_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "environment" VARCHAR(100),
    "build_version" VARCHAR(100),
    "title_pattern" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "test_run_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_test_runs" (
    "id" BIGSERIAL NOT NULL,
    "template_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "frequency" "ScheduledTestRunFrequency" NOT NULL,
    "status" "ScheduledTestRunStatus" NOT NULL DEFAULT 'active',
    "schedule" TEXT NOT NULL,
    "next_run_at" TIMESTAMP,
    "last_run_at" TIMESTAMP,
    "last_run_id" BIGINT,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "max_runs" INTEGER,
    "end_date" DATE,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "scheduled_test_runs_pkey" PRIMARY KEY ("id")
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
    "data" BYTEA,
    "storage_type" VARCHAR(50) NOT NULL DEFAULT 'filesystem',
    "uploaded_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "editor_images_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "audit_logs_model_type_model_id_created_at_idx" ON "audit_logs"("model_type", "model_id", "created_at");


-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");


-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");


-- Update existing tenants to have maxProjects = 100
UPDATE "tenants" SET "max_projects" = 100 WHERE "max_projects" < 100;

-- AlterTable
ALTER TABLE "tenants" ALTER COLUMN "max_projects" SET DEFAULT 100;


-- CreateIndex
CREATE INDEX "test_run_results_is_valid_idx" ON "test_run_results"("is_valid");

-- CreateIndex
CREATE INDEX "test_runs_attachments_comment_id_idx" ON "test_runs_attachments"("comment_id");

-- CreateIndex
CREATE INDEX "editor_images_storage_type_idx" ON "editor_images"("storage_type");

-- CreateIndex
CREATE INDEX "test_run_templates_project_id_is_active_idx" ON "test_run_templates"("project_id", "is_active");

-- CreateIndex
CREATE INDEX "test_run_templates_test_plan_id_idx" ON "test_run_templates"("test_plan_id");

-- CreateIndex
CREATE INDEX "test_run_templates_created_by_idx" ON "test_run_templates"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_test_runs_last_run_id_key" ON "scheduled_test_runs"("last_run_id");

-- CreateIndex
CREATE INDEX "scheduled_test_runs_project_id_status_idx" ON "scheduled_test_runs"("project_id", "status");

-- CreateIndex
CREATE INDEX "scheduled_test_runs_template_id_idx" ON "scheduled_test_runs"("template_id");

-- CreateIndex
CREATE INDEX "scheduled_test_runs_next_run_at_idx" ON "scheduled_test_runs"("next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_test_runs_status_next_run_at_idx" ON "scheduled_test_runs"("status", "next_run_at");

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
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "test_runs_attachments" ADD CONSTRAINT "test_runs_attachments_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "test_runs_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_templates" ADD CONSTRAINT "test_run_templates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_templates" ADD CONSTRAINT "test_run_templates_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_run_templates" ADD CONSTRAINT "test_run_templates_test_plan_id_fkey" FOREIGN KEY ("test_plan_id") REFERENCES "test_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_test_runs" ADD CONSTRAINT "scheduled_test_runs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "test_run_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_test_runs" ADD CONSTRAINT "scheduled_test_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_test_runs" ADD CONSTRAINT "scheduled_test_runs_last_run_id_fkey" FOREIGN KEY ("last_run_id") REFERENCES "test_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
