import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper function to get user's primary tenant
async function getUserPrimaryTenant(userId: bigint): Promise<bigint | null> {
  let tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
    orderBy: { joinedAt: 'asc' },
  });

  if (!tenantUser) {
    const defaultTenant = await prisma.tenant.findFirst({
      where: { slug: 'default' },
    });

    if (defaultTenant) {
      tenantUser = await prisma.tenantUser.create({
        data: {
          tenantId: defaultTenant.id,
          userId: userId,
          role: 'member',
        },
        include: { tenant: true },
      });
      logger.info(`Auto-assigned user ${userId} to default tenant`);
    }
  }

  return tenantUser?.tenantId || null;
}

// Test run status enum
const TestRunStatusEnum = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

// Create test run schema
const createTestRunSchema = z.object({
  testPlanId: z.string().min(1, 'Test plan ID is required'),
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  executionDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  environment: z.string().max(100, 'Environment must be less than 100 characters').optional().nullable(),
  buildVersion: z.string().max(100, 'Build version must be less than 100 characters').optional().nullable(),
  status: TestRunStatusEnum.default('pending').optional(),
});

// Update test run schema
const updateTestRunSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  status: TestRunStatusEnum.optional(),
  executionDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  startedAt: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  completedAt: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  environment: z.string().max(100, 'Environment must be less than 100 characters').optional().nullable(),
  buildVersion: z.string().max(100, 'Build version must be less than 100 characters').optional().nullable(),
});

// List test runs schema
const listTestRunsSchema = z.object({
  search: z.string().optional(),
  status: TestRunStatusEnum.optional(),
  testPlanId: z.string().optional(),
  environment: z.string().optional(),
  startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['title', 'status', 'executionDate', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test runs for a project
router.get('/projects/:projectId/test-runs', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test runs',
        },
      });
    }

    // Verify project exists and belongs to tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    const query = listTestRunsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
    };

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.testPlanId) {
      where.testPlanId = BigInt(query.testPlanId);
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.startDate || query.endDate) {
      where.executionDate = {};
      if (query.startDate) {
        where.executionDate.gte = query.startDate;
      }
      if (query.endDate) {
        where.executionDate.lte = query.endDate;
      }
    }

    const [testRuns, total] = await Promise.all([
      prisma.testRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          testPlan: {
            select: {
              id: true,
              title: true,
            },
          },
          repository: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              results: true,
              attachments: true,
              comments: true,
            },
          },
        },
      }),
      prisma.testRun.count({ where }),
    ]);

    // Calculate result statistics
    const testRunsWithStats = await Promise.all(
      testRuns.map(async (tr) => {
        const results = await prisma.testRunResult.findMany({
          where: { testRunId: tr.id },
          select: { status: true },
        });

        const stats = {
          total: results.length,
          passed: results.filter((r) => r.status === 'passed').length,
          failed: results.filter((r) => r.status === 'failed').length,
          skipped: results.filter((r) => r.status === 'skipped').length,
          blocked: results.filter((r) => r.status === 'blocked').length,
        };

        return {
          id: tr.id.toString(),
          title: tr.title,
          status: tr.status,
          executionDate: tr.executionDate?.toISOString().split('T')[0] || null,
          startedAt: tr.startedAt?.toISOString() || null,
          completedAt: tr.completedAt?.toISOString() || null,
          environment: tr.environment,
          buildVersion: tr.buildVersion,
          createdAt: tr.createdAt.toISOString(),
          updatedAt: tr.updatedAt.toISOString(),
          testPlan: {
            id: tr.testPlan.id.toString(),
            title: tr.testPlan.title,
          },
          repository: tr.repository ? {
            id: tr.repository.id.toString(),
            title: tr.repository.title,
          } : null,
          counts: {
            results: tr._count.results,
            attachments: tr._count.attachments,
            comments: tr._count.comments,
          },
          stats,
        };
      })
    );

    // Fetch user details
    const userIds = new Set<bigint>();
    testRuns.forEach((tr) => {
      if (tr.createdBy) userIds.add(tr.createdBy);
      if (tr.updatedBy) userIds.add(tr.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        testRuns: testRunsWithStats.map((tr, index) => {
          const original = testRuns[index];
          const createdByUser = original.createdBy ? userMap.get(original.createdBy.toString()) : null;
          const updatedByUser = original.updatedBy ? userMap.get(original.updatedBy.toString()) : null;

          return {
            ...tr,
            createdBy: createdByUser ? {
              id: createdByUser.id.toString(),
              name: createdByUser.name,
              email: createdByUser.email,
            } : null,
            updatedBy: updatedByUser ? {
              id: updatedByUser.id.toString(),
              name: updatedByUser.name,
              email: updatedByUser.email,
            } : null,
          };
        }),
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
    logger.error('List test runs error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test runs',
      },
    });
  }
});

