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
});

// Update comment schema
const updateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').optional(),
  isResolved: z.boolean().optional(),
});

// List comments schema
const listCommentsSchema = z.object({
  parentId: z.string().optional().nullable(),
  isResolved: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  includeDeleted: z.string().optional().transform((val) => val === 'true'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List comments for a test case
router.get('/test-cases/:testCaseId/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view comments',
        },
      });
    }

    // Verify test case exists and belongs to tenant
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    const query = listCommentsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      testCaseId,
    };

    // Soft delete filter
    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    // Parent filter
    if (query.parentId === null || query.parentId === 'null') {
      where.parentId = null;
    } else if (query.parentId) {
      where.parentId = BigInt(query.parentId);
    }

    // Resolved filter
    if (query.isResolved !== undefined) {
      where.isResolved = query.isResolved;
    }

    const [comments, total] = await Promise.all([
      prisma.testCaseComment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          _count: {
            select: {
              replies: true,
            },
          },
        },
      }),
      prisma.testCaseComment.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    comments.forEach((c) => {
      userIds.add(c.userId);
      if (c.parentId) {
        // We'll fetch parent comment user separately if needed
      }
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true, avatar: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        comments: comments.map((comment) => {
          const user = userMap.get(comment.userId.toString());

          return {
            id: comment.id.toString(),
            content: comment.content,
            isResolved: comment.isResolved,
            parentId: comment.parentId?.toString() || null,
            deletedAt: comment.deletedAt?.toISOString() || null,
            createdAt: comment.createdAt.toISOString(),
            updatedAt: comment.updatedAt.toISOString(),
            counts: {
              replies: comment._count.replies,
            },
            user: user ? {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            } : null,
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
    logger.error('List comments error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching comments',
      },
    });
  }
});

// Get comment by ID
router.get('/test-cases/:testCaseId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testCaseId = BigInt(req.params.testCaseId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view comments',
        },
      });
    }

    // Verify test case exists and belongs to tenant
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    const comment = await prisma.testCaseComment.findFirst({
      where: {
        id: commentId,
        testCaseId,
      },
      include: {
        _count: {
          select: {
            replies: true,
          },
        },
        parent: {
          select: {
            id: true,
            content: true,
            userId: true,
          },
        },
        replies: {
          take: 10,
          include: {
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    // Fetch user details
    const userIds = new Set<bigint>();
    userIds.add(comment.userId);
    if (comment.parent) {
      userIds.add(comment.parent.userId);
    }
    comment.replies.forEach((reply) => {
      userIds.add(reply.userId);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true, avatar: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        comment: {
          id: comment.id.toString(),
          content: comment.content,
          isResolved: comment.isResolved,
          parentId: comment.parentId?.toString() || null,
          parent: comment.parent ? {
            id: comment.parent.id.toString(),
            content: comment.parent.content,
            user: userMap.get(comment.parent.userId.toString()) ? {
              id: userMap.get(comment.parent.userId.toString())!.id.toString(),
              name: userMap.get(comment.parent.userId.toString())!.name,
              email: userMap.get(comment.parent.userId.toString())!.email,
            } : null,
          } : null,
          deletedAt: comment.deletedAt?.toISOString() || null,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          counts: {
            replies: comment._count.replies,
          },
          user: userMap.get(comment.userId.toString()) ? {
            id: userMap.get(comment.userId.toString())!.id.toString(),
            name: userMap.get(comment.userId.toString())!.name,
            email: userMap.get(comment.userId.toString())!.email,
            avatar: userMap.get(comment.userId.toString())!.avatar,
          } : null,
          replies: comment.replies.map((reply) => {
            const replyUser = userMap.get(reply.userId.toString());
            return {
              id: reply.id.toString(),
              content: reply.content,
              isResolved: reply.isResolved,
              parentId: reply.parentId?.toString() || null,
              deletedAt: reply.deletedAt?.toISOString() || null,
              createdAt: reply.createdAt.toISOString(),
              updatedAt: reply.updatedAt.toISOString(),
              counts: {
                replies: reply._count.replies,
              },
              user: replyUser ? {
                id: replyUser.id.toString(),
                name: replyUser.name,
                email: replyUser.email,
                avatar: replyUser.avatar,
              } : null,
            };
          }),
        },
      },
    });
  } catch (error) {
    logger.error('Get comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching comment',
      },
    });
  }
});

