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
  comments: z.string().min(1, 'Comment is required'),
});

// Update comment schema
const updateCommentSchema = z.object({
  comments: z.string().min(1, 'Comment is required'),
});

// List comments schema
const listCommentsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test run comments
router.get('/test-runs/:testRunId/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run comments',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
        },
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    const query = listCommentsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.testRunComment.findMany({
        where: {
          testRunId,
        },
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          testPlan: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.testRunComment.count({
        where: {
          testRunId,
        },
      }),
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

    // Fetch attachments for each comment
    const commentIds = comments.map(c => c.id);
    const attachments = commentIds.length > 0 ? await prisma.testRunAttachment.findMany({
      where: {
        commentId: { in: commentIds },
      },
      select: {
        id: true,
        url: true,
        commentId: true,
        createdAt: true,
      },
    }) : [];

    const attachmentsByCommentId = new Map<string, any[]>();
    attachments.forEach(att => {
      if (att.commentId) {
        const commentIdStr = att.commentId.toString();
        if (!attachmentsByCommentId.has(commentIdStr)) {
          attachmentsByCommentId.set(commentIdStr, []);
        }
        attachmentsByCommentId.get(commentIdStr)!.push({
          id: att.id.toString(),
          url: att.url,
          createdAt: att.createdAt.toISOString(),
        });
      }
    });

    res.json({
      data: {
        comments: comments.map((c) => {
          const user = userMap.get(c.userId.toString());

          return {
            id: c.id.toString(),
            comments: c.comments,
            testPlan: {
              id: c.testPlan.id.toString(),
              title: c.testPlan.title,
            },
            user: user ? {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
            } : null,
            attachments: attachmentsByCommentId.get(c.id.toString()) || [],
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
    logger.error('List test run comments error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run comments',
      },
    });
  }
});

// Get test run comment by ID
router.get('/test-runs/:testRunId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run comments',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
        },
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    const comment = await prisma.testRunComment.findFirst({
      where: {
        id: commentId,
        testRunId,
      },
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Test run comment not found',
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
          comments: comment.comments,
          testPlan: {
            id: comment.testPlan.id.toString(),
            title: comment.testPlan.title,
          },
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
    logger.error('Get test run comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run comment',
      },
    });
  }
});

// Create test run comment
router.post('/test-runs/:testRunId/comments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test run comments',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
        },
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    const data = createCommentSchema.parse(req.body);

    const comment = await prisma.testRunComment.create({
      data: {
        userId,
        testRunId,
        testPlanId: testRun.testPlanId,
        comments: data.comments.trim(),
      },
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
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
          modelType: 'test_run_comment',
          modelId: comment.id,
          oldValues: {},
          newValues: {
            comments: comment.comments,
            testRunId: comment.testRunId.toString(),
            testPlanId: comment.testPlanId.toString(),
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

    logger.info(`Test run comment created: ${comment.id} for test run ${testRunId} by user ${userId}`);

    res.status(201).json({
      data: {
        comment: {
          id: comment.id.toString(),
          comments: comment.comments,
          testPlan: {
            id: comment.testPlan.id.toString(),
            title: comment.testPlan.title,
          },
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
    logger.error('Create test run comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test run comment',
      },
    });
  }
});

// Update test run comment
router.patch('/test-runs/:testRunId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update test run comments',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
        },
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    const existing = await prisma.testRunComment.findFirst({
      where: {
        id: commentId,
        testRunId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Test run comment not found',
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
      comments: existing.comments,
    };

    const comment = await prisma.testRunComment.update({
      where: { id: commentId },
      data: {
        comments: data.comments.trim(),
      },
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
          },
        },
      },
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
          modelType: 'test_run_comment',
          modelId: comment.id,
          oldValues,
          newValues: {
            comments: comment.comments,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run comment updated: ${comment.id} by user ${userId}`);

    res.json({
      data: {
        comment: {
          id: comment.id.toString(),
          comments: comment.comments,
          testPlan: {
            id: comment.testPlan.id.toString(),
            title: comment.testPlan.title,
          },
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
    logger.error('Update test run comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating test run comment',
      },
    });
  }
});

// Delete test run comment
router.delete('/test-runs/:testRunId/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);
    const commentId = BigInt(req.params.commentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete test run comments',
        },
      });
    }

    // Verify test run exists and belongs to tenant
    const testRun = await prisma.testRun.findFirst({
      where: {
        id: testRunId,
        project: {
          tenantId,
        },
      },
    });

    if (!testRun) {
      return res.status(404).json({
        error: {
          code: 'TEST_RUN_NOT_FOUND',
          message: 'Test run not found',
        },
      });
    }

    const comment = await prisma.testRunComment.findFirst({
      where: {
        id: commentId,
        testRunId,
      },
    });

    if (!comment) {
      return res.status(404).json({
        error: {
          code: 'COMMENT_NOT_FOUND',
          message: 'Test run comment not found',
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

    await prisma.testRunComment.delete({
      where: { id: commentId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'test_run_comment',
          modelId: commentId,
          oldValues: {
            comments: comment.comments,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run comment deleted: ${commentId} by user ${userId}`);

    res.json({
      message: 'Test run comment deleted successfully',
    });
  } catch (error) {
    logger.error('Delete test run comment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting test run comment',
      },
    });
  }
});

export default router;

