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

// List test runs view schema
const listTestRunsViewSchema = z.object({
  projectId: z.string().optional(),
  testPlanId: z.string().optional(),
  repositoryId: z.string().optional(),
  startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  search: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['executionDate', 'lastUpdatedAt', 'title']).optional().default('executionDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test runs from read model (fast query)
router.get('/test-runs-view', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test runs',
        },
      });
    }

    const query = listTestRunsViewSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.projectId) {
      where.projectId = BigInt(query.projectId);
    }

    if (query.testPlanId) {
      where.testPlanId = BigInt(query.testPlanId);
    }

    if (query.repositoryId) {
      where.repositoryId = BigInt(query.repositoryId);
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

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { testPlanTitle: { contains: query.search, mode: 'insensitive' } },
        { projectTitle: { contains: query.search, mode: 'insensitive' } },
        { repositoryTitle: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [testRuns, total] = await Promise.all([
      prisma.testRunsView.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.testRunsView.count({ where }),
    ]);

    res.json({
      data: {
        testRuns: testRuns.map((tr) => ({
          id: tr.id.toString(),
          testPlanId: tr.testPlanId.toString(),
          testPlanTitle: tr.testPlanTitle,
          projectId: tr.projectId.toString(),
          projectTitle: tr.projectTitle,
          repositoryId: tr.repositoryId.toString(),
          repositoryTitle: tr.repositoryTitle,
          title: tr.title,
          totalCases: tr.totalCases,
          passedCases: tr.passedCases,
          failedCases: tr.failedCases,
          skippedCases: tr.skippedCases,
          blockedCases: tr.blockedCases,
          executionDate: tr.executionDate?.toISOString().split('T')[0] || null,
          executionDuration: tr.executionDuration,
          createdById: tr.createdById?.toString() || null,
          createdByName: tr.createdByName,
          lastUpdatedAt: tr.lastUpdatedAt.toISOString(),
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
    logger.error('List test runs view error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test runs view',
      },
    });
  }
});

// Get test run from read model by ID
router.get('/test-runs-view/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test runs',
        },
      });
    }

    const testRun = await prisma.testRunsView.findUnique({
      where: { id: testRunId },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    res.json({
      data: {
        testRun: {
          id: testRun.id.toString(),
          testPlanId: testRun.testPlanId.toString(),
          testPlanTitle: testRun.testPlanTitle,
          projectId: testRun.projectId.toString(),
          projectTitle: testRun.projectTitle,
          repositoryId: testRun.repositoryId.toString(),
          repositoryTitle: testRun.repositoryTitle,
          title: testRun.title,
          totalCases: testRun.totalCases,
          passedCases: testRun.passedCases,
          failedCases: testRun.failedCases,
          skippedCases: testRun.skippedCases,
          blockedCases: testRun.blockedCases,
          executionDate: testRun.executionDate?.toISOString().split('T')[0] || null,
          executionDuration: testRun.executionDuration,
          createdById: testRun.createdById?.toString() || null,
          createdByName: testRun.createdByName,
          lastUpdatedAt: testRun.lastUpdatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get test run view error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run view',
      },
    });
  }
});

export default router;

