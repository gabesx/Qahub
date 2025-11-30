# Tenant Isolation Implementation Guide

## Quick Reference

This guide provides step-by-step instructions for adding tenant isolation to all tables in the QaHub schema.

## Critical Rules

1. **ALL tenant-scoped tables MUST have `tenant_id` column**
2. **ALL queries MUST include `tenant_id` filter**
3. **ALL indexes MUST include `tenant_id` as first column in composite indexes**
4. **NEVER expose `tenant_id` in API responses** (use `tenant_slug` instead)

## Tables Requiring `tenant_id`

### ✅ Already Added (Examples)
- `tenants` (tenant registry)
- `tenant_users` (tenant-user relationships)
- `projects`
- `repositories`
- `test_cases`
- `documents`

### ⚠️ Still Need `tenant_id`

#### Test Management
- [ ] `suites`
- [ ] `test_plans`
- [ ] `test_plan_test_cases`
- [ ] `test_case_comments`
- [ ] `test_runs`
- [ ] `test_run_results`
- [ ] `test_runs_attachments`
- [ ] `test_runs_comments`

#### Document Management
- [ ] `document_versions`
- [ ] `document_comments`
- [ ] `document_engagements`
- [ ] `document_templates`
- [ ] `editor_images`

#### Bug Tracking
- [ ] `bug_budget`
- [ ] `bug_budget_metadata`
- [ ] `jira_table_history`
- [ ] `jira_lead_times`

#### Analytics
- [ ] `allure_report`
- [ ] `allure_scenarios`
- [ ] `allure_steps`
- [ ] `gitlab_mr_lead_times`
- [ ] `gitlab_mr_contributors`
- [ ] `monthly_contributions`
- [ ] `test_execution_summary`
- [ ] `bug_analytics_daily`
- [ ] `test_case_analytics`

#### PRD & Settings
- [ ] `prd_reviews`
- [ ] `prd_review_cache`
- [ ] `settings` (tenant-specific settings)

#### CQRS Read Models
- [ ] `test_runs_view`
- [ ] `bug_budget_view`

#### Other
- [ ] `decision_logs`
- [ ] `workflow_sagas`
- [ ] `entity_metadata`

### ❌ Do NOT Add `tenant_id` (Global/System Tables)
- `users` (global, linked via `tenant_users`)
- `roles` (global, can be tenant-scoped via `tenant_roles` if needed)
- `permissions` (global)
- `user_roles` (global, but filter by tenant_users)
- `user_permissions` (global, but filter by tenant_users)
- `password_resets` (global, but filter by tenant_users)
- `personal_access_tokens` (global, but filter by tenant_users)
- `password_history` (global, but filter by tenant_users)
- `notifications` (global, but filter by tenant_users)
- `migrations` (system table)
- `audit_logs` (global, but include tenant_id in metadata)
- `audit_events` (global, but include tenant_id in metadata)
- `change_log` (global, but include tenant_id in metadata)
- `menu_visibilities` (can be global or tenant-scoped)
- `jira_fields` (global configuration)

## Implementation Pattern

### 1. Add `tenant_id` Column

```dbml
Table table_name {
  id bigint [pk, increment]
  tenant_id bigint [ref: > tenants.id, note: 'CRITICAL: Tenant isolation - on delete cascade']
  // ... other columns
}
```

### 2. Add Composite Index

```dbml
indexes {
  (tenant_id, id) [note: 'Composite index for tenant-scoped queries']
  (tenant_id, other_foreign_key)
  // ... other indexes
}
```

### 3. Update Prisma Schema

```prisma
model TableName {
  id        BigInt   @id @default(autoincrement())
  tenantId  BigInt   @map("tenant_id")
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([tenantId, id])
  @@map("table_name")
}
```

### 4. Update Repository Pattern

```typescript
class TableNameRepository extends BaseRepository<TableName> {
  protected modelName = 'tableName';

  async findAll(tenantId: bigint): Promise<TableName[]> {
    return this.prisma.tableName.findMany({
      where: {
        tenant_id: tenantId,
        deleted_at: null, // if soft deletes
      },
    });
  }
}
```

## Migration Strategy

### Phase 1: Add `tenant_id` Column (Nullable)
```sql
ALTER TABLE table_name 
ADD COLUMN tenant_id BIGINT NULL,
ADD INDEX idx_table_name_tenant_id (tenant_id);

-- Set default tenant for existing data (if migrating)
UPDATE table_name 
SET tenant_id = (SELECT id FROM tenants WHERE slug = 'default' LIMIT 1)
WHERE tenant_id IS NULL;

-- Make NOT NULL after data migration
ALTER TABLE table_name 
MODIFY COLUMN tenant_id BIGINT NOT NULL;

-- Add foreign key
ALTER TABLE table_name 
ADD CONSTRAINT fk_table_name_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
```

