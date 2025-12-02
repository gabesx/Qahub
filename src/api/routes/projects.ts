import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Create project schema
const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
  tenantId: z.string().optional(), // Will use user's primary tenant if not provided
});

// Update project schema
const updateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  description: z.string().max(500, 'Description must be less than 500 characters').optional().nullable(),
});

// List projects with filters
const listProjectsSchema = z.object({
  search: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Create repository schema
const createRepositorySchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  prefix: z.string().min(1, 'Prefix is required').max(50, 'Prefix must be less than 50 characters'),
  description: z.string().max(255, 'Description must be less than 255 characters').optional().nullable(),
});

// Get user's primary tenant ID, or assign to default tenant if none exists
async function getUserPrimaryTenant(userId: bigint): Promise<bigint | null> {
  let tenantUser = await prisma.tenantUser.findFirst({
    where: { userId },
    include: { tenant: true },
    orderBy: { joinedAt: 'asc' }, // Get first tenant (primary)
  });

  // If user has no tenant, assign them to the default tenant
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

// Get project statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.json({
        data: {
          projects: 0,
          squads: 0,
          testPlans: 0,
          testRuns: 0,
        },
      });
    }

    const [projectsCount, repositoriesCount, testPlansCount, testRunsCount] = await Promise.all([
      prisma.project.count({
        where: { tenantId },
      }),
      prisma.repository.count({
        where: { tenantId },
      }),
      prisma.testPlan.count({
        where: {
          project: {
            tenantId,
          },
        },
      }),
      prisma.testRun.count({
        where: {
          project: {
            tenantId,
          },
        },
      }),
    ]);

    res.json({
      data: {
        projects: projectsCount,
        squads: repositoriesCount, // Using repositories as "Squads"
        testPlans: testPlansCount,
        testRuns: testRunsCount,
      },
    });
  } catch (error) {
    logger.error('Get project stats error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching project statistics',
      },
    });
  }
});

// List projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.json({
        data: {
          projects: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        },
      });
    }

    const query = listProjectsSchema.parse(req.query);
    const pageNum = parseInt(query.page, 10);
    const limitNum = parseInt(query.limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {
      tenantId,
    };

    if (query.search) {
      whereClause.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: whereClause,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take: limitNum,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              repositories: true,
              testPlans: true,
              testRuns: true,
              documents: true,
            },
          },
        },
      }),
      prisma.project.count({ where: whereClause }),
    ]);

    res.json({
      data: {
        projects: projects.map(project => ({
          id: project.id.toString(),
          title: project.title,
          description: project.description,
          createdBy: project.createdBy?.toString() || null,
          creator: project.creator ? {
            id: project.creator.id.toString(),
            name: project.creator.name,
            email: project.creator.email,
            avatar: project.creator.avatar,
          } : null,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          counts: {
            repositories: project._count.repositories,
            testPlans: project._count.testPlans,
            testRuns: project._count.testRuns,
            documents: project._count.documents,
          },
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
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
    logger.error('List projects error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching projects',
      },
    });
  }
});

// Get project by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.id);

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: tenantId || undefined, // Only if user has a tenant
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            repositories: true,
            testPlans: true,
            testRuns: true,
            documents: true,
          },
        },
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

    res.json({
      data: {
        project: {
          id: project.id.toString(),
          title: project.title,
          description: project.description,
          createdBy: project.createdBy?.toString() || null,
          updatedBy: project.updatedBy?.toString() || null,
          creator: project.creator ? {
            id: project.creator.id.toString(),
            name: project.creator.name,
            email: project.creator.email,
            avatar: project.creator.avatar,
          } : null,
          updater: project.updater ? {
            id: project.updater.id.toString(),
            name: project.updater.name,
            email: project.updater.email,
            avatar: project.updater.avatar,
          } : null,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          counts: {
            repositories: project._count.repositories,
            testPlans: project._count.testPlans,
            testRuns: project._count.testRuns,
            documents: project._count.documents,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Get project error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching project',
      },
    });
  }
});

