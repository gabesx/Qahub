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

// Create attachment schema
const createAttachmentSchema = z.object({
  url: z.string().url('URL must be a valid URL').max(500, 'URL must be less than 500 characters'),
  testCaseId: z.string().min(1, 'Test case ID is required'),
  commentId: z.string().optional().nullable(), // Optional comment ID to link attachment to comment
});

// List attachments schema
const listAttachmentsSchema = z.object({
  testCaseId: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['createdAt', 'url']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List test run attachments
router.get('/test-runs/:testRunId/attachments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view test run attachments',
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

    const query = listAttachmentsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      testRunId,
    };

    if (query.testCaseId) {
      where.testCaseId = BigInt(query.testCaseId);
    }

    const [attachments, total] = await Promise.all([
      prisma.testRunAttachment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
        include: {
          testCase: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.testRunAttachment.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    attachments.forEach((a) => {
      if (a.uploadedBy) userIds.add(a.uploadedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        attachments: attachments.map((a) => {
          const uploadedByUser = a.uploadedBy ? userMap.get(a.uploadedBy.toString()) : null;

          return {
            id: a.id.toString(),
            url: a.url,
            testCase: a.testCase ? {
              id: a.testCase.id.toString(),
              title: a.testCase.title,
            } : null,
            commentId: a.commentId?.toString() || null,
            uploadedBy: uploadedByUser ? {
              id: uploadedByUser.id.toString(),
              name: uploadedByUser.name,
              email: uploadedByUser.email,
            } : null,
            createdAt: a.createdAt.toISOString(),
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
    logger.error('List test run attachments error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching test run attachments',
      },
    });
  }
});

// Create test run attachment
router.post('/test-runs/:testRunId/attachments', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create test run attachments',
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
      include: {
        repository: {
          select: {
            id: true,
          },
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

    const data = createAttachmentSchema.parse(req.body);

    // Verify test case exists and belongs to the same repository
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: BigInt(data.testCaseId),
        suite: {
          repositoryId: testRun.repositoryId || undefined,
        },
        deletedAt: null,
      },
    });

    if (!testCase) {
      return res.status(404).json({
        error: {
          code: 'TEST_CASE_NOT_FOUND',
          message: 'Test case not found or does not belong to this repository',
        },
      });
    }

    const attachment = await prisma.testRunAttachment.create({
      data: {
        testRunId,
        testCaseId: BigInt(data.testCaseId),
        url: data.url.trim(),
        uploadedBy: userId,
        commentId: data.commentId ? BigInt(data.commentId) : null,
      },
      include: {
        testCase: {
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
          modelType: 'test_run_attachment',
          modelId: attachment.id,
          oldValues: {},
          newValues: {
            url: attachment.url,
            testCaseId: attachment.testCaseId.toString(),
            testRunId: attachment.testRunId.toString(),
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run attachment created: ${attachment.id} for test case ${data.testCaseId} in test run ${testRunId} by user ${userId}`);

    res.status(201).json({
      data: {
        attachment: {
          id: attachment.id.toString(),
          url: attachment.url,
          testCase: attachment.testCase ? {
            id: attachment.testCase.id.toString(),
            title: attachment.testCase.title,
          } : null,
          commentId: attachment.commentId?.toString() || null,
          uploadedBy: {
            id: userId.toString(),
          },
          createdAt: attachment.createdAt.toISOString(),
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
    logger.error('Create test run attachment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating test run attachment',
      },
    });
  }
});

// Delete test run attachment
router.delete('/test-runs/:testRunId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const testRunId = BigInt(req.params.testRunId);
    const attachmentId = BigInt(req.params.attachmentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete test run attachments',
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

    const attachment = await prisma.testRunAttachment.findFirst({
      where: {
        id: attachmentId,
        testRunId,
      },
    });

    if (!attachment) {
      return res.status(404).json({
        error: {
          code: 'ATTACHMENT_NOT_FOUND',
          message: 'Test run attachment not found',
        },
      });
    }

    await prisma.testRunAttachment.delete({
      where: { id: attachmentId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'test_run_attachment',
          modelId: attachmentId,
          oldValues: {
            url: attachment.url,
            testCaseId: attachment.testCaseId.toString(),
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Test run attachment deleted: ${attachmentId} by user ${userId}`);

    res.json({
      message: 'Test run attachment deleted successfully',
    });
  } catch (error) {
    logger.error('Delete test run attachment error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting test run attachment',
      },
    });
  }
});

export default router;

