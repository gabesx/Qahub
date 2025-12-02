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

// Create document schema
const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  content: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

// Update document schema
const updateDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters').optional(),
  content: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

// List documents schema
const listDocumentsSchema = z.object({
  search: z.string().optional(),
  parentId: z.string().optional().nullable(),
  includeDeleted: z.string().optional().transform((val) => val === 'true'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'viewsCount', 'likesCount', 'starsCount']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List documents for a project
router.get('/projects/:projectId/documents', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view documents',
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

    const query = listDocumentsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      projectId,
      tenantId,
    };

    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' };
    }

    if (query.parentId !== undefined) {
      if (query.parentId === null || query.parentId === '') {
        where.parentId = null;
      } else {
        where.parentId = BigInt(query.parentId);
      }
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          parent: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              children: true,
              versions: true,
              comments: true,
              engagements: true,
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    documents.forEach((doc) => {
      if (doc.createdBy) userIds.add(doc.createdBy);
      if (doc.lastEditedBy) userIds.add(doc.lastEditedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        documents: documents.map((doc) => {
          const createdByUser = doc.createdBy ? userMap.get(doc.createdBy.toString()) : null;
          const lastEditedByUser = doc.lastEditedBy ? userMap.get(doc.lastEditedBy.toString()) : null;

          return {
            id: doc.id.toString(),
            title: doc.title,
            content: doc.content,
            version: doc.version,
            viewsCount: doc.viewsCount,
            likesCount: doc.likesCount,
            starsCount: doc.starsCount,
            parent: doc.parent ? {
              id: doc.parent.id.toString(),
              title: doc.parent.title,
            } : null,
            counts: {
              children: doc._count.children,
              versions: doc._count.versions,
              comments: doc._count.comments,
              engagements: doc._count.engagements,
            },
            createdBy: createdByUser ? {
              id: createdByUser.id.toString(),
              name: createdByUser.name,
              email: createdByUser.email,
            } : null,
            lastEditedBy: lastEditedByUser ? {
              id: lastEditedByUser.id.toString(),
              name: lastEditedByUser.name,
              email: lastEditedByUser.email,
            } : null,
            deletedAt: doc.deletedAt?.toISOString() || null,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString(),
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
    logger.error('List documents error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching documents',
      },
    });
  }
});

// Get document by ID
router.get('/projects/:projectId/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view documents',
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

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        tenantId,
      },
      include: {
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            children: true,
            versions: true,
            comments: true,
            engagements: true,
          },
        },
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

    // Increment views count (async, don't wait)
    prisma.documentEngagement.upsert({
      where: {
        documentId_userId_engagementType: {
          documentId,
          userId,
          engagementType: 'view',
        },
      },
      create: {
        documentId,
        userId,
        engagementType: 'view',
        viewedAt: new Date(),
      },
      update: {
        viewedAt: new Date(),
      },
    }).then(() => {
      // Update views count
      prisma.document.update({
        where: { id: documentId },
        data: {
          viewsCount: { increment: 1 },
        },
      }).catch((err) => logger.warn('Failed to increment views count:', err));
    }).catch((err) => logger.warn('Failed to record view engagement:', err));

    // Fetch user details
    const userIds = new Set<bigint>();
    if (document.createdBy) userIds.add(document.createdBy);
    if (document.lastEditedBy) userIds.add(document.lastEditedBy);

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));
    const createdByUser = document.createdBy ? userMap.get(document.createdBy.toString()) : null;
    const lastEditedByUser = document.lastEditedBy ? userMap.get(document.lastEditedBy.toString()) : null;

    res.json({
      data: {
        document: {
          id: document.id.toString(),
          title: document.title,
          content: document.content,
          version: document.version,
          viewsCount: document.viewsCount,
          likesCount: document.likesCount,
          starsCount: document.starsCount,
          parent: document.parent ? {
            id: document.parent.id.toString(),
            title: document.parent.title,
          } : null,
          counts: {
            children: document._count.children,
            versions: document._count.versions,
            comments: document._count.comments,
            engagements: document._count.engagements,
          },
          createdBy: createdByUser ? {
            id: createdByUser.id.toString(),
            name: createdByUser.name,
            email: createdByUser.email,
          } : null,
          lastEditedBy: lastEditedByUser ? {
            id: lastEditedByUser.id.toString(),
            name: lastEditedByUser.name,
            email: lastEditedByUser.email,
          } : null,
          deletedAt: document.deletedAt?.toISOString() || null,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get document error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document',
      },
    });
  }
});

