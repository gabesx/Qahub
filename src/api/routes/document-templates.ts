import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Create template schema
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  type: z.string().min(1, 'Type is required').max(100, 'Type must be less than 100 characters'),
  content: z.string().min(1, 'Content is required'),
  variables: z.any().optional().nullable(), // JSON field
  isActive: z.boolean().default(true).optional(),
});

// Update template schema
const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters').optional(),
  type: z.string().min(1, 'Type is required').max(100, 'Type must be less than 100 characters').optional(),
  content: z.string().min(1, 'Content is required').optional(),
  variables: z.any().optional().nullable(), // JSON field
  isActive: z.boolean().optional(),
});

// List templates schema
const listTemplatesSchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  isActive: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['name', 'type', 'createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List document templates
router.get('/document-templates', authenticateToken, async (req, res) => {
  try {
    const query = listTemplatesSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [templates, total] = await Promise.all([
      prisma.documentTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.documentTemplate.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    templates.forEach((t) => {
      if (t.createdBy) userIds.add(t.createdBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        templates: templates.map((t) => {
          const createdByUser = t.createdBy ? userMap.get(t.createdBy.toString()) : null;

          return {
            id: t.id.toString(),
            name: t.name,
            type: t.type,
            content: t.content,
            variables: t.variables,
            isActive: t.isActive,
            createdBy: createdByUser ? {
              id: createdByUser.id.toString(),
              name: createdByUser.name,
              email: createdByUser.email,
            } : null,
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
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
    logger.error('List document templates error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document templates',
      },
    });
  }
});

// Get document template by ID
router.get('/document-templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const templateId = BigInt(req.params.templateId);

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Document template not found',
        },
      });
    }

    // Fetch user details
    const createdByUser = template.createdBy ? await prisma.user.findFirst({
      where: { id: template.createdBy },
      select: { id: true, name: true, email: true },
    }) : null;

    res.json({
      data: {
        template: {
          id: template.id.toString(),
          name: template.name,
          type: template.type,
          content: template.content,
          variables: template.variables,
          isActive: template.isActive,
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
          } : null,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get document template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document template',
      },
    });
  }
});

// Create document template
router.post('/document-templates', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createTemplateSchema.parse(req.body);

    const template = await prisma.documentTemplate.create({
      data: {
        name: data.name.trim(),
        type: data.type.trim(),
        content: data.content.trim(),
        variables: data.variables || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'document_template',
          modelId: template.id,
          oldValues: {},
          newValues: {
            name: template.name,
            type: template.type,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    // Fetch user details
    const createdByUser = await prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    logger.info(`Document template created: ${template.name} by user ${userId}`);

    res.status(201).json({
      data: {
        template: {
          id: template.id.toString(),
          name: template.name,
          type: template.type,
          content: template.content,
          variables: template.variables,
          isActive: template.isActive,
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
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
    logger.error('Create document template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating document template',
      },
    });
  }
});

// Update document template
router.patch('/document-templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const templateId = BigInt(req.params.templateId);

    const existing = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Document template not found',
        },
      });
    }

    const data = updateTemplateSchema.parse(req.body);

    const oldValues = {
      name: existing.name,
      type: existing.type,
      content: existing.content,
      variables: existing.variables,
      isActive: existing.isActive,
    };

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.type !== undefined) updateData.type = data.type.trim();
    if (data.content !== undefined) updateData.content = data.content.trim();
    if (data.variables !== undefined) updateData.variables = data.variables || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const template = await prisma.documentTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'document_template',
          modelId: template.id,
          oldValues,
          newValues: {
            name: template.name,
            type: template.type,
            content: template.content,
            variables: template.variables,
            isActive: template.isActive,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    // Fetch user details
    const createdByUser = template.createdBy ? await prisma.user.findFirst({
      where: { id: template.createdBy },
      select: { id: true, name: true, email: true },
    }) : null;

    logger.info(`Document template updated: ${template.name} by user ${userId}`);

    res.json({
      data: {
        template: {
          id: template.id.toString(),
          name: template.name,
          type: template.type,
          content: template.content,
          variables: template.variables,
          isActive: template.isActive,
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
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
    logger.error('Update document template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating document template',
      },
    });
  }
});

// Delete document template
router.delete('/document-templates/:templateId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const templateId = BigInt(req.params.templateId);

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Document template not found',
        },
      });
    }

    await prisma.documentTemplate.delete({
      where: { id: templateId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'document_template',
          modelId: templateId,
          oldValues: {
            name: template.name,
            type: template.type,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document template deleted: ${template.name} by user ${userId}`);

    res.json({
      message: 'Document template deleted successfully',
    });
  } catch (error) {
    logger.error('Delete document template error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting document template',
      },
    });
  }
});

export default router;

