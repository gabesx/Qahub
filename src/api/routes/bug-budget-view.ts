import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';

const router = Router();

const querySchema = z.object({
  project: z.string().optional(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  isOpen: z.string().optional().transform((val) => val === 'true'),
  assigneeFinal: z.string().optional(),
  assigneeId: z.string().optional(),
  sprint: z.string().optional(),
  statusCategory: z.string().optional(),
  epicName: z.string().optional(),
  serviceFeature: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /bug-budget-view
 * List bug budget view (CQRS read model)
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view bug budget',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.project) where.project = query.project;
    if (query.projectId) where.projectId = BigInt(query.projectId);
    if (query.status) where.status = query.status;
    if (query.isOpen !== undefined) where.isOpen = query.isOpen;
    if (query.assigneeFinal) where.assigneeFinal = query.assigneeFinal;
    if (query.assigneeId) where.assigneeId = BigInt(query.assigneeId);
    if (query.sprint) where.sprint = query.sprint;
    if (query.statusCategory) where.statusCategory = query.statusCategory;
    if (query.epicName) where.epicName = query.epicName;
    if (query.serviceFeature) where.serviceFeature = query.serviceFeature;

    const [views, total] = await prisma.$transaction([
      prisma.bugBudgetView.findMany({
        where,
        orderBy: { lastUpdatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.bugBudgetView.count({ where }),
    ]);

    res.json({
      data: {
        views: views.map((v) => ({
          id: v.id.toString(),
          jiraKey: v.jiraKey,
          project: v.project,
          projectId: v.projectId?.toString() || null,
          summary: v.summary,
          status: v.status,
          issueType: v.issueType,
          priority: v.priority,
          assigneeFinal: v.assigneeFinal,
          assigneeId: v.assigneeId?.toString() || null,
          sprint: v.sprint,
          statusCategory: v.statusCategory,
          isOpen: v.isOpen,
          createdDate: v.createdDate?.toISOString() || null,
          resolvedDate: v.resolvedDate?.toISOString() || null,
          epicName: v.epicName,
          serviceFeature: v.serviceFeature,
          resolutionTimeHours: v.resolutionTimeHours?.toString() || null,
          ageDays: v.ageDays,
          lastUpdatedAt: v.lastUpdatedAt.toISOString(),
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

    logger.error('List bug budget view error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching bug budget view',
      },
    });
  }
});

/**
 * GET /bug-budget-view/:id
 * Get specific bug budget view entry
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view bug budget',
        },
      });
    }

    const viewId = BigInt(req.params.id);

    const view = await prisma.bugBudgetView.findUnique({
      where: { id: viewId },
    });

    if (!view) {
      return res.status(404).json({
        error: {
          code: 'BUG_BUDGET_VIEW_NOT_FOUND',
          message: 'Bug budget view entry not found',
        },
      });
    }

    res.json({
      data: {
        view: {
          id: view.id.toString(),
          jiraKey: view.jiraKey,
          project: view.project,
          projectId: view.projectId?.toString() || null,
          summary: view.summary,
          status: view.status,
          issueType: view.issueType,
          priority: view.priority,
          assigneeFinal: view.assigneeFinal,
          assigneeId: view.assigneeId?.toString() || null,
          sprint: view.sprint,
          statusCategory: view.statusCategory,
          isOpen: view.isOpen,
          createdDate: view.createdDate?.toISOString() || null,
          resolvedDate: view.resolvedDate?.toISOString() || null,
          epicName: view.epicName,
          serviceFeature: view.serviceFeature,
          resolutionTimeHours: view.resolutionTimeHours?.toString() || null,
          ageDays: view.ageDays,
          lastUpdatedAt: view.lastUpdatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get bug budget view error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching bug budget view',
      },
    });
  }
});

export default router;

