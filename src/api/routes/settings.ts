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

// Create setting schema
const createSettingSchema = z.object({
  key: z.string().min(1, 'Key is required').max(255, 'Key must be less than 255 characters'),
  value: z.string().optional().nullable(),
  type: z.string().max(50, 'Type must be less than 50 characters').default('string').optional(),
  category: z.string().max(100, 'Category must be less than 100 characters').optional().nullable(),
  description: z.string().optional().nullable(),
});

// Update setting schema
const updateSettingSchema = z.object({
  value: z.string().optional().nullable(),
  type: z.string().max(50, 'Type must be less than 50 characters').optional(),
  category: z.string().max(100, 'Category must be less than 100 characters').optional().nullable(),
  description: z.string().optional().nullable(),
});

// List settings schema
const listSettingsSchema = z.object({
  category: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['key', 'category', 'type', 'createdAt', 'updatedAt']).optional().default('key'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List settings
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const query = listSettingsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.category) {
      where.category = query.category;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.search) {
      where.OR = [
        { key: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [settings, total] = await Promise.all([
      prisma.setting.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.setting.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    settings.forEach((s) => {
      if (s.createdBy) userIds.add(s.createdBy);
      if (s.updatedBy) userIds.add(s.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        settings: settings.map((s) => {
          const createdByUser = s.createdBy ? userMap.get(s.createdBy.toString()) : null;
          const updatedByUser = s.updatedBy ? userMap.get(s.updatedBy.toString()) : null;

          return {
            id: s.id.toString(),
            key: s.key,
            value: s.value,
            type: s.type,
            category: s.category,
            description: s.description,
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
            createdAt: s.createdAt.toISOString(),
            updatedAt: s.updatedAt.toISOString(),
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
    logger.error('List settings error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching settings',
      },
    });
  }
});

// Get setting by key
router.get('/settings/:key', authenticateToken, async (req, res) => {
  try {
    const key = req.params.key;

    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({
        error: {
          code: 'SETTING_NOT_FOUND',
          message: 'Setting not found',
        },
      });
    }

    // Fetch user details
    const userIds = new Set<bigint>();
    if (setting.createdBy) userIds.add(setting.createdBy);
    if (setting.updatedBy) userIds.add(setting.updatedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = setting.createdBy ? userMap.get(setting.createdBy.toString()) : null;
    const updatedByUser = setting.updatedBy ? userMap.get(setting.updatedBy.toString()) : null;

    res.json({
      data: {
        setting: {
          id: setting.id.toString(),
          key: setting.key,
          value: setting.value,
          type: setting.type,
          category: setting.category,
          description: setting.description,
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
          createdAt: setting.createdAt.toISOString(),
          updatedAt: setting.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get setting error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching setting',
      },
    });
  }
});

// Create setting
router.post('/settings', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createSettingSchema.parse(req.body);

    const setting = await prisma.setting.create({
      data: {
        key: data.key.trim(),
        value: data.value?.trim() || null,
        type: data.type || 'string',
        category: data.category?.trim() || null,
        description: data.description?.trim() || null,
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
          modelType: 'setting',
          modelId: setting.id,
          oldValues: {},
          newValues: {
            key: setting.key,
            value: setting.value,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Setting created: ${setting.key} by user ${userId}`);

    res.status(201).json({
      data: {
        setting: {
          id: setting.id.toString(),
          key: setting.key,
          value: setting.value,
          type: setting.type,
          category: setting.category,
          description: setting.description,
          createdAt: setting.createdAt.toISOString(),
          updatedAt: setting.updatedAt.toISOString(),
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
    logger.error('Create setting error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating setting',
      },
    });
  }
});

// Update setting
router.patch('/settings/:key', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const key = req.params.key;

    const existing = await prisma.setting.findUnique({
      where: { key },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'SETTING_NOT_FOUND',
          message: 'Setting not found',
        },
      });
    }

    const data = updateSettingSchema.parse(req.body);

    const oldValues = {
      value: existing.value,
      type: existing.type,
      category: existing.category,
      description: existing.description,
    };

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.value !== undefined) updateData.value = data.value?.trim() || null;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category?.trim() || null;
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;

    const setting = await prisma.setting.update({
      where: { key },
      data: updateData,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'setting',
          modelId: setting.id,
          oldValues,
          newValues: {
            value: setting.value,
            type: setting.type,
            category: setting.category,
            description: setting.description,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Setting updated: ${setting.key} by user ${userId}`);

    res.json({
      data: {
        setting: {
          id: setting.id.toString(),
          key: setting.key,
          value: setting.value,
          type: setting.type,
          category: setting.category,
          description: setting.description,
          createdAt: setting.createdAt.toISOString(),
          updatedAt: setting.updatedAt.toISOString(),
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
    logger.error('Update setting error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating setting',
      },
    });
  }
});

// Get settings by category
router.get('/settings/category/:category', authenticateToken, async (req, res) => {
  try {
    const category = req.params.category;

    const settings = await prisma.setting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    res.json({
      data: {
        category,
        settings: settings.map((s) => ({
          id: s.id.toString(),
          key: s.key,
          value: s.value,
          type: s.type,
          category: s.category,
          description: s.description,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        })),
        count: settings.length,
      },
    });
  } catch (error) {
    logger.error('Get settings by category error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching settings by category',
      },
    });
  }
});

// Bulk update settings
router.patch('/settings/bulk', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const updates = z.array(z.object({
      key: z.string().min(1),
      value: z.string().optional().nullable(),
    })).parse(req.body);

    const results = await Promise.allSettled(
      updates.map(async (update) => {
        const existing = await prisma.setting.findUnique({
          where: { key: update.key },
        });

        if (!existing) {
          throw new Error(`Setting ${update.key} not found`);
        }

        const oldValue = existing.value;

        const setting = await prisma.setting.update({
          where: { key: update.key },
          data: {
            value: update.value !== undefined ? update.value : existing.value,
            updatedBy: userId,
          },
        });

        // Create audit log
        try {
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'updated',
              modelType: 'setting',
              modelId: setting.id,
              oldValues: { value: oldValue },
              newValues: { value: setting.value },
              ipAddress: req.ip || req.socket.remoteAddress || null,
              userAgent: req.get('user-agent') || null,
            },
          });
        } catch (auditError) {
          logger.warn('Failed to create audit log:', auditError);
        }

        return {
          key: setting.key,
          success: true,
          value: setting.value,
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
    logger.error('Bulk update settings error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while bulk updating settings',
      },
    });
  }
});

// Delete setting
router.delete('/settings/:key', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const key = req.params.key;

    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({
        error: {
          code: 'SETTING_NOT_FOUND',
          message: 'Setting not found',
        },
      });
    }

    await prisma.setting.delete({
      where: { key },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'setting',
          modelId: setting.id,
          oldValues: {
            key: setting.key,
            value: setting.value,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Setting deleted: ${key} by user ${userId}`);

    res.json({
      message: 'Setting deleted successfully',
    });
  } catch (error) {
    logger.error('Delete setting error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting setting',
      },
    });
  }
});

export default router;

