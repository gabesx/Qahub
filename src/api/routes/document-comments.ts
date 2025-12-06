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

// Create comment schema
const createCommentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  parentId: z.string().optional().nullable(),
  commentType: z.string().max(50, 'Comment type must be less than 50 characters').default('general').optional(),
  mentionedUserIds: z.array(z.string()).optional().nullable(),
});

// Update comment schema
const updateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').optional(),
  isResolved: z.boolean().optional(),
});

// List comments schema
const listCommentsSchema = z.object({
  parentId: z.string().optional().nullable(),
  commentType: z.string().optional(),
  isResolved: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  includeDeleted: z.string().optional().transform((val) => val === 'true'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List document comments
router.get('/documents/:documentId/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view document comments',
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

    const query = listCommentsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      documentId,
    };

    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    if (query.parentId !== undefined) {
      if (query.parentId === null || query.parentId === '') {
        where.parentId = null;
      } else {
        where.parentId = BigInt(query.parentId);
      }
    }

    if (query.commentType) {
      where.commentType = query.commentType;
    }

    if (query.isResolved !== undefined) {
      where.isResolved = query.isResolved;
    }

    const [comments, total] = await Promise.all([
      prisma.documentComment.findMany({
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
              content: true,
            },
          },
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
      prisma.documentComment.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    comments.forEach((c) => {
      userIds.add(c.userId);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        comments: comments.map((c) => {
          const user = userMap.get(c.userId.toString());

          return {
            id: c.id.toString(),
            content: c.content,
            commentType: c.commentType,
            isResolved: c.isResolved,
            mentionedUserIds: c.mentionedUserIds,
            parent: c.parent ? {
              id: c.parent.id.toString(),
              content: c.parent.content,
            } : null,
            counts: {
              replies: c._count.replies,
            },
            user: user ? {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
            } : null,
            deletedAt: c.deletedAt?.toISOString() || null,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
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
    logger.error('List document comments error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document comments',
      },
    });
  }
});

// Get document comment by ID
router.get('/documents/:documentId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view document comments',
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

    const comment = await prisma.documentComment.findFirst({
      where: {
        id: commentId,
        documentId,
      },
      include: {
        parent: {
          select: {
            id: true,
            content: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Document comment not found',
        },
      });
    }

    // Fetch user details
    const user = await prisma.user.findFirst({
      where: { id: comment.userId },
      select: { id: true, name: true, email: true },
    });

    res.json({
      data: {
        comment: {
          id: comment.id.toString(),
          content: comment.content,
          commentType: comment.commentType,
          isResolved: comment.isResolved,
          mentionedUserIds: comment.mentionedUserIds,
          parent: comment.parent ? {
            id: comment.parent.id.toString(),
            content: comment.parent.content,
          } : null,
          counts: {
            replies: comment._count.replies,
          },
          user: user ? {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          } : null,
          deletedAt: comment.deletedAt?.toISOString() || null,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get document comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document comment',
      },
    });
  }
});

// Create document comment
router.post('/documents/:documentId/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create document comments',
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

    const data = createCommentSchema.parse(req.body);

    // Verify parent comment exists if provided
    if (data.parentId) {
      const parent = await prisma.documentComment.findFirst({
        where: {
          id: BigInt(data.parentId),
          documentId,
          deletedAt: null,
        },
      });

      if (!parent) {
        return res.status(404).json({
          error: {
            code: 'PARENT_COMMENT_NOT_FOUND',
            message: 'Parent comment not found',
          },
        });
      }
    }

    const comment = await prisma.documentComment.create({
      data: {
        documentId,
        userId,
        parentId: data.parentId ? BigInt(data.parentId) : null,
        content: data.content.trim(),
        commentType: data.commentType || 'general',
        mentionedUserIds: data.mentionedUserIds || undefined,
      },
      include: {
        parent: {
          select: {
            id: true,
            content: true,
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
          modelType: 'document_comment',
          modelId: comment.id,
          oldValues: {},
          newValues: {
            content: comment.content,
            documentId: comment.documentId?.toString() || null,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    // Fetch user details
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    logger.info(`Document comment created: ${comment.id} for document ${documentId} by user ${userId}`);

    res.status(201).json({
      data: {
        comment: {
          id: comment.id.toString(),
          content: comment.content,
          commentType: comment.commentType,
          isResolved: comment.isResolved,
          mentionedUserIds: comment.mentionedUserIds,
          parent: comment.parent ? {
            id: comment.parent.id.toString(),
            content: comment.parent.content,
          } : null,
          user: user ? {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          } : null,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
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
    logger.error('Create document comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating document comment',
      },
    });
  }
});

// Update document comment
router.patch('/documents/:documentId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update document comments',
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

    const existing = await prisma.documentComment.findFirst({
      where: {
        id: commentId,
        documentId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Document comment not found',
        },
      });
    }

    // Only the comment author can update
    if (existing.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own comments',
        },
      });
    }

    const data = updateCommentSchema.parse(req.body);

    const oldValues = {
      content: existing.content,
      isResolved: existing.isResolved,
    };

    const updateData: any = {};

    if (data.content !== undefined) {
      updateData.content = data.content.trim();
    }

    if (data.isResolved !== undefined) {
      updateData.isResolved = data.isResolved;
    }

    const comment = await prisma.documentComment.update({
      where: { id: commentId },
      data: updateData,
    });

    // Fetch user details
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'document_comment',
          modelId: comment.id,
          oldValues,
          newValues: {
            content: comment.content,
            isResolved: comment.isResolved,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document comment updated: ${comment.id} by user ${userId}`);

    res.json({
      data: {
        comment: {
          id: comment.id.toString(),
          content: comment.content,
          commentType: comment.commentType,
          isResolved: comment.isResolved,
          mentionedUserIds: comment.mentionedUserIds,
          user: user ? {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          } : null,
          deletedAt: comment.deletedAt?.toISOString() || null,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
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
    logger.error('Update document comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating document comment',
      },
    });
  }
});

// Delete document comment (soft delete)
router.delete('/documents/:documentId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete document comments',
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

    const comment = await prisma.documentComment.findFirst({
      where: {
        id: commentId,
        documentId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Document comment not found',
        },
      });
    }

    // Only the comment author can delete
    if (comment.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own comments',
        },
      });
    }

    // Check if comment has replies
    if (comment._count.replies > 0) {
      return res.status(400).json({
        error: {
          code: 'HAS_REPLIES',
          message: 'Cannot delete comment with replies. Please delete replies first.',
        },
      });
    }

    await prisma.documentComment.update({
      where: { id: commentId },
      data: {
        deletedAt: new Date(),
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'document_comment',
          modelId: commentId,
          oldValues: {
            content: comment.content,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Document comment deleted: ${commentId} by user ${userId}`);

    res.json({
      message: 'Document comment deleted successfully',
    });
  } catch (error) {
    logger.error('Delete document comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting document comment',
      },
    });
  }
});

export default router;

