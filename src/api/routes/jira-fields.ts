import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Create Jira field schema
const createJiraFieldSchema = z.object({
  fieldType: z.string().min(1, 'Field type is required').max(255, 'Field type must be less than 255 characters'),
  fieldId: z.string().min(1, 'Field ID is required').max(255, 'Field ID must be less than 255 characters'),
  description: z.string().optional().nullable(),
  isCustom: z.boolean().default(false).optional(),
  isActive: z.boolean().default(true).optional(),
  sortOrder: z.number().int().default(0).optional(),
});

// Update Jira field schema
const updateJiraFieldSchema = z.object({
  fieldType: z.string().min(1, 'Field type is required').max(255, 'Field type must be less than 255 characters').optional(),
  description: z.string().optional().nullable(),
  isCustom: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// List Jira fields schema
const listJiraFieldsSchema = z.object({
  fieldType: z.string().optional(),
  isCustom: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  isActive: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  search: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['fieldId', 'fieldType', 'sortOrder', 'createdAt']).optional().default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

// List Jira fields
router.get('/jira-fields', authenticateToken, async (req, res) => {
  try {
    const query = listJiraFieldsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.fieldType) {
      where.fieldType = query.fieldType;
    }

    if (query.isCustom !== undefined) {
      where.isCustom = query.isCustom;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { fieldId: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [fields, total] = await Promise.all([
      prisma.jiraField.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.jiraField.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    fields.forEach((f) => {
      if (f.createdBy) userIds.add(f.createdBy);
      if (f.updatedBy) userIds.add(f.updatedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        fields: fields.map((f) => {
          const createdByUser = f.createdBy ? userMap.get(f.createdBy.toString()) : null;
          const updatedByUser = f.updatedBy ? userMap.get(f.updatedBy.toString()) : null;

          return {
            id: f.id.toString(),
            fieldType: f.fieldType,
            fieldId: f.fieldId,
            description: f.description,
            isCustom: f.isCustom,
            isActive: f.isActive,
            sortOrder: f.sortOrder,
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
            createdAt: f.createdAt?.toISOString() || null,
            updatedAt: f.updatedAt?.toISOString() || null,
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
    logger.error('List Jira fields error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching Jira fields',
      },
    });
  }
});

// Get Jira field by ID
router.get('/jira-fields/:id', authenticateToken, async (req, res) => {
  try {
    const fieldId = BigInt(req.params.id);

    const field = await prisma.jiraField.findUnique({
      where: { id: fieldId },
    });

    if (!field) {
      return res.status(404).json({
        error: {
          code: 'FIELD_NOT_FOUND',
          message: 'Jira field not found',
        },
      });
    }

    // Fetch user details
    const userIds = new Set<bigint>();
    if (field.createdBy) userIds.add(field.createdBy);
    if (field.updatedBy) userIds.add(field.updatedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = field.createdBy ? userMap.get(field.createdBy.toString()) : null;
    const updatedByUser = field.updatedBy ? userMap.get(field.updatedBy.toString()) : null;

    res.json({
      data: {
        field: {
          id: field.id.toString(),
          fieldType: field.fieldType,
          fieldId: field.fieldId,
          description: field.description,
          isCustom: field.isCustom,
          isActive: field.isActive,
          sortOrder: field.sortOrder,
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
          createdAt: field.createdAt?.toISOString() || null,
          updatedAt: field.updatedAt?.toISOString() || null,
        },
      },
    });
  } catch (error) {
    logger.error('Get Jira field error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching Jira field',
      },
    });
  }
});

// Create Jira field
router.post('/jira-fields', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createJiraFieldSchema.parse(req.body);

    const field = await prisma.jiraField.create({
      data: {
        fieldType: data.fieldType.trim(),
        fieldId: data.fieldId.trim(),
        description: data.description?.trim() || null,
        isCustom: data.isCustom !== undefined ? data.isCustom : false,
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder || 0,
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
          modelType: 'jira_field',
          modelId: field.id,
          oldValues: {},
          newValues: {
            fieldId: field.fieldId,
            fieldType: field.fieldType,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Jira field created: ${field.fieldId} by user ${userId}`);

    res.status(201).json({
      data: {
        field: {
          id: field.id.toString(),
          fieldType: field.fieldType,
          fieldId: field.fieldId,
          description: field.description,
          isCustom: field.isCustom,
          isActive: field.isActive,
          sortOrder: field.sortOrder,
          createdAt: field.createdAt?.toISOString() || null,
          updatedAt: field.updatedAt?.toISOString() || null,
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
    logger.error('Create Jira field error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating Jira field',
      },
    });
  }
});

// Update Jira field
router.patch('/jira-fields/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const fieldId = BigInt(req.params.id);
    const data = updateJiraFieldSchema.parse(req.body);

    const existing = await prisma.jiraField.findUnique({
      where: { id: fieldId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'FIELD_NOT_FOUND',
          message: 'Jira field not found',
        },
      });
    }

    const oldValues = {
      fieldType: existing.fieldType,
      description: existing.description,
      isCustom: existing.isCustom,
      isActive: existing.isActive,
      sortOrder: existing.sortOrder,
    };

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.fieldType !== undefined) updateData.fieldType = data.fieldType.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.isCustom !== undefined) updateData.isCustom = data.isCustom;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

    const field = await prisma.jiraField.update({
      where: { id: fieldId },
      data: updateData,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'jira_field',
          modelId: field.id,
          oldValues,
          newValues: {
            fieldType: field.fieldType,
            description: field.description,
            isCustom: field.isCustom,
            isActive: field.isActive,
            sortOrder: field.sortOrder,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Jira field updated: ${field.fieldId} by user ${userId}`);

    res.json({
      data: {
        field: {
          id: field.id.toString(),
          fieldType: field.fieldType,
          fieldId: field.fieldId,
          description: field.description,
          isCustom: field.isCustom,
          isActive: field.isActive,
          sortOrder: field.sortOrder,
          createdAt: field.createdAt?.toISOString() || null,
          updatedAt: field.updatedAt?.toISOString() || null,
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
    logger.error('Update Jira field error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating Jira field',
      },
    });
  }
});

// Delete Jira field
router.delete('/jira-fields/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const fieldId = BigInt(req.params.id);

    const field = await prisma.jiraField.findUnique({
      where: { id: fieldId },
    });

    if (!field) {
      return res.status(404).json({
        error: {
          code: 'FIELD_NOT_FOUND',
          message: 'Jira field not found',
        },
      });
    }

    await prisma.jiraField.delete({
      where: { id: fieldId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'jira_field',
          modelId: fieldId,
          oldValues: {
            fieldId: field.fieldId,
            fieldType: field.fieldType,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Jira field deleted: ${field.fieldId} by user ${userId}`);

    res.json({
      message: 'Jira field deleted successfully',
    });
  } catch (error) {
    logger.error('Delete Jira field error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting Jira field',
      },
    });
  }
});

export default router;

