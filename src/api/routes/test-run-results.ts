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

// Test run result status enum
const TestRunResultStatusEnum = z.enum(['passed', 'failed', 'skipped', 'blocked']);

// Defect stage enum
const DefectStageEnum = z.enum(['pre_development', 'development', 'post_development', 'release_production']).optional().nullable();

// Create test run result schema
const createTestRunResultSchema = z.object({
  testCaseId: z.string().min(1, 'Test case ID is required'),
  status: TestRunResultStatusEnum,
  executionTime: z.number().int().positive().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  stackTrace: z.string().optional().nullable(),
  screenshots: z.any().optional().nullable(), // JSON field
  logs: z.string().optional().nullable(),
  defectFoundAtStage: DefectStageEnum,
  defectSeverity: z.string().max(50, 'Defect severity must be less than 50 characters').optional().nullable(),
  executedAt: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  retryCount: z.number().int().min(0).default(0).optional(),
});

// Update test run result schema
const updateTestRunResultSchema = z.object({
  status: TestRunResultStatusEnum.optional(),
  executionTime: z.number().int().positive().optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  stackTrace: z.string().optional().nullable(),
  screenshots: z.any().optional().nullable(), // JSON field
  logs: z.string().optional().nullable(),
  defectFoundAtStage: DefectStageEnum,
  defectSeverity: z.string().max(50, 'Defect severity must be less than 50 characters').optional().nullable(),
  executedAt: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  retryCount: z.number().int().min(0).optional(),
});

