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

// Create bug budget schema
const createBugBudgetSchema = z.object({
  jiraKey: z.string().min(1, 'Jira key is required').max(255, 'Jira key must be less than 255 characters'),
  project: z.string().min(1, 'Project is required').max(255, 'Project must be less than 255 characters'),
  projectId: z.string().optional().nullable(),
  summary: z.string().min(1, 'Summary is required'),
  status: z.string().optional().nullable(),
  issueType: z.string().optional().nullable(),
  finalIssueType: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  severityIssue: z.string().optional().nullable(),
  sprint: z.string().optional().nullable(),
  statusCategory: z.string().optional().nullable(),
  assigneeFinal: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  reporter: z.string().optional().nullable(),
  reporterId: z.string().optional().nullable(),
  creator: z.string().optional().nullable(),
  creatorId: z.string().optional().nullable(),
  labels: z.string().optional().nullable(),
  isOpen: z.boolean().default(true).optional(),
  createdDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  updatedDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  resolvedDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  dueDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  description: z.string().optional().nullable(),
});

// Update bug budget schema
const updateBugBudgetSchema = z.object({
  project: z.string().min(1, 'Project is required').max(255, 'Project must be less than 255 characters').optional(),
  projectId: z.string().optional().nullable(),
  summary: z.string().min(1, 'Summary is required').optional(),
  status: z.string().optional().nullable(),
  issueType: z.string().optional().nullable(),
  finalIssueType: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  severityIssue: z.string().optional().nullable(),
  sprint: z.string().optional().nullable(),
  statusCategory: z.string().optional().nullable(),
  assigneeFinal: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  reporter: z.string().optional().nullable(),
  reporterId: z.string().optional().nullable(),
  creator: z.string().optional().nullable(),
  creatorId: z.string().optional().nullable(),
  labels: z.string().optional().nullable(),
  isOpen: z.boolean().optional(),
  createdDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  updatedDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  resolvedDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  dueDate: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
  description: z.string().optional().nullable(),
  lastSyncedAt: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
});

