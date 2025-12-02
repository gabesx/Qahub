import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';

const router = Router();

// Validation schemas
const createDecisionLogSchema = z.object({
  title: z.string().min(1).max(255),
  decisionType: z.string().min(1).max(255),
  decisionOwner: z.string().max(255).optional().nullable(),
  decisionOwnerId: z.string().optional().nullable(),
  involvedQa: z.string().optional().nullable(),
  decisionDate: z.string().date(),
  sprintRelease: z.string().max(255).optional().nullable(),
  context: z.string().optional().nullable(),
  decision: z.string().min(1),
  impactRisk: z.string().optional().nullable(),
  status: z.enum(['active', 'archived', 'superseded']).default('active'),
  tags: z.array(z.string()).optional().nullable(),
  relatedArtifacts: z.string().optional().nullable(),
});

const updateDecisionLogSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  decisionType: z.string().min(1).max(255).optional(),
  decisionOwner: z.string().max(255).optional().nullable(),
  decisionOwnerId: z.string().optional().nullable(),
  involvedQa: z.string().optional().nullable(),
  decisionDate: z.string().date().optional(),
  sprintRelease: z.string().max(255).optional().nullable(),
  context: z.string().optional().nullable(),
  decision: z.string().min(1).optional(),
  impactRisk: z.string().optional().nullable(),
  status: z.enum(['active', 'archived', 'superseded']).optional(),
  tags: z.array(z.string()).optional().nullable(),
  relatedArtifacts: z.string().optional().nullable(),
});

