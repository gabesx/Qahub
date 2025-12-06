# QaHub Architecture Documentation

This document describes the system architecture, design patterns, and technical decisions for the QaHub application.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Domain Model](#domain-model)
6. [Multi-Tenancy Architecture](#multi-tenancy-architecture)
7. [API Design](#api-design)
8. [Data Flow](#data-flow)
9. [Security Architecture](#security-architecture)
10. [Deployment Architecture](#deployment-architecture)

---

## System Overview

QaHub is a comprehensive Test Management System with Document Management and Analytics capabilities. It is designed as a multi-tenant SaaS application with the following key features:

- **Test Management**: Test cases, test plans, test runs, and results tracking
- **Document Management**: Document versioning, comments, and collaboration
- **Bug Tracking**: Jira integration and bug budget management
- **Analytics**: Test execution summaries, bug analytics, and lead time tracking
- **Multi-Tenancy**: Full tenant isolation for SaaS deployment
- **RBAC**: Role-based access control with permissions

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (Browser)                   │
│                  Next.js 14 (React + SSR)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP/REST API
┌───────────────────────▼─────────────────────────────────────┐
│                    API Layer (Express.js)                    │
│              Authentication | Authorization                  │
│              Rate Limiting | CORS | Validation               │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              Application Layer (Business Logic)              │
│         Services | Commands | Queries | Events              │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│            Infrastructure Layer (Data Access)                │
│              Prisma ORM | PostgreSQL                         │
│              Redis (Optional) | File Storage                │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Patterns

### 1. Domain-Driven Design (DDD)

The application is organized around business domains:

- **Test Management Domain**: Test cases, test plans, test runs, results
- **Document Management Domain**: Documents, versions, comments, engagements
- **Bug Tracking Domain**: Bug budget, Jira integration, lead times
- **Analytics Domain**: Reports, summaries, metrics
- **User Management Domain**: Users, roles, permissions, invitations

Each domain is self-contained with clear boundaries and communicates via events.

### 2. CQRS (Command Query Responsibility Segregation)

**Write Models (Normalized)**
- Optimized for data integrity and consistency
- Examples: `test_cases`, `test_runs`, `test_run_results`

**Read Models (Denormalized)**
- Optimized for fast queries and reporting
- Examples: `test_runs_view`, `bug_budget_view`
- Updated via event listeners

**Benefits:**
- Fast read queries without complex joins
- Optimized for different access patterns
- Separates read/write concerns

### 3. Event-Driven Architecture

**Event Sourcing**
- `audit_events` table stores all domain events
- Immutable append-only log
- Enables time-travel queries and event replay

**Event Listeners**
- Update read models when write models change
- Send notifications
- Trigger workflows and sagas
- Update analytics summaries

**Event Flow:**
```
Write Operation → Domain Event → Event Emitter → Event Listeners → Read Model Updates
```

### 4. Layered Architecture

```
┌─────────────────────────────────┐
│   Presentation Layer (API)      │  ← Express routes, controllers
├─────────────────────────────────┤
│   Application Layer             │  ← Services, use cases
├─────────────────────────────────┤
│   Domain Layer                   │  ← Business logic, entities
├─────────────────────────────────┤
│   Infrastructure Layer           │  ← Database, external services
└─────────────────────────────────┘
```

**Principles:**
- Dependencies flow inward (presentation → infrastructure)
- Domain layer has no dependencies on infrastructure
- Clear separation of concerns

---

## Technology Stack

### Backend

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.6+ (strict mode)
- **Framework**: Express.js 4.21+
- **ORM**: Prisma 5.19+
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (jsonwebtoken)
- **Validation**: Zod 3.23+
- **Logging**: Winston 3.15+
- **Email**: Nodemailer 7.0+

### Frontend

- **Framework**: Next.js 14.2+ (App Router)
- **Language**: TypeScript 5.6+
- **UI Library**: React 18.3+
- **Styling**: Tailwind CSS 3.4+
- **Forms**: React Hook Form 7.52+
- **HTTP Client**: Axios 1.7+

### Infrastructure

- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Cache/Queue**: Redis 7+ (optional)
- **File Storage**: Local filesystem (uploads/)

---

## Project Structure

```
QaHub/
├── apps/
│   └── web/                    # Next.js frontend
│       ├── app/                # App Router pages
│       ├── lib/                # Frontend utilities
│       └── components/         # React components
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts                # Database seeding
│   └── migrations/            # Database migrations
├── src/
│   ├── api/                    # API layer
│   │   ├── routes/            # Express routes (40 files)
│   │   └── middleware/        # Auth, validation middleware
│   ├── shared/                # Shared code
│   │   ├── infrastructure/    # Database, external services
│   │   ├── services/          # Email, etc.
│   │   └── utils/            # Utilities (logger, tenant)
│   ├── jobs/                  # Background jobs
│   └── index.ts               # Application entry point
├── docs/                      # Documentation
├── logs/                      # Application logs
├── uploads/                   # File uploads
└── dist/                      # Compiled JavaScript
```

---

## Domain Model

### Core Entities

**User Management**
- `User`: System users
- `Tenant`: Multi-tenant organizations
- `TenantUser`: User-tenant relationships
- `Role`: User roles
- `Permission`: System permissions

**Test Management**
- `Project`: Test projects
- `Repository`: Test repositories within projects
- `Suite`: Test suite hierarchy
- `TestCase`: Individual test cases
- `TestPlan`: Test execution plans
- `TestRun`: Test execution runs
- `TestRunResult`: Individual test results

**Document Management**
- `Document`: Documents
- `DocumentVersion`: Document version history
- `DocumentComment`: Document comments
- `DocumentEngagement`: Likes, stars, views

**Bug Tracking**
- `BugBudget`: Jira issues/bugs
- `BugBudgetMetadata`: Extended bug metadata
- `JiraField`: Jira field mappings

**Analytics**
- `TestExecutionSummary`: Daily test execution summaries
- `BugAnalyticsDaily`: Daily bug analytics
- `TestCaseAnalytics`: Test case analytics
- `TestRunsView`: Denormalized test runs view
- `BugBudgetView`: Denormalized bug budget view

### Relationships

```
Tenant ──┬── Project ──┬── Repository ──┬── Suite ── TestCase
         │             │                 │
         │             │                 └── TestPlan ── TestRun ── TestRunResult
         │             │
         │             └── Document ── DocumentVersion
         │
         └── TenantUser ── User ──┬── UserRole ── Role
                                  └── UserPermission ── Permission
```

---

## Multi-Tenancy Architecture

### Strategy: Shared Database, Shared Schema

All tenant-scoped tables include a `tenant_id` column for data isolation.

### Tenant Isolation Rules

1. **All queries must filter by tenant_id**
   - Use `getUserPrimaryTenant()` utility
   - Validate tenant access in middleware
   - Never expose tenant_id in API responses

2. **Composite Indexes**
   - All tenant-scoped tables have `(tenant_id, id)` indexes
   - Optimizes tenant-scoped queries

3. **Application-Level Enforcement**
   - Middleware validates tenant access
   - Utility functions ensure tenant filtering
   - Audit logs track tenant context

### Tenant Registry

```typescript
Tenant {
  id: BigInt
  name: string (unique)
  slug: string (unique, URL-friendly)
  plan: TenantPlan (free | starter | professional | enterprise)
  status: TenantStatus (active | suspended | cancelled | trial)
  maxUsers: number
  maxProjects: number
  features: JSON
}
```

### Tenant-User Relationships

```typescript
TenantUser {
  tenantId: BigInt
  userId: BigInt
  role: string (member | admin | owner)
  joinedAt: DateTime
}
```

Users can belong to multiple tenants with different roles in each.

---

## API Design

### RESTful Conventions

**Base URL**: `/api/v1`

**Endpoints Structure:**
```
GET    /api/v1/resource           # List resources
GET    /api/v1/resource/:id       # Get resource by ID
POST   /api/v1/resource           # Create resource
PATCH  /api/v1/resource/:id       # Update resource
DELETE /api/v1/resource/:id       # Delete resource
```

**Nested Resources:**
```
GET    /api/v1/projects/:id/repositories
POST   /api/v1/projects/:id/repositories
GET    /api/v1/projects/:id/repositories/:repoId
```

### Authentication

**JWT Token Authentication**
- Token in `Authorization: Bearer <token>` header
- Token includes: `userId`, `email`, `tenantId`
- Configurable expiration (default: 7 days)

**Endpoints:**
- `POST /api/v1/auth/login` - Login and get token
- `GET /api/v1/auth/verify` - Verify token validity
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password

### Response Format

**Success Response:**
```json
{
  "data": {
    "resource": { ... },
    "pagination": { ... }
  }
}
```

**Error Response:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

### Validation

- **Input Validation**: Zod schemas
- **Error Codes**: Standardized error codes
- **Status Codes**: HTTP status codes (200, 201, 400, 401, 403, 404, 500)

---

## Data Flow

### Write Flow (CQRS)

```
1. API Request → Route Handler
2. Validate Input (Zod)
3. Authenticate & Authorize
4. Execute Command/Service
5. Update Write Model (Prisma)
6. Emit Domain Event
7. Event Listeners Update Read Models
8. Return Response
```

### Read Flow (CQRS)

```
1. API Request → Route Handler
2. Authenticate & Authorize
3. Query Read Model (Optimized View)
4. Return Response
```

### Event Flow

```
Write Model Change
    ↓
Domain Event Emitted
    ↓
Event Emitter
    ↓
Event Listeners (Parallel)
    ├── Update Read Model
    ├── Send Notification
    ├── Update Analytics
    └── Trigger Workflow
```

---

## Security Architecture

### Authentication

- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcrypt (cost 12)
- **Password History**: Track password changes
- **Remember Me**: Extended token expiration

### Authorization

- **RBAC**: Role-based access control
- **Permissions**: Granular permissions system
- **Tenant Isolation**: Application-level enforcement
- **Middleware**: Auth middleware on protected routes

### Security Headers

- **Helmet.js**: Security headers
- **CORS**: Configurable CORS policies
- **Rate Limiting**: Express rate limit
- **Input Validation**: Zod schemas

### Data Protection

- **Tenant Isolation**: All queries filtered by tenant
- **Audit Logging**: All actions logged
- **Password Security**: bcrypt hashing, history tracking
- **Token Security**: JWT with expiration

---

## Deployment Architecture

### Development

```
Developer Machine
    ├── Node.js (Local)
    ├── PostgreSQL (Docker or Local)
    └── Next.js Dev Server (Local)
```

### Production (Docker)

```
Docker Compose
    ├── app (QaHub Backend)
    ├── postgres (PostgreSQL)
    └── redis (Optional - Cache/Queue)
```

### Environment Configuration

- **Development**: `.env` (local)
- **Production**: Environment variables (Docker)
- **Test**: `.env.test` (for testing)

### Scaling Considerations

- **Horizontal Scaling**: Stateless API (JWT)
- **Database**: PostgreSQL with connection pooling
- **Caching**: Redis (optional)
- **File Storage**: Can migrate to S3/cloud storage
- **Read Replicas**: Can add for read-heavy workloads

---

## Key Design Decisions

See [DECISIONS.md](./DECISIONS.md) for detailed decision records:

- **DEC-001**: Use Prisma as ORM
- **DEC-002**: PostgreSQL as primary database
- **DEC-003**: Database-level multi-tenancy (shared database)
- **DEC-004**: Application-level tenant enforcement
- **DEC-005**: CQRS pattern for read models
- **DEC-006**: Event-driven architecture
- **DEC-007**: JWT for authentication
- **DEC-008**: Express.js for API framework
- **DEC-009**: Next.js 14 with App Router
- **DEC-010**: TypeScript strict mode

---

## Future Considerations

### Potential Improvements

1. **Microservices**: Split into domain services if needed
2. **Message Queue**: Add RabbitMQ/Kafka for async processing
3. **Caching Layer**: Redis for frequently accessed data
4. **CDN**: For static assets and uploads
5. **Search**: Elasticsearch for full-text search
6. **Monitoring**: APM tools (New Relic, Datadog)
7. **GraphQL**: Consider GraphQL API alongside REST

### Scalability Path

1. **Phase 1**: Current monolith (sufficient for MVP)
2. **Phase 2**: Add caching and read replicas
3. **Phase 3**: Extract analytics to separate service
4. **Phase 4**: Full microservices if needed

---

## References

- [Development Rules](../.cursor/rules/DEVELOPMENT_RULES.md)
- [API Endpoints](./API_ENDPOINTS.md)
- [ERD](./ERD.md)
- [Multi-Tenancy Guide](./TENANT_ISOLATION_GUIDE.md)
- [Decision Log](./DECISIONS.md)

---

**Last Updated:** 2025-12-02

