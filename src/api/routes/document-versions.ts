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

// Create version schema
const createVersionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  content: z.string().min(1, 'Content is required'),
  changeSummary: z.string().optional().nullable(),
});

// List versions schema
const listVersionsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['versionNumber', 'createdAt']).optional().default('versionNumber'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List document versions
router.get('/documents/:documentId/versions', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view document versions',
        },
      });
    }

    // Verify document exists and belongs to tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
      },
    });

    if (!document) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    const query = listVersionsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const [versions, total] = await Promise.all([
      prisma.documentVersion.findMany({
        where: {
          documentId,
        },
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.documentVersion.count({
        where: {
          documentId,
        },
      }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    versions.forEach((v) => {
      if (v.createdBy) userIds.add(v.createdBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        versions: versions.map((v) => {
          const createdByUser = v.createdBy ? userMap.get(v.createdBy.toString()) : null;

          return {
            id: v.id.toString(),
            title: v.title,
            content: v.content,
            versionNumber: v.versionNumber,
            changeSummary: v.changeSummary,
            createdBy: createdByUser ? {
              id: createdByUser.id.toString(),
              name: createdByUser.name,
              email: createdByUser.email,
            } : null,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
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
    logger.error('List document versions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document versions',
      },
    });
  }
});

// Get document version by ID
router.get('/documents/:documentId/versions/:versionId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);
    const versionId = BigInt(req.params.versionId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view document versions',
        },
      });
    }

    // Verify document exists and belongs to tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
      },
    });

    if (!document) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    const version = await prisma.documentVersion.findFirst({
      where: {
        id: versionId,
        documentId,
      },
    });

    if (!version) {
      return res.status(404).json({
        error: {
          code: 'VERSION_NOT_FOUND',
          message: 'Document version not found',
        },
      });
    }

    // Fetch user details
    const createdByUser = version.createdBy ? await prisma.user.findFirst({
      where: { id: version.createdBy },
      select: { id: true, name: true, email: true },
    }) : null;

    res.json({
      data: {
        version: {
          id: version.id.toString(),
          title: version.title,
          content: version.content,
          versionNumber: version.versionNumber,
          changeSummary: version.changeSummary,
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
          } : null,
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get document version error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document version',
      },
    });
  }
});

// Create document version (manual version creation)
router.post('/documents/:documentId/versions', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create document versions',
        },
      });
    }

    // Verify document exists and belongs to tenant
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!document) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    const data = createVersionSchema.parse(req.body);

    // Get next version number
    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const nextVersionNumber = (latestVersion?.versionNumber || document.version) + 1;

    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        title: data.title.trim(),
        content: data.content.trim(),
        versionNumber: nextVersionNumber,
        changeSummary: data.changeSummary?.trim() || null,
        createdBy: userId,
      },
    });

    // Update document version
    await prisma.document.update({
      where: { id: documentId },
      data: {
        version: nextVersionNumber,
        title: data.title.trim(),
        content: data.content.trim(),
        lastEditedBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'document_version',
          modelId: version.id,
          oldValues: {},
          newValues: {
            versionNumber: version.versionNumber,
            documentId: version.documentId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document version created: ${version.versionNumber} for document ${documentId} by user ${userId}`);

    // Fetch user details
    const createdByUser = await prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    res.status(201).json({
      data: {
        version: {
          id: version.id.toString(),
          title: version.title,
          content: version.content,
          versionNumber: version.versionNumber,
          changeSummary: version.changeSummary,
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
          } : null,
          createdAt: version.createdAt.toISOString(),
          updatedAt: version.updatedAt.toISOString(),
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
    logger.error('Create document version error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating document version',
      },
    });
  }
});

export default router;

