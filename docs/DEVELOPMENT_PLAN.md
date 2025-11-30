# QaHub Development Plan

**Last Updated:** 2025-11-30  
**Status:** In Progress  
**Current Phase:** User Management & Authentication (Phase 1) - ✅ Completed

---

## 📋 Overview

This document outlines the development plan for implementing all features defined in `schema.dbml`, starting from **User Management & Authentication** through **Audit & Logging**. The plan is organized into phases, with each phase building upon the previous one.

### Development Principles

1. **Incremental Development**: Build features incrementally, ensuring each phase is complete and tested before moving to the next
2. **Security First**: Authentication, authorization, and security features are prioritized
3. **Multi-Tenancy**: All tenant-scoped features must include proper tenant isolation
4. **Testing**: Unit tests, integration tests, and E2E tests for each feature
5. **Documentation**: API documentation, code comments, and user guides for each feature

---

## ✅ Phase 1: User Management & Authentication (COMPLETED)

**Status:** ✅ **COMPLETED**  
**Completion Date:** 2025-11-30

### Implemented Features

#### 1.1 User Management
- ✅ User registration (`POST /users/register`)
- ✅ User profile management (`GET /users/me`, `PATCH /users/me`)
- ✅ User listing with pagination (`GET /users`)
- ✅ User retrieval by ID (`GET /users/:id`)
- ✅ Password change with history tracking (`POST /users/change-password`)

#### 1.2 Authentication
- ✅ JWT-based authentication (`POST /auth/login`)
- ✅ Token verification (`GET /auth/verify`)
- ✅ Password reset flow:
  - ✅ Forgot password (`POST /auth/forgot-password`)
  - ✅ Verify reset token (`GET /auth/verify-reset-token`)
  - ✅ Reset password (`POST /auth/reset-password`)

#### 1.3 Password Security
- ✅ Password hashing (bcrypt, 12 rounds)
- ✅ Password history tracking (prevents reuse of last 5 passwords)
- ✅ Password reset token generation and validation
- ✅ Token expiration (1 hour)
- ✅ One-time use tokens

#### 1.4 Personal Access Tokens
- ✅ Token creation (`POST /tokens`)
- ✅ Token listing (`GET /tokens`)
- ✅ Token details (`GET /tokens/:id`)
- ✅ Token revocation (`DELETE /tokens/:id`, `DELETE /tokens`)
- ✅ Token usage tracking (IP, user agent, last used)
- ✅ Token expiration support
- ✅ Automatic token revocation on password change

### Database Tables
- ✅ `users`
- ✅ `password_resets`
- ✅ `password_history`
- ✅ `personal_access_tokens`

### API Endpoints
See [`docs/API_ENDPOINTS.md`](./API_ENDPOINTS.md) for complete documentation.

### Next Steps
- [ ] Add email verification flow
- [ ] Add Google OAuth integration (`google_id`, `google_avatar`, `auth_provider`)
- [ ] Add remember token functionality
- [ ] Add user avatar upload
- [ ] Add user deactivation/reactivation

---

## 🔄 Phase 2: Authorization & Permissions

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 2-3 weeks  
**Dependencies:** Phase 1

### Objectives
- Implement role-based access control (RBAC)
- Create permission management system
- Add role and permission assignment to users
- Implement permission checking middleware

### 2.1 Permissions Management

#### Database Tables
- [ ] `permissions` - Permission definitions
- [ ] `roles` - Role definitions
- [ ] `user_permissions` - Direct user-permission assignments
- [ ] `user_roles` - Direct user-role assignments
- [ ] `role_has_permissions` - Role-permission mappings
- [ ] `model_has_permissions` - Polymorphic permissions (deprecated, for backward compatibility)
- [ ] `model_has_roles` - Polymorphic roles (deprecated, for backward compatibility)

#### API Endpoints
- [ ] `GET /permissions` - List all permissions
- [ ] `GET /permissions/:id` - Get permission details
- [ ] `POST /permissions` - Create permission (admin only)
- [ ] `PATCH /permissions/:id` - Update permission (admin only)
- [ ] `DELETE /permissions/:id` - Delete permission (admin only)

- [ ] `GET /roles` - List all roles
- [ ] `GET /roles/:id` - Get role details
- [ ] `POST /roles` - Create role (admin only)
- [ ] `PATCH /roles/:id` - Update role (admin only)
- [ ] `DELETE /roles/:id` - Delete role (admin only)

- [ ] `POST /roles/:id/permissions` - Assign permissions to role
- [ ] `DELETE /roles/:id/permissions/:permissionId` - Remove permission from role

