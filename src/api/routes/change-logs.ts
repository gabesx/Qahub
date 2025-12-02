import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';

const router = Router();

// Validation schemas
const querySchema = z.object({
  tableName: z.string().optional(),
  recordId: z.string().optional(),
  changeType: z.enum(['insert', 'update', 'delete']).optional(),
  source: z.string().optional(),
  transactionId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /change-logs
 * List change logs with filtering and pagination
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view change logs',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.tableName) {
      where.tableName = query.tableName;
    }

    if (query.recordId) {
      where.recordId = BigInt(query.recordId);
    }

    if (query.changeType) {
      where.changeType = query.changeType;
    }

    if (query.source) {
      where.source = query.source;
    }

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }

    if (query.startDate || query.endDate) {
      where.changedAt = {};
      if (query.startDate) {
        where.changedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.changedAt.lte = new Date(query.endDate);
      }
    }

    // Get total count
    const total = await prisma.changeLog.count({ where });

    // Get change logs
    const changeLogs = await prisma.changeLog.findMany({
      where,
      include: {
        changer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        changedAt: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: {
        changeLogs: changeLogs.map((log) => ({
          id: log.id.toString(),
          tableName: log.tableName,
          recordId: log.recordId.toString(),
          changeType: log.changeType,
          oldValues: log.oldValues,
          newValues: log.newValues,
          changedAt: log.changedAt.toISOString(),
          changedBy: log.changedBy?.toString() || null,
          changer: log.changer
            ? {
                id: log.changer.id.toString(),
                name: log.changer.name,
                email: log.changer.email,
              }
            : null,
          transactionId: log.transactionId,
          source: log.source,
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

    logger.error('List change logs error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching change logs',
      },
    });
  }
});

/**
 * GET /change-logs/:id
 * Get a specific change log by ID
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view change logs',
        },
      });
    }

    const changeLogId = BigInt(req.params.id);

    const changeLog = await prisma.changeLog.findUnique({
      where: { id: changeLogId },
      include: {
        changer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!changeLog) {
      return res.status(404).json({
        error: {
          code: 'CHANGE_LOG_NOT_FOUND',
          message: 'Change log not found',
        },
      });
    }

    res.json({
      data: {
        changeLog: {
          id: changeLog.id.toString(),
          tableName: changeLog.tableName,
          recordId: changeLog.recordId.toString(),
          changeType: changeLog.changeType,
          oldValues: changeLog.oldValues,
          newValues: changeLog.newValues,
          changedAt: changeLog.changedAt.toISOString(),
          changedBy: changeLog.changedBy?.toString() || null,
          changer: changeLog.changer
            ? {
                id: changeLog.changer.id.toString(),
                name: changeLog.changer.name,
                email: changeLog.changer.email,
              }
            : null,
          transactionId: changeLog.transactionId,
          source: changeLog.source,
        },
      },
    });
  } catch (error) {
    logger.error('Get change log error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching change log',
      },
    });
  }
});

/**
 * GET /change-logs/table/:tableName/record/:recordId
 * Get change history for a specific record
 */
router.get('/table/:tableName/record/:recordId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view change logs',
        },
      });
    }

    const tableName = req.params.tableName;
    const recordId = BigInt(req.params.recordId);

    const changeLogs = await prisma.changeLog.findMany({
      where: {
        tableName,
        recordId,
      },
      include: {
        changer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        changedAt: 'desc',
      },
    });

    res.json({
      data: {
        changeLogs: changeLogs.map((log) => ({
          id: log.id.toString(),
          tableName: log.tableName,
          recordId: log.recordId.toString(),
          changeType: log.changeType,
          oldValues: log.oldValues,
          newValues: log.newValues,
          changedAt: log.changedAt.toISOString(),
          changedBy: log.changedBy?.toString() || null,
          changer: log.changer
            ? {
                id: log.changer.id.toString(),
                name: log.changer.name,
                email: log.changer.email,
              }
            : null,
          transactionId: log.transactionId,
          source: log.source,
        })),
      },
    });
  } catch (error) {
    logger.error('Get record change history error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching change history',
      },
    });
  }
});

/**
 * GET /change-logs/statistics/summary
 * Get change log statistics
 */
router.get('/statistics/summary', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view change log statistics',
        },
      });
    }

    const [total, byType, byTable, recent] = await Promise.all([
      prisma.changeLog.count(),
      prisma.changeLog.groupBy({
        by: ['changeType'],
        _count: true,
      }),
      prisma.changeLog.groupBy({
        by: ['tableName'],
        _count: true,
        orderBy: {
          _count: {
            tableName: 'desc',
          },
        },
        take: 10,
      }),
      prisma.changeLog.count({
        where: {
          changedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    res.json({
      data: {
        statistics: {
          total,
          recent24Hours: recent,
          byType: byType.reduce(
            (acc, item) => {
              acc[item.changeType] = item._count;
              return acc;
            },
            {} as Record<string, number>
          ),
          byTable: byTable.map((item) => ({
            tableName: item.tableName,
            count: item._count,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Get change log statistics error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching change log statistics',
      },
    });
  }
});

export default router;