// Create document
router.post('/projects/:projectId/documents', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create documents',
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

    const data = createDocumentSchema.parse(req.body);

    // Verify parent document exists if provided
    if (data.parentId) {
      const parent = await prisma.document.findFirst({
        where: {
          id: BigInt(data.parentId),
          projectId,
          tenantId,
          deletedAt: null,
        },
      });

      if (!parent) {
        return res.status(404).json({
          error: {
            code: 'PARENT_DOCUMENT_NOT_FOUND',
            message: 'Parent document not found',
          },
        });
      }
    }

    const document = await prisma.document.create({
      data: {
        tenantId,
        projectId,
        parentId: data.parentId ? BigInt(data.parentId) : null,
        title: data.title.trim(),
        content: data.content?.trim() || null,
        version: 1,
        createdBy: userId,
        lastEditedBy: userId,
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

    // Create initial version
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        title: document.title,
        content: document.content || '',
        versionNumber: 1,
        createdBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'document',
          modelId: document.id,
          oldValues: {},
          newValues: {
            title: document.title,
            projectId: document.projectId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document created: ${document.title} in project ${projectId} by user ${userId}`);

    res.status(201).json({
      data: {
        document: {
          id: document.id.toString(),
          title: document.title,
          content: document.content,
          version: document.version,
          viewsCount: document.viewsCount,
          likesCount: document.likesCount,
          starsCount: document.starsCount,
          parent: document.parent ? {
            id: document.parent.id.toString(),
            title: document.parent.title,
          } : null,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
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
    logger.error('Create document error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating document',
      },
    });
  }
});

// Update document
router.patch('/projects/:projectId/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update documents',
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

    const existing = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document not found',
        },
      });
    }

    const data = updateDocumentSchema.parse(req.body);

    const oldValues = {
      title: existing.title,
      content: existing.content,
      parentId: existing.parentId?.toString() || null,
      version: existing.version,
    };

    const updateData: any = {
      lastEditedBy: userId,
    };

    let shouldCreateVersion = false;

    if (data.title !== undefined) {
      updateData.title = data.title.trim();
      if (data.title.trim() !== existing.title) {
        shouldCreateVersion = true;
      }
    }

    if (data.content !== undefined) {
      updateData.content = data.content?.trim() || null;
      if ((data.content?.trim() || null) !== existing.content) {
        shouldCreateVersion = true;
      }
    }

    if (data.parentId !== undefined) {
      if (data.parentId === null || data.parentId === '') {
        updateData.parentId = null;
      } else {
        // Verify parent document exists
        const parent = await prisma.document.findFirst({
          where: {
            id: BigInt(data.parentId),
            projectId,
            tenantId,
            deletedAt: null,
          },
        });

        if (!parent) {
          return res.status(404).json({
            error: {
              code: 'PARENT_DOCUMENT_NOT_FOUND',
              message: 'Parent document not found',
            },
          });
        }

        // Prevent circular reference
        if (BigInt(data.parentId) === documentId) {
          return res.status(400).json({
            error: {
              code: 'CIRCULAR_REFERENCE',
              message: 'A document cannot be its own parent',
            },
          });
        }

        // Check if parent is a descendant
        let currentParentId = existing.parentId;
        while (currentParentId) {
          if (currentParentId === BigInt(data.parentId)) {
            return res.status(400).json({
              error: {
                code: 'CIRCULAR_REFERENCE',
                message: 'Cannot set parent to a descendant document',
              },
            });
          }
          const parentDoc = await prisma.document.findFirst({
            where: { id: currentParentId },
            select: { parentId: true },
          });
          currentParentId = parentDoc?.parentId || null;
        }

        updateData.parentId = BigInt(data.parentId);
      }
    }

    // Create new version if content or title changed
    if (shouldCreateVersion) {
      updateData.version = { increment: 1 };
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
      include: {
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Create new version if needed
    if (shouldCreateVersion) {
      await prisma.documentVersion.create({
        data: {
          documentId: document.id,
          title: document.title,
          content: document.content || '',
          versionNumber: document.version,
          createdBy: userId,
        },
      });
    }

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'document',
          modelId: document.id,
          oldValues,
          newValues: {
            title: document.title,
            content: document.content,
            parentId: document.parentId?.toString() || null,
            version: document.version,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document updated: ${document.title} by user ${userId}`);

    res.json({
      data: {
        document: {
          id: document.id.toString(),
          title: document.title,
          content: document.content,
          version: document.version,
          viewsCount: document.viewsCount,
          likesCount: document.likesCount,
          starsCount: document.starsCount,
          parent: document.parent ? {
            id: document.parent.id.toString(),
            title: document.parent.title,
          } : null,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
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
    logger.error('Update document error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating document',
      },
    });
  }
});

// Delete document (soft delete)
router.delete('/projects/:projectId/documents/:documentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const projectId = BigInt(req.params.projectId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete documents',
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

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        projectId,
        tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            children: true,
          },
        },
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

    // Check if document has children
    if (document._count.children > 0) {
      return res.status(400).json({
        error: {
          code: 'HAS_CHILDREN',
          message: 'Cannot delete document with child documents. Please delete or move children first.',
        },
      });
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'document',
          modelId: documentId,
          oldValues: {
            title: document.title,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document deleted: ${document.title} by user ${userId}`);

    res.json({
      message: 'Document deleted successfully',
    });
  } catch (error) {
    logger.error('Delete document error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting document',
      },
    });
  }
});

export default router;

