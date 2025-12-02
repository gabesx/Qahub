# Next Implementation Priorities

Based on scanning `schema.dbml` and comparing with `SCHEMA_IMPLEMENTATION_STATUS.md`, here are the missing features prioritized by importance:

## 🔴 High Priority (Core Features)

### 1. PRD Review & Requirements Management
**Status:** ❌ Not Implemented  
**Models Needed:**
- `prd_reviews` - PRD review management
- `prd_review_cache` - PRD review caching

**Why:** Core feature for product requirements documentation and review workflow.

**Schema Details:**
- `prd_reviews`: title, content, status, project_id, reviewed_by, reviewed_at, comments
- `prd_review_cache`: cache_key, cache_type, data (JSON), expires_at

**Implementation Tasks:**
1. Add models to Prisma schema
2. Create API routes: `/projects/:projectId/prd-reviews/*`
3. Implement caching logic
4. Add review workflow (draft → review → approved)

---

### 2. Decision Logs
**Status:** ❌ Not Implemented  
**Model Needed:**
- `decision_logs` - Decision tracking and logging

**Why:** Important for tracking decisions, context, and impact/risk analysis.

**Schema Details:**
- Fields: title, decision_type, decision_owner, decision_owner_id, involved_qa, decision_date, sprint_release, context, decision, impact_risk, status, tags (JSON), related_artifacts

**Implementation Tasks:**
1. Add model to Prisma schema
2. Create API routes: `/decision-logs/*`
3. Add filtering by decision_type, status, date range
4. Add search functionality

---

## 🟡 Medium Priority (Enhanced Features)

### 3. Entity Metadata (Extensibility)
**Status:** ❌ Not Implemented  
**Model Needed:**
- `entity_metadata` - Generic metadata storage

**Why:** Provides extensibility without schema changes - allows custom fields, tags, labels for any entity.

**Schema Details:**
- Fields: entity_type, entity_id, meta_key, meta_value
- Unique index: (entity_type, entity_id, meta_key)

**Implementation Tasks:**
1. Add model to Prisma schema
2. Create API routes: `/metadata/*` or `/entities/:type/:id/metadata`
3. Support bulk operations
4. Add validation for entity types

---

### 4. Audit Events (Event Sourcing)
**Status:** ❌ Not Implemented  
**Model Needed:**
- `audit_events` - Event sourcing table

**Why:** Comprehensive audit trail with event sourcing pattern - enables time-travel queries and event replay.

**Schema Details:**
- Fields: event_type, aggregate_type, aggregate_id, user_id, event_data (JSON), metadata (JSON), occurred_at

**Implementation Tasks:**
1. Add model to Prisma schema
2. Integrate with domain event emitter
3. Create API routes for querying events
4. Add event replay functionality (optional)

---

## 🟢 Lower Priority (Integration/Advanced Features)

### 5. Analytics & Reporting (External Integrations)
**Status:** ❌ Not Implemented  
**Models Needed:**
- `allure_report` - Allure test reports
- `allure_scenarios` - Allure scenarios
- `allure_steps` - Allure test steps
- `gitlab_mr_lead_times` - GitLab merge request metrics
- `gitlab_mr_contributors` - GitLab contributor metrics
- `jira_lead_times` - Jira issue lead times
- `monthly_contributions` - Monthly contribution tracking

**Why:** Integration features for external tools - can be added when needed.

**Implementation Tasks:**
1. Add models to Prisma schema
2. Create API routes for uploading/viewing reports
3. Implement integration with Allure, GitLab, Jira
4. Add data sync jobs

---

### 6. Workflow & Saga Patterns
**Status:** ❌ Not Implemented  
**Model Needed:**
- `workflow_sagas` - Workflow orchestration

**Why:** Advanced feature for complex multi-step workflows with rollback capability.

**Schema Details:**
- Fields: saga_type, current_step, status (enum), context (JSON), started_by, completed_at, failed_at, error_message

**Implementation Tasks:**
1. Add model to Prisma schema
2. Implement saga pattern
3. Create API routes for workflow management
4. Add rollback/compensation logic

---

## ✅ Already Implemented (Archive Tables)

- ✅ `audit_logs_archive` - Exists in Prisma schema
- ✅ `jira_table_history_archive` - Exists in Prisma schema

**Note:** Archive API routes and archiving jobs can be added later.

---

## 📊 Summary

### By Priority:
- **High Priority:** 2 features (PRD Reviews, Decision Logs)
- **Medium Priority:** 2 features (Entity Metadata, Audit Events)
- **Lower Priority:** 2 feature groups (Analytics Integrations, Workflow Sagas)

### Recommended Next Steps:

1. **Start with PRD Reviews** - Most likely to be used immediately
   - Clear business value
   - Well-defined schema
   - Straightforward implementation

2. **Then Decision Logs** - Important for tracking decisions
   - Useful for documentation
   - Simple CRUD operations

3. **Entity Metadata** - Provides extensibility
   - Enables custom fields without migrations
   - Useful for future flexibility

4. **Audit Events** - Enhanced audit trail
   - Can integrate with existing event system
   - Enables advanced audit features

---

## 🎯 Recommendation

**Start with: PRD Review & Requirements Management**

This is the most complete missing feature that would provide immediate value. It includes:
- Clear use case (PRD review workflow)
- Well-defined schema
- Caching support
- Project integration

Would you like me to implement PRD Reviews next?

