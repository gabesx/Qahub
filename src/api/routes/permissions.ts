import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const GUARD_NAME = 'web';

// Create permission schema
const createPermissionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  guardName: z.string().default(GUARD_NAME).optional(),
});

// Update permission schema
const updatePermissionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters').optional(),
});

// List permissions schema
const listPermissionsSchema = z.object({
  search: z.string().optional(),
  guardName: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  sortBy: z.enum(['name', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List permissions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = listPermissionsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }
    if (query.guardName) {
      where.guardName = query.guardName;
    } else {
      where.guardName = GUARD_NAME;
    }

    const [permissions, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          _count: {
            select: {
              userPermissions: true,
              rolePermissions: true,
            },
          },
        },
      }),
      prisma.permission.count({ where }),
    ]);

    res.json({
      data: {
        permissions: permissions.map((p) => ({
          id: p.id.toString(),
          name: p.name,
          guardName: p.guardName,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          counts: {
            users: p._count.userPermissions,
            roles: p._count.rolePermissions,
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
    logger.error('List permissions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching permissions',
      },
    });
  }
});

// Get permission by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const permissionId = BigInt(req.params.id);

    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        _count: {
          select: {
            userPermissions: true,
            rolePermissions: true,
          },
        },
        userPermissions: {
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        rolePermissions: {
          take: 10,
          include: {
            role: {
              select: {
                id: true,
                name: true,
                guardName: true,
              },
            },
          },
        },
      },
    });

    if (!permission) {
      return res.status(404).json({
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permission not found',
        },
      });
    }

    res.json({
      data: {
        permission: {
          id: permission.id.toString(),
          name: permission.name,
          guardName: permission.guardName,
          createdAt: permission.createdAt.toISOString(),
          updatedAt: permission.updatedAt.toISOString(),
          counts: {
            users: permission._count.userPermissions,
            roles: permission._count.rolePermissions,
          },
          users: permission.userPermissions.map((up) => ({
            id: up.user.id.toString(),
            name: up.user.name,
            email: up.user.email,
          })),
          roles: permission.rolePermissions.map((rp) => ({
            id: rp.role.id.toString(),
            name: rp.role.name,
            guardName: rp.role.guardName,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Get permission error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching permission',
      },
    });
  }
});

// Create permission
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createPermissionSchema.parse(req.body);

    // Check if permission already exists
    const existing = await prisma.permission.findUnique({
      where: {
        name_guardName: {
          name: data.name,
          guardName: data.guardName || GUARD_NAME,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: 'PERMISSION_ALREADY_EXISTS',
          message: 'Permission with this name and guard already exists',
        },
      });
    }

    const permission = await prisma.permission.create({
      data: {
        name: data.name.trim(),
        guardName: data.guardName || GUARD_NAME,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'permission',
          modelId: permission.id,
          oldValues: null,
          newValues: {
            name: permission.name,
            guardName: permission.guardName,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Permission created: ${permission.name} by user ${userId}`);

    res.status(201).json({
      data: {
        permission: {
          id: permission.id.toString(),
          name: permission.name,
          guardName: permission.guardName,
          createdAt: permission.createdAt.toISOString(),
          updatedAt: permission.updatedAt.toISOString(),
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
    logger.error('Create permission error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating permission',
      },
    });
  }
});

// Update permission
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const permissionId = BigInt(req.params.id);
    const data = updatePermissionSchema.parse(req.body);

    const existing = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permission not found',
        },
      });
    }

    // Check if new name conflicts with existing permission
    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.permission.findUnique({
        where: {
          name_guardName: {
            name: data.name,
            guardName: existing.guardName,
          },
        },
      });

      if (conflict) {
        return res.status(409).json({
          error: {
            code: 'PERMISSION_ALREADY_EXISTS',
            message: 'Permission with this name and guard already exists',
          },
        });
      }
    }

    const oldValues = {
      name: existing.name,
      guardName: existing.guardName,
    };

    const permission = await prisma.permission.update({
      where: { id: permissionId },
      data: {
        ...(data.name && { name: data.name.trim() }),
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'permission',
          modelId: permission.id,
          oldValues,
          newValues: {
            name: permission.name,
            guardName: permission.guardName,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Permission updated: ${permission.name} by user ${userId}`);

    res.json({
      data: {
        permission: {
          id: permission.id.toString(),
          name: permission.name,
          guardName: permission.guardName,
          createdAt: permission.createdAt.toISOString(),
          updatedAt: permission.updatedAt.toISOString(),
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
    logger.error('Update permission error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating permission',
      },
    });
  }
});

// Delete permission
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const permissionId = BigInt(req.params.id);

    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        _count: {
          select: {
            userPermissions: true,
            rolePermissions: true,
          },
        },
      },
    });

    if (!permission) {
      return res.status(404).json({
        error: {
          code: 'PERMISSION_NOT_FOUND',
          message: 'Permission not found',
        },
      });
    }

    // Check if permission is in use
    if (permission._count.userPermissions > 0 || permission._count.rolePermissions > 0) {
      return res.status(409).json({
        error: {
          code: 'PERMISSION_IN_USE',
          message: 'Cannot delete permission that is assigned to users or roles',
          details: {
            usersCount: permission._count.userPermissions,
            rolesCount: permission._count.rolePermissions,
          },
        },
      });
    }

    await prisma.permission.delete({
      where: { id: permissionId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'permission',
          modelId: permissionId,
          oldValues: {
            name: permission.name,
            guardName: permission.guardName,
          },
          newValues: null,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Permission deleted: ${permission.name} by user ${userId}`);

    res.json({
      message: 'Permission deleted successfully',
    });
  } catch (error) {
    logger.error('Delete permission error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting permission',
      },
    });
  }
});

export default router;

