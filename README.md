# QaHub - Test Management System

A comprehensive Test Management System with Document Management and Analytics, built with Node.js, TypeScript, PostgreSQL, and Prisma.

## 🚀 Features

- **Test Management**: Test cases, test plans, test runs, and results tracking
- **Document Management**: Document versioning, comments, and collaboration
- **Bug Tracking**: Jira integration and bug budget management
- **Analytics**: Test execution summaries, bug analytics, and lead time tracking
- **Multi-Tenancy**: Full tenant isolation for SaaS deployment
- **RBAC**: Role-based access control with permissions
- **API**: RESTful API with TypeScript type safety

## 📋 Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **PostgreSQL** >= 14.0
- **Git**

## 🛠️ Installation

### Option A: Docker (Recommended for Quick Start)

The easiest way to get started is using Docker:

```bash
# Start all services (app + database + redis)
docker-compose up -d

# Run migrations
docker-compose exec app npm run prisma:migrate

# Seed database (optional)
docker-compose exec app npm run prisma:seed

# View logs
docker-compose logs -f app
```

The application will be available at `http://localhost:3000`

See [DOCKER.md](./DOCKER.md) for detailed Docker instructions.

### Option B: Local Development

#### 1. Clone the repository

```bash
git clone <repository-url>
cd QaHub
```

#### 2. Install dependencies

```bash
npm install
```

#### 3. Set up environment variables

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` and configure your database connection:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/qahub?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
```

#### 4. Set up PostgreSQL database

**Option 4a: Using Docker (Recommended)**

```bash
# Start only database services
docker-compose -f docker-compose.dev.yml up -d
```

**Option 4b: Local PostgreSQL**

Create a PostgreSQL database:

```bash
# Using psql
psql -U postgres
CREATE DATABASE qahub;
\q
```

Or using createdb:

```bash
createdb qahub
```

#### 5. Generate Prisma Client

```bash
npm run prisma:generate
```

#### 6. Run database migrations

```bash
npm run prisma:migrate
```

This will:
- Create all database tables
- Set up indexes and foreign keys
- Create the initial migration

#### 7. Seed the database (optional)

Create default tenant, admin user, and sample data:

```bash
npm run prisma:seed
```

Default credentials:
- **Email**: `admin@qahub.com`
- **Password**: `admin123`
- **Tenant**: `default`

## 🏃 Running the Application

### Using Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Local Development

```bash
# Development mode (with hot reload)
npm run dev
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

### Production mode

```bash
# Build
npm run build

# Start
npm start

# Or using Docker
npm run docker:build
docker run -d -p 3000:3000 --env-file .env qahub:latest
```

## 📁 Project Structure

```
QaHub/
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.ts            # Database seed script
│   └── migrations/        # Database migrations
├── src/
│   ├── api/               # API routes and controllers
│   ├── domains/           # Domain modules (DDD)
│   │   ├── test-management/
│   │   ├── document-management/
│   │   └── bug-tracking/
│   ├── shared/            # Shared code
│   │   ├── infrastructure/ # DB, cache, queue
│   │   ├── middleware/    # Auth, tenant, validation
│   │   ├── utils/         # Helpers
│   │   └── types/         # Shared types
│   └── index.ts           # Application entry point
├── logs/                  # Application logs
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## 🗄️ Database Management

### Prisma Studio (Database GUI)

```bash
npm run prisma:studio
```

Opens Prisma Studio at `http://localhost:5555` to browse and edit your database.

### Create a new migration

```bash
npm run prisma:migrate
```

### Reset database (⚠️ deletes all data)

```bash
npm run db:reset
```

### Push schema changes (development only)

```bash
npm run db:push
```

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create and apply migrations |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:seed` | Seed database with initial data |
| `npm run db:reset` | Reset database (⚠️ deletes all data) |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type check without building |
| `npm run docker:build` | Build Docker image |
| `npm run docker:up` | Start Docker services |
| `npm run docker:down` | Stop Docker services |
| `npm run docker:logs` | View Docker logs |
| `npm run docker:dev` | Start dev database services |

## 🔐 Environment Variables

Key environment variables (see `env.example` for full list):

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed CORS origins

## 🏗️ Architecture

### Domain-Driven Design (DDD)

The application follows DDD principles with clear domain boundaries:
- **Test Management**: Test cases, plans, runs, results
- **Document Management**: Documents, versions, comments
- **Bug Tracking**: Bug budget, Jira integration
- **Analytics**: Reports, summaries, metrics

### Multi-Tenancy

Full tenant isolation at the database level:
- All tenant-scoped tables include `tenant_id`
- Application-level enforcement via middleware
- Composite indexes for performance

### CQRS Pattern

- Write operations through command handlers
- Read operations via optimized read models
- Event-driven updates to read models

## 📚 API Documentation

Complete API documentation is available in [`docs/API_ENDPOINTS.md`](./docs/API_ENDPOINTS.md).

**Base URL:** `http://localhost:3001/api/v1`

### Available Endpoints:

**Authentication:**
- `POST /auth/login` - User login
- `GET /auth/verify` - Verify JWT token
- `POST /auth/forgot-password` - Request password reset
- `GET /auth/verify-reset-token` - Verify reset token
- `POST /auth/reset-password` - Reset password

**User Management:**
- `POST /users/register` - Register new user
- `GET /users/me` - Get current user profile
- `PATCH /users/me` - Update user profile
- `POST /users/change-password` - Change password
- `GET /users` - List users (with pagination)
- `GET /users/:id` - Get user by ID

**Personal Access Tokens:**
- `POST /tokens` - Create API token
- `GET /tokens` - List user's tokens
- `GET /tokens/:id` - Get token details
- `DELETE /tokens/:id` - Revoke token
- `DELETE /tokens` - Revoke all tokens

See [`docs/API_ENDPOINTS.md`](./docs/API_ENDPOINTS.md) for detailed request/response formats, authentication requirements, and error codes.

## 🔒 Security

- **Authentication**: JWT tokens with refresh tokens
- **Authorization**: RBAC with permissions
- **Password Security**: bcrypt hashing (cost 12)
- **Input Validation**: Zod schemas
- **Rate Limiting**: Express rate limit middleware
- **CORS**: Configurable CORS policies
- **Helmet**: Security headers

## 📊 Database Schema

The database schema is defined in `prisma/schema.prisma` and includes:

- **Multi-Tenancy**: Tenants, tenant_users
- **Users & Auth**: Users, password_resets, personal_access_tokens
- **RBAC**: Roles, permissions, user_roles, user_permissions
- **Projects**: Projects, repositories, suites
- **Test Management**: Test cases, test plans, test runs, results
- **Documents**: Documents, versions, comments, engagements
- **Bug Tracking**: Bug budget, Jira integration
- **Analytics**: Summary tables, lead times, contributions

## 📖 Additional Documentation

- [`docs/DEVELOPMENT_PLAN.md`](./docs/DEVELOPMENT_PLAN.md) - Complete development plan from User Management to Audit & Logging
- [`docs/ERD.md`](./docs/ERD.md) - Entity Relationship Diagram (ERD) documentation
- [`docs/API_ENDPOINTS.md`](./docs/API_ENDPOINTS.md) - Complete API endpoints documentation
- [`apps/web/docs/CLIENT_VS_SERVER_COMPONENTS.md`](./apps/web/docs/CLIENT_VS_SERVER_COMPONENTS.md) - Next.js component architecture guide
- [`schema.dbml`](./schema.dbml) - Complete database design documentation
- [`document/QUICKSTART.md`](./document/QUICKSTART.md) - Quick start guide
- [`DOCKER.md`](./DOCKER.md) - Docker setup and usage

## 🚧 Development Guidelines

See [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) for:
- Architecture principles
- Code organization
- Security best practices
- Testing requirements
- Deployment procedures

## 🔄 Multi-Tenancy Setup

See [TENANT_ISOLATION_GUIDE.md](./TENANT_ISOLATION_GUIDE.md) for:
- Tenant isolation implementation
- Adding tenant_id to tables
- Migration strategy
- Testing tenant isolation

## 🐛 Troubleshooting

### Docker Issues

See [DOCKER.md](./DOCKER.md) for detailed Docker troubleshooting.

### Database connection issues

1. **Using Docker**: Check if PostgreSQL container is running:
   ```bash
   docker-compose ps postgres
   docker-compose logs postgres
   ```

2. **Local PostgreSQL**: Verify PostgreSQL is running:
   ```bash
   psql -U postgres -c "SELECT version();"
   ```

3. Check DATABASE_URL in `.env`:
   ```env
   # Docker
   DATABASE_URL="postgresql://qahub:qahub_password@postgres:5432/qahub?schema=public"
   
   # Local
   DATABASE_URL="postgresql://user:password@localhost:5432/qahub?schema=public"
   ```

4. Verify database exists:
   ```bash
   # Docker
   docker-compose exec postgres psql -U qahub -l
   
   # Local
   psql -U postgres -l | grep qahub
   ```

### Migration issues

1. Reset database (⚠️ deletes all data):
   ```bash
   # Docker
   docker-compose down -v
   docker-compose up -d
   docker-compose exec app npm run prisma:migrate
   
   # Local
   npm run db:reset
   ```

2. Check migration status:
   ```bash
   # Docker
   docker-compose exec app npx prisma migrate status
   
   # Local
   npx prisma migrate status
   ```

### Port already in use

**Docker**: Change port in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Change 3000 to 3001
```

**Local**: Change the port in `.env`:
```env
PORT=3001
```

## 📄 License

ISC

## 🤝 Contributing

1. Follow the development rules in [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md)
2. Write tests for new features
3. Ensure all tests pass
4. Update documentation

## 📞 Support

For issues and questions, please open an issue on the repository.

---

**Built with ❤️ using Node.js, TypeScript, PostgreSQL, and Prisma**

Email: admin@qahub.com
Password: admin123