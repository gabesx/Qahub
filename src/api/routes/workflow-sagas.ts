import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';
import { SagaStatus } from '@prisma/client';

const router = Router();

const querySchema = z.object({
  sagaType: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'rolled_back']).optional(),
  startedBy: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

const createSagaSchema = z.object({
  sagaType: z.string().min(1).max(255),
  currentStep: z.string().min(1).max(255),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'rolled_back']).default('pending'),
  context: z.any(),
});

const updateSagaSchema = z.object({
  currentStep: z.string().min(1).max(255).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'rolled_back']).optional(),
  context: z.any().optional(),
  errorMessage: z.string().optional().nullable(),
});

/**
 * GET /workflow-sagas
 * List workflow sagas
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view workflow sagas',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.sagaType) where.sagaType = query.sagaType;
    if (query.status) where.status = query.status as SagaStatus;
    if (query.startedBy) where.startedBy = BigInt(query.startedBy);

    const [sagas, total] = await prisma.$transaction([
      prisma.workflowSaga.findMany({
        where,
        include: {
          starter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.workflowSaga.count({ where }),
    ]);

    res.json({
      data: {
        sagas: sagas.map((s) => ({
          id: s.id.toString(),
          sagaType: s.sagaType,
          currentStep: s.currentStep,
          status: s.status,
          context: s.context,
          startedBy: s.startedBy?.toString() || null,
          starter: s.starter
            ? {
                id: s.starter.id.toString(),
                name: s.starter.name,
                email: s.starter.email,
              }
            : null,
          completedAt: s.completedAt?.toISOString() || null,
          failedAt: s.failedAt?.toISOString() || null,
          errorMessage: s.errorMessage,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
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

    logger.error('List workflow sagas error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching workflow sagas',
      },
    });
  }
});

/**
 * GET /workflow-sagas/:id
 * Get specific workflow saga
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view workflow sagas',
        },
      });
    }

    const sagaId = BigInt(req.params.id);

    const saga = await prisma.workflowSaga.findUnique({
      where: { id: sagaId },
      include: {
        starter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!saga) {
      return res.status(404).json({
        error: {
          code: 'SAGA_NOT_FOUND',
          message: 'Workflow saga not found',
        },
      });
    }

    res.json({
      data: {
        saga: {
          id: saga.id.toString(),
          sagaType: saga.sagaType,
          currentStep: saga.currentStep,
          status: saga.status,
          context: saga.context,
          startedBy: saga.startedBy?.toString() || null,
          starter: saga.starter
            ? {
                id: saga.starter.id.toString(),
                name: saga.starter.name,
                email: saga.starter.email,
              }
            : null,
          completedAt: saga.completedAt?.toISOString() || null,
          failedAt: saga.failedAt?.toISOString() || null,
          errorMessage: saga.errorMessage,
          createdAt: saga.createdAt.toISOString(),
          updatedAt: saga.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get workflow saga error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching workflow saga',
      },
    });
  }
});

/**
 * POST /workflow-sagas
 * Create workflow saga
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create workflow sagas',
        },
      });
    }

    const data = createSagaSchema.parse(req.body);

    const saga = await prisma.workflowSaga.create({
      data: {
        sagaType: data.sagaType.trim(),
        currentStep: data.currentStep.trim(),
        status: data.status || 'pending',
        context: data.context,
        startedBy: userId,
      },
      include: {
        starter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Workflow saga created: ${saga.sagaType} by user ${userId}`);

    res.status(201).json({
      data: {
        saga: {
          id: saga.id.toString(),
          sagaType: saga.sagaType,
          currentStep: saga.currentStep,
          status: saga.status,
          context: saga.context,
          startedBy: saga.startedBy?.toString() || null,
          starter: saga.starter
            ? {
                id: saga.starter.id.toString(),
                name: saga.starter.name,
                email: saga.starter.email,
              }
            : null,
          createdAt: saga.createdAt.toISOString(),
          updatedAt: saga.updatedAt.toISOString(),
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

    logger.error('Create workflow saga error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating workflow saga',
      },
    });
  }
});

/**
 * PATCH /workflow-sagas/:id
 * Update workflow saga
 */
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update workflow sagas',
        },
      });
    }

    const sagaId = BigInt(req.params.id);
    const data = updateSagaSchema.parse(req.body);

    const existing = await prisma.workflowSaga.findUnique({
      where: { id: sagaId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'SAGA_NOT_FOUND',
          message: 'Workflow saga not found',
        },
      });
    }

    const updateData: any = {};
    if (data.currentStep !== undefined) updateData.currentStep = data.currentStep.trim();
    if (data.status !== undefined) {
      updateData.status = data.status as SagaStatus;
      // Auto-set timestamps based on status
      if (data.status === 'completed' && !existing.completedAt) {
        updateData.completedAt = new Date();
      }
      if (data.status === 'failed' && !existing.failedAt) {
        updateData.failedAt = new Date();
      }
    }
    if (data.context !== undefined) updateData.context = data.context;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage?.trim() || null;

    const saga = await prisma.workflowSaga.update({
      where: { id: sagaId },
      data: updateData,
      include: {
        starter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Workflow saga updated: ${saga.sagaType} (${saga.status}) by user ${userId}`);

    res.json({
      data: {
        saga: {
          id: saga.id.toString(),
          sagaType: saga.sagaType,
          currentStep: saga.currentStep,
          status: saga.status,
          context: saga.context,
          startedBy: saga.startedBy?.toString() || null,
          starter: saga.starter
            ? {
                id: saga.starter.id.toString(),
                name: saga.starter.name,
                email: saga.starter.email,
              }
            : null,
          completedAt: saga.completedAt?.toISOString() || null,
          failedAt: saga.failedAt?.toISOString() || null,
          errorMessage: saga.errorMessage,
          createdAt: saga.createdAt.toISOString(),
          updatedAt: saga.updatedAt.toISOString(),
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

    logger.error('Update workflow saga error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating workflow saga',
      },
    });
  }
});

export default router;