// List bug budget schema
const listBugBudgetSchema = z.object({
  project: z.string().optional(),
  projectId: z.string().optional(),
  status: z.string().optional(),
  issueType: z.string().optional(),
  priority: z.string().optional(),
  severityIssue: z.string().optional(),
  sprint: z.string().optional(),
  isOpen: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  assigneeId: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['jiraKey', 'createdDate', 'updatedDate', 'resolvedDate', 'priority']).optional().default('updatedDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List bug budgets
router.get('/bug-budget', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view bug budgets',
        },
      });
    }

    const query = listBugBudgetSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.project) {
      where.project = query.project;
    }

    if (query.projectId) {
      where.projectId = BigInt(query.projectId);
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.issueType) {
      where.issueType = query.issueType;
    }

    if (query.priority) {
      where.priority = query.priority;
    }

    if (query.severityIssue) {
      where.severityIssue = query.severityIssue;
    }

    if (query.sprint) {
      where.sprint = query.sprint;
    }

    if (query.isOpen !== undefined) {
      where.isOpen = query.isOpen;
    }

    if (query.assigneeId) {
      where.assigneeId = BigInt(query.assigneeId);
    }

    if (query.search) {
      where.OR = [
        { jiraKey: { contains: query.search, mode: 'insensitive' } },
        { summary: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [bugs, total] = await Promise.all([
      prisma.bugBudget.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          projectRef: {
            select: {
              id: true,
              title: true,
            },
          },
          assigneeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          reporterUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creatorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.bugBudget.count({ where }),
    ]);

    res.json({
      data: {
        bugs: bugs.map((b) => ({
          id: b.id.toString(),
          jiraKey: b.jiraKey,
          project: b.project,
          projectId: b.projectId?.toString() || null,
          projectRef: b.projectRef ? {
            id: b.projectRef.id.toString(),
            title: b.projectRef.title,
          } : null,
          summary: b.summary,
          status: b.status,
          issueType: b.issueType,
          finalIssueType: b.finalIssueType,
          priority: b.priority,
          severityIssue: b.severityIssue,
          sprint: b.sprint,
          statusCategory: b.statusCategory,
          assigneeFinal: b.assigneeFinal,
          assigneeUser: b.assigneeUser ? {
            id: b.assigneeUser.id.toString(),
            name: b.assigneeUser.name,
            email: b.assigneeUser.email,
          } : null,
          reporter: b.reporter,
          reporterUser: b.reporterUser ? {
            id: b.reporterUser.id.toString(),
            name: b.reporterUser.name,
            email: b.reporterUser.email,
          } : null,
          creator: b.creator,
          creatorUser: b.creatorUser ? {
            id: b.creatorUser.id.toString(),
            name: b.creatorUser.name,
            email: b.creatorUser.email,
          } : null,
          labels: b.labels,
          isOpen: b.isOpen,
          createdDate: b.createdDate?.toISOString() || null,
          updatedDate: b.updatedDate?.toISOString() || null,
          resolvedDate: b.resolvedDate?.toISOString() || null,
          dueDate: b.dueDate?.toISOString() || null,
          lastSyncedAt: b.lastSyncedAt?.toISOString() || null,
          description: b.description,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
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
    logger.error('List bug budget error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching bug budgets',
      },
    });
  }
});

// Get bug budget by ID
router.get('/bug-budget/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const bugId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view bug budgets',
        },
      });
    }

    const bug = await prisma.bugBudget.findUnique({
      where: { id: bugId },
      include: {
        projectRef: {
          select: {
            id: true,
            title: true,
          },
        },
        assigneeUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reporterUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creatorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        metadata: true,
      },
    });

    if (!bug) {
      return res.status(404).json({
        error: {
          code: 'BUG_NOT_FOUND',
          message: 'Bug budget not found',
        },
      });
    }

    res.json({
      data: {
        bug: {
          id: bug.id.toString(),
          jiraKey: bug.jiraKey,
          project: bug.project,
          projectId: bug.projectId?.toString() || null,
          projectRef: bug.projectRef ? {
            id: bug.projectRef.id.toString(),
            title: bug.projectRef.title,
          } : null,
          summary: bug.summary,
          status: bug.status,
          issueType: bug.issueType,
          finalIssueType: bug.finalIssueType,
          priority: bug.priority,
          severityIssue: bug.severityIssue,
          sprint: bug.sprint,
          statusCategory: bug.statusCategory,
          assigneeFinal: bug.assigneeFinal,
          assigneeUser: bug.assigneeUser ? {
            id: bug.assigneeUser.id.toString(),
            name: bug.assigneeUser.name,
            email: bug.assigneeUser.email,
          } : null,
          reporter: bug.reporter,
          reporterUser: bug.reporterUser ? {
            id: bug.reporterUser.id.toString(),
            name: bug.reporterUser.name,
            email: bug.reporterUser.email,
          } : null,
          creator: bug.creator,
          creatorUser: bug.creatorUser ? {
            id: bug.creatorUser.id.toString(),
            name: bug.creatorUser.name,
            email: bug.creatorUser.email,
          } : null,
          labels: bug.labels,
          isOpen: bug.isOpen,
          createdDate: bug.createdDate?.toISOString() || null,
          updatedDate: bug.updatedDate?.toISOString() || null,
          resolvedDate: bug.resolvedDate?.toISOString() || null,
          dueDate: bug.dueDate?.toISOString() || null,
          lastSyncedAt: bug.lastSyncedAt?.toISOString() || null,
          description: bug.description,
          metadata: bug.metadata ? {
            epicHierarchy: bug.metadata.epicHierarchy,
            assigneeDetails: bug.metadata.assigneeDetails,
            dateFields: bug.metadata.dateFields,
            analysisFields: bug.metadata.analysisFields,
            classificationFields: bug.metadata.classificationFields,
            reportFields: bug.metadata.reportFields,
            storyPointsData: bug.metadata.storyPointsData,
            versionFields: bug.metadata.versionFields,
            rawJiraData: bug.metadata.rawJiraData,
          } : null,
          createdAt: bug.createdAt.toISOString(),
          updatedAt: bug.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get bug budget error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching bug budget',
      },
    });
  }
});