### Phase 2: Add Composite Indexes
```sql
ALTER TABLE table_name 
ADD INDEX idx_table_name_tenant_id_id (tenant_id, id);

ALTER TABLE table_name 
ADD INDEX idx_table_name_tenant_id_foreign_key (tenant_id, foreign_key_id);
```

### Phase 3: Update Application Code
1. Update Prisma schema
2. Run `prisma generate`
3. Update repositories to include tenant_id filter
4. Update API controllers to extract tenant from context
5. Add middleware to validate tenant access

## Application-Level Enforcement

### Prisma Middleware

```typescript
// Automatically add tenant_id to all queries
prisma.$use(async (params, next) => {
  const tenantId = getTenantIdFromContext();
  
  if (params.model && isTenantScoped(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        tenant_id: tenantId,
      };
    }
    
    if (params.action === 'create' || params.action === 'update') {
      params.args.data = {
        ...params.args.data,
        tenant_id: tenantId,
      };
    }
  }
  
  return next(params);
});
```

### Base Repository

```typescript
abstract class BaseRepository<T> {
  constructor(
    protected prisma: PrismaClient,
    protected tenantId: bigint
  ) {}

  protected getTenantFilter() {
    return { tenant_id: this.tenantId };
  }

  async findById(id: bigint): Promise<T | null> {
    return this.prisma[this.modelName].findFirst({
      where: {
        id,
        ...this.getTenantFilter(),
      },
    });
  }

  async findAll(): Promise<T[]> {
    return this.prisma[this.modelName].findMany({
      where: {
        ...this.getTenantFilter(),
        deleted_at: null,
      },
    });
  }
}
```

## Testing Tenant Isolation

### Unit Tests

```typescript
describe('Tenant Isolation', () => {
  it('should not return data from other tenants', async () => {
    const tenant1 = await createTenant('tenant1');
    const tenant2 = await createTenant('tenant2');
    
    const project1 = await createProject(tenant1.id, 'Project 1');
    const project2 = await createProject(tenant2.id, 'Project 2');
    
    const repo = new ProjectRepository(prisma, tenant1.id);
    const projects = await repo.findAll();
    
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(project1.id);
    expect(projects[0].id).not.toBe(project2.id);
  });
  
  it('should throw error when accessing other tenant data', async () => {
    const tenant1 = await createTenant('tenant1');
    const tenant2 = await createTenant('tenant2');
    
    const project2 = await createProject(tenant2.id, 'Project 2');
    
    const repo = new ProjectRepository(prisma, tenant1.id);
    
    await expect(repo.findById(project2.id)).resolves.toBeNull();
  });
});
```

## Common Pitfalls

### ❌ DON'T
```typescript
// Missing tenant_id filter
const projects = await prisma.project.findMany();

// Hardcoded tenant_id
const projects = await prisma.project.findMany({
  where: { tenant_id: 1 },
});

// Exposing tenant_id in API
return { id: project.id, tenant_id: project.tenant_id, ... };
```

### ✅ DO
```typescript
// Always include tenant_id from context
const projects = await prisma.project.findMany({
  where: { tenant_id: tenantContext.tenantId },
});

// Use tenant slug in API
return { id: project.id, tenant: tenantContext.tenantSlug, ... };
```

## Checklist for Each Table

- [ ] Add `tenant_id` column with FK to `tenants.id`
- [ ] Add `ON DELETE CASCADE` to FK
- [ ] Add composite index `(tenant_id, id)`
- [ ] Add composite indexes for common query patterns
- [ ] Update Prisma schema
- [ ] Update repository to include tenant filter
- [ ] Add unit tests for tenant isolation
- [ ] Update API controllers
- [ ] Update documentation

## Performance Considerations

1. **Always include `tenant_id` as first column in composite indexes**
   - Enables partition pruning
   - Faster query execution

2. **Use covering indexes** for common queries
   ```sql
   CREATE INDEX idx_test_cases_tenant_status 
   ON test_cases (tenant_id, status, id);
   ```

3. **Monitor query performance** after adding tenant_id
   - Use `EXPLAIN` to verify index usage
   - Check query execution times

## Security Considerations

1. **Never trust client-provided tenant_id**
   - Extract from authenticated user's session
   - Validate user belongs to tenant

2. **Validate tenant access in middleware**
   ```typescript
   async function validateTenantAccess(
     userId: bigint,
     tenantId: bigint
   ): Promise<boolean> {
     const tenantUser = await prisma.tenantUser.findUnique({
       where: {
         tenant_id_user_id: {
           tenant_id: tenantId,
           user_id: userId,
         },
       },
     });
     
     return tenantUser !== null;
   }
   ```

3. **Log all tenant access attempts**
   - Include tenant_id in audit logs
   - Monitor for unauthorized access attempts

---

**Last Updated**: 2024
**Status**: In Progress
**Priority**: CRITICAL - Required for monetization