// Create comment
router.post('/test-cases/:testCaseId/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testCaseId = BigInt(req.params.testCaseId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create comments',
        },
      });
    }

    // Verify test case exists and belongs to tenant
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    // Check if test case is deleted
    if (testCase.deletedAt) {
      return res.status(410).json({
        error: {
          code: 'TEST_CASE_DELETED',
          message: 'Cannot comment on a deleted test case',
        },
      });
    }

    const data = createCommentSchema.parse(req.body);

    // Verify parent comment exists if provided
    let parentId: bigint | null = null;
    if (data.parentId) {
      const parent = await prisma.testCaseComment.findFirst({
        where: {
          id: BigInt(data.parentId),
          testCaseId,
          deletedAt: null,
        },
      });

      if (!parent) {
        return res.status(400).json({
          error: {
            code: 'PARENT_COMMENT_NOT_FOUND',
            message: 'Parent comment not found',
          },
        });
      }
      parentId = parent.id;
    }

    const comment = await prisma.testCaseComment.create({
      data: {
        testCaseId,
        userId,
        content: data.content.trim(),
        parentId,
      },
      include: {
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'test_case_comment',
          modelId: comment.id,
          oldValues: {},
          newValues: {
            content: comment.content,
            testCaseId: comment.testCaseId.toString(),
            parentId: comment.parentId?.toString() || null,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Comment created on test case ${testCaseId} by user ${userId}`);

    res.status(201).json({
      data: {
        comment: {
          id: comment.id.toString(),
          content: comment.content,
          isResolved: comment.isResolved,
          parentId: comment.parentId?.toString() || null,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          counts: {
            replies: comment._count.replies,
          },
          user: user ? {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          } : null,
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
    logger.error('Create comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating comment',
      },
    });
  }
});

// Update comment
router.patch('/test-cases/:testCaseId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testCaseId = BigInt(req.params.testCaseId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update comments',
        },
      });
    }

    // Verify test case exists and belongs to tenant
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    const existing = await prisma.testCaseComment.findFirst({
      where: {
        id: commentId,
        testCaseId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    // Check if comment is deleted
    if (existing.deletedAt) {
      return res.status(410).json({
        error: {
          code: 'COMMENT_DELETED',
          message: 'Cannot update a deleted comment',
        },
      });
    }

    // Check if user owns the comment
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
    if (data.content !== undefined) updateData.content = data.content.trim();
    if (data.isResolved !== undefined) updateData.isResolved = data.isResolved;

    const comment = await prisma.testCaseComment.update({
      where: { id: commentId },
      data: updateData,
      include: {
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // Fetch user details
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatar: true },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'test_case_comment',
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

    logger.info(`Comment updated: ${comment.id} by user ${userId}`);

    res.json({
      data: {
        comment: {
          id: comment.id.toString(),
          content: comment.content,
          isResolved: comment.isResolved,
          parentId: comment.parentId?.toString() || null,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          counts: {
            replies: comment._count.replies,
          },
          user: user ? {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          } : null,
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
    logger.error('Update comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating comment',
      },
    });
  }
});

// Delete comment (soft delete)
router.delete('/test-cases/:testCaseId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testCaseId = BigInt(req.params.testCaseId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete comments',
        },
      });
    }

    // Verify test case exists and belongs to tenant
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    const comment = await prisma.testCaseComment.findFirst({
      where: {
        id: commentId,
        testCaseId,
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
          message: 'Comment not found',
        },
      });
    }

    // Check if already deleted
    if (comment.deletedAt) {
      return res.status(410).json({
        error: {
          code: 'COMMENT_ALREADY_DELETED',
          message: 'Comment is already deleted',
        },
      });
    }

    // Check if user owns the comment
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
      return res.status(409).json({
        error: {
          code: 'COMMENT_HAS_REPLIES',
          message: 'Cannot delete comment that has replies',
          details: {
            repliesCount: comment._count.replies,
          },
        },
      });
    }

    // Soft delete
    await prisma.testCaseComment.update({
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
          modelType: 'test_case_comment',
          modelId: commentId,
          oldValues: {
            content: comment.content,
          },
          newValues: {
            deletedAt: new Date().toISOString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Comment deleted: ${comment.id} by user ${userId}`);

    res.json({
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    logger.error('Delete comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting comment',
      },
    });
  }
});

// Restore soft-deleted comment
router.post('/test-cases/:testCaseId/comments/:commentId/restore', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testCaseId = BigInt(req.params.testCaseId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to restore comments',
        },
      });
    }

    // Verify test case exists
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        tenantId,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found',
        },
      });
    }

    const comment = await prisma.testCaseComment.findFirst({
      where: {
        id: commentId,
        testCaseId,
      },
    });

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Comment not found',
        },
      });
    }

    if (!comment.deletedAt) {
      return res.status(400).json({
        error: {
          code: 'COMMENT_NOT_DELETED',
          message: 'Comment is not deleted',
        },
      });
    }

    // Restore
    const restored = await prisma.testCaseComment.update({
      where: { id: commentId },
      data: {
        deletedAt: null,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'restored',
          modelType: 'test_case_comment',
          modelId: commentId,
          oldValues: {
            deletedAt: comment.deletedAt?.toISOString(),
          },
          newValues: {
            deletedAt: null,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Comment restored: ${comment.id} by user ${userId}`);

    res.json({
      message: 'Comment restored successfully',
      data: {
        comment: {
          id: restored.id.toString(),
          content: restored.content,
          deletedAt: null,
        },
      },
    });
  } catch (error) {
    logger.error('Restore comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while restoring comment',
      },
    });
  }
});

export default router;