- [ ] `POST /users/:id/roles` - Assign roles to user
- [ ] `DELETE /users/:id/roles/:roleId` - Remove role from user
- [ ] `POST /users/:id/permissions` - Assign permissions to user
- [ ] `DELETE /users/:id/permissions/:permissionId` - Remove permission from user

- [ ] `GET /users/:id/permissions` - Get user's effective permissions (roles + direct)
- [ ] `GET /users/:id/roles` - Get user's roles

#### Middleware
- [ ] `checkPermission(permission)` - Check if user has specific permission
- [ ] `checkRole(role)` - Check if user has specific role
- [ ] `requirePermission(permission)` - Require permission or return 403
- [ ] `requireRole(role)` - Require role or return 403
- [ ] `requireAnyPermission([permissions])` - Require any of the permissions
- [ ] `requireAllPermissions([permissions])` - Require all permissions

#### Services
- [ ] `PermissionService` - Permission CRUD operations
- [ ] `RoleService` - Role CRUD operations
- [ ] `AuthorizationService` - Check user permissions/roles
- [ ] `PermissionCacheService` - Cache user permissions for performance

#### Seed Data
- [ ] Default roles: `admin`, `manager`, `member`, `viewer`
- [ ] Default permissions: `test_case.create`, `test_case.read`, `test_case.update`, `test_case.delete`, etc.

### 2.2 Testing
- [ ] Unit tests for permission checking
- [ ] Integration tests for role assignment
- [ ] E2E tests for permission-based access control
- [ ] Performance tests for permission caching

### 2.3 Documentation
- [ ] API documentation for all endpoints
- [ ] Permission system guide
- [ ] Role assignment guide
- [ ] Migration guide from deprecated polymorphic tables

---

## 🏢 Phase 3: Multi-Tenancy

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 2-3 weeks  
**Dependencies:** Phase 1, Phase 2

### Objectives
- Implement tenant management system
- Add tenant isolation to all tenant-scoped tables
- Create tenant-user relationship management
- Implement tenant context middleware

### 3.1 Tenant Management

#### Database Tables
- [ ] `tenants` - Tenant/organization definitions
- [ ] `tenant_users` - User-tenant relationships with roles

