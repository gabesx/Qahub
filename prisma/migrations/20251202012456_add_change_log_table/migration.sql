-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('insert', 'update', 'delete');

-- CreateEnum
CREATE TYPE "SagaStatus" AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'rolled_back');

-- CreateTable
CREATE TABLE "bug_budget" (
    "id" BIGSERIAL NOT NULL,
    "jira_key" VARCHAR(255) NOT NULL,
    "project" VARCHAR(255) NOT NULL,
    "project_id" BIGINT,
    "summary" TEXT NOT NULL,
    "status" VARCHAR(255),
    "issue_type" VARCHAR(255),
    "final_issue_type" VARCHAR(255),
    "priority" VARCHAR(255),
    "severity_issue" VARCHAR(255),
    "sprint" VARCHAR(255),
    "status_category" VARCHAR(255),
    "assignee_final" VARCHAR(255),
    "assignee_id" BIGINT,
    "reporter" VARCHAR(255),
    "reporter_id" BIGINT,
    "creator" VARCHAR(255),
    "creator_id" BIGINT,
    "labels" TEXT,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP,
    "updated_date" TIMESTAMP,
    "resolved_date" TIMESTAMP,
    "due_date" TIMESTAMP,
    "last_synced_at" TIMESTAMP,
    "description" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "bug_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_budget_metadata" (
    "bug_budget_id" BIGINT NOT NULL,
    "epic_hierarchy" JSONB,
    "assignee_details" JSONB,
    "date_fields" JSONB,
    "analysis_fields" JSONB,
    "classification_fields" JSONB,
    "report_fields" JSONB,
    "story_points_data" JSONB,
    "version_fields" JSONB,
    "raw_jira_data" JSONB,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "bug_budget_metadata_pkey" PRIMARY KEY ("bug_budget_id")
);

-- CreateTable
CREATE TABLE "jira_table_history" (
    "id" BIGSERIAL NOT NULL,
    "project" VARCHAR(255),
    "issuetype" VARCHAR(255),
    "issuekey" VARCHAR(255) NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "acceptance_criteria" TEXT,
    "implementation_detail" TEXT,
    "components" JSONB,
    "epic_link" VARCHAR(255),
    "epic_name" VARCHAR(255),
    "epic_status" VARCHAR(255),
    "fix_versions" JSONB,
    "priority" VARCHAR(255),
    "severity_issue" VARCHAR(255),
    "comment" JSONB,
    "subtasks" JSONB,
    "parent" VARCHAR(255),
    "parent_link" VARCHAR(255),
    "labels" JSONB,
    "linked_issues" JSONB,
    "linked_items" JSONB,
    "linked_test_document" VARCHAR(255),
    "test_run_link" VARCHAR(255),
    "user_journey" VARCHAR(255),
    "service_feature" VARCHAR(255),
    "created" TIMESTAMP,
    "begin_date" TIMESTAMP,
    "start_date" DATE,
    "actual_start" TIMESTAMP,
    "due_date" DATE,
    "end_date" TIMESTAMP,
    "actual_end" TIMESTAMP,
    "sprint" VARCHAR(255),
    "sprint_id" BIGINT,
    "sprint_state" VARCHAR(255),
    "sprint_complete_date" TIMESTAMP,
    "sprint_start_date" TIMESTAMP,
    "sprint_end_date" TIMESTAMP,
    "sprint_goal_id" BIGINT,
    "status" VARCHAR(255),
    "status_category" VARCHAR(255),
    "status_category_changed" TIMESTAMP,
    "owner" VARCHAR(255),
    "approvers" JSONB,
    "assignee" VARCHAR(255),
    "engineer_assignee" JSONB,
    "collaborators" JSONB,
    "tester_assignee" VARCHAR(255),
    "reporter" VARCHAR(255),
    "story_points" DECIMAL(10,2),
    "story_point_estimate" DECIMAL(10,2),
    "re_test_point" DECIMAL(10,2),
    "log_work" JSONB,
    "original_estimate" INTEGER,
    "time_spent" INTEGER,
    "time_tracking" JSONB,
    "time_to_first_response" VARCHAR(255),
    "time_to_resolution" VARCHAR(255),
    "time_to_close_after_resolution" VARCHAR(255),
    "tis_al_board" VARCHAR(255),
    "chart_date_of_first_response" TIMESTAMP,
    "chart_time_in_status" JSONB,
    "updated" TIMESTAMP,
    "resolution" VARCHAR(255),
    "resolved" TIMESTAMP,
    "raw_jira_data" JSONB,
    "synced_at" TIMESTAMP,
    "sync_source" VARCHAR(255),
    "jql_query_used" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "jira_table_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_fields" (
    "id" BIGSERIAL NOT NULL,
    "field_type" VARCHAR(255) NOT NULL,
    "field_id" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "jira_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs_archive" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT,
    "action" VARCHAR(255) NOT NULL,
    "model_type" VARCHAR(255),
    "model_id" BIGINT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "archived_at" TIMESTAMP NOT NULL,
    "original_created_at" TIMESTAMP NOT NULL,
    "original_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "audit_logs_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_table_history_archive" (
    "id" BIGSERIAL NOT NULL,
    "issuekey" VARCHAR(255) NOT NULL,
    "project" VARCHAR(255),
    "issuetype" VARCHAR(255),
    "summary" TEXT,
    "description" TEXT,
    "raw_jira_data" JSONB,
    "synced_at" TIMESTAMP,
    "archived_at" TIMESTAMP NOT NULL,
    "original_created_at" TIMESTAMP NOT NULL,
    "original_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "jira_table_history_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_logs" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "decision_type" VARCHAR(255) NOT NULL,
    "decision_owner" VARCHAR(255),
    "decision_owner_id" BIGINT,
    "involved_qa" TEXT,
    "decision_date" DATE NOT NULL,
    "sprint_release" VARCHAR(255),
    "context" TEXT,
    "decision" TEXT NOT NULL,
    "impact_risk" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'active',
    "tags" JSONB,
    "related_artifacts" TEXT,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "decision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_metadata" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR(255) NOT NULL,
    "entity_id" BIGINT NOT NULL,
    "meta_key" VARCHAR(255) NOT NULL,
    "meta_value" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "entity_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prd_reviews" (
    "id" BIGSERIAL NOT NULL,
    "request_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "requester_name" VARCHAR(255) NOT NULL,
    "confluence_url" VARCHAR(2048),
    "page_id" VARCHAR(255),
    "ai_review" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "project_id" BIGINT,
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP,
    "synced_at" TIMESTAMP,
    "comments" TEXT,
    "metadata" JSONB,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "prd_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prd_review_cache" (
    "id" BIGSERIAL NOT NULL,
    "prd_review_id" BIGINT,
    "cache_key" VARCHAR(255) NOT NULL,
    "cache_type" VARCHAR(100),
    "data" JSONB NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "prd_review_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allure_report" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "version" VARCHAR(255),
    "summary" JSONB,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "execution_started_at" TIMESTAMP,
    "execution_stopped_at" TIMESTAMP,
    "created_by" BIGINT,
    "updated_by" BIGINT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "allure_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allure_scenarios" (
    "id" BIGSERIAL NOT NULL,
    "allure_report_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "duration" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "allure_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allure_steps" (
    "id" BIGSERIAL NOT NULL,
    "scenario_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "duration" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "allure_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gitlab_mr_lead_times" (
    "id" BIGSERIAL NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "project_id" BIGINT,
    "mr_id" VARCHAR(255) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "author" VARCHAR(255) NOT NULL,
    "author_id" BIGINT,
    "mr_created_at" TIMESTAMP NOT NULL,
    "merged_at" TIMESTAMP,
    "lead_time_hours" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "gitlab_mr_lead_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gitlab_mr_contributors" (
    "id" BIGSERIAL NOT NULL,
    "project_name" VARCHAR(255) NOT NULL,
    "project_id" BIGINT,
    "username" VARCHAR(255) NOT NULL,
    "user_id" BIGINT,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "contributions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "gitlab_mr_contributors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jira_lead_times" (
    "id" BIGSERIAL NOT NULL,
    "project_key" VARCHAR(255) NOT NULL,
    "project_id" BIGINT,
    "issue_key" VARCHAR(255) NOT NULL,
    "bug_budget_id" BIGINT,
    "issue_type" VARCHAR(255) NOT NULL,
    "status" VARCHAR(255) NOT NULL,
    "issue_created_at" TIMESTAMP NOT NULL,
    "resolved_at" TIMESTAMP,
    "lead_time_hours" INTEGER,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "jira_lead_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_contributions" (
    "id" BIGSERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "month_name" VARCHAR(50),
    "username" VARCHAR(255),
    "user_id" BIGINT,
    "name" VARCHAR(255),
    "squad" VARCHAR(255),
    "mr_created" INTEGER NOT NULL DEFAULT 0,
    "mr_approved" INTEGER NOT NULL DEFAULT 0,
    "repo_pushes" INTEGER NOT NULL DEFAULT 0,
    "total_events" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,
    "project_id" BIGINT,

    CONSTRAINT "monthly_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_log" (
    "id" BIGSERIAL NOT NULL,
    "table_name" VARCHAR(255) NOT NULL,
    "record_id" BIGINT NOT NULL,
    "change_type" "ChangeType" NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "changed_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" BIGINT,
    "transaction_id" VARCHAR(255),
    "source" VARCHAR(100),

    CONSTRAINT "change_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" BIGSERIAL NOT NULL,
    "event_type" VARCHAR(255) NOT NULL,
    "aggregate_type" VARCHAR(255) NOT NULL,
    "aggregate_id" BIGINT NOT NULL,
    "user_id" BIGINT,
    "event_data" JSONB NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_sagas" (
    "id" BIGSERIAL NOT NULL,
    "saga_type" VARCHAR(255) NOT NULL,
    "current_step" VARCHAR(255) NOT NULL,
    "status" "SagaStatus" NOT NULL,
    "context" JSONB NOT NULL,
    "started_by" BIGINT,
    "completed_at" TIMESTAMP,
    "failed_at" TIMESTAMP,
    "error_message" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "workflow_sagas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bug_budget_view" (
    "id" BIGINT NOT NULL,
    "jira_key" VARCHAR(255) NOT NULL,
    "project" VARCHAR(255) NOT NULL,
    "project_id" BIGINT,
    "summary" TEXT NOT NULL,
    "status" VARCHAR(255) NOT NULL,
    "issue_type" VARCHAR(255) NOT NULL,
    "priority" VARCHAR(255),
    "assignee_final" VARCHAR(255),
    "assignee_id" BIGINT,
    "sprint" VARCHAR(255),
    "status_category" VARCHAR(255),
    "is_open" BOOLEAN NOT NULL,
    "created_date" TIMESTAMP,
    "resolved_date" TIMESTAMP,
    "epic_name" VARCHAR(255),
    "service_feature" VARCHAR(255),
    "resolution_time_hours" DECIMAL(10,2),
    "age_days" INTEGER,
    "last_updated_at" TIMESTAMP NOT NULL,

    CONSTRAINT "bug_budget_view_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bug_budget_jira_key_key" ON "bug_budget"("jira_key");

-- CreateIndex
CREATE INDEX "bug_budget_project_status_is_open_idx" ON "bug_budget"("project", "status", "is_open");

-- CreateIndex
CREATE INDEX "bug_budget_project_id_status_is_open_idx" ON "bug_budget"("project_id", "status", "is_open");

-- CreateIndex
CREATE INDEX "bug_budget_assignee_final_status_idx" ON "bug_budget"("assignee_final", "status");

-- CreateIndex
CREATE INDEX "bug_budget_assignee_id_status_idx" ON "bug_budget"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "bug_budget_sprint_status_category_idx" ON "bug_budget"("sprint", "status_category");

-- CreateIndex
CREATE INDEX "bug_budget_created_date_resolved_date_idx" ON "bug_budget"("created_date", "resolved_date");

-- CreateIndex
CREATE INDEX "bug_budget_jira_key_last_synced_at_idx" ON "bug_budget"("jira_key", "last_synced_at");

-- CreateIndex
CREATE INDEX "bug_budget_project_id_idx" ON "bug_budget"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "jira_table_history_issuekey_key" ON "jira_table_history"("issuekey");

-- CreateIndex
CREATE INDEX "jira_table_history_project_idx" ON "jira_table_history"("project");

-- CreateIndex
CREATE INDEX "jira_table_history_issuetype_idx" ON "jira_table_history"("issuetype");

-- CreateIndex
CREATE INDEX "jira_table_history_issuekey_idx" ON "jira_table_history"("issuekey");

-- CreateIndex
CREATE INDEX "jira_table_history_epic_link_idx" ON "jira_table_history"("epic_link");

-- CreateIndex
CREATE INDEX "jira_table_history_priority_idx" ON "jira_table_history"("priority");

-- CreateIndex
CREATE INDEX "jira_table_history_created_idx" ON "jira_table_history"("created");

-- CreateIndex
CREATE INDEX "jira_table_history_updated_idx" ON "jira_table_history"("updated");

-- CreateIndex
CREATE INDEX "jira_table_history_status_idx" ON "jira_table_history"("status");

-- CreateIndex
CREATE INDEX "jira_table_history_assignee_idx" ON "jira_table_history"("assignee");

-- CreateIndex
CREATE INDEX "jira_table_history_reporter_idx" ON "jira_table_history"("reporter");

-- CreateIndex
CREATE INDEX "jira_table_history_sprint_idx" ON "jira_table_history"("sprint");

-- CreateIndex
CREATE INDEX "jira_table_history_sprint_id_idx" ON "jira_table_history"("sprint_id");

-- CreateIndex
CREATE INDEX "jira_table_history_synced_at_idx" ON "jira_table_history"("synced_at");

-- CreateIndex
CREATE INDEX "jira_table_history_project_issuetype_idx" ON "jira_table_history"("project", "issuetype");

-- CreateIndex
CREATE INDEX "jira_table_history_status_created_idx" ON "jira_table_history"("status", "created");

-- CreateIndex
CREATE INDEX "jira_table_history_assignee_status_idx" ON "jira_table_history"("assignee", "status");

-- CreateIndex
CREATE INDEX "jira_table_history_created_resolved_idx" ON "jira_table_history"("created", "resolved");

-- CreateIndex
CREATE INDEX "jira_table_history_sprint_state_sprint_complete_date_idx" ON "jira_table_history"("sprint_state", "sprint_complete_date");

-- CreateIndex
CREATE INDEX "jira_table_history_sprint_complete_date_idx" ON "jira_table_history"("sprint_complete_date");

-- CreateIndex
CREATE UNIQUE INDEX "jira_fields_field_id_key" ON "jira_fields"("field_id");

-- CreateIndex
CREATE INDEX "jira_fields_field_id_idx" ON "jira_fields"("field_id");

-- CreateIndex
CREATE INDEX "jira_fields_is_custom_idx" ON "jira_fields"("is_custom");

-- CreateIndex
CREATE INDEX "jira_fields_is_active_idx" ON "jira_fields"("is_active");

-- CreateIndex
CREATE INDEX "jira_fields_field_type_is_active_idx" ON "jira_fields"("field_type", "is_active");

-- CreateIndex
CREATE INDEX "jira_fields_created_by_idx" ON "jira_fields"("created_by");

-- CreateIndex
CREATE INDEX "audit_logs_archive_model_type_model_id_original_created_at_idx" ON "audit_logs_archive"("model_type", "model_id", "original_created_at");

-- CreateIndex
CREATE INDEX "audit_logs_archive_user_id_original_created_at_idx" ON "audit_logs_archive"("user_id", "original_created_at");

-- CreateIndex
CREATE INDEX "audit_logs_archive_action_original_created_at_idx" ON "audit_logs_archive"("action", "original_created_at");

-- CreateIndex
CREATE INDEX "jira_table_history_archive_project_idx" ON "jira_table_history_archive"("project");

-- CreateIndex
CREATE INDEX "jira_table_history_archive_issuetype_idx" ON "jira_table_history_archive"("issuetype");

-- CreateIndex
CREATE INDEX "jira_table_history_archive_issuekey_idx" ON "jira_table_history_archive"("issuekey");

-- CreateIndex
CREATE INDEX "decision_logs_decision_type_status_idx" ON "decision_logs"("decision_type", "status");

-- CreateIndex
CREATE INDEX "decision_logs_decision_date_idx" ON "decision_logs"("decision_date");

-- CreateIndex
CREATE INDEX "decision_logs_status_decision_date_idx" ON "decision_logs"("status", "decision_date");

-- CreateIndex
CREATE INDEX "decision_logs_decision_owner_idx" ON "decision_logs"("decision_owner");

-- CreateIndex
CREATE INDEX "decision_logs_decision_owner_id_idx" ON "decision_logs"("decision_owner_id");

-- CreateIndex
CREATE INDEX "decision_logs_created_by_idx" ON "decision_logs"("created_by");

-- CreateIndex
CREATE INDEX "entity_metadata_entity_type_entity_id_idx" ON "entity_metadata"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "entity_metadata_meta_key_meta_value_idx" ON "entity_metadata"("meta_key", "meta_value");

-- CreateIndex
CREATE UNIQUE INDEX "entity_metadata_entity_type_entity_id_meta_key_key" ON "entity_metadata"("entity_type", "entity_id", "meta_key");

-- CreateIndex
CREATE UNIQUE INDEX "prd_reviews_request_id_key" ON "prd_reviews"("request_id");

-- CreateIndex
CREATE INDEX "prd_reviews_request_id_idx" ON "prd_reviews"("request_id");

-- CreateIndex
CREATE INDEX "prd_reviews_project_id_status_idx" ON "prd_reviews"("project_id", "status");

-- CreateIndex
CREATE INDEX "prd_reviews_status_created_at_idx" ON "prd_reviews"("status", "created_at");

-- CreateIndex
CREATE INDEX "prd_reviews_status_reviewed_at_idx" ON "prd_reviews"("status", "reviewed_at");

-- CreateIndex
CREATE INDEX "prd_reviews_reviewed_by_reviewed_at_idx" ON "prd_reviews"("reviewed_by", "reviewed_at");

-- CreateIndex
CREATE INDEX "prd_reviews_created_by_idx" ON "prd_reviews"("created_by");

-- CreateIndex
CREATE INDEX "prd_reviews_requester_name_idx" ON "prd_reviews"("requester_name");

-- CreateIndex
CREATE INDEX "prd_reviews_title_idx" ON "prd_reviews"("title");

-- CreateIndex
CREATE INDEX "prd_reviews_synced_at_idx" ON "prd_reviews"("synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "prd_review_cache_cache_key_key" ON "prd_review_cache"("cache_key");

-- CreateIndex
CREATE INDEX "prd_review_cache_prd_review_id_idx" ON "prd_review_cache"("prd_review_id");

-- CreateIndex
CREATE INDEX "prd_review_cache_cache_key_idx" ON "prd_review_cache"("cache_key");

-- CreateIndex
CREATE INDEX "prd_review_cache_expires_at_idx" ON "prd_review_cache"("expires_at");

-- CreateIndex
CREATE INDEX "prd_review_cache_cache_key_expires_at_idx" ON "prd_review_cache"("cache_key", "expires_at");

-- CreateIndex
CREATE INDEX "prd_review_cache_prd_review_id_cache_type_idx" ON "prd_review_cache"("prd_review_id", "cache_type");

-- CreateIndex
CREATE INDEX "prd_review_cache_cache_type_expires_at_idx" ON "prd_review_cache"("cache_type", "expires_at");

-- CreateIndex
CREATE INDEX "allure_report_status_created_at_idx" ON "allure_report"("status", "created_at");

-- CreateIndex
CREATE INDEX "allure_report_execution_started_at_idx" ON "allure_report"("execution_started_at");

-- CreateIndex
CREATE INDEX "allure_report_name_version_idx" ON "allure_report"("name", "version");

-- CreateIndex
CREATE INDEX "allure_report_created_by_idx" ON "allure_report"("created_by");

-- CreateIndex
CREATE INDEX "allure_scenarios_allure_report_id_idx" ON "allure_scenarios"("allure_report_id");

-- CreateIndex
CREATE INDEX "allure_scenarios_allure_report_id_status_idx" ON "allure_scenarios"("allure_report_id", "status");

-- CreateIndex
CREATE INDEX "allure_scenarios_status_duration_idx" ON "allure_scenarios"("status", "duration");

-- CreateIndex
CREATE INDEX "allure_steps_scenario_id_status_idx" ON "allure_steps"("scenario_id", "status");

-- CreateIndex
CREATE INDEX "allure_steps_status_duration_idx" ON "allure_steps"("status", "duration");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_project_name_mr_created_at_idx" ON "gitlab_mr_lead_times"("project_name", "mr_created_at");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_project_id_mr_created_at_idx" ON "gitlab_mr_lead_times"("project_id", "mr_created_at");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_author_mr_created_at_idx" ON "gitlab_mr_lead_times"("author", "mr_created_at");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_author_id_mr_created_at_idx" ON "gitlab_mr_lead_times"("author_id", "mr_created_at");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_merged_at_idx" ON "gitlab_mr_lead_times"("merged_at");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_project_name_author_idx" ON "gitlab_mr_lead_times"("project_name", "author");

-- CreateIndex
CREATE INDEX "gitlab_mr_lead_times_project_id_author_id_idx" ON "gitlab_mr_lead_times"("project_id", "author_id");

-- CreateIndex
CREATE INDEX "gitlab_mr_contributors_project_name_contributions_idx" ON "gitlab_mr_contributors"("project_name", "contributions");

-- CreateIndex
CREATE INDEX "gitlab_mr_contributors_project_id_contributions_idx" ON "gitlab_mr_contributors"("project_id", "contributions");

-- CreateIndex
CREATE INDEX "gitlab_mr_contributors_username_idx" ON "gitlab_mr_contributors"("username");

-- CreateIndex
CREATE INDEX "gitlab_mr_contributors_user_id_idx" ON "gitlab_mr_contributors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_mr_contributors_project_name_username_key" ON "gitlab_mr_contributors"("project_name", "username");

-- CreateIndex
CREATE UNIQUE INDEX "gitlab_mr_contributors_project_id_user_id_key" ON "gitlab_mr_contributors"("project_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "jira_lead_times_issue_key_key" ON "jira_lead_times"("issue_key");

-- CreateIndex
CREATE INDEX "jira_lead_times_project_key_issue_created_at_idx" ON "jira_lead_times"("project_key", "issue_created_at");

-- CreateIndex
CREATE INDEX "jira_lead_times_project_id_issue_created_at_idx" ON "jira_lead_times"("project_id", "issue_created_at");

-- CreateIndex
CREATE INDEX "jira_lead_times_issue_key_idx" ON "jira_lead_times"("issue_key");

-- CreateIndex
CREATE INDEX "jira_lead_times_bug_budget_id_idx" ON "jira_lead_times"("bug_budget_id");

-- CreateIndex
CREATE INDEX "jira_lead_times_status_resolved_at_idx" ON "jira_lead_times"("status", "resolved_at");

-- CreateIndex
CREATE INDEX "jira_lead_times_project_key_status_idx" ON "jira_lead_times"("project_key", "status");

-- CreateIndex
CREATE INDEX "jira_lead_times_project_id_status_idx" ON "jira_lead_times"("project_id", "status");

-- CreateIndex
CREATE INDEX "jira_lead_times_issue_type_status_idx" ON "jira_lead_times"("issue_type", "status");

-- CreateIndex
CREATE INDEX "monthly_contributions_year_month_idx" ON "monthly_contributions"("year", "month");

-- CreateIndex
CREATE INDEX "monthly_contributions_username_year_month_idx" ON "monthly_contributions"("username", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_contributions_user_id_year_month_idx" ON "monthly_contributions"("user_id", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_contributions_squad_year_month_idx" ON "monthly_contributions"("squad", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_contributions_year_month_username_key" ON "monthly_contributions"("year", "month", "username");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_contributions_year_month_user_id_key" ON "monthly_contributions"("year", "month", "user_id");

-- CreateIndex
CREATE INDEX "change_log_table_name_record_id_changed_at_idx" ON "change_log"("table_name", "record_id", "changed_at");

-- CreateIndex
CREATE INDEX "change_log_changed_at_idx" ON "change_log"("changed_at");

-- CreateIndex
CREATE INDEX "change_log_change_type_changed_at_idx" ON "change_log"("change_type", "changed_at");

-- CreateIndex
CREATE INDEX "change_log_transaction_id_idx" ON "change_log"("transaction_id");

-- CreateIndex
CREATE INDEX "change_log_table_name_change_type_changed_at_idx" ON "change_log"("table_name", "change_type", "changed_at");

-- CreateIndex
CREATE INDEX "audit_events_aggregate_type_aggregate_id_occurred_at_idx" ON "audit_events"("aggregate_type", "aggregate_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_user_id_occurred_at_idx" ON "audit_events"("user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_event_type_occurred_at_idx" ON "audit_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_aggregate_type_event_type_occurred_at_idx" ON "audit_events"("aggregate_type", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "workflow_sagas_saga_type_status_idx" ON "workflow_sagas"("saga_type", "status");

-- CreateIndex
CREATE INDEX "workflow_sagas_started_by_status_idx" ON "workflow_sagas"("started_by", "status");

-- CreateIndex
CREATE INDEX "workflow_sagas_status_created_at_idx" ON "workflow_sagas"("status", "created_at");

-- CreateIndex
CREATE INDEX "bug_budget_view_project_status_is_open_idx" ON "bug_budget_view"("project", "status", "is_open");

-- CreateIndex
CREATE INDEX "bug_budget_view_project_id_status_is_open_idx" ON "bug_budget_view"("project_id", "status", "is_open");

-- CreateIndex
CREATE INDEX "bug_budget_view_assignee_final_status_idx" ON "bug_budget_view"("assignee_final", "status");

-- CreateIndex
CREATE INDEX "bug_budget_view_assignee_id_status_idx" ON "bug_budget_view"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "bug_budget_view_sprint_status_category_idx" ON "bug_budget_view"("sprint", "status_category");

-- CreateIndex
CREATE INDEX "bug_budget_view_created_date_resolved_date_idx" ON "bug_budget_view"("created_date", "resolved_date");

-- CreateIndex
CREATE INDEX "bug_budget_view_epic_name_idx" ON "bug_budget_view"("epic_name");

-- CreateIndex
CREATE INDEX "bug_budget_view_service_feature_idx" ON "bug_budget_view"("service_feature");

-- AddForeignKey
ALTER TABLE "test_run_results" ADD CONSTRAINT "test_run_results_bug_budget_id_fkey" FOREIGN KEY ("bug_budget_id") REFERENCES "bug_budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_budget" ADD CONSTRAINT "bug_budget_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_budget" ADD CONSTRAINT "bug_budget_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_budget" ADD CONSTRAINT "bug_budget_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_budget" ADD CONSTRAINT "bug_budget_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bug_budget_metadata" ADD CONSTRAINT "bug_budget_metadata_bug_budget_id_fkey" FOREIGN KEY ("bug_budget_id") REFERENCES "bug_budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_fields" ADD CONSTRAINT "jira_fields_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_fields" ADD CONSTRAINT "jira_fields_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_decision_owner_id_fkey" FOREIGN KEY ("decision_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prd_reviews" ADD CONSTRAINT "prd_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prd_reviews" ADD CONSTRAINT "prd_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prd_reviews" ADD CONSTRAINT "prd_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prd_reviews" ADD CONSTRAINT "prd_reviews_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prd_review_cache" ADD CONSTRAINT "prd_review_cache_prd_review_id_fkey" FOREIGN KEY ("prd_review_id") REFERENCES "prd_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allure_report" ADD CONSTRAINT "allure_report_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allure_report" ADD CONSTRAINT "allure_report_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allure_scenarios" ADD CONSTRAINT "allure_scenarios_allure_report_id_fkey" FOREIGN KEY ("allure_report_id") REFERENCES "allure_report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allure_steps" ADD CONSTRAINT "allure_steps_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "allure_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_mr_lead_times" ADD CONSTRAINT "gitlab_mr_lead_times_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_mr_lead_times" ADD CONSTRAINT "gitlab_mr_lead_times_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_mr_contributors" ADD CONSTRAINT "gitlab_mr_contributors_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gitlab_mr_contributors" ADD CONSTRAINT "gitlab_mr_contributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_lead_times" ADD CONSTRAINT "jira_lead_times_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jira_lead_times" ADD CONSTRAINT "jira_lead_times_bug_budget_id_fkey" FOREIGN KEY ("bug_budget_id") REFERENCES "bug_budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_contributions" ADD CONSTRAINT "monthly_contributions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_contributions" ADD CONSTRAINT "monthly_contributions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_sagas" ADD CONSTRAINT "workflow_sagas_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
