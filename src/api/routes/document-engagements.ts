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

// Engagement type enum
const EngagementTypeEnum = z.enum(['like', 'star', 'view']);

// Create engagement schema
const createEngagementSchema = z.object({
  engagementType: EngagementTypeEnum,
});

// List engagements schema
const listEngagementsSchema = z.object({
  engagementType: EngagementTypeEnum.optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['createdAt', 'viewedAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List document engagements
router.get('/documents/:documentId/engagements', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view document engagements',
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

    const query = listEngagementsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      documentId,
    };

    if (query.engagementType) {
      where.engagementType = query.engagementType;
    }

    const [engagements, total] = await Promise.all([
      prisma.documentEngagement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.documentEngagement.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    engagements.forEach((e) => {
      userIds.add(e.userId);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        engagements: engagements.map((e) => {
          const user = userMap.get(e.userId.toString());

          return {
            id: e.id.toString(),
            engagementType: e.engagementType,
            viewedAt: e.viewedAt?.toISOString() || null,
            user: user ? {
              id: user.id.toString(),
              name: user.name,
              email: user.email,
            } : null,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
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
    logger.error('List document engagements error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching document engagements',
      },
    });
  }
});

// Create or update document engagement (like/star/view)
router.post('/documents/:documentId/engagements', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to engage with documents',
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

    const data = createEngagementSchema.parse(req.body);

    // Check if engagement already exists
    const existing = await prisma.documentEngagement.findUnique({
      where: {
        documentId_userId_engagementType: {
          documentId,
          userId,
          engagementType: data.engagementType,
        },
      },
    });

    let engagement;
    let isNew = false;

    if (existing) {
      // Update existing engagement
      engagement = await prisma.documentEngagement.update({
        where: { id: existing.id },
        data: {
          viewedAt: data.engagementType === 'view' ? new Date() : existing.viewedAt,
        },
      });
    } else {
      // Create new engagement
      isNew = true;
      engagement = await prisma.documentEngagement.create({
        data: {
          documentId,
          userId,
          engagementType: data.engagementType,
          viewedAt: data.engagementType === 'view' ? new Date() : null,
        },
      });

      // Update document counts
      const countField = data.engagementType === 'like' ? 'likesCount' :
                        data.engagementType === 'star' ? 'starsCount' :
                        'viewsCount';

      await prisma.document.update({
        where: { id: documentId },
        data: {
          [countField]: { increment: 1 },
        },
      });
    }

    // Fetch user details
    const user = await prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    logger.info(`Document engagement ${isNew ? 'created' : 'updated'}: ${data.engagementType} for document ${documentId} by user ${userId}`);

    res.status(isNew ? 201 : 200).json({
      data: {
        engagement: {
          id: engagement.id.toString(),
          engagementType: engagement.engagementType,
          viewedAt: engagement.viewedAt?.toISOString() || null,
          user: user ? {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
          } : null,
          createdAt: engagement.createdAt.toISOString(),
          updatedAt: engagement.updatedAt.toISOString(),
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
    logger.error('Create document engagement error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating document engagement',
      },
    });
  }
});

// Delete document engagement (unlike/unstar)
router.delete('/documents/:documentId/engagements/:engagementId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const documentId = BigInt(req.params.documentId);
    const engagementId = BigInt(req.params.engagementId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to remove document engagements',
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

    const engagement = await prisma.documentEngagement.findFirst({
      where: {
        id: engagementId,
        documentId,
      },
    });

    if (!engagement) {
      return res.status(404).json({
        error: {
          code: 'ENGAGEMENT_NOT_FOUND',
          message: 'Document engagement not found',
        },
      });
    }

    // Only the user who created the engagement can delete it
    if (engagement.userId !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only remove your own engagements',
        },
      });
    }

    // Don't allow deleting view engagements (they're auto-tracked)
    if (engagement.engagementType === 'view') {
      return res.status(400).json({
        error: {
          code: 'INVALID_OPERATION',
          message: 'Cannot delete view engagements',
        },
      });
    }

    await prisma.documentEngagement.delete({
      where: { id: engagementId },
    });

    // Update document counts
    const countField = engagement.engagementType === 'like' ? 'likesCount' : 'starsCount';

    await prisma.document.update({
      where: { id: documentId },
      data: {
        [countField]: { decrement: 1 },
      },
    });

    logger.info(`Document engagement deleted: ${engagement.engagementType} for document ${documentId} by user ${userId}`);

    res.json({
      message: 'Document engagement removed successfully',
    });
  } catch (error) {
    logger.error('Delete document engagement error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while removing document engagement',
      },
    });
  }
});

export default router;