#### API Endpoints
- [ ] `GET /tenants` - List tenants (admin only, or user's tenants)
- [ ] `GET /tenants/:id` - Get tenant details
- [ ] `POST /tenants` - Create tenant (admin only)
- [ ] `PATCH /tenants/:id` - Update tenant (admin/owner only)
- [ ] `DELETE /tenants/:id` - Delete tenant (admin only)
- [ ] `POST /tenants/:id/users` - Invite user to tenant
- [ ] `DELETE /tenants/:id/users/:userId` - Remove user from tenant
- [ ] `PATCH /tenants/:id/users/:userId` - Update user role in tenant
- [ ] `GET /tenants/:id/users` - List tenant users
- [ ] `GET /users/me/tenants` - Get current user's tenants

#### Middleware
- [ ] `requireTenant()` - Require tenant context in request
- [ ] `setTenantContext(tenantId)` - Set tenant context for request
- [ ] `checkTenantAccess(tenantId)` - Check if user has access to tenant
- [ ] `enforceTenantIsolation()` - Automatically filter queries by tenant_id

#### Services
- [ ] `TenantService` - Tenant CRUD operations
- [ ] `TenantUserService` - Tenant-user relationship management
- [ ] `TenantContextService` - Manage tenant context in requests
- [ ] `TenantIsolationService` - Enforce tenant isolation in queries

#### Features
- [ ] Tenant plans: `free`, `starter`, `professional`, `enterprise`
- [ ] Tenant status: `active`, `suspended`, `cancelled`, `trial`
- [ ] Tenant limits: `max_users`, `max_projects` based on plan
- [ ] Tenant features: Feature flags per tenant
- [ ] Subdomain routing support
- [ ] Custom domain support
- [ ] Trial expiration handling

### 3.2 Tenant Isolation
- [ ] Add `tenant_id` to all tenant-scoped tables:
  - [ ] `projects` ✅ (already in schema)
  - [ ] `repositories` ✅ (already in schema)
  - [ ] `test_cases` ✅ (already in schema)
  - [ ] `documents` ✅ (already in schema)
- [ ] Update all queries to include tenant_id filter
- [ ] Add tenant_id validation in all create/update operations
- [ ] Add tenant_id to all indexes (composite indexes)

### 3.3 Testing
- [ ] Unit tests for tenant isolation
- [ ] Integration tests for multi-tenant queries
- [ ] E2E tests for tenant switching
- [ ] Security tests to ensure tenant data isolation

### 3.4 Documentation
- [ ] Multi-tenancy architecture guide
- [ ] Tenant isolation implementation guide
- [ ] Tenant management API documentation
- [ ] Migration guide for adding tenant_id to existing data

---

## 📁 Phase 4: Projects & Repositories

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 1-2 weeks  
**Dependencies:** Phase 3

### Objectives
- Implement project management
- Create repository management within projects
- Add system settings management

### 4.1 Projects Management

#### Database Tables
- [ ] `projects` - Project definitions (with tenant_id)
- [ ] `repositories` - Repository definitions (with tenant_id, project_id)
- [ ] `settings` - System settings (key-value store)

#### API Endpoints
- [ ] `GET /projects` - List projects (tenant-scoped)
- [ ] `GET /projects/:id` - Get project details
- [ ] `POST /projects` - Create project
- [ ] `PATCH /projects/:id` - Update project
- [ ] `DELETE /projects/:id` - Delete project (soft delete)

- [ ] `GET /projects/:id/repositories` - List repositories in project
- [ ] `GET /repositories/:id` - Get repository details
- [ ] `POST /repositories` - Create repository
- [ ] `PATCH /repositories/:id` - Update repository
- [ ] `DELETE /repositories/:id` - Delete repository (soft delete)

- [ ] `GET /settings` - List settings (with category filter)
- [ ] `GET /settings/:key` - Get setting by key
- [ ] `POST /settings` - Create setting (admin only)
- [ ] `PATCH /settings/:key` - Update setting (admin only)
- [ ] `DELETE /settings/:key` - Delete setting (admin only)

#### Services
- [ ] `ProjectService` - Project CRUD operations
- [ ] `RepositoryService` - Repository CRUD operations
- [ ] `SettingsService` - Settings management

#### Features
- [ ] Project title, description
- [ ] Repository title, prefix, description
- [ ] Settings categories: `bug_budget`, `system`, etc.
- [ ] Settings types: `string`, `number`, `boolean`, `json`

### 4.2 Testing
- [ ] Unit tests for project/repository operations
- [ ] Integration tests for tenant isolation
- [ ] E2E tests for project creation workflow

### 4.3 Documentation
- [ ] Project management API documentation
- [ ] Repository management guide
- [ ] Settings configuration guide

---

## 🧪 Phase 5: Test Planning & Organization

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 3-4 weeks  
**Dependencies:** Phase 4

### Objectives
- Implement test suite hierarchy
- Create test case management
- Build test plan system
- Add test case comments

### 5.1 Test Suites

#### Database Tables
- [ ] `suites` - Test suite hierarchy (nested)
- [ ] `test_cases` - Test case definitions (with tenant_id)
- [ ] `test_plans` - Test plan definitions
- [ ] `test_plan_test_cases` - Test plan-test case junction
- [ ] `test_case_comments` - Test case comments (nested)

#### API Endpoints
- [ ] `GET /repositories/:id/suites` - List suites in repository
- [ ] `GET /suites/:id` - Get suite details
- [ ] `POST /suites` - Create suite
- [ ] `PATCH /suites/:id` - Update suite
- [ ] `DELETE /suites/:id` - Delete suite
- [ ] `PATCH /suites/:id/reorder` - Reorder suites

- [ ] `GET /suites/:id/test-cases` - List test cases in suite
- [ ] `GET /test-cases/:id` - Get test case details
- [ ] `POST /test-cases` - Create test case
- [ ] `PATCH /test-cases/:id` - Update test case
- [ ] `DELETE /test-cases/:id` - Delete test case (soft delete)
- [ ] `PATCH /test-cases/:id/reorder` - Reorder test cases
- [ ] `GET /test-cases` - Search test cases (with filters)

- [ ] `GET /projects/:id/test-plans` - List test plans
- [ ] `GET /test-plans/:id` - Get test plan details
- [ ] `POST /test-plans` - Create test plan
- [ ] `PATCH /test-plans/:id` - Update test plan
- [ ] `DELETE /test-plans/:id` - Delete test plan
- [ ] `POST /test-plans/:id/test-cases` - Add test case to plan
- [ ] `DELETE /test-plans/:id/test-cases/:testCaseId` - Remove test case from plan
- [ ] `PATCH /test-plans/:id/test-cases/reorder` - Reorder test cases in plan

- [ ] `GET /test-cases/:id/comments` - List comments
- [ ] `POST /test-cases/:id/comments` - Create comment
- [ ] `PATCH /comments/:id` - Update comment
- [ ] `DELETE /comments/:id` - Delete comment (soft delete)
- [ ] `POST /comments/:id/resolve` - Mark comment as resolved

#### Services
- [ ] `SuiteService` - Suite CRUD and hierarchy management
- [ ] `TestCaseService` - Test case CRUD operations
- [ ] `TestPlanService` - Test plan management
- [ ] `TestCaseCommentService` - Comment management

#### Features
- [ ] Nested suite hierarchy (parent-child)
- [ ] Test case fields:
  - [ ] Title, description, labels
  - [ ] Automated/manual flag
  - [ ] Priority (1-5)
  - [ ] JSON data field (test steps, expected results)
  - [ ] Regression flag
  - [ ] Epic link, linked issue, Jira key
  - [ ] Platform, release version
  - [ ] Severity, defect stage
  - [ ] Version (optimistic locking)
- [ ] Test plan status: `draft`, `active`, `archived`
- [ ] Test case ordering within suites
- [ ] Test case ordering within test plans
- [ ] Full-text search on test cases
- [ ] Nested comments with resolution tracking

### 5.2 Testing
- [ ] Unit tests for suite hierarchy
- [ ] Integration tests for test case CRUD
- [ ] E2E tests for test plan creation workflow
- [ ] Performance tests for full-text search

### 5.3 Documentation
- [ ] Test case management API documentation
- [ ] Test plan creation guide
- [ ] Suite hierarchy guide
- [ ] Test case data JSON schema documentation

---

## 🏃 Phase 6: Test Execution & Results

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 3-4 weeks  
**Dependencies:** Phase 5

### Objectives
- Implement test run execution
- Create test result tracking
- Add test run attachments
- Build test run comments

### 6.1 Test Execution

#### Database Tables
- [ ] `test_runs` - Test run executions
- [ ] `test_run_results` - Individual test case execution results
- [ ] `test_runs_attachments` - Test run attachments
- [ ] `test_runs_comments` - Test run comments

#### API Endpoints
- [ ] `GET /test-runs` - List test runs (with filters)
- [ ] `GET /test-runs/:id` - Get test run details
- [ ] `POST /test-runs` - Create test run
- [ ] `PATCH /test-runs/:id` - Update test run
- [ ] `DELETE /test-runs/:id` - Delete test run
- [ ] `POST /test-runs/:id/start` - Start test run execution
- [ ] `POST /test-runs/:id/complete` - Complete test run execution
- [ ] `POST /test-runs/:id/cancel` - Cancel test run

- [ ] `GET /test-runs/:id/results` - List test run results
- [ ] `GET /test-run-results/:id` - Get test result details
- [ ] `POST /test-run-results` - Create test result
- [ ] `PATCH /test-run-results/:id` - Update test result
- [ ] `POST /test-run-results/:id/retry` - Retry failed test

- [ ] `GET /test-runs/:id/attachments` - List attachments
- [ ] `POST /test-runs/:id/attachments` - Upload attachment
- [ ] `DELETE /attachments/:id` - Delete attachment

- [ ] `GET /test-runs/:id/comments` - List comments
- [ ] `POST /test-runs/:id/comments` - Create comment
- [ ] `PATCH /comments/:id` - Update comment
- [ ] `DELETE /comments/:id` - Delete comment

#### Services
- [ ] `TestRunService` - Test run management
- [ ] `TestRunResultService` - Test result management
- [ ] `TestRunAttachmentService` - Attachment management
- [ ] `TestRunCommentService` - Comment management

#### Features
- [ ] Test run status: `pending`, `running`, `completed`, `failed`, `cancelled`
- [ ] Test result status: `passed`, `failed`, `skipped`, `blocked`
- [ ] Execution time tracking
- [ ] Error messages and stack traces
- [ ] Screenshots (JSON array)
- [ ] Test execution logs
- [ ] Defect found at stage tracking
- [ ] Bug budget linking
- [ ] Defect severity tracking
- [ ] Retry count tracking
- [ ] Execution date, environment, build version

### 6.2 Testing
- [ ] Unit tests for test run creation
- [ ] Integration tests for test result tracking
- [ ] E2E tests for complete test execution workflow
- [ ] Performance tests for bulk result insertion

### 6.3 Documentation
- [ ] Test execution API documentation
- [ ] Test result tracking guide
- [ ] Attachment upload guide
- [ ] Test run status workflow documentation

---

## 📄 Phase 7: Document Management

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 3-4 weeks  
**Dependencies:** Phase 4

### Objectives
- Implement document storage and versioning
- Create document hierarchy
- Add document comments and engagements
- Build document templates

### 7.1 Document Management

#### Database Tables
- [ ] `documents` - Document definitions (with tenant_id)
- [ ] `document_versions` - Document version history
- [ ] `document_comments` - Document comments (nested)
- [ ] `document_engagements` - Document likes, stars, views
- [ ] `document_templates` - Document templates
- [ ] `editor_images` - Editor image uploads
- [ ] `content_storage` - Content-addressable storage for large content
- [ ] `documents_manager` - Deprecated document system (migration support)
- [ ] `document_manager_reviewer` - Deprecated reviewer system

#### API Endpoints
- [ ] `GET /documents` - List documents (with filters)
- [ ] `GET /documents/:id` - Get document details
- [ ] `POST /documents` - Create document
- [ ] `PATCH /documents/:id` - Update document
- [ ] `DELETE /documents/:id` - Delete document (soft delete)
- [ ] `POST /documents/:id/duplicate` - Duplicate document

- [ ] `GET /documents/:id/versions` - List document versions
- [ ] `GET /documents/:id/versions/:versionNumber` - Get specific version
- [ ] `POST /documents/:id/versions` - Create new version
- [ ] `POST /documents/:id/restore/:versionNumber` - Restore to version

- [ ] `GET /documents/:id/comments` - List comments
- [ ] `POST /documents/:id/comments` - Create comment
- [ ] `PATCH /comments/:id` - Update comment
- [ ] `DELETE /comments/:id` - Delete comment (soft delete)
- [ ] `POST /comments/:id/resolve` - Mark comment as resolved

- [ ] `POST /documents/:id/like` - Like document
- [ ] `DELETE /documents/:id/like` - Unlike document
- [ ] `POST /documents/:id/star` - Star document
- [ ] `DELETE /documents/:id/star` - Unstar document
- [ ] `POST /documents/:id/view` - Record view

- [ ] `GET /document-templates` - List templates
- [ ] `GET /document-templates/:id` - Get template details
- [ ] `POST /document-templates` - Create template (admin only)
- [ ] `PATCH /document-templates/:id` - Update template (admin only)
- [ ] `DELETE /document-templates/:id` - Delete template (admin only)

- [ ] `POST /editor/images` - Upload editor image
- [ ] `GET /editor/images/:id` - Get image
- [ ] `DELETE /editor/images/:id` - Delete image

#### Services
- [ ] `DocumentService` - Document CRUD operations
- [ ] `DocumentVersionService` - Version management
- [ ] `DocumentCommentService` - Comment management
- [ ] `DocumentEngagementService` - Engagement tracking
- [ ] `DocumentTemplateService` - Template management
- [ ] `ContentStorageService` - Content-addressable storage
- [ ] `EditorImageService` - Image upload management

#### Features
- [ ] Document hierarchy (parent-child)
- [ ] Document versioning with change summaries
- [ ] Content storage for large documents (content_id → content_storage)
- [ ] Views, likes, stars tracking
- [ ] Nested comments with resolution
- [ ] Document templates with variables
- [ ] Full-text search on documents
- [ ] Optimistic locking (version field)

### 7.2 Migration
- [ ] Migration script from `documents_manager` to `documents`
- [ ] Data migration for existing documents
- [ ] Reviewer migration to comments

### 7.3 Testing
- [ ] Unit tests for document CRUD
- [ ] Integration tests for versioning
- [ ] E2E tests for document creation workflow
- [ ] Performance tests for large content storage

### 7.4 Documentation
- [ ] Document management API documentation
- [ ] Versioning guide
- [ ] Template system guide
- [ ] Migration guide from documents_manager

---

## 📋 Phase 8: PRD Review & Requirements

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 1-2 weeks  
**Dependencies:** Phase 4

### Objectives
- Implement PRD review system
- Create PRD review cache for performance

### 8.1 PRD Review

#### Database Tables
- [ ] `prd_reviews` - PRD review definitions
- [ ] `prd_review_cache` - Cached PRD analysis data

#### API Endpoints
- [ ] `GET /prd-reviews` - List PRD reviews
- [ ] `GET /prd-reviews/:id` - Get PRD review details
- [ ] `POST /prd-reviews` - Create PRD review
- [ ] `PATCH /prd-reviews/:id` - Update PRD review
- [ ] `DELETE /prd-reviews/:id` - Delete PRD review
- [ ] `POST /prd-reviews/:id/review` - Submit review
- [ ] `GET /prd-reviews/:id/cache` - Get cached analysis
- [ ] `POST /prd-reviews/:id/cache/invalidate` - Invalidate cache

#### Services
- [ ] `PRDReviewService` - PRD review management
- [ ] `PRDReviewCacheService` - Cache management
- [ ] `PRDAnalysisService` - PRD analysis and processing

#### Features
- [ ] PRD status: `draft`, `reviewed`, `approved`
- [ ] Review comments and feedback
- [ ] Cached analysis data (metrics, summaries)
- [ ] Cache expiration handling

### 8.2 Testing
- [ ] Unit tests for PRD review CRUD
- [ ] Integration tests for cache management
- [ ] E2E tests for PRD review workflow

### 8.3 Documentation
- [ ] PRD review API documentation
- [ ] PRD review workflow guide
- [ ] Cache management guide

---

## 🐛 Phase 9: Bug Tracking & Issue Management

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 4-5 weeks  
**Dependencies:** Phase 4

### Objectives
- Implement bug tracking system
- Create Jira integration
- Build bug budget management
- Add Jira field management

### 9.1 Bug Tracking

#### Database Tables
- [ ] `bug_budget` - Core bug tracking
- [ ] `bug_budget_metadata` - Extended bug metadata (JSON)
- [ ] `jira_table_history` - Historical Jira data
- [ ] `jira_fields` - Jira field definitions

#### API Endpoints
- [ ] `GET /bug-budget` - List bugs (with filters)
- [ ] `GET /bug-budget/:id` - Get bug details
- [ ] `POST /bug-budget` - Create bug
- [ ] `PATCH /bug-budget/:id` - Update bug
- [ ] `DELETE /bug-budget/:id` - Delete bug
- [ ] `GET /bug-budget/:id/metadata` - Get bug metadata
- [ ] `PATCH /bug-budget/:id/metadata` - Update bug metadata

- [ ] `GET /jira/history` - List Jira history (with filters)
- [ ] `GET /jira/history/:id` - Get Jira history details
- [ ] `POST /jira/sync` - Sync from Jira API
- [ ] `GET /jira/sync/status` - Get sync status

- [ ] `GET /jira/fields` - List Jira fields
- [ ] `GET /jira/fields/:id` - Get field details
- [ ] `POST /jira/fields` - Create field (admin only)
- [ ] `PATCH /jira/fields/:id` - Update field (admin only)
- [ ] `DELETE /jira/fields/:id` - Delete field (admin only)

#### Services
- [ ] `BugBudgetService` - Bug tracking management
- [ ] `BugBudgetMetadataService` - Metadata management
- [ ] `JiraSyncService` - Jira API integration
- [ ] `JiraFieldService` - Field management

#### Features
- [ ] Jira key uniqueness
- [ ] Project linking (project_id)
- [ ] Assignee and reporter linking (user_id)
- [ ] Status tracking (is_open)
- [ ] Date tracking (created_date, updated_date, resolved_date)
- [ ] Extended metadata in JSON:
  - [ ] Epic hierarchy
  - [ ] Assignee details
  - [ ] Date fields
  - [ ] Analysis fields
  - [ ] Classification fields
  - [ ] Report fields
  - [ ] Story points
  - [ ] Version fields
- [ ] Jira sync from API
- [ ] Historical data tracking
- [ ] Partitioning support for large datasets

### 9.2 Jira Integration
- [ ] Jira API client
- [ ] JQL query support
- [ ] Incremental sync
- [ ] Webhook support (optional)
- [ ] Error handling and retry logic

### 9.3 Testing
- [ ] Unit tests for bug tracking CRUD
- [ ] Integration tests for Jira sync
- [ ] E2E tests for bug creation workflow
- [ ] Performance tests for large datasets

### 9.4 Documentation
- [ ] Bug tracking API documentation
- [ ] Jira integration guide
- [ ] Sync configuration guide
- [ ] Metadata structure documentation

---

## 📊 Phase 10: Analytics & Reporting

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 4-5 weeks  
**Dependencies:** Phase 6, Phase 9

### Objectives
- Implement Allure report integration
- Create GitLab metrics tracking
- Build Jira lead time tracking
- Add contribution tracking

### 10.1 Test Reports (Allure)

#### Database Tables
- [ ] `allure_report` - Allure report definitions
- [ ] `allure_scenarios` - Test scenarios
- [ ] `allure_steps` - Test steps

#### API Endpoints
- [ ] `GET /allure/reports` - List reports
- [ ] `GET /allure/reports/:id` - Get report details
- [ ] `POST /allure/reports` - Upload/import report
- [ ] `DELETE /allure/reports/:id` - Delete report
- [ ] `GET /allure/reports/:id/scenarios` - List scenarios
- [ ] `GET /allure/scenarios/:id/steps` - List steps

#### Services
- [ ] `AllureReportService` - Report management
- [ ] `AllureImportService` - Report import/parsing

### 10.2 GitLab Metrics

#### Database Tables
- [ ] `gitlab_mr_lead_times` - Merge request lead times
- [ ] `gitlab_mr_contributors` - Contributor statistics

#### API Endpoints
- [ ] `GET /gitlab/lead-times` - List lead times (with filters)
- [ ] `POST /gitlab/sync` - Sync from GitLab API
- [ ] `GET /gitlab/contributors` - List contributors
- [ ] `GET /gitlab/contributors/:username` - Get contributor stats

#### Services
- [ ] `GitLabSyncService` - GitLab API integration
- [ ] `GitLabMetricsService` - Metrics calculation

### 10.3 Jira Lead Times

#### Database Tables
- [ ] `jira_lead_times` - Jira issue lead times

#### API Endpoints
- [ ] `GET /jira/lead-times` - List lead times (with filters)
- [ ] `POST /jira/lead-times/calculate` - Calculate lead times

#### Services
- [ ] `JiraLeadTimeService` - Lead time calculation

### 10.4 Contributions

#### Database Tables
- [ ] `monthly_contributions` - Monthly contribution statistics

#### API Endpoints
- [ ] `GET /contributions` - List contributions (with filters)
- [ ] `GET /contributions/:username` - Get user contributions
- [ ] `POST /contributions/calculate` - Calculate contributions

#### Services
- [ ] `ContributionService` - Contribution calculation

### 10.5 Testing
- [ ] Unit tests for analytics calculations
- [ ] Integration tests for report import
- [ ] E2E tests for metrics sync
- [ ] Performance tests for large datasets

### 10.6 Documentation
- [ ] Analytics API documentation
- [ ] Allure integration guide
- [ ] GitLab sync guide
- [ ] Lead time calculation guide

---

## 📈 Phase 11: Analytics Summary Tables

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 2-3 weeks  
**Dependencies:** Phase 6, Phase 9, Phase 10

### Objectives
- Create pre-aggregated summary tables
- Implement scheduled jobs for data aggregation
- Build fast analytics queries

### 11.1 Summary Tables

#### Database Tables
- [ ] `test_execution_summary` - Daily test execution summaries
- [ ] `bug_analytics_daily` - Daily bug analytics
- [ ] `test_case_analytics` - Test case analytics

#### API Endpoints
- [ ] `GET /analytics/test-execution` - Get test execution summary
- [ ] `GET /analytics/bugs` - Get bug analytics
- [ ] `GET /analytics/test-cases` - Get test case analytics
- [ ] `POST /analytics/refresh` - Refresh summaries (admin only)

#### Services
- [ ] `TestExecutionSummaryService` - Summary aggregation
- [ ] `BugAnalyticsService` - Bug analytics aggregation
- [ ] `TestCaseAnalyticsService` - Test case analytics aggregation
- [ ] `ScheduledJobService` - Scheduled aggregation jobs

#### Features
- [ ] Daily aggregation
- [ ] Project-level summaries
- [ ] Date range queries
- [ ] Scheduled jobs (node-cron, BullMQ, or Agenda.js)
- [ ] Incremental updates

### 11.2 Scheduled Jobs
- [ ] Daily aggregation job
- [ ] Hourly incremental updates
- [ ] Weekly/monthly summaries
- [ ] Job monitoring and error handling

### 11.3 Testing
- [ ] Unit tests for aggregation logic
- [ ] Integration tests for scheduled jobs
- [ ] Performance tests for large datasets

### 11.4 Documentation
- [ ] Analytics summary API documentation
- [ ] Scheduled jobs guide
- [ ] Aggregation strategy documentation

---

## 🔍 Phase 12: Audit & Logging

**Status:** 🔄 **PENDING**  
**Estimated Duration:** 2-3 weeks  
**Dependencies:** All previous phases

### Objectives
- Implement decision logging
- Create comprehensive audit trails
- Build event sourcing system

### 12.1 Decision Logs

#### Database Tables
- [ ] `decision_logs` - Decision tracking

#### API Endpoints
- [ ] `GET /decision-logs` - List decision logs (with filters)
- [ ] `GET /decision-logs/:id` - Get decision log details
- [ ] `POST /decision-logs` - Create decision log
- [ ] `PATCH /decision-logs/:id` - Update decision log
- [ ] `DELETE /decision-logs/:id` - Delete decision log

#### Services
- [ ] `DecisionLogService` - Decision log management

### 12.2 Audit Logs

#### Database Tables
- [ ] `audit_logs` - Audit trail
- [ ] `audit_logs_archive` - Archived audit logs

#### API Endpoints
- [ ] `GET /audit-logs` - List audit logs (with filters)
- [ ] `GET /audit-logs/:id` - Get audit log details
- [ ] `POST /audit-logs/archive` - Archive old logs (admin only)

#### Services
- [ ] `AuditLogService` - Audit log management
- [ ] `AuditArchiveService` - Archive management

#### Features
- [ ] Automatic audit logging on create/update/delete
- [ ] Old values and new values tracking
- [ ] IP address and user agent tracking
- [ ] Model type and model ID tracking
- [ ] Automatic archiving (2+ years old)
- [ ] Partitioning support

### 12.3 Event Sourcing

#### Database Tables
- [ ] `audit_events` - Event sourcing log

#### API Endpoints
- [ ] `GET /audit-events` - List events (with filters)
- [ ] `GET /audit-events/:id` - Get event details
- [ ] `POST /audit-events/replay` - Replay events (admin only)

#### Services
- [ ] `EventSourcingService` - Event management
- [ ] `EventReplayService` - Event replay

#### Features
- [ ] Immutable event log
- [ ] Event types: `created`, `updated`, `deleted`, `restored`, `archived`
- [ ] Aggregate type and ID tracking
- [ ] Complete event payload
- [ ] Metadata tracking (IP, user_agent, request_id, session_id)
- [ ] Time-travel queries
- [ ] Event replay capability

### 12.4 Middleware
- [ ] `auditMiddleware()` - Automatic audit logging
- [ ] `eventSourcingMiddleware()` - Event sourcing capture

### 12.5 Testing
- [ ] Unit tests for audit logging
- [ ] Integration tests for event sourcing
- [ ] E2E tests for audit trail
- [ ] Performance tests for high-volume logging

### 12.6 Documentation
- [ ] Audit logging API documentation
- [ ] Event sourcing guide
- [ ] Archive management guide
- [ ] Compliance documentation

---

## 🎯 Implementation Priority

### High Priority (Core Features)
1. ✅ Phase 1: User Management & Authentication
2. Phase 2: Authorization & Permissions
3. Phase 3: Multi-Tenancy
4. Phase 4: Projects & Repositories
5. Phase 5: Test Planning & Organization

### Medium Priority (Essential Features)
6. Phase 6: Test Execution & Results
7. Phase 7: Document Management
8. Phase 9: Bug Tracking & Issue Management

### Lower Priority (Enhancement Features)
9. Phase 8: PRD Review & Requirements
10. Phase 10: Analytics & Reporting
11. Phase 11: Analytics Summary Tables
12. Phase 12: Audit & Logging

---

## 📝 Notes

### Technical Considerations

1. **Database Partitioning**: Large tables (`bug_budget`, `jira_table_history`, `audit_logs`) should be partitioned by date for performance
2. **Caching**: Implement Redis caching for frequently accessed data (permissions, tenant context, analytics summaries)
3. **Background Jobs**: Use BullMQ or Agenda.js for scheduled jobs and async processing
4. **File Storage**: Use S3 or similar for large file storage (attachments, content storage)
5. **Search**: Implement Elasticsearch or similar for full-text search on large datasets
6. **Rate Limiting**: Implement rate limiting on all API endpoints
7. **API Versioning**: Maintain API versioning strategy (`/api/v1/...`)

### Migration Strategy

1. **Incremental Rollout**: Deploy features incrementally, testing each phase before moving to the next
2. **Data Migration**: Create migration scripts for deprecated tables (`documents_manager`, `model_has_permissions`, etc.)
3. **Backward Compatibility**: Maintain backward compatibility during migration periods
4. **Rollback Plan**: Have rollback procedures for each phase

### Testing Strategy

1. **Unit Tests**: Test all services and utilities
2. **Integration Tests**: Test API endpoints and database operations
3. **E2E Tests**: Test complete user workflows
4. **Performance Tests**: Test with large datasets and high load
5. **Security Tests**: Test authentication, authorization, and tenant isolation

---

## 📊 Progress Tracking

| Phase | Status | Progress | Start Date | End Date |
|-------|--------|----------|------------|----------|
| Phase 1: User Management & Authentication | ✅ Completed | 100% | 2025-11-01 | 2025-11-30 |
| Phase 2: Authorization & Permissions | 🔄 Pending | 0% | - | - |
| Phase 3: Multi-Tenancy | 🔄 Pending | 0% | - | - |
| Phase 4: Projects & Repositories | 🔄 Pending | 0% | - | - |
| Phase 5: Test Planning & Organization | 🔄 Pending | 0% | - | - |
| Phase 6: Test Execution & Results | 🔄 Pending | 0% | - | - |
| Phase 7: Document Management | 🔄 Pending | 0% | - | - |
| Phase 8: PRD Review & Requirements | 🔄 Pending | 0% | - | - |
| Phase 9: Bug Tracking & Issue Management | 🔄 Pending | 0% | - | - |
| Phase 10: Analytics & Reporting | 🔄 Pending | 0% | - | - |
| Phase 11: Analytics Summary Tables | 🔄 Pending | 0% | - | - |
| Phase 12: Audit & Logging | 🔄 Pending | 0% | - | - |

---

**Last Updated:** 2025-11-30  
**Next Review:** After Phase 2 completion

