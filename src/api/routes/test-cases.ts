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

// Test case defect stage enum
const TestCaseDefectStageEnum = z.enum([
  'pre_development',
  'development',
  'post_development',
  'release_production',
]);

// Create test case schema
const createTestCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().optional().nullable(),
  labels: z.string().max(255, 'Labels must be less than 255 characters').optional().nullable(),
  automated: z.boolean().default(false).optional(),
  priority: z.number().int().min(1).max(5).default(2).optional(),
  data: z.any().optional().nullable(), // JSON field
  order: z.number().int().optional().nullable(),
  regression: z.boolean().default(true).optional(),
  epicLink: z.string().max(255, 'Epic link must be less than 255 characters').optional().nullable(),
  linkedIssue: z.string().max(255, 'Linked issue must be less than 255 characters').optional().nullable(),
  jiraKey: z.string().max(45, 'Jira key must be less than 45 characters').optional().nullable(),
  platform: z.string().optional().nullable(),
  releaseVersion: z.string().max(100, 'Release version must be less than 100 characters').optional().nullable(),
  severity: z.string().max(45, 'Severity must be less than 45 characters').default('Moderate').optional(),
  defectStage: TestCaseDefectStageEnum.optional().nullable(),
});

// Update test case schema
const updateTestCaseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  description: z.string().optional().nullable(),
  labels: z.string().max(255, 'Labels must be less than 255 characters').optional().nullable(),
  automated: z.boolean().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  data: z.any().optional().nullable(),
  order: z.number().int().optional().nullable(),
  regression: z.boolean().optional(),
  epicLink: z.string().max(255, 'Epic link must be less than 255 characters').optional().nullable(),
  linkedIssue: z.string().max(255, 'Linked issue must be less than 255 characters').optional().nullable(),
  jiraKey: z.string().max(45, 'Jira key must be less than 45 characters').optional().nullable(),
  platform: z.string().optional().nullable(),
  releaseVersion: z.string().max(100, 'Release version must be less than 100 characters').optional().nullable(),
  severity: z.string().max(45, 'Severity must be less than 45 characters').optional(),
  defectStage: TestCaseDefectStageEnum.optional().nullable(),
  version: z.number().int().optional(), // For optimistic locking
});

