# QaHub Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* tsconfig.json ./
COPY prisma ./prisma

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source code
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 qahub

# Copy necessary files from previous stages
COPY --from=deps --chown=qahub:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=qahub:nodejs /app/dist ./dist
COPY --from=builder --chown=qahub:nodejs /app/prisma ./prisma
COPY --from=builder --chown=qahub:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=qahub:nodejs /app/package.json ./

# Create logs directory
RUN mkdir -p logs && chown qahub:nodejs logs

# Switch to non-root user
USER qahub

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]

