import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';

const router = Router();

// Validation schemas
const auditLogsArchiveQuerySchema = z.object({
  modelType: z.string().optional(),
  modelId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

const jiraHistoryArchiveQuerySchema = z.object({
  project: z.string().optional(),
  issuekey: z.string().optional(),
  issuetype: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /archive/audit-logs
 * List archived audit logs (read-only)
 */
router.get('/audit-logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view archived audit logs',
        },
      });
    }

    const query = auditLogsArchiveQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.modelType) {
      where.modelType = query.modelType;
    }

    if (query.modelId) {
      where.modelId = BigInt(query.modelId);
    }

    if (query.userId) {
      where.userId = BigInt(query.userId);
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.startDate || query.endDate) {
      where.originalCreatedAt = {};
      if (query.startDate) {
        where.originalCreatedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.originalCreatedAt.lte = new Date(query.endDate);
      }
    }

    // Get total count
    const total = await prisma.auditLogsArchive.count({ where });

    // Get archived audit logs
    const auditLogs = await prisma.auditLogsArchive.findMany({
      where,
      orderBy: {
        originalCreatedAt: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: {
        auditLogs: auditLogs.map((log) => ({
          id: log.id.toString(),
          userId: log.userId?.toString() || null,
          action: log.action,
          modelType: log.modelType,
          modelId: log.modelId?.toString() || null,
          oldValues: log.oldValues,
          newValues: log.newValues,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          archivedAt: log.archivedAt.toISOString(),
          originalCreatedAt: log.originalCreatedAt.toISOString(),
          originalUpdatedAt: log.originalUpdatedAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
    }

    logger.error('List archived audit logs error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching archived audit logs',
      },
    });
  }
});

/**
 * GET /archive/audit-logs/:id
 * Get a specific archived audit log by ID
 */
router.get('/audit-logs/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view archived audit logs',
        },
      });
    }

    const logId = BigInt(req.params.id);

    const auditLog = await prisma.auditLogsArchive.findUnique({
      where: { id: logId },
    });

    if (!auditLog) {
      return res.status(404).json({
        error: {
          code: 'AUDIT_LOG_NOT_FOUND',
          message: 'Archived audit log not found',
        },
      });
    }

    res.json({
      data: {
        auditLog: {
          id: auditLog.id.toString(),
          userId: auditLog.userId?.toString() || null,
          action: auditLog.action,
          modelType: auditLog.modelType,
          modelId: auditLog.modelId?.toString() || null,
          oldValues: auditLog.oldValues,
          newValues: auditLog.newValues,
          ipAddress: auditLog.ipAddress,
          userAgent: auditLog.userAgent,
          archivedAt: auditLog.archivedAt.toISOString(),
          originalCreatedAt: auditLog.originalCreatedAt.toISOString(),
          originalUpdatedAt: auditLog.originalUpdatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get archived audit log error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching archived audit log',
      },
    });
  }
});

/**
 * GET /archive/jira-history
 * List archived Jira table history (read-only)
 */
router.get('/jira-history', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view archived Jira history',
        },
      });
    }

    const query = jiraHistoryArchiveQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.project) {
      where.project = query.project;
    }

    if (query.issuekey) {
      where.issuekey = query.issuekey;
    }

    if (query.issuetype) {
      where.issuetype = query.issuetype;
    }

    if (query.startDate || query.endDate) {
      where.originalCreatedAt = {};
      if (query.startDate) {
        where.originalCreatedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.originalCreatedAt.lte = new Date(query.endDate);
      }
    }

    // Get total count
    const total = await prisma.jiraTableHistoryArchive.count({ where });

    // Get archived Jira history
    const jiraHistory = await prisma.jiraTableHistoryArchive.findMany({
      where,
      orderBy: {
        originalCreatedAt: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: {
        jiraHistory: jiraHistory.map((item) => ({
          id: item.id.toString(),
          issuekey: item.issuekey,
          project: item.project,
          issuetype: item.issuetype,
          summary: item.summary,
          description: item.description,
          rawJiraData: item.rawJiraData,
          syncedAt: item.syncedAt?.toISOString() || null,
          archivedAt: item.archivedAt.toISOString(),
          originalCreatedAt: item.originalCreatedAt.toISOString(),
          originalUpdatedAt: item.originalUpdatedAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        },
      });
    }

    logger.error('List archived Jira history error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching archived Jira history',
      },
    });
  }
});

/**
 * GET /archive/jira-history/:id
 * Get a specific archived Jira history entry by ID
 */
router.get('/jira-history/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view archived Jira history',
        },
      });
    }

    const historyId = BigInt(req.params.id);

    const jiraHistory = await prisma.jiraTableHistoryArchive.findUnique({
      where: { id: historyId },
    });

    if (!jiraHistory) {
      return res.status(404).json({
        error: {
          code: 'JIRA_HISTORY_NOT_FOUND',
          message: 'Archived Jira history entry not found',
        },
      });
    }

    res.json({
      data: {
        jiraHistory: {
          id: jiraHistory.id.toString(),
          issuekey: jiraHistory.issuekey,
          project: jiraHistory.project,
          issuetype: jiraHistory.issuetype,
          summary: jiraHistory.summary,
          description: jiraHistory.description,
          rawJiraData: jiraHistory.rawJiraData,
          syncedAt: jiraHistory.syncedAt?.toISOString() || null,
          archivedAt: jiraHistory.archivedAt.toISOString(),
          originalCreatedAt: jiraHistory.originalCreatedAt.toISOString(),
          originalUpdatedAt: jiraHistory.originalUpdatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get archived Jira history error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching archived Jira history',
      },
    });
  }
});

export default router;