// List test cases schema
const listTestCasesSchema = z.object({
  search: z.string().optional(),
  automated: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  priority: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  severity: z.string().optional(),
  defectStage: TestCaseDefectStageEnum.optional(),
  regression: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  includeDeleted: z.string().optional().transform((val) => val === 'true'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['title', 'priority', 'order', 'createdAt', 'updatedAt']).optional().default('order'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List test cases for a suite
router.get('/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const suiteId = BigInt(req.params.suiteId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test cases',
        },
      });
    }

    // Verify suite exists and belongs to repository and tenant
    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
        repository: {
          projectId,
          tenantId,
        },
      },
      include: {
        repository: {
          select: {
            id: true,
            title: true,
            projectId: true,
          },
        },
      },
    });

    if (!suite) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const query = listTestCasesSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      suiteId,
      tenantId,
    };

    // Soft delete filter
    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    // Search filter
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { jiraKey: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Filters
    if (query.automated !== undefined) {
      where.automated = query.automated;
    }
    if (query.priority !== undefined) {
      where.priority = query.priority;
    }
    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.defectStage) {
      where.defectStage = query.defectStage;
    }
    if (query.regression !== undefined) {
      where.regression = query.regression;
    }

    const [testCases, total] = await Promise.all([
      prisma.testCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          _count: {
            select: {
              comments: true,
              testPlanCases: true,
              testRunResults: true,
            },
          },
        },
      }),
      prisma.testCase.count({ where }),
    ]);

    // Fetch user details for createdBy and updatedBy
    const userIds = new Set<bigint>();
    testCases.forEach((tc) => {
      if (tc.createdBy) userIds.add(tc.createdBy);
      if (tc.updatedBy) userIds.add(tc.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        testCases: testCases.map((tc) => {
          const createdByUser = tc.createdBy ? userMap.get(tc.createdBy.toString()) : null;
          const updatedByUser = tc.updatedBy ? userMap.get(tc.updatedBy.toString()) : null;

          return {
            id: tc.id.toString(),
            title: tc.title,
            description: tc.description,
            labels: tc.labels,
            automated: tc.automated,
            priority: tc.priority,
            data: tc.data,
            order: tc.order,
            regression: tc.regression,
            epicLink: tc.epicLink,
            linkedIssue: tc.linkedIssue,
            jiraKey: tc.jiraKey,
            platform: tc.platform,
            releaseVersion: tc.releaseVersion,
            severity: tc.severity,
            defectStage: tc.defectStage,
            version: tc.version,
            deletedAt: tc.deletedAt?.toISOString() || null,
            createdAt: tc.createdAt.toISOString(),
            updatedAt: tc.updatedAt.toISOString(),
            counts: {
              comments: tc._count.comments,
              testPlans: tc._count.testPlanCases,
              testRuns: tc._count.testRunResults,
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
    logger.error('List test cases error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test cases',
      },
    });
  }
});

// Get test case by ID
router.get('/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const suiteId = BigInt(req.params.suiteId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test cases',
        },
      });
    }

    // Verify suite exists and belongs to repository and tenant
    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
        repository: {
          projectId,
          tenantId,
        },
      },
    });

    if (!suite) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
        tenantId,
      },
      include: {
        suite: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            comments: true,
            testPlanCases: true,
            testRunResults: true,
          },
        },
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    // Fetch user details
    const userIds = new Set<bigint>();
    if (testCase.createdBy) userIds.add(testCase.createdBy);
    if (testCase.updatedBy) userIds.add(testCase.updatedBy);
    if (testCase.deletedBy) userIds.add(testCase.deletedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = testCase.createdBy ? userMap.get(testCase.createdBy.toString()) : null;
    const updatedByUser = testCase.updatedBy ? userMap.get(testCase.updatedBy.toString()) : null;
    const deletedByUser = testCase.deletedBy ? userMap.get(testCase.deletedBy.toString()) : null;

    res.json({
      data: {
        testCase: {
          id: testCase.id.toString(),
          title: testCase.title,
          description: testCase.description,
          labels: testCase.labels,
          automated: testCase.automated,
          priority: testCase.priority,
          data: testCase.data,
          order: testCase.order,
          regression: testCase.regression,
          epicLink: testCase.epicLink,
          linkedIssue: testCase.linkedIssue,
          jiraKey: testCase.jiraKey,
          platform: testCase.platform,
          releaseVersion: testCase.releaseVersion,
          severity: testCase.severity,
          defectStage: testCase.defectStage,
          version: testCase.version,
          deletedAt: testCase.deletedAt?.toISOString() || null,
          createdAt: testCase.createdAt.toISOString(),
          updatedAt: testCase.updatedAt.toISOString(),
          suite: {
            id: testCase.suite.id.toString(),
            title: testCase.suite.title,
          },
          counts: {
            comments: testCase._count.comments,
            testPlans: testCase._count.testPlanCases,
            testRuns: testCase._count.testRunResults,
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
          deletedBy: deletedByUser ? {
            id: deletedByUser.id.toString(),
            name: deletedByUser.name,
            email: deletedByUser.email,
          } : null,
        },
      },
    });
  } catch (error) {
    logger.error('Get test case error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test case',
      },
    });
  }
});