// List test run results schema
const listTestRunResultsSchema = z.object({
  testCaseId: z.string().optional(),
  status: TestRunResultStatusEnum.optional(),
  defectFoundAtStage: DefectStageEnum,
  startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['status', 'executedAt', 'executionTime', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test run results
router.get('/test-runs/:testRunId/results', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run results',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
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

    const query = listTestRunResultsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      testRunId,
    };

    if (query.testCaseId) {
      where.testCaseId = BigInt(query.testCaseId);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.defectFoundAtStage !== undefined) {
      where.defectFoundAtStage = query.defectFoundAtStage;
    }

    if (query.startDate || query.endDate) {
      where.executedAt = {};
      if (query.startDate) {
        where.executedAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.executedAt.lte = query.endDate;
      }
    }

    const [results, total] = await Promise.all([
      prisma.testRunResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          testCase: {
            select: {
              id: true,
              title: true,
              priority: true,
              automated: true,
            },
          },
        },
      }),
      prisma.testRunResult.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    results.forEach((r) => {
      if (r.executedBy) userIds.add(r.executedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        results: results.map((r) => {
          const executedByUser = r.executedBy ? userMap.get(r.executedBy.toString()) : null;

          return {
            id: r.id.toString(),
            testCase: {
              id: r.testCase.id.toString(),
              title: r.testCase.title,
              priority: r.testCase.priority,
              automated: r.testCase.automated,
            },
            status: r.status,
            executionTime: r.executionTime,
            errorMessage: r.errorMessage,
            stackTrace: r.stackTrace,
            screenshots: r.screenshots,
            logs: r.logs,
            defectFoundAtStage: r.defectFoundAtStage,
            defectSeverity: r.defectSeverity,
            executedBy: executedByUser ? {
              id: executedByUser.id.toString(),
              name: executedByUser.name,
              email: executedByUser.email,
            } : null,
            executedAt: r.executedAt?.toISOString() || null,
            retryCount: r.retryCount,
            createdAt: r.createdAt.toISOString(),
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
    logger.error('List test run results error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run results',
      },
    });
  }
});

// Get test run result by ID
router.get('/test-runs/:testRunId/results/:resultId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);
    const resultId = BigInt(req.params.resultId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run results',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
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

    const result = await prisma.testRunResult.findFirst({
      where: {
        id: resultId,
        testRunId,
      },
      include: {
        testCase: {
          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            automated: true,
            severity: true,
            defectStage: true,
          },
        },
      },
    });

    if (!result) {
      return res.status(404).json({
        error: {
          code: 'RESULT_NOT_FOUND',
          message: 'Test run result not found',
        },
      });
    }

    // Fetch user details
    const executedByUser = result.executedBy ? await prisma.user.findFirst({
      where: { id: result.executedBy },
      select: { id: true, name: true, email: true },
    }) : null;

    res.json({
      data: {
        result: {
          id: result.id.toString(),
          testCase: {
            id: result.testCase.id.toString(),
            title: result.testCase.title,
            description: result.testCase.description,
            priority: result.testCase.priority,
            automated: result.testCase.automated,
            severity: result.testCase.severity,
            defectStage: result.testCase.defectStage,
          },
          status: result.status,
          executionTime: result.executionTime,
          errorMessage: result.errorMessage,
          stackTrace: result.stackTrace,
          screenshots: result.screenshots,
          logs: result.logs,
          defectFoundAtStage: result.defectFoundAtStage,
          defectSeverity: result.defectSeverity,
          executedBy: executedByUser ? {
            id: executedByUser.id.toString(),
            name: executedByUser.name,
            email: executedByUser.email,
          } : null,
          executedAt: result.executedAt?.toISOString() || null,
          retryCount: result.retryCount,
          createdAt: result.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get test run result error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run result',
      },
    });
  }
});

// Create test run result
router.post('/test-runs/:testRunId/results', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test run results',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
        },
      },
      include: {
        repository: {
          select: {
            id: true,
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

    const data = createTestRunResultSchema.parse(req.body);

    // Verify test case exists and belongs to the same repository
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: BigInt(data.testCaseId),
        suite: {
          repositoryId: testRun.repositoryId || undefined,
        },
        deletedAt: null,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found or does not belong to this repository',
        },
      });
    }

    // Check if result already exists for this test run and test case
    const existing = await prisma.testRunResult.findUnique({
      where: {
        testRunId_testCaseId: {
          testRunId,
          testCaseId: BigInt(data.testCaseId),
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: 'RESULT_ALREADY_EXISTS',
          message: 'A result already exists for this test case in this test run',
        },
      });
    }

    const result = await prisma.testRunResult.create({
      data: {
        testRunId,
        testCaseId: BigInt(data.testCaseId),
        status: data.status,
        executionTime: data.executionTime || null,
        errorMessage: data.errorMessage?.trim() || null,
        stackTrace: data.stackTrace?.trim() || null,
        screenshots: data.screenshots || null,
        logs: data.logs?.trim() || null,
        defectFoundAtStage: data.defectFoundAtStage || null,
        defectSeverity: data.defectSeverity?.trim() || null,
        executedBy: userId,
        executedAt: data.executedAt || new Date(),
        retryCount: data.retryCount || 0,
      },
      include: {
        testCase: {
          select: {
            id: true,
            title: true,
            priority: true,
            automated: true,
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
          modelType: 'test_run_result',
          modelId: result.id,
          oldValues: {},
          newValues: {
            status: result.status,
            testCaseId: result.testCaseId.toString(),
            testRunId: result.testRunId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run result created: ${result.id} for test case ${data.testCaseId} in test run ${testRunId} by user ${userId}`);

    // Emit domain event for read model update
    try {
      const { domainEventEmitter, DomainEventType } = await import('../../shared/events/event-emitter');
      domainEventEmitter.emitEvent({
        type: DomainEventType.TEST_RUN_RESULT_CREATED,
        aggregateType: 'test_run_result',
        aggregateId: result.id,
        data: {
          testRunResultId: result.id.toString(),
          testRunId: testRunId.toString(),
          testCaseId: data.testCaseId,
        },
        metadata: {
          userId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to emit test run result created event:', error);
    }

    res.status(201).json({
      data: {
        result: {
          id: result.id.toString(),
          testCase: {
            id: result.testCase.id.toString(),
            title: result.testCase.title,
            priority: result.testCase.priority,
            automated: result.testCase.automated,
          },
          status: result.status,
          executionTime: result.executionTime,
          errorMessage: result.errorMessage,
          stackTrace: result.stackTrace,
          screenshots: result.screenshots,
          logs: result.logs,
          defectFoundAtStage: result.defectFoundAtStage,
          defectSeverity: result.defectSeverity,
          executedBy: {
            id: userId.toString(),
          },
          executedAt: result.executedAt?.toISOString() || null,
          retryCount: result.retryCount,
          createdAt: result.createdAt.toISOString(),
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
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return res.status(409).json({
        error: {
          code: 'RESULT_ALREADY_EXISTS',
          message: 'A result already exists for this test case in this test run',
        },
      });
    }
    logger.error('Create test run result error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test run result',
      },
    });
  }
});

// Update test run result
router.patch('/test-runs/:testRunId/results/:resultId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);
    const resultId = BigInt(req.params.resultId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update test run results',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
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

    const existing = await prisma.testRunResult.findFirst({
      where: {
        id: resultId,
        testRunId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'RESULT_NOT_FOUND',
          message: 'Test run result not found',
        },
      });
    }

    const data = updateTestRunResultSchema.parse(req.body);

    const oldValues = {
      status: existing.status,
      executionTime: existing.executionTime,
      errorMessage: existing.errorMessage,
      stackTrace: existing.stackTrace,
      logs: existing.logs,
      defectFoundAtStage: existing.defectFoundAtStage,
      defectSeverity: existing.defectSeverity,
      executedAt: existing.executedAt?.toISOString() || null,
      retryCount: existing.retryCount,
    };

    const updateData: any = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.executionTime !== undefined) updateData.executionTime = data.executionTime;
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage?.trim() || null;
    if (data.stackTrace !== undefined) updateData.stackTrace = data.stackTrace?.trim() || null;
    if (data.screenshots !== undefined) updateData.screenshots = data.screenshots || null;
    if (data.logs !== undefined) updateData.logs = data.logs?.trim() || null;
    if (data.defectFoundAtStage !== undefined) updateData.defectFoundAtStage = data.defectFoundAtStage;
    if (data.defectSeverity !== undefined) updateData.defectSeverity = data.defectSeverity?.trim() || null;
    if (data.executedAt !== undefined) updateData.executedAt = data.executedAt;
    if (data.retryCount !== undefined) updateData.retryCount = data.retryCount;

    // If executedAt is being set and executedBy is not set, set it to current user
    if (data.executedAt !== undefined && !existing.executedBy) {
      updateData.executedBy = userId;
    }

    const result = await prisma.testRunResult.update({
      where: { id: resultId },
      data: updateData,
      include: {
        testCase: {
          select: {
            id: true,
            title: true,
            priority: true,
            automated: true,
          },
        },
      },
    });

    // Fetch user details
    const executedByUser = result.executedBy ? await prisma.user.findFirst({
      where: { id: result.executedBy },
      select: { id: true, name: true, email: true },
    }) : null;

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'test_run_result',
          modelId: result.id,
          oldValues,
          newValues: {
            status: result.status,
            executionTime: result.executionTime,
            errorMessage: result.errorMessage,
            stackTrace: result.stackTrace,
            logs: result.logs,
            defectFoundAtStage: result.defectFoundAtStage,
            defectSeverity: result.defectSeverity,
            executedAt: result.executedAt?.toISOString() || null,
            retryCount: result.retryCount,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run result updated: ${result.id} by user ${userId}`);

    // Emit domain event for read model update
    try {
      const { domainEventEmitter, DomainEventType } = await import('../../shared/events/event-emitter');
      domainEventEmitter.emitEvent({
        type: DomainEventType.TEST_RUN_RESULT_UPDATED,
        aggregateType: 'test_run_result',
        aggregateId: result.id,
        data: {
          testRunResultId: result.id.toString(),
          testRunId: testRunId.toString(),
        },
        metadata: {
          userId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      logger.warn('Failed to emit test run result updated event:', error);
    }

    res.json({
      data: {
        result: {
          id: result.id.toString(),
          testCase: {
            id: result.testCase.id.toString(),
            title: result.testCase.title,
            priority: result.testCase.priority,
            automated: result.testCase.automated,
          },
          status: result.status,
          executionTime: result.executionTime,
          errorMessage: result.errorMessage,
          stackTrace: result.stackTrace,
          screenshots: result.screenshots,
          logs: result.logs,
          defectFoundAtStage: result.defectFoundAtStage,
          defectSeverity: result.defectSeverity,
          executedBy: executedByUser ? {
            id: executedByUser.id.toString(),
            name: executedByUser.name,
            email: executedByUser.email,
          } : null,
          executedAt: result.executedAt?.toISOString() || null,
          retryCount: result.retryCount,
          createdAt: result.createdAt.toISOString(),
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
    logger.error('Update test run result error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test run result',
      },
    });
  }
});

export default router;