const querySchema = z.object({
  decisionType: z.string().optional(),
  status: z.enum(['active', 'archived', 'superseded']).optional(),
  decisionOwner: z.string().optional(),
  decisionOwnerId: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /decision-logs
 * List decision logs with filtering and pagination
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view decision logs',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.decisionType) {
      where.decisionType = query.decisionType;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.decisionOwner) {
      where.decisionOwner = { contains: query.decisionOwner, mode: 'insensitive' };
    }

    if (query.decisionOwnerId) {
      where.decisionOwnerId = BigInt(query.decisionOwnerId);
    }

    if (query.startDate || query.endDate) {
      where.decisionDate = {};
      if (query.startDate) {
        where.decisionDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.decisionDate.lte = new Date(query.endDate);
      }
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { decision: { contains: query.search, mode: 'insensitive' } },
        { context: { contains: query.search, mode: 'insensitive' } },
        { impactRisk: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.decisionLog.count({ where });

    // Get decision logs
    const decisionLogs = await prisma.decisionLog.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        decisionDate: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: {
        decisionLogs: decisionLogs.map((log) => ({
          id: log.id.toString(),
          title: log.title,
          decisionType: log.decisionType,
          decisionOwner: log.decisionOwner,
          decisionOwnerId: log.decisionOwnerId?.toString() || null,
          owner: log.owner
            ? {
                id: log.owner.id.toString(),
                name: log.owner.name,
                email: log.owner.email,
              }
            : null,
          involvedQa: log.involvedQa,
          decisionDate: log.decisionDate.toISOString().split('T')[0],
          sprintRelease: log.sprintRelease,
          context: log.context,
          decision: log.decision,
          impactRisk: log.impactRisk,
          status: log.status,
          tags: log.tags,
          relatedArtifacts: log.relatedArtifacts,
          createdBy: log.createdBy?.toString() || null,
          creator: log.creator
            ? {
                id: log.creator.id.toString(),
                name: log.creator.name,
                email: log.creator.email,
              }
            : null,
          updatedBy: log.updatedBy?.toString() || null,
          updater: log.updater
            ? {
                id: log.updater.id.toString(),
                name: log.updater.name,
                email: log.updater.email,
              }
            : null,
          createdAt: log.createdAt.toISOString(),
          updatedAt: log.updatedAt.toISOString(),
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

    logger.error('List decision logs error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching decision logs',
      },
    });
  }
});

/**
 * GET /decision-logs/:id
 * Get a specific decision log by ID
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view decision logs',
        },
      });
    }

    const decisionLogId = BigInt(req.params.id);

    const decisionLog = await prisma.decisionLog.findUnique({
      where: { id: decisionLogId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!decisionLog) {
      return res.status(404).json({
        error: {
          code: 'DECISION_LOG_NOT_FOUND',
          message: 'Decision log not found',
        },
      });
    }

    res.json({
      data: {
        decisionLog: {
          id: decisionLog.id.toString(),
          title: decisionLog.title,
          decisionType: decisionLog.decisionType,
          decisionOwner: decisionLog.decisionOwner,
          decisionOwnerId: decisionLog.decisionOwnerId?.toString() || null,
          owner: decisionLog.owner
            ? {
                id: decisionLog.owner.id.toString(),
                name: decisionLog.owner.name,
                email: decisionLog.owner.email,
              }
            : null,
          involvedQa: decisionLog.involvedQa,
          decisionDate: decisionLog.decisionDate.toISOString().split('T')[0],
          sprintRelease: decisionLog.sprintRelease,
          context: decisionLog.context,
          decision: decisionLog.decision,
          impactRisk: decisionLog.impactRisk,
          status: decisionLog.status,
          tags: decisionLog.tags,
          relatedArtifacts: decisionLog.relatedArtifacts,
          createdBy: decisionLog.createdBy?.toString() || null,
          creator: decisionLog.creator
            ? {
                id: decisionLog.creator.id.toString(),
                name: decisionLog.creator.name,
                email: decisionLog.creator.email,
              }
            : null,
          updatedBy: decisionLog.updatedBy?.toString() || null,
          updater: decisionLog.updater
            ? {
                id: decisionLog.updater.id.toString(),
                name: decisionLog.updater.name,
                email: decisionLog.updater.email,
              }
            : null,
          createdAt: decisionLog.createdAt.toISOString(),
          updatedAt: decisionLog.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get decision log error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching decision log',
      },
    });
  }
});

/**
 * POST /decision-logs
 * Create a new decision log
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create decision logs',
        },
      });
    }

    const data = createDecisionLogSchema.parse(req.body);

    const decisionLog = await prisma.decisionLog.create({
      data: {
        title: data.title.trim(),
        decisionType: data.decisionType.trim(),
        decisionOwner: data.decisionOwner?.trim() || null,
        decisionOwnerId: data.decisionOwnerId ? BigInt(data.decisionOwnerId) : null,
        involvedQa: data.involvedQa?.trim() || null,
        decisionDate: new Date(data.decisionDate),
        sprintRelease: data.sprintRelease?.trim() || null,
        context: data.context?.trim() || null,
        decision: data.decision.trim(),
        impactRisk: data.impactRisk?.trim() || null,
        status: data.status || 'active',
        tags: data.tags || null,
        relatedArtifacts: data.relatedArtifacts?.trim() || null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'decision_log',
          modelId: decisionLog.id,
          newValues: {
            title: decisionLog.title,
            decisionType: decisionLog.decisionType,
            status: decisionLog.status,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Decision log created: ${decisionLog.title} by user ${userId}`);

    res.status(201).json({
      data: {
        decisionLog: {
          id: decisionLog.id.toString(),
          title: decisionLog.title,
          decisionType: decisionLog.decisionType,
          decisionOwner: decisionLog.decisionOwner,
          decisionOwnerId: decisionLog.decisionOwnerId?.toString() || null,
          owner: decisionLog.owner
            ? {
                id: decisionLog.owner.id.toString(),
                name: decisionLog.owner.name,
                email: decisionLog.owner.email,
              }
            : null,
          involvedQa: decisionLog.involvedQa,
          decisionDate: decisionLog.decisionDate.toISOString().split('T')[0],
          sprintRelease: decisionLog.sprintRelease,
          context: decisionLog.context,
          decision: decisionLog.decision,
          impactRisk: decisionLog.impactRisk,
          status: decisionLog.status,
          tags: decisionLog.tags,
          relatedArtifacts: decisionLog.relatedArtifacts,
          createdBy: decisionLog.createdBy?.toString() || null,
          creator: decisionLog.creator
            ? {
                id: decisionLog.creator.id.toString(),
                name: decisionLog.creator.name,
                email: decisionLog.creator.email,
              }
            : null,
          updatedBy: decisionLog.updatedBy?.toString() || null,
          createdAt: decisionLog.createdAt.toISOString(),
          updatedAt: decisionLog.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
    }

    logger.error('Create decision log error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating decision log',
      },
    });
  }
});

/**
 * PATCH /decision-logs/:id
 * Update a decision log
 */
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update decision logs',
        },
      });
    }

    const decisionLogId = BigInt(req.params.id);

    const existing = await prisma.decisionLog.findUnique({
      where: { id: decisionLogId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'DECISION_LOG_NOT_FOUND',
          message: 'Decision log not found',
        },
      });
    }

    const data = updateDecisionLogSchema.parse(req.body);

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.decisionType !== undefined) updateData.decisionType = data.decisionType.trim();
    if (data.decisionOwner !== undefined) updateData.decisionOwner = data.decisionOwner?.trim() || null;
    if (data.decisionOwnerId !== undefined) updateData.decisionOwnerId = data.decisionOwnerId ? BigInt(data.decisionOwnerId) : null;
    if (data.involvedQa !== undefined) updateData.involvedQa = data.involvedQa?.trim() || null;
    if (data.decisionDate !== undefined) updateData.decisionDate = new Date(data.decisionDate);
    if (data.sprintRelease !== undefined) updateData.sprintRelease = data.sprintRelease?.trim() || null;
    if (data.context !== undefined) updateData.context = data.context?.trim() || null;
    if (data.decision !== undefined) updateData.decision = data.decision.trim();
    if (data.impactRisk !== undefined) updateData.impactRisk = data.impactRisk?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.relatedArtifacts !== undefined) updateData.relatedArtifacts = data.relatedArtifacts?.trim() || null;

    const decisionLog = await prisma.decisionLog.update({
      where: { id: decisionLogId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    try {
      const oldValues = {
        title: existing.title,
        decisionType: existing.decisionType,
        status: existing.status,
      };
      const newValues = {
        title: decisionLog.title,
        decisionType: decisionLog.decisionType,
        status: decisionLog.status,
      };

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'decision_log',
          modelId: decisionLog.id,
          oldValues,
          newValues,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Decision log updated: ${decisionLog.title} by user ${userId}`);

    res.json({
      data: {
        decisionLog: {
          id: decisionLog.id.toString(),
          title: decisionLog.title,
          decisionType: decisionLog.decisionType,
          decisionOwner: decisionLog.decisionOwner,
          decisionOwnerId: decisionLog.decisionOwnerId?.toString() || null,
          owner: decisionLog.owner
            ? {
                id: decisionLog.owner.id.toString(),
                name: decisionLog.owner.name,
                email: decisionLog.owner.email,
              }
            : null,
          involvedQa: decisionLog.involvedQa,
          decisionDate: decisionLog.decisionDate.toISOString().split('T')[0],
          sprintRelease: decisionLog.sprintRelease,
          context: decisionLog.context,
          decision: decisionLog.decision,
          impactRisk: decisionLog.impactRisk,
          status: decisionLog.status,
          tags: decisionLog.tags,
          relatedArtifacts: decisionLog.relatedArtifacts,
          createdBy: decisionLog.createdBy?.toString() || null,
          creator: decisionLog.creator
            ? {
                id: decisionLog.creator.id.toString(),
                name: decisionLog.creator.name,
                email: decisionLog.creator.email,
              }
            : null,
          updatedBy: decisionLog.updatedBy?.toString() || null,
          updater: decisionLog.updater
            ? {
                id: decisionLog.updater.id.toString(),
                name: decisionLog.updater.name,
                email: decisionLog.updater.email,
              }
            : null,
          createdAt: decisionLog.createdAt.toISOString(),
          updatedAt: decisionLog.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors,
        },
      });
    }

    logger.error('Update decision log error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating decision log',
      },
    });
  }
});

/**
 * DELETE /decision-logs/:id
 * Delete a decision log
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete decision logs',
        },
      });
    }

    const decisionLogId = BigInt(req.params.id);

    const decisionLog = await prisma.decisionLog.findUnique({
      where: { id: decisionLogId },
    });

    if (!decisionLog) {
      return res.status(404).json({
        error: {
          code: 'DECISION_LOG_NOT_FOUND',
          message: 'Decision log not found',
        },
      });
    }

    await prisma.decisionLog.delete({
      where: { id: decisionLogId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'decision_log',
          modelId: decisionLogId,
          oldValues: {
            title: decisionLog.title,
            decisionType: decisionLog.decisionType,
            status: decisionLog.status,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Decision log deleted: ${decisionLog.title} by user ${userId}`);

    res.json({
      message: 'Decision log deleted successfully',
    });
  } catch (error) {
    logger.error('Delete decision log error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting decision log',
      },
    });
  }
});

export default router;