// Create project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create projects',
        },
      });
    }

    const data = createProjectSchema.parse(req.body);

    // Check tenant project limit
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxProjects: true, _count: { select: { projects: true } } },
    });

    if (tenant && tenant._count.projects >= tenant.maxProjects) {
      return res.status(403).json({
        error: {
          code: 'PROJECT_LIMIT_REACHED',
          message: `You have reached the maximum number of projects (${tenant.maxProjects}) for your plan`,
        },
      });
    }

    const project = await prisma.project.create({
      data: {
        tenantId,
        title: data.title,
        description: data.description || null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            repositories: true,
            testPlans: true,
            testRuns: true,
            documents: true,
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
          modelType: 'project',
          modelId: project.id,
          oldValues: null,
          newValues: {
            title: project.title,
            description: project.description,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Project created: ${project.title} by user ${userId}`);

    res.status(201).json({
      data: {
        project: {
          id: project.id.toString(),
          title: project.title,
          description: project.description,
          createdBy: project.createdBy?.toString() || null,
          creator: project.creator ? {
            id: project.creator.id.toString(),
            name: project.creator.name,
            email: project.creator.email,
            avatar: project.creator.avatar,
          } : null,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          counts: {
            repositories: project._count.repositories,
            testPlans: project._count.testPlans,
            testRuns: project._count.testRuns,
            documents: project._count.documents,
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
    logger.error('Create project error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating project',
      },
    });
  }
});

// Update project
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.id);
    const data = updateProjectSchema.parse(req.body);

    // Check if project exists and belongs to user's tenant
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: tenantId || undefined,
      },
    });

    if (!existingProject) {
      return res.status(404).json({
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    // Build update data
    const updateData: any = {
      updatedBy: userId,
    };
    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        updater: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            repositories: true,
            testPlans: true,
            testRuns: true,
            documents: true,
          },
        },
      },
    });

    // Create audit log
    try {
      const oldValues: any = {};
      const newValues: any = {};

      if (data.title !== undefined) {
        oldValues.title = existingProject.title;
        newValues.title = project.title;
      }
      if (data.description !== undefined) {
        oldValues.description = existingProject.description;
        newValues.description = project.description;
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'project',
          modelId: project.id,
          oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
          newValues: Object.keys(newValues).length > 0 ? newValues : null,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Project updated: ${project.title} by user ${userId}`);

    res.json({
      data: {
        project: {
          id: project.id.toString(),
          title: project.title,
          description: project.description,
          createdBy: project.createdBy?.toString() || null,
          updatedBy: project.updatedBy?.toString() || null,
          creator: project.creator ? {
            id: project.creator.id.toString(),
            name: project.creator.name,
            email: project.creator.email,
            avatar: project.creator.avatar,
          } : null,
          updater: project.updater ? {
            id: project.updater.id.toString(),
            name: project.updater.name,
            email: project.updater.email,
            avatar: project.updater.avatar,
          } : null,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          counts: {
            repositories: project._count.repositories,
            testPlans: project._count.testPlans,
            testRuns: project._count.testRuns,
            documents: project._count.documents,
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
    logger.error('Update project error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating project',
      },
    });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.id);

    // Check if project exists and belongs to user's tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: tenantId || undefined,
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

    // Delete project (cascade will handle related records)
    await prisma.project.delete({
      where: { id: projectId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'project',
          modelId: projectId,
          oldValues: {
            title: project.title,
            description: project.description,
          },
          newValues: null,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Project deleted: ${project.title} by user ${userId}`);

    res.json({
      message: 'Project deleted successfully',
    });
  } catch (error) {
    logger.error('Delete project error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting project',
      },
    });
  }
});

// List repositories for a project
router.get('/:id/repositories', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view repositories',
        },
      });
    }

    // Check if project exists and belongs to user's tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: tenantId || undefined,
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

    // Get repositories for this project
    const repositories = await prisma.repository.findMany({
      where: {
        projectId,
        tenantId,
      },
      include: {
        _count: {
          select: {
            suites: true,
            testPlans: true,
            testRuns: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate test cases count (from suites -> test cases)
    // For now, we'll use a placeholder calculation
    const repositoriesWithCounts = await Promise.all(
      repositories.map(async (repo) => {
        // Count test cases through suites
        const suites = await prisma.suite.findMany({
          where: { repositoryId: repo.id },
          select: { id: true },
        });
        
        const testCasesCount = await prisma.testCase.count({
          where: {
            suiteId: { in: suites.map(s => s.id) },
            tenantId,
            deletedAt: null, // Exclude soft-deleted test cases
          },
        });

        // Count automated test cases
        const automatedCount = await prisma.testCase.count({
          where: {
            suiteId: { in: suites.map(s => s.id) },
            tenantId,
            automated: true,
            deletedAt: null, // Exclude soft-deleted test cases
          },
        });

        const automationPercent = testCasesCount > 0 
          ? Math.round((automatedCount / testCasesCount) * 100) 
          : 0;

        return {
          id: repo.id.toString(),
          title: repo.title,
          prefix: repo.prefix,
          description: repo.description,
          createdAt: repo.createdAt.toISOString(),
          updatedAt: repo.updatedAt.toISOString(),
          counts: {
            suites: repo._count.suites,
            testCases: testCasesCount,
            automation: automationPercent,
          },
        };
      })
    );

    res.json({
      data: {
        repositories: repositoriesWithCounts,
      },
    });
  } catch (error) {
    logger.error('List repositories error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching repositories',
      },
    });
  }
});

// Get repository by ID
router.get('/:id/repositories/:repoId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.id);
    const repoId = BigInt(req.params.repoId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view repositories',
        },
      });
    }

    // Check if project exists and belongs to user's tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: tenantId || undefined,
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

    // Get repository
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

    // Get counts
    const suites = await prisma.suite.findMany({
      where: { repositoryId: repository.id },
      select: { id: true },
    });
    
    const testCasesCount = await prisma.testCase.count({
      where: {
        suiteId: { in: suites.map(s => s.id) },
        tenantId,
        deletedAt: null,
      },
    });

    const automatedCount = await prisma.testCase.count({
      where: {
        suiteId: { in: suites.map(s => s.id) },
        tenantId,
        automated: true,
        deletedAt: null,
      },
    });

    const automationPercent = testCasesCount > 0 
      ? Math.round((automatedCount / testCasesCount) * 100) 
      : 0;

    res.json({
      data: {
        repository: {
          id: repository.id.toString(),
          title: repository.title,
          prefix: repository.prefix,
          description: repository.description,
          createdAt: repository.createdAt.toISOString(),
          updatedAt: repository.updatedAt.toISOString(),
          counts: {
            suites: suites.length,
            testCases: testCasesCount,
            automation: automationPercent,
          },
        },
      },
    });
  } catch (error) {
    logger.error('Get repository error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching repository',
      },
    });
  }
});

// Create repository for a project
router.post('/:id/repositories', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create repositories',
        },
      });
    }

    // Check if project exists and belongs to user's tenant
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        tenantId: tenantId || undefined,
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

    const data = createRepositorySchema.parse(req.body);

    // Create repository
    const repository = await prisma.repository.create({
      data: {
        tenantId,
        projectId,
        title: data.title.trim(),
        prefix: data.prefix.trim().toUpperCase(),
        description: data.description?.trim() || null,
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
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'repository',
          modelId: repository.id,
          oldValues: null,
          newValues: {
            title: repository.title,
            prefix: repository.prefix,
            description: repository.description,
            projectId: repository.projectId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Repository created: ${repository.title} in project ${project.title} by user ${userId}`);

    res.status(201).json({
      data: {
        repository: {
          id: repository.id.toString(),
          title: repository.title,
          prefix: repository.prefix,
          description: repository.description,
          projectId: repository.projectId.toString(),
          createdAt: repository.createdAt.toISOString(),
          updatedAt: repository.updatedAt.toISOString(),
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
    logger.error('Create repository error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating repository',
      },
    });
  }
});

export default router;

