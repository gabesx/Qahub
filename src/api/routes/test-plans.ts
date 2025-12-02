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

// Create test plan schema
const createTestPlanSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']).default('draft').optional(),
});

// Update test plan schema
const updateTestPlanSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

// List test plans schema
const listTestPlansSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['title', 'status', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test plans for a repository
router.get('/projects/:projectId/repositories/:repoId/test-plans', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test plans',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    const query = listTestPlansSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
      repositoryId: repoId,
    };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    const [testPlans, total] = await Promise.all([
      prisma.testPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          _count: {
            select: {
              testPlanCases: true,
              testRuns: true,
            },
          },
        },
      }),
      prisma.testPlan.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    testPlans.forEach((tp) => {
      if (tp.createdBy) userIds.add(tp.createdBy);
      if (tp.updatedBy) userIds.add(tp.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        testPlans: testPlans.map((tp) => {
          const createdByUser = tp.createdBy ? userMap.get(tp.createdBy.toString()) : null;
          const updatedByUser = tp.updatedBy ? userMap.get(tp.updatedBy.toString()) : null;

          return {
            id: tp.id.toString(),
            title: tp.title,
            description: tp.description,
            status: tp.status,
            createdAt: tp.createdAt.toISOString(),
            updatedAt: tp.updatedAt.toISOString(),
            counts: {
              testCases: tp._count.testPlanCases,
              testRuns: tp._count.testRuns,
            },
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
    logger.error('List test plans error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test plans',
      },
    });
  }
});

// Get test plan by ID
router.get('/projects/:projectId/repositories/:repoId/test-plans/:testPlanId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testPlanId = BigInt(req.params.testPlanId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test plans',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    const testPlan = await prisma.testPlan.findFirst({
      where: {
        id: testPlanId,
        projectId,
        repositoryId: repoId,
      },
      include: {
        project: {
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
            testPlanCases: true,
            testRuns: true,
          },
        },
        testPlanCases: {
          take: 50,
          include: {
            testCase: {
              select: {
                id: true,
                title: true,
                automated: true,
                priority: true,
                severity: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
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

    // Fetch user details
    const userIds = new Set<bigint>();
    if (testPlan.createdBy) userIds.add(testPlan.createdBy);
    if (testPlan.updatedBy) userIds.add(testPlan.updatedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = testPlan.createdBy ? userMap.get(testPlan.createdBy.toString()) : null;
    const updatedByUser = testPlan.updatedBy ? userMap.get(testPlan.updatedBy.toString()) : null;

    res.json({
      data: {
        testPlan: {
          id: testPlan.id.toString(),
          title: testPlan.title,
          description: testPlan.description,
          status: testPlan.status,
          createdAt: testPlan.createdAt.toISOString(),
          updatedAt: testPlan.updatedAt.toISOString(),
          project: {
            id: testPlan.project.id.toString(),
            title: testPlan.project.title,
          },
          repository: {
            id: testPlan.repository.id.toString(),
            title: testPlan.repository.title,
          },
          counts: {
            testCases: testPlan._count.testPlanCases,
            testRuns: testPlan._count.testRuns,
          },
          testCases: testPlan.testPlanCases.map((tpc) => ({
            id: tpc.testCase.id.toString(),
            title: tpc.testCase.title,
            automated: tpc.testCase.automated,
            priority: tpc.testCase.priority,
            severity: tpc.testCase.severity,
            order: tpc.order,
          })),
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
    logger.error('Get test plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test plan',
      },
    });
  }
});

// Create test plan
router.post('/projects/:projectId/repositories/:repoId/test-plans', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test plans',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    const data = createTestPlanSchema.parse(req.body);

    const testPlan = await prisma.testPlan.create({
      data: {
        projectId,
        repositoryId: repoId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        status: data.status || 'draft',
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        project: {
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
          modelType: 'test_plan',
          modelId: testPlan.id,
          oldValues: {},
          newValues: {
            title: testPlan.title,
            status: testPlan.status,
            projectId: testPlan.projectId.toString(),
            repositoryId: testPlan.repositoryId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test plan created: ${testPlan.title} in repository ${repoId} by user ${userId}`);

    res.status(201).json({
      data: {
        testPlan: {
          id: testPlan.id.toString(),
          title: testPlan.title,
          description: testPlan.description,
          status: testPlan.status,
          createdAt: testPlan.createdAt.toISOString(),
          updatedAt: testPlan.updatedAt.toISOString(),
          project: {
            id: testPlan.project.id.toString(),
            title: testPlan.project.title,
          },
          repository: {
            id: testPlan.repository.id.toString(),
            title: testPlan.repository.title,
          },
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
    logger.error('Create test plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test plan',
      },
    });
  }
});

// Update test plan
router.patch('/projects/:projectId/repositories/:repoId/test-plans/:testPlanId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testPlanId = BigInt(req.params.testPlanId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update test plans',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    const existing = await prisma.testPlan.findFirst({
      where: {
        id: testPlanId,
        projectId,
        repositoryId: repoId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'TEST_PLAN_NOT_FOUND',
          message: 'Test plan not found',
        },
      });
    }

    const data = updateTestPlanSchema.parse(req.body);

    const oldValues = {
      title: existing.title,
      description: existing.description,
      status: existing.status,
    };

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.status !== undefined) updateData.status = data.status;

    const testPlan = await prisma.testPlan.update({
      where: { id: testPlanId },
      data: updateData,
      include: {
        project: {
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
          modelType: 'test_plan',
          modelId: testPlan.id,
          oldValues,
          newValues: {
            title: testPlan.title,
            description: testPlan.description,
            status: testPlan.status,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test plan updated: ${testPlan.title} by user ${userId}`);

    res.json({
      data: {
        testPlan: {
          id: testPlan.id.toString(),
          title: testPlan.title,
          description: testPlan.description,
          status: testPlan.status,
          createdAt: testPlan.createdAt.toISOString(),
          updatedAt: testPlan.updatedAt.toISOString(),
          project: {
            id: testPlan.project.id.toString(),
            title: testPlan.project.title,
          },
          repository: {
            id: testPlan.repository.id.toString(),
            title: testPlan.repository.title,
          },
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
    logger.error('Update test plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test plan',
      },
    });
  }
});

// Delete test plan
router.delete('/projects/:projectId/repositories/:repoId/test-plans/:testPlanId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testPlanId = BigInt(req.params.testPlanId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete test plans',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    const testPlan = await prisma.testPlan.findFirst({
      where: {
        id: testPlanId,
        projectId,
        repositoryId: repoId,
      },
      include: {
        _count: {
          select: {
            testPlanCases: true,
            testRuns: true,
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

    // Check if test plan has test runs
    if (testPlan._count.testRuns > 0) {
      return res.status(409).json({
        error: {
          code: 'TEST_PLAN_IN_USE',
          message: 'Cannot delete test plan that has test runs',
          details: {
            testRunsCount: testPlan._count.testRuns,
          },
        },
      });
    }

    await prisma.testPlan.delete({
      where: { id: testPlanId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'test_plan',
          modelId: testPlanId,
          oldValues: {
            title: testPlan.title,
            status: testPlan.status,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test plan deleted: ${testPlan.title} by user ${userId}`);

    res.json({
      message: 'Test plan deleted successfully',
    });
  } catch (error) {
    logger.error('Delete test plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting test plan',
      },
    });
  }
});

// Add test cases to test plan
router.post('/projects/:projectId/repositories/:repoId/test-plans/:testPlanId/test-cases', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testPlanId = BigInt(req.params.testPlanId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to manage test plan cases',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    // Verify test plan exists
    const testPlan = await prisma.testPlan.findFirst({
      where: {
        id: testPlanId,
        projectId,
        repositoryId: repoId,
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

    const { testCaseIds } = z.object({
      testCaseIds: z.array(z.string()).min(1, 'At least one test case ID is required'),
    }).parse(req.body);

    // Verify all test cases exist and belong to the same tenant
    const testCaseBigInts = testCaseIds.map((id) => BigInt(id));
    const testCases = await prisma.testCase.findMany({
      where: {
        id: { in: testCaseBigInts },
        tenantId,
        deletedAt: null, // Only include non-deleted test cases
      },
      select: {
        id: true,
        suiteId: true,
      },
    });

    if (testCases.length !== testCaseIds.length) {
      return res.status(400).json({
        error: {
          code: 'INVALID_TEST_CASES',
          message: 'One or more test case IDs are invalid or deleted',
        },
      });
    }

    // Verify all test cases belong to suites in this repository
    const suiteIds = new Set(testCases.map((tc) => tc.suiteId.toString()));
    const suites = await prisma.suite.findMany({
      where: {
        id: { in: Array.from(suiteIds).map((id) => BigInt(id)) },
        repositoryId: repoId,
      },
    });

    if (suites.length !== suiteIds.size) {
      return res.status(400).json({
        error: {
          code: 'TEST_CASES_NOT_IN_REPOSITORY',
          message: 'One or more test cases do not belong to this repository',
        },
      });
    }

    // Get current max order
    const maxOrder = await prisma.testPlanTestCase.findFirst({
      where: { testPlanId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    let currentOrder = maxOrder ? maxOrder.order + 1 : 0;

    // Create test plan-test case assignments
    await prisma.testPlanTestCase.createMany({
      data: testCaseBigInts.map((testCaseId) => ({
        testPlanId,
        testCaseId,
        order: currentOrder++,
      })),
      skipDuplicates: true,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'test_plan',
          modelId: testPlanId,
          oldValues: {},
          newValues: {
            testCasesAdded: testCaseIds,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test cases added to test plan ${testPlanId} by user ${userId}`);

    res.json({
      message: 'Test cases added to test plan successfully',
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
    logger.error('Add test cases to test plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while adding test cases to test plan',
      },
    });
  }
});

// Remove test case from test plan
router.delete('/projects/:projectId/repositories/:repoId/test-plans/:testPlanId/test-cases/:testCaseId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testPlanId = BigInt(req.params.testPlanId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to manage test plan cases',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    // Verify test plan exists
    const testPlan = await prisma.testPlan.findFirst({
      where: {
        id: testPlanId,
        projectId,
        repositoryId: repoId,
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

    // Remove test case from test plan
    await prisma.testPlanTestCase.deleteMany({
      where: {
        testPlanId,
        testCaseId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'test_plan',
          modelId: testPlanId,
          oldValues: {
            testCaseRemoved: testCaseId.toString(),
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test case removed from test plan ${testPlanId} by user ${userId}`);

    res.json({
      message: 'Test case removed from test plan successfully',
    });
  } catch (error) {
    logger.error('Remove test case from test plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while removing test case from test plan',
      },
    });
  }
});

// Update test case order in test plan
router.patch('/projects/:projectId/repositories/:repoId/test-plans/:testPlanId/test-cases/:testCaseId/order', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testPlanId = BigInt(req.params.testPlanId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to manage test plan cases',
        },
      });
    }

    // Verify repository exists and belongs to tenant
    const repository = await prisma.repository.findFirst({
      where: {
        id: repoId,
        projectId,
        tenantId,
      },
    });

    if (!repository) {
      return res.status(404).json({
        error: {
          code: 'REPOSITORY_NOT_FOUND',
          message: 'Repository not found',
        },
      });
    }

    // Verify test plan exists
    const testPlan = await prisma.testPlan.findFirst({
      where: {
        id: testPlanId,
        projectId,
        repositoryId: repoId,
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

    const { order } = z.object({
      order: z.number().int().min(0, 'Order must be non-negative'),
    }).parse(req.body);

    // Update order
    await prisma.testPlanTestCase.updateMany({
      where: {
        testPlanId,
        testCaseId,
      },
      data: {
        order,
      },
    });

    logger.info(`Test case order updated in test plan ${testPlanId} by user ${userId}`);

    res.json({
      message: 'Test case order updated successfully',
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
    logger.error('Update test case order error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test case order',
      },
    });
  }
});

export default router;

