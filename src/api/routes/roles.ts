import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

const GUARD_NAME = 'web';

// Create role schema
const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  guardName: z.string().default(GUARD_NAME).optional(),
});

// Update role schema
const updateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters').optional(),
});

// List roles schema
const listRolesSchema = z.object({
  search: z.string().optional(),
  guardName: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  sortBy: z.enum(['name', 'createdAt']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List roles
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = listRolesSchema.parse(req.query);
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

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          _count: {
            select: {
              userRoles: true,
              rolePermissions: true,
            },
          },
        },
      }),
      prisma.role.count({ where }),
    ]);

    res.json({
      data: {
        roles: roles.map((r) => ({
          id: r.id.toString(),
          name: r.name,
          guardName: r.guardName,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          counts: {
            users: r._count.userRoles,
            permissions: r._count.rolePermissions,
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
    logger.error('List roles error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching roles',
      },
    });
  }
});

// Get role by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const roleId = BigInt(req.params.id);

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true,
          },
        },
        userRoles: {
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
          include: {
            permission: {
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

    if (!role) {
      return res.status(404).json({
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Role not found',
        },
      });
    }

    res.json({
      data: {
        role: {
          id: role.id.toString(),
          name: role.name,
          guardName: role.guardName,
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
          counts: {
            users: role._count.userRoles,
            permissions: role._count.rolePermissions,
          },
          users: role.userRoles.map((ur) => ({
            id: ur.user.id.toString(),
            name: ur.user.name,
            email: ur.user.email,
          })),
          permissions: role.rolePermissions.map((rp) => ({
            id: rp.permission.id.toString(),
            name: rp.permission.name,
            guardName: rp.permission.guardName,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Get role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching role',
      },
    });
  }
});

// Create role
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createRoleSchema.parse(req.body);

    // Check if role already exists
    const existing = await prisma.role.findUnique({
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
          code: 'ROLE_ALREADY_EXISTS',
          message: 'Role with this name and guard already exists',
        },
      });
    }

    const role = await prisma.role.create({
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
          modelType: 'role',
          modelId: role.id,
          oldValues: undefined,
          newValues: {
            name: role.name,
            guardName: role.guardName,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Role created: ${role.name} by user ${userId}`);

    res.status(201).json({
      data: {
        role: {
          id: role.id.toString(),
          name: role.name,
          guardName: role.guardName,
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
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
    logger.error('Create role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating role',
      },
    });
  }
});

// Update role
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const roleId = BigInt(req.params.id);
    const data = updateRoleSchema.parse(req.body);

    const existing = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Role not found',
        },
      });
    }

    // Check if new name conflicts with existing role
    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.role.findUnique({
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
            code: 'ROLE_ALREADY_EXISTS',
            message: 'Role with this name and guard already exists',
          },
        });
      }
    }

    const oldValues = {
      name: existing.name,
      guardName: existing.guardName,
    };

    const role = await prisma.role.update({
      where: { id: roleId },
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
          modelType: 'role',
          modelId: role.id,
          oldValues,
          newValues: {
            name: role.name,
            guardName: role.guardName,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Role updated: ${role.name} by user ${userId}`);

    res.json({
      data: {
        role: {
          id: role.id.toString(),
          name: role.name,
          guardName: role.guardName,
          createdAt: role.createdAt.toISOString(),
          updatedAt: role.updatedAt.toISOString(),
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
    logger.error('Update role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating role',
      },
    });
  }
});

// Delete role
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const roleId = BigInt(req.params.id);

    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true,
          },
        },
      },
    });

    if (!role) {
      return res.status(404).json({
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Role not found',
        },
      });
    }

    // Check if role is in use
    if (role._count.userRoles > 0) {
      return res.status(409).json({
        error: {
          code: 'ROLE_IN_USE',
          message: 'Cannot delete role that is assigned to users',
          details: {
            usersCount: role._count.userRoles,
          },
        },
      });
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'role',
          modelId: roleId,
          oldValues: {
            name: role.name,
            guardName: role.guardName,
          },
          newValues: undefined,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Role deleted: ${role.name} by user ${userId}`);

    res.json({
      message: 'Role deleted successfully',
    });
  } catch (error) {
    logger.error('Delete role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting role',
      },
    });
  }
});

// Assign permissions to role
router.post('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const roleId = BigInt(req.params.id);
    const { permissionIds } = z.object({
      permissionIds: z.array(z.string()).min(1, 'At least one permission ID is required'),
    }).parse(req.body);

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return res.status(404).json({
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Role not found',
        },
      });
    }

    // Verify all permissions exist
    const permissionBigInts = permissionIds.map((id) => BigInt(id));
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionBigInts },
      },
    });

    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PERMISSIONS',
          message: 'One or more permission IDs are invalid',
        },
      });
    }

    // Create role-permission assignments (skip if already exists)
    await prisma.rolePermission.createMany({
      data: permissionBigInts.map((permissionId) => ({
        roleId,
        permissionId,
      })),
      skipDuplicates: true,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'role',
          modelId: roleId,
          oldValues: undefined,
          newValues: {
            permissionsAssigned: permissionIds,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Permissions assigned to role ${role.name} by user ${userId}`);

    res.json({
      message: 'Permissions assigned successfully',
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
    logger.error('Assign permissions to role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while assigning permissions',
      },
    });
  }
});

// Remove permission from role
router.delete('/:id/permissions/:permissionId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const roleId = BigInt(req.params.id);
    const permissionId = BigInt(req.params.permissionId);

    // Verify role exists
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      return res.status(404).json({
        error: {
          code: 'ROLE_NOT_FOUND',
          message: 'Role not found',
        },
      });
    }

    // Remove permission
    await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'role',
          modelId: roleId,
          oldValues: {
            permissionRemoved: permissionId.toString(),
          },
          newValues: undefined,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Permission removed from role ${role.name} by user ${userId}`);

    res.json({
      message: 'Permission removed successfully',
    });
  } catch (error) {
    logger.error('Remove permission from role error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while removing permission',
      },
    });
  }
});

export default router;

