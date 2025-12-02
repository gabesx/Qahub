import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Create menu visibility schema
const createMenuVisibilitySchema = z.object({
  menuKey: z.string().min(1, 'Menu key is required').max(255, 'Menu key must be less than 255 characters'),
  menuName: z.string().min(1, 'Menu name is required').max(255, 'Menu name must be less than 255 characters'),
  isVisible: z.boolean().default(true).optional(),
  parentKey: z.string().max(255, 'Parent key must be less than 255 characters').optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
  metadata: z.any().optional().nullable(), // JSON field
});

// Update menu visibility schema
const updateMenuVisibilitySchema = z.object({
  menuName: z.string().min(1, 'Menu name is required').max(255, 'Menu name must be less than 255 characters').optional(),
  isVisible: z.boolean().optional(),
  parentKey: z.string().max(255, 'Parent key must be less than 255 characters').optional().nullable(),
  sortOrder: z.number().int().optional().nullable(),
  metadata: z.any().optional().nullable(), // JSON field
});

// List menu visibilities schema
const listMenuVisibilitiesSchema = z.object({
  parentKey: z.string().optional().nullable(),
  isVisible: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('100'),
  sortBy: z.enum(['menuKey', 'menuName', 'sortOrder', 'createdAt']).optional().default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List menu visibilities
router.get('/menu-visibilities', authenticateToken, async (req, res) => {
  try {
    const query = listMenuVisibilitiesSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.parentKey !== undefined) {
      if (query.parentKey === null || query.parentKey === '') {
        where.parentKey = null;
      } else {
        where.parentKey = query.parentKey;
      }
    }

    if (query.isVisible !== undefined) {
      where.isVisible = query.isVisible;
    }

    const [menus, total] = await Promise.all([
      prisma.menuVisibility.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.menuVisibility.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    menus.forEach((m) => {
      if (m.createdBy) userIds.add(m.createdBy);
      if (m.updatedBy) userIds.add(m.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        menus: menus.map((m) => {
          const createdByUser = m.createdBy ? userMap.get(m.createdBy.toString()) : null;
          const updatedByUser = m.updatedBy ? userMap.get(m.updatedBy.toString()) : null;

          return {
            id: m.id.toString(),
            menuKey: m.menuKey,
            menuName: m.menuName,
            isVisible: m.isVisible,
            parentKey: m.parentKey,
            sortOrder: m.sortOrder,
            metadata: m.metadata,
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
            createdAt: m.createdAt.toISOString(),
            updatedAt: m.updatedAt.toISOString(),
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
    logger.error('List menu visibilities error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching menu visibilities',
      },
    });
  }
});

// Get menu visibility by key
router.get('/menu-visibilities/:menuKey', authenticateToken, async (req, res) => {
  try {
    const menuKey = req.params.menuKey;

    const menu = await prisma.menuVisibility.findUnique({
      where: { menuKey },
    });

    if (!menu) {
      return res.status(404).json({
        error: {
          code: 'MENU_NOT_FOUND',
          message: 'Menu visibility not found',
        },
      });
    }

    // Fetch user details
    const userIds = new Set<bigint>();
    if (menu.createdBy) userIds.add(menu.createdBy);
    if (menu.updatedBy) userIds.add(menu.updatedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = menu.createdBy ? userMap.get(menu.createdBy.toString()) : null;
    const updatedByUser = menu.updatedBy ? userMap.get(menu.updatedBy.toString()) : null;

    res.json({
      data: {
        menu: {
          id: menu.id.toString(),
          menuKey: menu.menuKey,
          menuName: menu.menuName,
          isVisible: menu.isVisible,
          parentKey: menu.parentKey,
          sortOrder: menu.sortOrder,
          metadata: menu.metadata,
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
          createdAt: menu.createdAt.toISOString(),
          updatedAt: menu.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get menu visibility error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching menu visibility',
      },
    });
  }
});

// Create menu visibility
router.post('/menu-visibilities', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createMenuVisibilitySchema.parse(req.body);

    const menu = await prisma.menuVisibility.create({
      data: {
        menuKey: data.menuKey.trim(),
        menuName: data.menuName.trim(),
        isVisible: data.isVisible !== undefined ? data.isVisible : true,
        parentKey: data.parentKey?.trim() || null,
        sortOrder: data.sortOrder || null,
        metadata: data.metadata || null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'menu_visibility',
          modelId: menu.id,
          oldValues: {},
          newValues: {
            menuKey: menu.menuKey,
            menuName: menu.menuName,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Menu visibility created: ${menu.menuKey} by user ${userId}`);

    res.status(201).json({
      data: {
        menu: {
          id: menu.id.toString(),
          menuKey: menu.menuKey,
          menuName: menu.menuName,
          isVisible: menu.isVisible,
          parentKey: menu.parentKey,
          sortOrder: menu.sortOrder,
          metadata: menu.metadata,
          createdAt: menu.createdAt.toISOString(),
          updatedAt: menu.updatedAt.toISOString(),
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
    logger.error('Create menu visibility error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating menu visibility',
      },
    });
  }
});

// Update menu visibility
router.patch('/menu-visibilities/:menuKey', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const menuKey = req.params.menuKey;

    const existing = await prisma.menuVisibility.findUnique({
      where: { menuKey },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'MENU_NOT_FOUND',
          message: 'Menu visibility not found',
        },
      });
    }

    const data = updateMenuVisibilitySchema.parse(req.body);

    const oldValues = {
      menuName: existing.menuName,
      isVisible: existing.isVisible,
      parentKey: existing.parentKey,
      sortOrder: existing.sortOrder,
      metadata: existing.metadata,
    };

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.menuName !== undefined) updateData.menuName = data.menuName.trim();
    if (data.isVisible !== undefined) updateData.isVisible = data.isVisible;
    if (data.parentKey !== undefined) updateData.parentKey = data.parentKey?.trim() || null;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.metadata !== undefined) updateData.metadata = data.metadata || null;

    const menu = await prisma.menuVisibility.update({
      where: { menuKey },
      data: updateData,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'menu_visibility',
          modelId: menu.id,
          oldValues,
          newValues: {
            menuName: menu.menuName,
            isVisible: menu.isVisible,
            parentKey: menu.parentKey,
            sortOrder: menu.sortOrder,
            metadata: menu.metadata,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Menu visibility updated: ${menu.menuKey} by user ${userId}`);

    res.json({
      data: {
        menu: {
          id: menu.id.toString(),
          menuKey: menu.menuKey,
          menuName: menu.menuName,
          isVisible: menu.isVisible,
          parentKey: menu.parentKey,
          sortOrder: menu.sortOrder,
          metadata: menu.metadata,
          createdAt: menu.createdAt.toISOString(),
          updatedAt: menu.updatedAt.toISOString(),
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
    logger.error('Update menu visibility error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating menu visibility',
      },
    });
  }
});

// Get menu visibility tree (hierarchical structure)
router.get('/menu-visibilities/tree', authenticateToken, async (req, res) => {
  try {
    const menus = await prisma.menuVisibility.findMany({
      where: { isVisible: true },
      orderBy: [
        { parentKey: 'asc' },
        { sortOrder: 'asc' },
        { menuKey: 'asc' },
      ],
    });

    // Build tree structure
    const menuMap = new Map(menus.map((m) => [m.menuKey, { ...m, children: [] }]));
    const rootMenus: any[] = [];

    menus.forEach((menu) => {
      const menuNode = menuMap.get(menu.menuKey)!;
      if (menu.parentKey) {
        const parent = menuMap.get(menu.parentKey);
        if (parent) {
          parent.children.push(menuNode);
        } else {
          // Parent not found or not visible, treat as root
          rootMenus.push(menuNode);
        }
      } else {
        rootMenus.push(menuNode);
      }
    });

    res.json({
      data: {
        tree: rootMenus.map((m) => ({
          id: m.id.toString(),
          menuKey: m.menuKey,
          menuName: m.menuName,
          isVisible: m.isVisible,
          sortOrder: m.sortOrder,
          metadata: m.metadata,
          children: m.children.map((c: any) => ({
            id: c.id.toString(),
            menuKey: c.menuKey,
            menuName: c.menuName,
            isVisible: c.isVisible,
            sortOrder: c.sortOrder,
            metadata: c.metadata,
            children: c.children || [],
          })),
        })),
      },
    });
  } catch (error) {
    logger.error('Get menu visibility tree error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching menu visibility tree',
      },
    });
  }
});

// Bulk update menu visibilities
router.patch('/menu-visibilities/bulk', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const updates = z.array(z.object({
      menuKey: z.string().min(1),
      isVisible: z.boolean().optional(),
      sortOrder: z.number().int().optional().nullable(),
    })).parse(req.body);

    const results = await Promise.allSettled(
      updates.map(async (update) => {
        const existing = await prisma.menuVisibility.findUnique({
          where: { menuKey: update.menuKey },
        });

        if (!existing) {
          throw new Error(`Menu visibility ${update.menuKey} not found`);
        }

        const oldValues = {
          isVisible: existing.isVisible,
          sortOrder: existing.sortOrder,
        };

        const menu = await prisma.menuVisibility.update({
          where: { menuKey: update.menuKey },
          data: {
            isVisible: update.isVisible !== undefined ? update.isVisible : existing.isVisible,
            sortOrder: update.sortOrder !== undefined ? update.sortOrder : existing.sortOrder,
            updatedBy: userId,
          },
        });

        // Create audit log
        try {
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'updated',
              modelType: 'menu_visibility',
              modelId: menu.id,
              oldValues,
              newValues: {
                isVisible: menu.isVisible,
                sortOrder: menu.sortOrder,
              },
              ipAddress: req.ip || req.socket.remoteAddress || null,
              userAgent: req.get('user-agent') || null,
            },
          });
        } catch (auditError) {
          logger.warn('Failed to create audit log:', auditError);
        }

        return {
          menuKey: menu.menuKey,
          success: true,
          isVisible: menu.isVisible,
          sortOrder: menu.sortOrder,
        };
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    res.json({
      message: `Bulk update completed: ${successful} successful, ${failed} failed`,
      results: results.map((r) => {
        if (r.status === 'fulfilled') {
          return r.value;
        } else {
          return {
            success: false,
            error: r.reason?.message || 'Unknown error',
          };
        }
      }),
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
    logger.error('Bulk update menu visibilities error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while bulk updating menu visibilities',
      },
    });
  }
});

// Delete menu visibility
router.delete('/menu-visibilities/:menuKey', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const menuKey = req.params.menuKey;

    const menu = await prisma.menuVisibility.findUnique({
      where: { menuKey },
    });

    if (!menu) {
      return res.status(404).json({
        error: {
          code: 'MENU_NOT_FOUND',
          message: 'Menu visibility not found',
        },
      });
    }

    await prisma.menuVisibility.delete({
      where: { menuKey },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'menu_visibility',
          modelId: menu.id,
          oldValues: {
            menuKey: menu.menuKey,
            menuName: menu.menuName,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Menu visibility deleted: ${menuKey} by user ${userId}`);

    res.json({
      message: 'Menu visibility deleted successfully',
    });
  } catch (error) {
    logger.error('Delete menu visibility error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting menu visibility',
      },
    });
  }
});

export default router;