// Create test case
router.post('/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const suiteId = BigInt(req.params.suiteId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test cases',
        },
      });
    }

    // Verify suite exists and belongs to repository and tenant
    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
        repository: {
          projectId,
          tenantId,
        },
      },
    });

    if (!suite) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const data = createTestCaseSchema.parse(req.body);

    const testCase = await prisma.testCase.create({
      data: {
        tenantId,
        suiteId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        labels: data.labels?.trim() || null,
        automated: data.automated ?? false,
        priority: data.priority ?? 2,
        data: data.data || undefined,
        order: data.order || null,
        regression: data.regression ?? true,
        epicLink: data.epicLink?.trim() || null,
        linkedIssue: data.linkedIssue?.trim() || null,
        jiraKey: data.jiraKey?.trim() || null,
        platform: data.platform || null,
        releaseVersion: data.releaseVersion?.trim() || null,
        severity: data.severity || 'Moderate',
        defectStage: data.defectStage || null,
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        suite: {
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
          modelType: 'test_case',
          modelId: testCase.id,
          oldValues: {},
          newValues: {
            title: testCase.title,
            automated: testCase.automated,
            priority: testCase.priority,
            severity: testCase.severity,
            suiteId: testCase.suiteId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test case created: ${testCase.title} in suite ${suiteId} by user ${userId}`);

    res.status(201).json({
      data: {
        testCase: {
          id: testCase.id.toString(),
          title: testCase.title,
          description: testCase.description,
          labels: testCase.labels,
          automated: testCase.automated,
          priority: testCase.priority,
          data: testCase.data,
          order: testCase.order,
          regression: testCase.regression,
          epicLink: testCase.epicLink,
          linkedIssue: testCase.linkedIssue,
          jiraKey: testCase.jiraKey,
          platform: testCase.platform,
          releaseVersion: testCase.releaseVersion,
          severity: testCase.severity,
          defectStage: testCase.defectStage,
          version: testCase.version,
          createdAt: testCase.createdAt.toISOString(),
          updatedAt: testCase.updatedAt.toISOString(),
          suite: {
            id: testCase.suite.id.toString(),
            title: testCase.suite.title,
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
    logger.error('Create test case error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test case',
      },
    });
  }
});

// Update test case
router.patch('/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const suiteId = BigInt(req.params.suiteId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update test cases',
        },
      });
    }

    // Verify suite exists and belongs to repository and tenant
    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
        repository: {
          projectId,
          tenantId,
        },
      },
    });

    if (!suite) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const existing = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
        tenantId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    // Check if test case is soft-deleted
    if (existing.deletedAt) {
      return res.status(410).json({
        error: {
          code: 'TEST_CASE_DELETED',
          message: 'Cannot update a deleted test case',
        },
      });
    }

    const data = updateTestCaseSchema.parse(req.body);

    // Optimistic locking check
    if (data.version !== undefined && data.version !== existing.version) {
      return res.status(409).json({
        error: {
          code: 'VERSION_CONFLICT',
          message: 'Test case has been modified by another user. Please refresh and try again.',
          currentVersion: existing.version,
        },
      });
    }

    const oldValues = {
      title: existing.title,
      description: existing.description,
      automated: existing.automated,
      priority: existing.priority,
      severity: existing.severity,
      defectStage: existing.defectStage,
      version: existing.version,
    };

    const updateData: any = {
      updatedBy: userId,
      version: existing.version + 1, // Increment version
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.labels !== undefined) updateData.labels = data.labels?.trim() || null;
    if (data.automated !== undefined) updateData.automated = data.automated;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.data !== undefined) updateData.data = data.data || undefined;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.regression !== undefined) updateData.regression = data.regression;
    if (data.epicLink !== undefined) updateData.epicLink = data.epicLink?.trim() || null;
    if (data.linkedIssue !== undefined) updateData.linkedIssue = data.linkedIssue?.trim() || null;
    if (data.jiraKey !== undefined) updateData.jiraKey = data.jiraKey?.trim() || null;
    if (data.platform !== undefined) updateData.platform = data.platform;
    if (data.releaseVersion !== undefined) updateData.releaseVersion = data.releaseVersion?.trim() || null;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.defectStage !== undefined) updateData.defectStage = data.defectStage;

    const testCase = await prisma.testCase.update({
      where: { id: testCaseId },
      data: updateData,
      include: {
        suite: {
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
          modelType: 'test_case',
          modelId: testCase.id,
          oldValues,
          newValues: {
            title: testCase.title,
            automated: testCase.automated,
            priority: testCase.priority,
            severity: testCase.severity,
            defectStage: testCase.defectStage,
            version: testCase.version,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test case updated: ${testCase.title} by user ${userId}`);

    res.json({
      data: {
        testCase: {
          id: testCase.id.toString(),
          title: testCase.title,
          description: testCase.description,
          labels: testCase.labels,
          automated: testCase.automated,
          priority: testCase.priority,
          data: testCase.data,
          order: testCase.order,
          regression: testCase.regression,
          epicLink: testCase.epicLink,
          linkedIssue: testCase.linkedIssue,
          jiraKey: testCase.jiraKey,
          platform: testCase.platform,
          releaseVersion: testCase.releaseVersion,
          severity: testCase.severity,
          defectStage: testCase.defectStage,
          version: testCase.version,
          createdAt: testCase.createdAt.toISOString(),
          updatedAt: testCase.updatedAt.toISOString(),
          suite: {
            id: testCase.suite.id.toString(),
            title: testCase.suite.title,
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
    logger.error('Update test case error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test case',
      },
    });
  }
});

// Soft delete test case
router.delete('/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const suiteId = BigInt(req.params.suiteId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete test cases',
        },
      });
    }

    // Verify suite exists and belongs to repository and tenant
    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
        repository: {
          projectId,
          tenantId,
        },
      },
    });

    if (!suite) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
        tenantId,
      },
      include: {
        _count: {
          select: {
            testPlanCases: true,
            testRunResults: true,
          },
        },
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    // Check if already deleted
    if (testCase.deletedAt) {
      return res.status(410).json({
        error: {
          code: 'TEST_CASE_ALREADY_DELETED',
          message: 'Test case is already deleted',
        },
      });
    }

    // Soft delete
    const deleted = await prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'test_case',
          modelId: testCaseId,
          oldValues: {
            title: testCase.title,
            automated: testCase.automated,
            priority: testCase.priority,
          },
          newValues: {
            deletedAt: deleted.deletedAt?.toISOString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test case deleted: ${testCase.title} by user ${userId}`);

    res.json({
      message: 'Test case deleted successfully',
    });
  } catch (error) {
    logger.error('Delete test case error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting test case',
      },
    });
  }
});

// Move test case to different suite
router.post('/projects/:projectId/repositories/:repoId/test-cases/:testCaseId/move', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to move test cases',
        },
      });
    }

    const moveSchema = z.object({
      targetSuiteId: z.string().min(1, 'Target suite ID is required'),
    });

    const { targetSuiteId } = moveSchema.parse(req.body);
    const targetSuiteIdBigInt = BigInt(targetSuiteId);

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

    // Verify target suite exists and belongs to repository
    const targetSuite = await prisma.suite.findFirst({
      where: {
        id: targetSuiteIdBigInt,
        repositoryId: repoId,
      },
    });

    if (!targetSuite) {
      return res.status(404).json({
        error: {
          code: 'TARGET_SUITE_NOT_FOUND',
          message: 'Target test suite not found',
        },
      });
    }

    // Get the test case (from any suite in this repository)
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
        suite: {
          repositoryId: repoId,
        },
      },
      include: {
        suite: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    // Check if already in target suite
    if (testCase.suiteId.toString() === targetSuiteId) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_IN_SUITE',
          message: 'Test case is already in the target suite',
        },
      });
    }

    // Check if test case is soft-deleted
    if (testCase.deletedAt) {
      return res.status(410).json({
        error: {
          code: 'TEST_CASE_DELETED',
          message: 'Cannot move a deleted test case',
        },
      });
    }

    // Move the test case
    const updated = await prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        suiteId: targetSuiteIdBigInt,
        updatedBy: userId,
        version: testCase.version + 1,
      },
      include: {
        suite: {
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
          action: 'moved',
          modelType: 'test_case',
          modelId: testCaseId,
          oldValues: {
            suiteId: testCase.suite.id.toString(),
            suiteTitle: testCase.suite.title,
          },
          newValues: {
            suiteId: updated.suite.id.toString(),
            suiteTitle: updated.suite.title,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test case moved: ${testCase.title} from suite ${testCase.suite.id} to suite ${targetSuiteId} by user ${userId}`);

    res.json({
      message: 'Test case moved successfully',
      data: {
        testCase: {
          id: updated.id.toString(),
          suiteId: updated.suiteId.toString(),
          suite: {
            id: updated.suite.id.toString(),
            title: updated.suite.title,
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
    logger.error('Move test case error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while moving test case',
      },
    });
  }
});

// Restore soft-deleted test case
router.post('/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId/restore', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);
    const suiteId = BigInt(req.params.suiteId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to restore test cases',
        },
      });
    }

    // Verify suite exists
    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
        repository: {
          projectId,
          tenantId,
        },
      },
    });

    if (!suite) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        suiteId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    if (!testCase.deletedAt) {
      return res.status(400).json({
        error: {
          code: 'TEST_CASE_NOT_DELETED',
          message: 'Test case is not deleted',
        },
      });
    }

    // Restore
    const restored = await prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        deletedAt: null,
        deletedBy: null,
        updatedBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'restored',
          modelType: 'test_case',
          modelId: testCaseId,
          oldValues: {
            deletedAt: testCase.deletedAt?.toISOString(),
          },
          newValues: {
            deletedAt: null,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test case restored: ${testCase.title} by user ${userId}`);

    res.json({
      message: 'Test case restored successfully',
      data: {
        testCase: {
          id: restored.id.toString(),
          title: restored.title,
          deletedAt: null,
        },
      },
    });
  } catch (error) {
    logger.error('Restore test case error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while restoring test case',
      },
    });
  }
});

export default router;

