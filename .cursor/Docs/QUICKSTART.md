# Quick Start Guide

Get QaHub up and running in 5 minutes!

## Prerequisites Check

```bash
# Check Node.js (requires >= 18)
node -v

# Check npm (requires >= 9)
npm -v

# Check PostgreSQL (requires >= 14)
psql --version
```

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

```bash
# Copy example environment file
cp env.example .env

# Edit .env and set your database URL
# DATABASE_URL="postgresql://user:password@localhost:5432/qahub?schema=public"
```

## Step 3: Create Database

```bash
# Using createdb (recommended)
createdb qahub

# Or using psql
psql -U postgres
CREATE DATABASE qahub;
\q
```

## Step 4: Setup Database Schema

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed with initial data (optional)
npm run prisma:seed
```

## Step 5: Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm run build
npm start
```

## Step 6: Verify Installation

Open your browser and visit:
- **Health Check**: http://localhost:3000/health
- **API**: http://localhost:3000/api/v1

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "database": "connected"
}
```

## Default Credentials (if seeded)

- **Email**: `admin@qahub.com`
- **Password**: `admin123`
- **Tenant**: `default`

## Using the Setup Script

For automated setup, use the provided script:

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The script will:
1. Check prerequisites
2. Install dependencies
3. Create .env file
4. Generate Prisma Client
5. Optionally create database
6. Optionally run migrations
7. Optionally seed database

## Common Issues

### Database Connection Error

**Error**: `Can't reach database server`

**Solution**:
1. Verify PostgreSQL is running:
   ```bash
   # macOS
   brew services list | grep postgresql
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Check DATABASE_URL in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/qahub?schema=public"
   ```

3. Test connection:
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

### Migration Errors

**Error**: `Migration failed`

**Solution**:
```bash
# Reset database (⚠️ deletes all data)
npm run db:reset

# Or manually drop and recreate
dropdb qahub
createdb qahub
npm run prisma:migrate
```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
Change port in `.env`:
```env
PORT=3001
```

## Next Steps

1. **Explore the API**: Check `src/index.ts` for available endpoints
2. **View Database**: Run `npm run prisma:studio` to open Prisma Studio
3. **Read Documentation**: See [README.md](./README.md) for full documentation
4. **Development Rules**: See [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) for coding guidelines

## Development Workflow

```bash
# 1. Start development server
npm run dev

# 2. In another terminal, open Prisma Studio
npm run prisma:studio

# 3. Make changes to schema.prisma
# 4. Create migration
npm run prisma:migrate

# 5. Test your changes
npm test
```

## Database Management

### View Database Schema

```bash
npm run prisma:studio
```

### Create New Migration

```bash
# After modifying schema.prisma
npm run prisma:migrate
```

### Reset Database

```bash
# ⚠️ This deletes all data!
npm run db:reset
```

## Need Help?

- Check [README.md](./README.md) for detailed documentation
- Review [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md) for development guidelines
- See [TENANT_ISOLATION_GUIDE.md](./TENANT_ISOLATION_GUIDE.md) for multi-tenancy setup

---

**Happy Coding! 🚀**