// Create bug budget
router.post('/bug-budget', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const data = createBugBudgetSchema.parse(req.body);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create bug budgets',
        },
      });
    }

    // Verify project exists if projectId is provided
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: BigInt(data.projectId),
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
    }

    const bug = await prisma.bugBudget.create({
      data: {
        jiraKey: data.jiraKey.trim(),
        project: data.project.trim(),
        projectId: data.projectId ? BigInt(data.projectId) : null,
        summary: data.summary.trim(),
        status: data.status?.trim() || null,
        issueType: data.issueType?.trim() || null,
        finalIssueType: data.finalIssueType?.trim() || null,
        priority: data.priority?.trim() || null,
        severityIssue: data.severityIssue?.trim() || null,
        sprint: data.sprint?.trim() || null,
        statusCategory: data.statusCategory?.trim() || null,
        assigneeFinal: data.assigneeFinal?.trim() || null,
        assigneeId: data.assigneeId ? BigInt(data.assigneeId) : null,
        reporter: data.reporter?.trim() || null,
        reporterId: data.reporterId ? BigInt(data.reporterId) : null,
        creator: data.creator?.trim() || null,
        creatorId: data.creatorId ? BigInt(data.creatorId) : null,
        labels: data.labels?.trim() || null,
        isOpen: data.isOpen !== undefined ? data.isOpen : true,
        createdDate: data.createdDate || null,
        updatedDate: data.updatedDate || null,
        resolvedDate: data.resolvedDate || null,
        dueDate: data.dueDate || null,
        description: data.description?.trim() || null,
      },
      include: {
        projectRef: {
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
          modelType: 'bug_budget',
          modelId: bug.id,
          oldValues: {},
          newValues: {
            jiraKey: bug.jiraKey,
            project: bug.project,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Bug budget created: ${bug.jiraKey} by user ${userId}`);

    res.status(201).json({
      data: {
        bug: {
          id: bug.id.toString(),
          jiraKey: bug.jiraKey,
          project: bug.project,
          projectId: bug.projectId?.toString() || null,
          projectRef: bug.projectRef ? {
            id: bug.projectRef.id.toString(),
            title: bug.projectRef.title,
          } : null,
          summary: bug.summary,
          status: bug.status,
          isOpen: bug.isOpen,
          createdAt: bug.createdAt.toISOString(),
          updatedAt: bug.updatedAt.toISOString(),
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
    logger.error('Create bug budget error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating bug budget',
      },
    });
  }
});

// Update bug budget
router.patch('/bug-budget/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const bugId = BigInt(req.params.id);
    const data = updateBugBudgetSchema.parse(req.body);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update bug budgets',
        },
      });
    }

    const existing = await prisma.bugBudget.findUnique({
      where: { id: bugId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'BUG_NOT_FOUND',
          message: 'Bug budget not found',
        },
      });
    }

    // Verify project exists if projectId is being updated
    if (data.projectId !== undefined && data.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: BigInt(data.projectId),
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
    }

    const oldValues = {
      project: existing.project,
      summary: existing.summary,
      status: existing.status,
      isOpen: existing.isOpen,
    };

    const updateData: any = {};

    if (data.project !== undefined) updateData.project = data.project.trim();
    if (data.projectId !== undefined) updateData.projectId = data.projectId ? BigInt(data.projectId) : null;
    if (data.summary !== undefined) updateData.summary = data.summary.trim();
    if (data.status !== undefined) updateData.status = data.status?.trim() || null;
    if (data.issueType !== undefined) updateData.issueType = data.issueType?.trim() || null;
    if (data.finalIssueType !== undefined) updateData.finalIssueType = data.finalIssueType?.trim() || null;
    if (data.priority !== undefined) updateData.priority = data.priority?.trim() || null;
    if (data.severityIssue !== undefined) updateData.severityIssue = data.severityIssue?.trim() || null;
    if (data.sprint !== undefined) updateData.sprint = data.sprint?.trim() || null;
    if (data.statusCategory !== undefined) updateData.statusCategory = data.statusCategory?.trim() || null;
    if (data.assigneeFinal !== undefined) updateData.assigneeFinal = data.assigneeFinal?.trim() || null;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId ? BigInt(data.assigneeId) : null;
    if (data.reporter !== undefined) updateData.reporter = data.reporter?.trim() || null;
    if (data.reporterId !== undefined) updateData.reporterId = data.reporterId ? BigInt(data.reporterId) : null;
    if (data.creator !== undefined) updateData.creator = data.creator?.trim() || null;
    if (data.creatorId !== undefined) updateData.creatorId = data.creatorId ? BigInt(data.creatorId) : null;
    if (data.labels !== undefined) updateData.labels = data.labels?.trim() || null;
    if (data.isOpen !== undefined) updateData.isOpen = data.isOpen;
    if (data.createdDate !== undefined) updateData.createdDate = data.createdDate;
    if (data.updatedDate !== undefined) updateData.updatedDate = data.updatedDate;
    if (data.resolvedDate !== undefined) updateData.resolvedDate = data.resolvedDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.lastSyncedAt !== undefined) updateData.lastSyncedAt = data.lastSyncedAt;

    const bug = await prisma.bugBudget.update({
      where: { id: bugId },
      data: updateData,
      include: {
        projectRef: {
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
          modelType: 'bug_budget',
          modelId: bug.id,
          oldValues,
          newValues: {
            project: bug.project,
            summary: bug.summary,
            status: bug.status,
            isOpen: bug.isOpen,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Bug budget updated: ${bug.jiraKey} by user ${userId}`);

    res.json({
      data: {
        bug: {
          id: bug.id.toString(),
          jiraKey: bug.jiraKey,
          project: bug.project,
          projectId: bug.projectId?.toString() || null,
          projectRef: bug.projectRef ? {
            id: bug.projectRef.id.toString(),
            title: bug.projectRef.title,
          } : null,
          summary: bug.summary,
          status: bug.status,
          isOpen: bug.isOpen,
          createdAt: bug.createdAt.toISOString(),
          updatedAt: bug.updatedAt.toISOString(),
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
    logger.error('Update bug budget error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating bug budget',
      },
    });
  }
});

// Delete bug budget
router.delete('/bug-budget/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const bugId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete bug budgets',
        },
      });
    }

    const bug = await prisma.bugBudget.findUnique({
      where: { id: bugId },
    });

    if (!bug) {
      return res.status(404).json({
        error: {
          code: 'BUG_NOT_FOUND',
          message: 'Bug budget not found',
        },
      });
    }

    await prisma.bugBudget.delete({
      where: { id: bugId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'bug_budget',
          modelId: bugId,
          oldValues: {
            jiraKey: bug.jiraKey,
            project: bug.project,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Bug budget deleted: ${bug.jiraKey} by user ${userId}`);

    res.json({
      message: 'Bug budget deleted successfully',
    });
  } catch (error) {
    logger.error('Delete bug budget error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting bug budget',
      },
    });
  }
});

export default router;

