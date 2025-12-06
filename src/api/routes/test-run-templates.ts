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

// Create template schema
const createTemplateSchema = z.object({
  testPlanId: z.string().min(1, 'Test plan ID is required'),
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().optional().nullable(),
  environment: z.string().max(100, 'Environment must be less than 100 characters').optional().nullable(),
  buildVersion: z.string().max(100, 'Build version must be less than 100 characters').optional().nullable(),
  titlePattern: z.string().max(255, 'Title pattern must be less than 255 characters').optional().nullable(),
  isActive: z.boolean().default(true).optional(),
});

// Update template schema
const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters').optional(),
  description: z.string().optional().nullable(),
  environment: z.string().max(100, 'Environment must be less than 100 characters').optional().nullable(),
  buildVersion: z.string().max(100, 'Build version must be less than 100 characters').optional().nullable(),
  titlePattern: z.string().max(255, 'Title pattern must be less than 255 characters').optional().nullable(),
  isActive: z.boolean().optional(),
});

// List templates schema
const listTemplatesSchema = z.object({
  search: z.string().optional(),
  isActive: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  testPlanId: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test run templates for a project
router.get('/projects/:projectId/test-run-templates', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run templates',
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

    const query = listTemplatesSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.testPlanId) {
      where.testPlanId = BigInt(query.testPlanId);
    }

    const [templates, total] = await Promise.all([
      prisma.testRunTemplate.findMany({
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
        },
      }),
      prisma.testRunTemplate.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    templates.forEach((t) => {
      if (t.createdBy) userIds.add(t.createdBy);
      if (t.updatedBy) userIds.add(t.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        templates: templates.map((t) => ({
          id: t.id.toString(),
          name: t.name,
          description: t.description,
          environment: t.environment,
          buildVersion: t.buildVersion,
          titlePattern: t.titlePattern,
          isActive: t.isActive,
          testPlan: {
            id: t.testPlan.id.toString(),
            title: t.testPlan.title,
          },
          repository: t.repository ? {
            id: t.repository.id.toString(),
            title: t.repository.title,
          } : null,
          createdBy: t.createdBy ? userMap.get(t.createdBy.toString()) : null,
          updatedBy: t.updatedBy ? userMap.get(t.updatedBy.toString()) : null,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
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
    logger.error('List test run templates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run templates',
      },
    });
  }
});

// Get test run template by ID
router.get('/projects/:projectId/test-run-templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const templateId = BigInt(req.params.templateId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run templates',
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

    const template = await prisma.testRunTemplate.findFirst({
      where: {
        id: templateId,
        projectId,
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

    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Test run template not found',
        },
      });
    }

    // Fetch user details
    const userIds = new Set<bigint>();
    if (template.createdBy) userIds.add(template.createdBy);
    if (template.updatedBy) userIds.add(template.updatedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        template: {
          id: template.id.toString(),
          name: template.name,
          description: template.description,
          environment: template.environment,
          buildVersion: template.buildVersion,
          titlePattern: template.titlePattern,
          isActive: template.isActive,
          testPlan: {
            id: template.testPlan.id.toString(),
            title: template.testPlan.title,
          },
          repository: template.repository ? {
            id: template.repository.id.toString(),
            title: template.repository.title,
          } : null,
          createdBy: template.createdBy ? userMap.get(template.createdBy.toString()) : null,
          updatedBy: template.updatedBy ? userMap.get(template.updatedBy.toString()) : null,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get test run template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run template',
      },
    });
  }
});