// Get test run by ID
router.get('/projects/:projectId/test-runs/:testRunId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test runs',
        },
      });
    }

    // Verify project exists and belongs to tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        projectId,
      },
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        repository: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            results: true,
            attachments: true,
            comments: true,
          },
        },
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    // Get result statistics
    const results = await prisma.testRunResult.findMany({
      where: { testRunId: testRun.id },
      select: { status: true },
    });

    const stats = {
      total: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      blocked: results.filter((r) => r.status === 'blocked').length,
    };

    // Fetch user details
    const userIds = new Set<bigint>();
    if (testRun.createdBy) userIds.add(testRun.createdBy);
    if (testRun.updatedBy) userIds.add(testRun.updatedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = testRun.createdBy ? userMap.get(testRun.createdBy.toString()) : null;
    const updatedByUser = testRun.updatedBy ? userMap.get(testRun.updatedBy.toString()) : null;

    res.json({
      data: {
        testRun: {
          id: testRun.id.toString(),
          title: testRun.title,
          status: testRun.status,
          executionDate: testRun.executionDate?.toISOString().split('T')[0] || null,
          startedAt: testRun.startedAt?.toISOString() || null,
          completedAt: testRun.completedAt?.toISOString() || null,
          environment: testRun.environment,
          buildVersion: testRun.buildVersion,
          createdAt: testRun.createdAt.toISOString(),
          updatedAt: testRun.updatedAt.toISOString(),
          testPlan: {
            id: testRun.testPlan.id.toString(),
            title: testRun.testPlan.title,
            status: testRun.testPlan.status,
          },
          repository: testRun.repository ? {
            id: testRun.repository.id.toString(),
            title: testRun.repository.title,
          } : null,
          counts: {
            results: testRun._count.results,
            attachments: testRun._count.attachments,
            comments: testRun._count.comments,
          },
          stats,
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
          } : null,
          updatedBy: updatedByUser ? {
            id: updatedByUser.id.toString(),
            name: updatedByUser.name,
            email: updatedByUser.email,
          } : null,
        },
      },
    });
  } catch (error) {
    logger.error('Get test run error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run',
      },
    });
  }
});

