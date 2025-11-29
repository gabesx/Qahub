# Docker Setup Guide

This guide explains how to run QaHub using Docker and Docker Compose.

## 🐳 Prerequisites

- **Docker** >= 20.10
- **Docker Compose** >= 2.0

Check your installation:
```bash
docker --version
docker-compose --version
```

## 🚀 Quick Start

### Option 1: Full Stack (App + Database + Redis)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

### Option 2: Database Only (for local development)

```bash
# Start only PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Run migrations locally
npm run prisma:migrate

# Start app locally
npm run dev
```

## 📋 Available Services

### Production Stack (`docker-compose.yml`)

- **app**: QaHub application (Node.js/TypeScript)
- **postgres**: PostgreSQL 15 database
- **redis**: Redis 7 for caching and queues

### Development Stack (`docker-compose.dev.yml`)

- **postgres**: PostgreSQL 15 database
- **redis**: Redis 7 for caching and queues

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database (automatically configured in docker-compose)
DATABASE_URL=postgresql://qahub:qahub_password@postgres:5432/qahub?schema=public

# Application
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this
CORS_ORIGIN=http://localhost:3000

# Redis
REDIS_URL=redis://redis:6379
```

### Database Credentials (Default)

- **User**: `qahub`
- **Password**: `qahub_password`
- **Database**: `qahub`
- **Port**: `5432`

⚠️ **Change these in production!**

## 📝 Common Commands

### Start Services

```bash
# Start in background
docker-compose up -d

# Start with logs
docker-compose up

# Start specific service
docker-compose up postgres
```

### Stop Services

```bash
# Stop services (keep volumes)
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f postgres
```

### Database Operations

```bash
# Run migrations
docker-compose exec app npm run prisma:migrate

# Seed database
docker-compose exec app npm run prisma:seed

# Open Prisma Studio
docker-compose exec app npm run prisma:studio
# Then visit http://localhost:5555

# Access PostgreSQL CLI
docker-compose exec postgres psql -U qahub -d qahub
```

### Build and Rebuild

```bash
# Build images
docker-compose build

# Rebuild without cache
docker-compose build --no-cache

# Rebuild specific service
docker-compose build app
```

## 🔄 Development Workflow

### 1. Start Database Services

```bash
docker-compose -f docker-compose.dev.yml up -d
```

### 2. Run Migrations Locally

```bash
npm run prisma:migrate
```

### 3. Start Application Locally

```bash
npm run dev
```

### 4. Make Changes

- Edit code in `src/`
- Changes are hot-reloaded (if using `npm run dev`)

### 5. Test in Docker

```bash
# Rebuild and restart
docker-compose up -d --build app
```

## 🏗️ Production Deployment

### Build Production Image

```bash
docker build -t qahub:latest .
```

### Run Production Container

```bash
docker run -d \
  --name qahub \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/qahub" \
  -e JWT_SECRET="your-secret" \
  -v qahub_logs:/app/logs \
  -v qahub_uploads:/app/uploads \
  qahub:latest
```

### Using Docker Compose (Production)

1. Update `docker-compose.yml` with production values
2. Set environment variables in `.env`
3. Run:

```bash
docker-compose up -d
```

## 🗄️ Database Management

### Backup Database

```bash
# Create backup
docker-compose exec postgres pg_dump -U qahub qahub > backup.sql

# Or using docker
docker exec qahub-postgres pg_dump -U qahub qahub > backup.sql
```

### Restore Database

```bash
# Restore from backup
docker-compose exec -T postgres psql -U qahub qahub < backup.sql

# Or using docker
docker exec -i qahub-postgres psql -U qahub qahub < backup.sql
```

### Access Database

```bash
# Using docker-compose
docker-compose exec postgres psql -U qahub -d qahub

# Using docker
docker exec -it qahub-postgres psql -U qahub -d qahub
```

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs app

# Check container status
docker-compose ps

# Restart service
docker-compose restart app
```

### Database Connection Issues

```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec app node -e "console.log(process.env.DATABASE_URL)"
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :5432

# Kill process or change port in docker-compose.yml
```

### Reset Everything

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Start fresh
docker-compose up -d
```

### Clear Volumes (⚠️ Deletes Data)

```bash
# Remove specific volume
docker volume rm qahub_postgres_data

# Remove all unused volumes
docker volume prune
```

## 📊 Health Checks

All services include health checks:

```bash
# Check service health
docker-compose ps

# Manual health check
curl http://localhost:3000/health
```

## 🔐 Security Best Practices

1. **Change Default Passwords**: Update database credentials in production
2. **Use Secrets**: Use Docker secrets or environment files for sensitive data
3. **Network Isolation**: Services communicate via internal network
4. **Non-root User**: Application runs as non-root user
5. **Read-only Volumes**: Use read-only volumes where possible

## 🚀 Performance Optimization

### Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Database Optimization

```yaml
services:
  postgres:
    command:
      - "postgres"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "max_connections=200"
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [Node.js Docker Best Practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

---

**Happy Dockerizing! 🐳**