// Create test run template
router.post('/projects/:projectId/test-run-templates', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test run templates',
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

    const data = createTemplateSchema.parse(req.body);

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

    const template = await prisma.testRunTemplate.create({
      data: {
        projectId,
        repositoryId: testPlan.repositoryId,
        testPlanId: BigInt(data.testPlanId),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        environment: data.environment?.trim() || null,
        buildVersion: data.buildVersion?.trim() || null,
        titlePattern: data.titlePattern?.trim() || null,
        isActive: data.isActive !== false,
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
          modelType: 'test_run_template',
          modelId: template.id,
          oldValues: {},
          newValues: {
            name: template.name,
            testPlanId: template.testPlanId.toString(),
            projectId: template.projectId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run template created: ${template.name} in project ${projectId} by user ${userId}`);

    res.status(201).json({
      data: {
        template: {
          id: template.id.toString(),
          name: template.name,
          description: template.description,
          environment: template.environment,
          buildVersion: template.buildVersion,
          titlePattern: template.titlePattern,
          isActive: template.isActive,
          testPlan: {
            id: template.testPlan.id.toString(),
            title: template.testPlan.title,
          },
          repository: template.repository ? {
            id: template.repository.id.toString(),
            title: template.repository.title,
          } : null,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
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
    logger.error('Create test run template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test run template',
      },
    });
  }
});

// Update test run template
router.patch('/projects/:projectId/test-run-templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const templateId = BigInt(req.params.templateId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update test run templates',
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

    const existing = await prisma.testRunTemplate.findFirst({
      where: {
        id: templateId,
        projectId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Test run template not found',
        },
      });
    }

    const data = updateTemplateSchema.parse(req.body);

    const oldValues = {
      name: existing.name,
      description: existing.description,
      environment: existing.environment,
      buildVersion: existing.buildVersion,
      titlePattern: existing.titlePattern,
      isActive: existing.isActive,
    };

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.environment !== undefined) updateData.environment = data.environment?.trim() || null;
    if (data.buildVersion !== undefined) updateData.buildVersion = data.buildVersion?.trim() || null;
    if (data.titlePattern !== undefined) updateData.titlePattern = data.titlePattern?.trim() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    updateData.updatedBy = userId;

    const template = await prisma.testRunTemplate.update({
      where: { id: templateId },
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
          modelType: 'test_run_template',
          modelId: template.id,
          oldValues,
          newValues: {
            name: template.name,
            description: template.description,
            environment: template.environment,
            buildVersion: template.buildVersion,
            titlePattern: template.titlePattern,
            isActive: template.isActive,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run template updated: ${template.id} by user ${userId}`);

    res.json({
      data: {
        template: {
          id: template.id.toString(),
          name: template.name,
          description: template.description,
          environment: template.environment,
          buildVersion: template.buildVersion,
          titlePattern: template.titlePattern,
          isActive: template.isActive,
          testPlan: {
            id: template.testPlan.id.toString(),
            title: template.testPlan.title,
          },
          repository: template.repository ? {
            id: template.repository.id.toString(),
            title: template.repository.title,
          } : null,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
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
    logger.error('Update test run template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test run template',
      },
    });
  }
});

// Delete test run template
router.delete('/projects/:projectId/test-run-templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const templateId = BigInt(req.params.templateId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete test run templates',
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

    const template = await prisma.testRunTemplate.findFirst({
      where: {
        id: templateId,
        projectId,
      },
    });

    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Test run template not found',
        },
      });
    }

    // Check if template has active schedules
    const activeSchedules = await prisma.scheduledTestRun.count({
      where: {
        templateId,
        status: 'active',
      },
    });

    if (activeSchedules > 0) {
      return res.status(400).json({
        error: {
          code: 'TEMPLATE_HAS_ACTIVE_SCHEDULES',
          message: `Cannot delete template with ${activeSchedules} active schedule(s). Please pause or cancel schedules first.`,
        },
      });
    }

    await prisma.testRunTemplate.delete({
      where: { id: templateId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'test_run_template',
          modelId: template.id,
          oldValues: {
            name: template.name,
            testPlanId: template.testPlanId.toString(),
            projectId: template.projectId.toString(),
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run template deleted: ${template.id} by user ${userId}`);

    res.status(204).send();
  } catch (error) {
    logger.error('Delete test run template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting test run template',
      },
    });
  }
});

export default router;

