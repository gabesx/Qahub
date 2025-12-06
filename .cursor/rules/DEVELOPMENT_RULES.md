# QaHub Development Rules & Guidelines

## Table of Contents
1. [Architecture Principles](#architecture-principles)
2. [Multi-Tenancy Strategy](#multi-tenancy-strategy)
3. [Code Organization](#code-organization)
4. [Database & Data Access](#database--data-access)
5. [Security & Authentication](#security--authentication)
6. [API Design Standards](#api-design-standards)
7. [Error Handling & Logging](#error-handling--logging)
8. [Testing Requirements](#testing-requirements)
9. [Performance & Scalability](#performance--scalability)
10. [Deployment & DevOps](#deployment--devops)

---

## Architecture Principles

### 1. **Domain-Driven Design (DDD)**
- Organize code by business domains (Test Management, Document Management, Bug Tracking, Analytics)
- Each domain should have its own module with clear boundaries
- Use aggregates to maintain data consistency

### 2. **CQRS Pattern**
- Separate read and write models (already implemented in schema: `test_runs_view`, `bug_budget_view`)
- Write operations go through command handlers
- Read operations use optimized read models
- Update read models via event listeners

### 3. **Event-Driven Architecture**
- Use `audit_events` table for event sourcing
- Emit domain events for all state changes
- Listeners update read models, send notifications, trigger workflows

### 4. **Layered Architecture**
```
┌─────────────────────────────────┐
│   Presentation Layer (API)      │
├─────────────────────────────────┤
│   Application Layer (Services)  │
├─────────────────────────────────┤
│   Domain Layer (Business Logic)│
├─────────────────────────────────┤
│   Infrastructure Layer (DB/ORM) │
└─────────────────────────────────┘
```

### 5. **SOLID Principles**
- **Single Responsibility**: Each class/function has one reason to change
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Derived classes must be substitutable
- **Interface Segregation**: Many specific interfaces > one general
- **Dependency Inversion**: Depend on abstractions, not concretions

---

## Multi-Tenancy Strategy

### **CRITICAL: Tenant Isolation is Mandatory**

### 1. **Database-Level Multi-Tenancy (Recommended)**
- Add `tenant_id` column to ALL tenant-scoped tables
- Use composite indexes: `(tenant_id, id)` for all primary queries
- Enforce tenant isolation at the ORM/Repository level

#### Tables Requiring `tenant_id`:
```typescript
// Core tenant-scoped tables
- projects
- repositories
- suites
- test_cases
- test_plans
- test_runs
- documents
- bug_budget
- jira_table_history
- allure_report
- gitlab_mr_lead_times
- settings (tenant-specific)
- All analytics tables
```

#### Tables NOT requiring `tenant_id`:
```typescript
// Global/system tables
- users (but link via tenant_users junction table)
- roles
- permissions
- tenants (tenant registry)
- migrations
- menu_visibilities (can be tenant-scoped or global)
```

### 2. **Tenant Registry Table**
```sql
Table tenants {
  id bigint [pk, increment]
  name varchar [unique]
  slug varchar [unique, note: 'URL-friendly identifier']
  domain varchar [unique, null, note: 'Custom domain for white-label']
  subdomain varchar [unique, null, note: 'Subdomain identifier']
  plan varchar [default: 'free', note: 'free, starter, professional, enterprise']
  status enum [default: 'active', note: 'active, suspended, cancelled']
  max_users integer [default: 5]
  max_projects integer [default: 3]
  features json [null, note: 'Feature flags per tenant']
  billing_email varchar [null]
  subscription_id varchar [null]
  trial_ends_at timestamp [null]
  created_at timestamp
  updated_at timestamp
}

Table tenant_users {
  tenant_id bigint [ref: > tenants.id, note: 'on delete cascade']
  user_id bigint [ref: > users.id, note: 'on delete cascade']
  role varchar [default: 'member', note: 'owner, admin, member, viewer']
  invited_by bigint [ref: > users.id, null]
  joined_at timestamp
  created_at timestamp
  
  indexes {
    (tenant_id, user_id) [pk]
    (user_id, tenant_id)
    (tenant_id, role)
  }
}
```

### 3. **Application-Level Tenant Context**
```typescript
// Middleware to extract tenant from request
interface TenantContext {
  tenantId: bigint;
  tenantSlug: string;
  userId: bigint;
  userRole: string;
  plan: string;
  features: string[];
}

// All database queries MUST include tenant_id filter
class BaseRepository {
  protected async findByTenant<T>(
    tenantId: bigint,
    conditions: Record<string, any>
  ): Promise<T[]> {
    return this.prisma.findMany({
      where: {
        tenant_id: tenantId,
        ...conditions,
      },
    });
  }
}
```

### 4. **Row-Level Security (RLS)**
- MySQL doesn't support native RLS, so enforce at application level
- Create Prisma middleware to automatically add `tenant_id` to all queries
- Use database views for read-only tenant-scoped access

### 5. **Data Isolation Rules**
- **NEVER** query without tenant_id filter
- **NEVER** expose tenant_id in API responses (use slug instead)
- **ALWAYS** validate tenant access in middleware
- **ALWAYS** log tenant context in audit logs

---

## Code Organization

### 1. **Project Structure**
```
src/
├── domains/
│   ├── test-management/
│   │   ├── commands/          # Write operations
│   │   ├── queries/           # Read operations
│   │   ├── events/            # Domain events
│   │   ├── models/            # Domain models
│   │   └── repositories/      # Data access
│   ├── document-management/
│   ├── bug-tracking/
│   └── analytics/
├── shared/
│   ├── infrastructure/       # DB, Cache, Queue
│   ├── middleware/           # Auth, Tenant, Validation
│   ├── utils/                # Helpers
│   └── types/                # Shared types
├── api/
│   ├── routes/               # Express routes
│   ├── controllers/          # Request handlers
│   └── validators/           # Input validation
└── jobs/
    ├── scheduled/            # Cron jobs
    └── queues/               # Background jobs
```

### 2. **Naming Conventions**

#### Files & Directories
- Use `kebab-case` for files: `test-case.service.ts`
- Use `PascalCase` for classes: `TestCaseService`
- Use `camelCase` for functions/variables: `createTestCase()`
- Use `SCREAMING_SNAKE_CASE` for constants: `MAX_FILE_SIZE`

#### Database
- Tables: `snake_case` (e.g., `test_cases`)
- Columns: `snake_case` (e.g., `created_at`)
- Indexes: `idx_{table}_{columns}` (e.g., `idx_test_cases_suite_id`)

#### TypeScript
- Interfaces: `PascalCase` with `I` prefix (optional): `ITestCase` or `TestCase`
- Types: `PascalCase`: `TestCaseStatus`
- Enums: `PascalCase`: `enum TestCaseStatus { ... }`

### 3. **Module Boundaries**
- Each domain module is self-contained
- Cross-domain communication via events only
- Shared code goes in `shared/` directory
- No circular dependencies

---

## Database & Data Access

### 1. **ORM Usage (Prisma Recommended)**
```typescript
// ✅ GOOD: Use Prisma client with type safety
const testCase = await prisma.testCase.findUnique({
  where: { id: testCaseId, tenant_id: tenantId },
  include: { suite: true },
});

// ❌ BAD: Raw SQL without tenant filter
const testCase = await prisma.$queryRaw`
  SELECT * FROM test_cases WHERE id = ${testCaseId}
`;
```

### 2. **Repository Pattern**
```typescript
// Abstract base repository with tenant isolation
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
}

// Concrete repository
class TestCaseRepository extends BaseRepository<TestCase> {
  protected modelName = 'testCase';

  async findBySuite(suiteId: bigint): Promise<TestCase[]> {
    return this.prisma.testCase.findMany({
      where: {
        suite_id: suiteId,
        ...this.getTenantFilter(),
      },
    });
  }
}
```

### 3. **Transactions**
- Use database transactions for multi-step operations
- Always include tenant_id in transaction queries
- Use optimistic locking (version field) for concurrent updates

```typescript
await prisma.$transaction(async (tx) => {
  const testCase = await tx.testCase.findUnique({
    where: { id, tenant_id: tenantId },
  });
  
  if (testCase.version !== expectedVersion) {
    throw new OptimisticLockException();
  }
  
  return tx.testCase.update({
    where: { id, tenant_id: tenantId },
    data: { ...data, version: { increment: 1 } },
  });
});
```

### 4. **Soft Deletes**
- Use `deleted_at` timestamp for soft deletes
- Always filter out soft-deleted records in queries
- Add `deleted_by` for audit trail

```typescript
// Prisma middleware to exclude soft-deleted records
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' || params.action === 'findFirst') {
    params.args.where = {
      ...params.args.where,
      deleted_at: null,
    };
  }
  return next(params);
});
```

### 5. **Migrations**
- Use Prisma Migrate for schema changes
- All migrations must be backward compatible
- Test migrations on staging before production
- Never drop columns without deprecation period

---

## Security & Authentication

### 1. **Authentication**
- Use JWT tokens stored in `personal_access_tokens` table
- Token hash stored, not plain token
- Implement token rotation on password change
- Support OAuth (Google) via `google_id` field

### 2. **Authorization (RBAC)**
```typescript
// Permission check middleware
async function requirePermission(
  permission: string,
  tenantId: bigint,
  userId: bigint
): Promise<boolean> {
  // Check user_permissions table
  // Check role_has_permissions via user_roles
  // Return true if user has permission in tenant context
}
```

### 3. **Input Validation**
- Validate all inputs using Zod or class-validator
- Sanitize user inputs to prevent XSS
- Use parameterized queries (Prisma handles this)

### 4. **Password Security**
- Use bcrypt or argon2id (minimum cost 12)
- Store in `password_history` to prevent reuse
- Require password change on first login
- Implement password strength requirements

### 5. **API Security**
- Rate limiting per tenant
- CORS configuration per tenant domain
- API versioning: `/api/v1/...`
- Request ID tracking for audit

---

## API Design Standards

### 1. **RESTful Conventions**
```
GET    /api/v1/projects              # List projects
GET    /api/v1/projects/:id           # Get project
POST   /api/v1/projects               # Create project
PUT    /api/v1/projects/:id           # Update project
DELETE /api/v1/projects/:id           # Delete project
```

### 2. **Response Format**
```typescript
// Success response
{
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100
  }
}

// Error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [ ... ]
  }
}
```

### 3. **Pagination**
- Use cursor-based pagination for large datasets
- Default page size: 20, max: 100
- Include `next_cursor` and `prev_cursor` in response

### 4. **Filtering & Sorting**
```
GET /api/v1/test-cases?status=active&sort=created_at:desc&page=1
```

### 5. **Versioning**
- URL versioning: `/api/v1/`, `/api/v2/`
- Maintain backward compatibility for at least 1 major version
- Deprecation warnings in response headers

---

## Error Handling & Logging

### 1. **Error Types**
```typescript
// Domain errors
class DomainError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

// Specific errors
class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

class UnauthorizedError extends DomainError {
  constructor() {
    super('Unauthorized', 'UNAUTHORIZED', 401);
  }
}
```

### 2. **Logging**
- Use structured logging (Winston, Pino)
- Log to `audit_logs` table for all state changes
- Include tenant_id, user_id, IP, user_agent
- Log levels: ERROR, WARN, INFO, DEBUG

### 3. **Audit Trail**
- All mutations must create audit log entry
- Use `audit_events` table for event sourcing
- Include before/after values in `old_values`/`new_values`

---

## Testing Requirements

### 1. **Test Types**
- **Unit Tests**: Test individual functions/classes (80% coverage)
- **Integration Tests**: Test database operations, API endpoints
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Load testing for critical paths

### 2. **Test Structure**
```typescript
describe('TestCaseService', () => {
  describe('createTestCase', () => {
    it('should create test case with tenant isolation', async () => {
      // Test implementation
    });
    
    it('should fail if tenant_id is missing', async () => {
      // Test implementation
    });
  });
});
```

### 3. **Test Data**
- Use factories for test data generation
- Clean up test data after each test
- Use separate test database
- Mock external services (Jira, GitLab APIs)

### 4. **CI/CD Testing**
- Run tests on every PR
- Require 80% code coverage
- Block merge if tests fail
- Run E2E tests on staging before production

---

## Performance & Scalability

### 1. **Database Optimization**
- Use indexes on all foreign keys
- Composite indexes for common query patterns: `(tenant_id, status, created_at)`
- Partition large tables (`bug_budget`, `jira_table_history`, `audit_logs`)
- Use read replicas for analytics queries

### 2. **Caching Strategy**
```typescript
// Cache tenant settings
const tenantSettings = await redis.get(`tenant:${tenantId}:settings`);

// Cache user permissions
const permissions = await redis.get(`user:${userId}:permissions`);

// Cache analytics (use prd_review_cache pattern)
const analytics = await cache.get(`analytics:${tenantId}:${date}`);
```

### 3. **Background Jobs**
- Use BullMQ/Agenda.js for async processing
- Queue heavy operations (Jira sync, analytics calculation)
- Retry failed jobs with exponential backoff
- Monitor job queues

### 4. **Read Models (CQRS)**
- Update read models asynchronously via events
- Use materialized views for analytics
- Refresh read models on schedule (daily/hourly)

### 5. **API Performance**
- Implement response caching (Redis)
- Use pagination for large lists
- Lazy load related data
- Compress responses (gzip)

---

## Deployment & DevOps

### 1. **Environment Configuration**
```typescript
// .env.example
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
TENANT_DEFAULT_PLAN=free
ENABLE_ANALYTICS=true
```

### 2. **Database Migrations**
- Run migrations automatically on deployment
- Backup database before migrations
- Rollback plan for failed migrations
- Test migrations on staging first

### 3. **Monitoring**
- Application metrics (Prometheus)
- Error tracking (Sentry)
- Log aggregation (ELK Stack)
- Uptime monitoring (Pingdom)

### 4. **Scaling Strategy**
- Horizontal scaling for API servers
- Database connection pooling
- Load balancing with sticky sessions (if needed)
- CDN for static assets

### 5. **Backup & Recovery**
- Daily database backups
- Point-in-time recovery enabled
- Test restore procedures quarterly
- Backup retention: 30 days

---

## Monetization Features

### 1. **Subscription Plans**
```typescript
enum Plan {
  FREE = 'free',           // 5 users, 3 projects
  STARTER = 'starter',     // 25 users, 10 projects
  PROFESSIONAL = 'professional', // 100 users, unlimited projects
  ENTERPRISE = 'enterprise'     // Custom limits, SSO, SLA
}
```

### 2. **Feature Flags**
- Store in `tenants.features` JSON field
- Check feature access in middleware
- Enable/disable features per plan

### 3. **Usage Limits**
- Track usage in `tenant_usage` table
- Enforce limits in application layer
- Send usage alerts at 80% of limit

### 4. **Billing Integration**
- Store `subscription_id` in tenants table
- Webhook handlers for subscription events
- Grace period for failed payments

---

## Code Review Checklist

### Before Submitting PR:
- [ ] All tests pass
- [ ] Code follows naming conventions
- [ ] Tenant isolation enforced
- [ ] Input validation added
- [ ] Error handling implemented
- [ ] Audit logging added
- [ ] Documentation updated
- [ ] No hardcoded values
- [ ] Security reviewed
- [ ] Performance considered

### Review Criteria:
- **Functionality**: Does it work as intended?
- **Security**: Any vulnerabilities?
- **Performance**: Will it scale?
- **Maintainability**: Is code readable?
- **Testing**: Are edge cases covered?

---

## Documentation Requirements

### 1. **Code Documentation**
- JSDoc comments for public functions
- README in each domain module
- API documentation (OpenAPI/Swagger)

### 2. **Architecture Documentation**
- System architecture diagram
- Database ERD
- API flow diagrams
- Deployment guide

### 3. **Runbooks**
- Common operations procedures
- Troubleshooting guides
- Incident response procedures

---

## Version Control

### 1. **Git Workflow**
- Main branch: production-ready code
- Develop branch: integration branch
- Feature branches: `feature/tenant-isolation`
- Hotfix branches: `hotfix/critical-bug`

### 2. **Commit Messages**
```
feat: add tenant isolation to test cases
fix: resolve tenant context middleware bug
refactor: extract tenant service
docs: update API documentation
test: add integration tests for multi-tenancy
```

### 3. **Branch Protection**
- Require PR reviews (2 approvals)
- Require CI/CD to pass
- No direct commits to main
- Squash merge only

---

## Compliance & Legal

### 1. **Data Privacy**
- GDPR compliance for EU tenants
- Data retention policies
- Right to deletion
- Data export functionality

### 2. **SLA Requirements**
- Uptime SLA per plan (99.9% for Enterprise)
- Response time SLAs
- Support response time SLAs

### 3. **Terms of Service**
- Tenant-specific terms
- Usage policy enforcement
- Abuse detection and prevention

---

## Emergency Procedures

### 1. **Security Incident**
1. Isolate affected tenant/system
2. Assess impact
3. Notify affected tenants
4. Fix vulnerability
5. Post-mortem review

### 2. **Data Loss**
1. Stop all writes
2. Assess scope
3. Restore from backup
4. Verify data integrity
5. Resume operations

### 3. **Performance Degradation**
1. Identify bottleneck
2. Scale horizontally if needed
3. Optimize queries
4. Add caching
5. Monitor improvement

---

## Continuous Improvement

### 1. **Regular Reviews**
- Architecture review (quarterly)
- Security audit (quarterly)
- Performance review (monthly)
- Code quality review (monthly)

### 2. **Learning & Updates**
- Keep dependencies updated
- Follow TypeScript/Node.js best practices
- Attend tech conferences
- Share knowledge in team

### 3. **Metrics to Track**
- API response times
- Error rates
- Database query performance
- Tenant onboarding time
- Customer satisfaction

---

## Final Notes

- **Tenant isolation is non-negotiable** - Every query must include tenant_id
- **Security first** - Never compromise on security for convenience
- **Test everything** - Write tests before fixing bugs
- **Document as you go** - Don't leave documentation for later
- **Monitor everything** - You can't improve what you don't measure
- **Plan for scale** - Design for 10x growth from day one

---

**Last Updated**: 2025
**Version**: 1.0.0
**Maintainer**: Development Team

