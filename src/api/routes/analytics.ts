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

// List analytics schema
const listAnalyticsSchema = z.object({
  startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['date', 'lastUpdatedAt']).optional().default('date'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Get test execution summary for a project
router.get('/projects/:projectId/analytics/test-execution', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view analytics',
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

    const query = listAnalyticsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
    };

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = query.startDate;
      }
      if (query.endDate) {
        where.date.lte = query.endDate;
      }
    }

    const [summaries, total] = await Promise.all([
      prisma.testExecutionSummary.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.testExecutionSummary.count({ where }),
    ]);

    res.json({
      data: {
        summaries: summaries.map((s) => ({
          id: s.id.toString(),
          projectId: s.projectId.toString(),
          date: s.date.toISOString().split('T')[0],
          totalRuns: s.totalRuns,
          passedRuns: s.passedRuns,
          failedRuns: s.failedRuns,
          skippedRuns: s.skippedRuns,
          blockedRuns: s.blockedRuns,
          automatedCount: s.automatedCount,
          manualCount: s.manualCount,
          avgExecutionTime: s.avgExecutionTime ? s.avgExecutionTime.toString() : null,
          totalTestCases: s.totalTestCases,
          lastUpdatedAt: s.lastUpdatedAt.toISOString(),
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
    logger.error('Get test execution summary error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test execution summary',
      },
    });
  }
});

// Get bug analytics for a project
router.get('/projects/:projectId/analytics/bugs', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view analytics',
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

    const query = listAnalyticsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
    };

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = query.startDate;
      }
      if (query.endDate) {
        where.date.lte = query.endDate;
      }
    }

    const [analytics, total] = await Promise.all([
      prisma.bugAnalyticsDaily.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.bugAnalyticsDaily.count({ where }),
    ]);

    res.json({
      data: {
        analytics: analytics.map((a) => ({
          id: a.id.toString(),
          project: a.project,
          projectId: a.projectId?.toString() || null,
          date: a.date.toISOString().split('T')[0],
          bugsCreated: a.bugsCreated,
          bugsResolved: a.bugsResolved,
          bugsClosed: a.bugsClosed,
          bugsReopened: a.bugsReopened,
          avgResolutionHours: a.avgResolutionHours ? a.avgResolutionHours.toString() : null,
          openBugs: a.openBugs,
          criticalBugs: a.criticalBugs,
          highPriorityBugs: a.highPriorityBugs,
          mediumPriorityBugs: a.mediumPriorityBugs,
          lowPriorityBugs: a.lowPriorityBugs,
          lastUpdatedAt: a.lastUpdatedAt.toISOString(),
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
    logger.error('Get bug analytics error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching bug analytics',
      },
    });
  }
});

// Get test case analytics for a repository
router.get('/projects/:projectId/repositories/:repositoryId/analytics/test-cases', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repositoryId = BigInt(req.params.repositoryId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view analytics',
        },
      });
    }

    // Verify project and repository exist and belong to tenant
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

    const repository = await prisma.repository.findFirst({
      where: {
        id: repositoryId,
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

    const query = listAnalyticsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
      repositoryId,
    };

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = query.startDate;
      }
      if (query.endDate) {
        where.date.lte = query.endDate;
      }
    }

    const [analytics, total] = await Promise.all([
      prisma.testCaseAnalytics.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.testCaseAnalytics.count({ where }),
    ]);

    res.json({
      data: {
        analytics: analytics.map((a) => ({
          id: a.id.toString(),
          projectId: a.projectId.toString(),
          repositoryId: a.repositoryId.toString(),
          date: a.date.toISOString().split('T')[0],
          totalCases: a.totalCases,
          automatedCases: a.automatedCases,
          manualCases: a.manualCases,
          highPriorityCases: a.highPriorityCases,
          mediumPriorityCases: a.mediumPriorityCases,
          lowPriorityCases: a.lowPriorityCases,
          regressionCases: a.regressionCases,
          lastUpdatedAt: a.lastUpdatedAt.toISOString(),
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
    logger.error('Get test case analytics error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test case analytics',
      },
    });
  }
});

export default router;

