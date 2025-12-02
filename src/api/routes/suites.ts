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

// Create suite schema
const createSuiteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  parentId: z.string().optional().nullable(),
  order: z.number().int().optional().nullable(),
});

// Update suite schema
const updateSuiteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  parentId: z.string().optional().nullable(),
  order: z.number().int().optional().nullable(),
});

// List suites schema
const listSuitesSchema = z.object({
  parentId: z.string().optional().nullable(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['title', 'order', 'createdAt']).optional().default('order'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List suites for a repository
router.get('/projects/:projectId/repositories/:repoId/suites', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view suites',
        },
      });
    }

    // Verify project and repository exist and belong to tenant
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

    const query = listSuitesSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      repositoryId: repoId,
    };

    if (query.parentId === null || query.parentId === 'null') {
      where.parentId = null;
    } else if (query.parentId) {
      where.parentId = BigInt(query.parentId);
    }

    const [suites, total] = await Promise.all([
      prisma.suite.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          _count: {
            select: {
              children: true,
              testCases: true,
            },
          },
          parent: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.suite.count({ where }),
    ]);

    res.json({
      data: {
        suites: suites.map((suite) => ({
          id: suite.id.toString(),
          title: suite.title,
          parentId: suite.parentId?.toString() || null,
          parent: suite.parent ? {
            id: suite.parent.id.toString(),
            title: suite.parent.title,
          } : null,
          order: suite.order,
          createdAt: suite.createdAt.toISOString(),
          updatedAt: suite.updatedAt.toISOString(),
          counts: {
            children: suite._count.children,
            testCases: suite._count.testCases,
          },
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
    logger.error('List suites error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching suites',
      },
    });
  }
});

// Get suite by ID
router.get('/projects/:projectId/repositories/:repoId/suites/:suiteId', authenticateToken, async (req, res) => {
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
          message: 'You must belong to a tenant to view suites',
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

    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
      },
      include: {
        _count: {
          select: {
            children: true,
            testCases: true,
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
        children: {
          take: 10,
          select: {
            id: true,
            title: true,
            order: true,
          },
          orderBy: {
            order: 'asc',
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

    res.json({
      data: {
        suite: {
          id: suite.id.toString(),
          title: suite.title,
          parentId: suite.parentId?.toString() || null,
          parent: suite.parent ? {
            id: suite.parent.id.toString(),
            title: suite.parent.title,
          } : null,
          order: suite.order,
          createdAt: suite.createdAt.toISOString(),
          updatedAt: suite.updatedAt.toISOString(),
          counts: {
            children: suite._count.children,
            testCases: suite._count.testCases,
          },
          children: suite.children.map((child) => ({
            id: child.id.toString(),
            title: child.title,
            order: child.order,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Get suite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching suite',
      },
    });
  }
});

// Create suite
router.post('/projects/:projectId/repositories/:repoId/suites', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const repoId = BigInt(req.params.repoId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create suites',
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

    const data = createSuiteSchema.parse(req.body);

    // Verify parent suite exists if provided
    let parentId: bigint | null = null;
    if (data.parentId) {
      const parent = await prisma.suite.findFirst({
        where: {
          id: BigInt(data.parentId),
          repositoryId: repoId,
        },
      });

      if (!parent) {
        return res.status(400).json({
          error: {
            code: 'PARENT_SUITE_NOT_FOUND',
            message: 'Parent suite not found',
          },
        });
      }
      parentId = parent.id;
    }

    const suite = await prisma.suite.create({
      data: {
        repositoryId: repoId,
        title: data.title.trim(),
        parentId,
        order: data.order || null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        parent: {
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
          modelType: 'suite',
          modelId: suite.id,
          oldValues: null,
          newValues: {
            title: suite.title,
            parentId: suite.parentId?.toString() || null,
            order: suite.order,
            repositoryId: suite.repositoryId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Suite created: ${suite.title} in repository ${repoId} by user ${userId}`);

    res.status(201).json({
      data: {
        suite: {
          id: suite.id.toString(),
          title: suite.title,
          parentId: suite.parentId?.toString() || null,
          parent: suite.parent ? {
            id: suite.parent.id.toString(),
            title: suite.parent.title,
          } : null,
          order: suite.order,
          createdAt: suite.createdAt.toISOString(),
          updatedAt: suite.updatedAt.toISOString(),
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
    logger.error('Create suite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating suite',
      },
    });
  }
});

// Update suite
router.patch('/projects/:projectId/repositories/:repoId/suites/:suiteId', authenticateToken, async (req, res) => {
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
          message: 'You must belong to a tenant to update suites',
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

    const existing = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'SUITE_NOT_FOUND',
          message: 'Suite not found',
        },
      });
    }

    const data = updateSuiteSchema.parse(req.body);

    // Verify parent suite exists if provided and not creating circular reference
    let parentId: bigint | null | undefined = undefined;
    if (data.parentId !== undefined) {
      if (data.parentId === null) {
        parentId = null;
      } else {
        // Prevent self-reference
        if (BigInt(data.parentId) === suiteId) {
          return res.status(400).json({
            error: {
              code: 'INVALID_PARENT',
              message: 'Suite cannot be its own parent',
            },
          });
        }

        const parent = await prisma.suite.findFirst({
          where: {
            id: BigInt(data.parentId),
            repositoryId: repoId,
          },
        });

        if (!parent) {
          return res.status(400).json({
            error: {
              code: 'PARENT_SUITE_NOT_FOUND',
              message: 'Parent suite not found',
            },
          });
        }

        // Prevent circular reference (parent cannot be a descendant)
        let current = parent;
        while (current.parentId) {
          if (current.parentId === suiteId) {
            return res.status(400).json({
              error: {
                code: 'CIRCULAR_REFERENCE',
                message: 'Cannot create circular reference in suite hierarchy',
              },
            });
          }
          current = await prisma.suite.findUnique({
            where: { id: current.parentId },
          }) as any;
          if (!current) break;
        }

        parentId = parent.id;
      }
    }

    const oldValues = {
      title: existing.title,
      parentId: existing.parentId?.toString() || null,
      order: existing.order,
    };

    const suite = await prisma.suite.update({
      where: { id: suiteId },
      data: {
        ...(data.title && { title: data.title.trim() }),
        ...(parentId !== undefined && { parentId }),
        ...(data.order !== undefined && { order: data.order }),
        updatedBy: userId,
      },
      include: {
        parent: {
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
          modelType: 'suite',
          modelId: suite.id,
          oldValues,
          newValues: {
            title: suite.title,
            parentId: suite.parentId?.toString() || null,
            order: suite.order,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Suite updated: ${suite.title} by user ${userId}`);

    res.json({
      data: {
        suite: {
          id: suite.id.toString(),
          title: suite.title,
          parentId: suite.parentId?.toString() || null,
          parent: suite.parent ? {
            id: suite.parent.id.toString(),
            title: suite.parent.title,
          } : null,
          order: suite.order,
          createdAt: suite.createdAt.toISOString(),
          updatedAt: suite.updatedAt.toISOString(),
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
    logger.error('Update suite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating suite',
      },
    });
  }
});

// Delete suite
router.delete('/projects/:projectId/repositories/:repoId/suites/:suiteId', authenticateToken, async (req, res) => {
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
          message: 'You must belong to a tenant to delete suites',
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

    const suite = await prisma.suite.findFirst({
      where: {
        id: suiteId,
        repositoryId: repoId,
      },
      include: {
        _count: {
          select: {
            children: true,
            testCases: true,
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

    // Check if suite has children or test cases
    if (suite._count.children > 0 || suite._count.testCases > 0) {
      return res.status(409).json({
        error: {
          code: 'SUITE_IN_USE',
          message: 'Cannot delete suite that has children or test cases',
          details: {
            childrenCount: suite._count.children,
            testCasesCount: suite._count.testCases,
          },
        },
      });
    }

    await prisma.suite.delete({
      where: { id: suiteId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'suite',
          modelId: suiteId,
          oldValues: {
            title: suite.title,
            parentId: suite.parentId?.toString() || null,
            order: suite.order,
          },
          newValues: null,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Suite deleted: ${suite.title} by user ${userId}`);

    res.json({
      message: 'Suite deleted successfully',
    });
  } catch (error) {
    logger.error('Delete suite error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting suite',
      },
    });
  }
});

export default router;