// Create test run
router.post('/projects/:projectId/test-runs', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test runs',
        },
      });
    }

    // Verify project exists and belongs to tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    const data = createTestRunSchema.parse(req.body);

    // Verify test plan exists and belongs to project
    const testPlan = await prisma.testPlan.findFirst({
      where: {
        id: BigInt(data.testPlanId),
        projectId,
      },
      include: {
        repository: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!testPlan) {
      return res.status(404).json({
        error: {
          code: 'TEST_PLAN_NOT_FOUND',
          message: 'Test plan not found',
        },
      });
    }

    const testRun = await prisma.testRun.create({
      data: {
        testPlanId: BigInt(data.testPlanId),
        projectId,
        repositoryId: testPlan.repositoryId,
        title: data.title.trim(),
        status: data.status || 'pending',
        executionDate: data.executionDate || null,
        environment: data.environment?.trim() || null,
        buildVersion: data.buildVersion?.trim() || null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
          },
        },
        repository: {
          select: {
            id: true,
            title: true,
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
          modelType: 'test_run',
          modelId: testRun.id,
          oldValues: {},
          newValues: {
            title: testRun.title,
            status: testRun.status,
            testPlanId: testRun.testPlanId.toString(),
            projectId: testRun.projectId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run created: ${testRun.title} in project ${projectId} by user ${userId}`);

    // Log change for CDC
    try {
      const { logInsert, sanitizeForChangeLog } = await import('../../shared/utils/change-logger');
      await logInsert('test_runs', testRun.id, sanitizeForChangeLog(testRun), {
        userId,
        source: 'api',
      });
    } catch (changeLogError) {
      logger.warn('Failed to log change for test run creation:', changeLogError);
    }

    // Emit domain event for read model update
    try {
      const { domainEventEmitter, DomainEventType } = await import('../../shared/events/event-emitter');
      domainEventEmitter.emitEvent({
        type: DomainEventType.TEST_RUN_CREATED,
        aggregateType: 'test_run',
        aggregateId: testRun.id,
        data: {
          testRunId: testRun.id.toString(),
          projectId: testRun.projectId.toString(),
          testPlanId: testRun.testPlanId.toString(),
        },
        metadata: {
          userId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to emit test run created event:', error);
    }

    res.status(201).json({
      data: {
        testRun: {
          id: testRun.id.toString(),
          title: testRun.title,
          status: testRun.status,
          executionDate: testRun.executionDate?.toISOString().split('T')[0] || null,
          startedAt: testRun.startedAt?.toISOString() || null,
          completedAt: testRun.completedAt?.toISOString() || null,
          environment: testRun.environment,
          buildVersion: testRun.buildVersion,
          createdAt: testRun.createdAt.toISOString(),
          updatedAt: testRun.updatedAt.toISOString(),
          testPlan: {
            id: testRun.testPlan.id.toString(),
            title: testRun.testPlan.title,
          },
          repository: testRun.repository ? {
            id: testRun.repository.id.toString(),
            title: testRun.repository.title,
          } : null,
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
    logger.error('Create test run error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test run',
      },
    });
  }
});

// Update test run
router.patch('/projects/:projectId/test-runs/:testRunId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update test runs',
        },
      });
    }

    // Verify project exists and belongs to tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    const existing = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        projectId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    const data = updateTestRunSchema.parse(req.body);

    const oldValues = {
      title: existing.title,
      status: existing.status,
      executionDate: existing.executionDate?.toISOString().split('T')[0] || null,
      startedAt: existing.startedAt?.toISOString() || null,
      completedAt: existing.completedAt?.toISOString() || null,
      environment: existing.environment,
      buildVersion: existing.buildVersion,
    };

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Auto-set timestamps based on status
      if (data.status === 'running' && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if ((data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') && !existing.completedAt) {
        updateData.completedAt = new Date();
      }
    }
    if (data.executionDate !== undefined) updateData.executionDate = data.executionDate;
    if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.environment !== undefined) updateData.environment = data.environment?.trim() || null;
    if (data.buildVersion !== undefined) updateData.buildVersion = data.buildVersion?.trim() || null;

    const testRun = await prisma.testRun.update({
      where: { id: testRunId },
      data: updateData,
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
          },
        },
        repository: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'test_run',
          modelId: testRun.id,
          oldValues,
          newValues: {
            title: testRun.title,
            status: testRun.status,
            executionDate: testRun.executionDate?.toISOString().split('T')[0] || null,
            startedAt: testRun.startedAt?.toISOString() || null,
            completedAt: testRun.completedAt?.toISOString() || null,
            environment: testRun.environment,
            buildVersion: testRun.buildVersion,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run updated: ${testRun.title} by user ${userId}`);

    // Log change for CDC
    try {
      const { logUpdate, sanitizeForChangeLog } = await import('../../shared/utils/change-logger');
      await logUpdate(
        'test_runs',
        testRun.id,
        sanitizeForChangeLog(existing),
        sanitizeForChangeLog(testRun),
        {
          userId,
          source: 'api',
        }
      );
    } catch (changeLogError) {
      logger.warn('Failed to log change for test run update:', changeLogError);
    }

    // Emit domain event for read model update
    try {
      const { domainEventEmitter, DomainEventType } = await import('../../shared/events/event-emitter');
      domainEventEmitter.emitEvent({
        type: DomainEventType.TEST_RUN_UPDATED,
        aggregateType: 'test_run',
        aggregateId: testRun.id,
        data: {
          testRunId: testRun.id.toString(),
          projectId: testRun.projectId.toString(),
          testPlanId: testRun.testPlanId.toString(),
        },
        metadata: {
          userId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to emit test run updated event:', error);
    }

    res.json({
      data: {
        testRun: {
          id: testRun.id.toString(),
          title: testRun.title,
          status: testRun.status,
          executionDate: testRun.executionDate?.toISOString().split('T')[0] || null,
          startedAt: testRun.startedAt?.toISOString() || null,
          completedAt: testRun.completedAt?.toISOString() || null,
          environment: testRun.environment,
          buildVersion: testRun.buildVersion,
          createdAt: testRun.createdAt.toISOString(),
          updatedAt: testRun.updatedAt.toISOString(),
          testPlan: {
            id: testRun.testPlan.id.toString(),
            title: testRun.testPlan.title,
          },
          repository: testRun.repository ? {
            id: testRun.repository.id.toString(),
            title: testRun.repository.title,
          } : null,
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
    logger.error('Update test run error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test run',
      },
    });
  }
});

// Delete test run
router.delete('/projects/:projectId/test-runs/:testRunId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete test runs',
        },
      });
    }

    // Verify project exists and belongs to tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        projectId,
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    await prisma.testRun.delete({
      where: { id: testRunId },
    });

    // Log change for CDC
    try {
      const { logDelete, sanitizeForChangeLog } = await import('../../shared/utils/change-logger');
      await logDelete('test_runs', testRunId, sanitizeForChangeLog(testRun), {
        userId,
        source: 'api',
      });
    } catch (changeLogError) {
      logger.warn('Failed to log change for test run deletion:', changeLogError);
    }

    // Emit domain event for read model update
    try {
      const { domainEventEmitter, DomainEventType } = await import('../../shared/events/event-emitter');
      domainEventEmitter.emitEvent({
        type: DomainEventType.TEST_RUN_DELETED,
        aggregateType: 'test_run',
        aggregateId: testRunId,
        data: {
          testRunId: testRunId.toString(),
          projectId: projectId.toString(),
        },
        metadata: {
          userId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to emit test run deleted event:', error);
    }

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'test_run',
          modelId: testRunId,
          oldValues: {
            title: testRun.title,
            status: testRun.status,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run deleted: ${testRun.title} by user ${userId}`);

    res.json({
      message: 'Test run deleted successfully',
    });
  } catch (error) {
    logger.error('Delete test run error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting test run',
      },
    });
  }
});

export default router;

