import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';
import {
  healthCheck,
  submitReviewRequest,
  testReview,
  fetchReviewsFromSheets,
  generateRequestId,
  GoogleAppsScriptConfig,
} from '../../shared/utils/google-apps-script';

const router = Router();

// Helper to get Google Apps Script configuration from settings
async function getGoogleAppsScriptConfig(): Promise<GoogleAppsScriptConfig> {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: ['GOOGLE_SCRIPT_URL', 'GOOGLE_SHEETS_ID', 'CONFLUENCE_URL', 'GOOGLE_SHEETS_TAB_NAME'],
      },
    },
  });

  const configMap = new Map(settings.map((s) => [s.key, s.value]));
  return {
    scriptUrl: configMap.get('GOOGLE_SCRIPT_URL') || process.env.GOOGLE_SCRIPT_URL || '',
    sheetsId: configMap.get('GOOGLE_SHEETS_ID') || process.env.GOOGLE_SHEETS_ID || undefined,
    confluenceUrl: configMap.get('CONFLUENCE_URL') || process.env.CONFLUENCE_URL || undefined,
    sheetTabName: configMap.get('GOOGLE_SHEETS_TAB_NAME') || process.env.GOOGLE_SHEETS_TAB_NAME || 'Review AI',
  };
}

// Validation schemas
const createPrdReviewSchema = z.object({
  requesterName: z.string().min(1).max(255).regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Name can only contain alphanumeric characters, spaces, hyphens, underscores, and dots'),
  title: z.string().min(1).max(500),
  content: z.string().min(100, 'PRD content must be at least 100 characters').max(50000, 'PRD content must not exceed 50,000 characters'),
  confluenceUrl: z.string().url().optional().nullable().refine(
    (url) => !url || url.includes('atlassian.net'),
    'Confluence URL must be from atlassian.net domain'
  ),
  projectId: z.string().optional().nullable(),
});

const updatePrdReviewSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(100).max(50000).optional(),
  status: z.enum(['DRAFT', 'PROCESSING', 'COMPLETED', 'FINALIZED']).optional(),
  aiReview: z.string().optional().nullable(),
  comments: z.string().optional().nullable(),
  metadata: z.any().optional(),
});

const querySchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(['DRAFT', 'PROCESSING', 'COMPLETED', 'FINALIZED']).optional(),
  requesterName: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
});

/**
 * GET /prd-reviews/health-check
 * Health check for Google Apps Script integration
 */
router.get('/health-check', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to access PRD reviews',
        },
      });
    }

    const config = await getGoogleAppsScriptConfig();

    if (!config.scriptUrl) {
      return res.status(400).json({
        error: {
          code: 'CONFIGURATION_MISSING',
          message: 'Google Apps Script URL is not configured. Please configure it in settings.',
        },
      });
    }

    const healthResult = await healthCheck(config);

    res.json({
      data: {
        health: healthResult,
        config: {
          scriptUrl: config.scriptUrl ? 'configured' : 'not configured',
          sheetsId: config.sheetsId ? 'configured' : 'not configured',
          confluenceUrl: config.confluenceUrl ? 'configured' : 'not configured',
        },
      },
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during health check',
      },
    });
  }
});

/**
 * POST /prd-reviews/test-review
 * Test review workflow without full submission
 */
router.post('/test-review', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to test PRD reviews',
        },
      });
    }

    const config = await getGoogleAppsScriptConfig();

    if (!config.scriptUrl) {
      return res.status(400).json({
        error: {
          code: 'CONFIGURATION_MISSING',
          message: 'Google Apps Script URL is not configured',
        },
      });
    }

    // First do health check
    const healthResult = await healthCheck(config);
    if (!healthResult.success) {
      return res.status(503).json({
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed. Please verify Google Apps Script configuration.',
          details: healthResult,
        },
      });
    }

    // Then test review
    const testResult = await testReview(config);

    res.json({
      data: {
        testReview: testResult,
        healthCheck: healthResult,
      },
    });
  } catch (error) {
    logger.error('Test review error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during test review',
      },
    });
  }
});

/**
 * GET /prd-reviews/statistics
 * Get PRD review statistics
 */
router.get('/statistics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view PRD review statistics',
        },
      });
    }

    const [total, drafts, processing, completed, finalized] = await Promise.all([
      prisma.prdReview.count(),
      prisma.prdReview.count({ where: { status: 'DRAFT' } }),
      prisma.prdReview.count({ where: { status: 'PROCESSING' } }),
      prisma.prdReview.count({ where: { status: 'COMPLETED' } }),
      prisma.prdReview.count({ where: { status: 'FINALIZED' } }),
    ]);

    res.json({
      data: {
        statistics: {
          total,
          drafts,
          processing,
          completed,
          finalized,
        },
      },
    });
  } catch (error) {
    logger.error('Get statistics error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching statistics',
      },
    });
  }
});

/**
 * GET /prd-reviews
 * List PRD reviews (dashboard view)
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view PRD reviews',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.requesterName) {
      where.requesterName = { contains: query.requesterName, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
        { requesterName: { contains: query.search, mode: 'insensitive' } },
        { requestId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [reviews, total] = await prisma.$transaction([
      prisma.prdReview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.prdReview.count({ where }),
    ]);

    res.json({
      data: {
        reviews: reviews.map((review) => ({
          id: review.id.toString(),
          requestId: review.requestId,
          title: review.title,
          content: review.content.length > 500 ? review.content.substring(0, 500) + '...' : review.content, // Truncated for list view
          fullContent: review.content, // Include full content
          requesterName: review.requesterName,
          confluenceUrl: review.confluenceUrl,
          pageId: review.pageId,
          aiReview: review.aiReview,
          status: review.status,
          syncedAt: review.syncedAt?.toISOString() || null,
          createdAt: review.createdAt.toISOString(),
          updatedAt: review.updatedAt.toISOString(),
        })),
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

    logger.error('List PRD reviews error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching PRD reviews',
      },
    });
  }
});

/**
 * GET /prd-reviews/:id
 * Get a specific PRD review
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view PRD reviews',
        },
      });
    }

    const reviewId = BigInt(req.params.id);

    const prdReview = await prisma.prdReview.findUnique({
      where: { id: reviewId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!prdReview) {
      return res.status(404).json({
        error: {
          code: 'PRD_REVIEW_NOT_FOUND',
          message: 'PRD review not found',
        },
      });
    }

    res.json({
      data: {
        review: {
          id: prdReview.id.toString(),
          requestId: prdReview.requestId,
          title: prdReview.title,
          content: prdReview.content,
          requesterName: prdReview.requesterName,
          confluenceUrl: prdReview.confluenceUrl,
          pageId: prdReview.pageId,
          aiReview: prdReview.aiReview,
          status: prdReview.status,
          syncedAt: prdReview.syncedAt?.toISOString() || null,
          metadata: prdReview.metadata,
          createdBy: prdReview.createdBy?.toString() || null,
          creator: prdReview.creator,
          createdAt: prdReview.createdAt.toISOString(),
          updatedAt: prdReview.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get PRD review error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching PRD review',
      },
    });
  }
});

/**
 * POST /prd-reviews
 * Submit a new PRD review request
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to submit PRD reviews',
        },
      });
    }

    const data = createPrdReviewSchema.parse(req.body);
    const config = await getGoogleAppsScriptConfig();

    if (!config.scriptUrl) {
      return res.status(400).json({
        error: {
          code: 'CONFIGURATION_MISSING',
          message: 'Google Apps Script URL is not configured. Please configure it in settings.',
        },
      });
    }

    // Generate unique request ID
    const requestId = generateRequestId();

    // Submit to Google Apps Script
    const submissionResult = await submitReviewRequest(config, {
      requesterName: data.requesterName.trim(),
      title: data.title.trim(),
      content: data.content.trim(),
      confluenceUrl: data.confluenceUrl?.trim() || undefined,
    });

    if (!submissionResult.success) {
      return res.status(500).json({
        error: {
          code: 'SUBMISSION_FAILED',
          message: submissionResult.message || 'Failed to submit review request to Google Apps Script',
        },
      });
    }

    // Use request ID from submission result if available, otherwise use generated one
    const finalRequestId = submissionResult.requestId || requestId;

    // Store in local database
    const prdReview = await prisma.prdReview.create({
      data: {
        requestId: finalRequestId,
        title: data.title.trim(),
        content: data.content.trim(),
        requesterName: data.requesterName.trim(),
        confluenceUrl: data.confluenceUrl?.trim() || null,
        status: 'DRAFT',
        projectId: data.projectId ? BigInt(data.projectId) : null,
        createdBy: userId,
        updatedBy: userId,
        metadata: {
          submittedAt: new Date().toISOString(),
          submissionResult: submissionResult.data,
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
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
          modelType: 'prd_review',
          modelId: prdReview.id,
          newValues: {
            requestId: prdReview.requestId,
            title: prdReview.title,
            status: prdReview.status,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`PRD review submitted: ${prdReview.requestId} by user ${userId}`);

    res.status(201).json({
      data: {
        review: {
          id: prdReview.id.toString(),
          requestId: prdReview.requestId,
          title: prdReview.title,
          status: prdReview.status,
          requesterName: prdReview.requesterName,
          createdAt: prdReview.createdAt.toISOString(),
        },
        submission: {
          success: true,
          message: submissionResult.message,
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

    logger.error('Submit PRD review error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while submitting PRD review',
      },
    });
  }
});

/**
 * POST /prd-reviews/sync
 * Sync reviews from Google Sheets
 */
router.post('/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to sync PRD reviews',
        },
      });
    }

    const config = await getGoogleAppsScriptConfig();

    if (!config.scriptUrl || !config.sheetsId) {
      return res.status(400).json({
        error: {
          code: 'CONFIGURATION_MISSING',
          message: 'Google Apps Script URL and Google Sheets ID must be configured',
        },
      });
    }

    // Fetch reviews from Google Sheets
    const fetchResult = await fetchReviewsFromSheets(config);

    if (!fetchResult.success || !fetchResult.reviews) {
      return res.status(500).json({
        error: {
          code: 'SYNC_FAILED',
          message: fetchResult.message || 'Failed to fetch reviews from Google Sheets',
        },
      });
    }

    // Sync to local database
    const syncResults = await Promise.allSettled(
      fetchResult.reviews.map(async (sheetReview) => {
        const existing = await prisma.prdReview.findUnique({
          where: { requestId: sheetReview.requestId },
        });

        const reviewData: any = {
          requestId: sheetReview.requestId,
          title: sheetReview.title,
          requesterName: sheetReview.requester,
          status: sheetReview.status || 'DRAFT',
          aiReview: sheetReview.aiReview || null,
          confluenceUrl: sheetReview.confluenceUrl || null,
          pageId: sheetReview.pageId || null,
          syncedAt: new Date(),
          updatedBy: userId,
        };

        if (existing) {
          return await prisma.prdReview.update({
            where: { id: existing.id },
            data: reviewData,
          });
        } else {
          return await prisma.prdReview.create({
            data: {
              ...reviewData,
              content: '', // Content not in sheets, will be empty
              createdBy: userId,
            },
          });
        }
      })
    );

    const successful = syncResults.filter((r) => r.status === 'fulfilled').length;
    const failed = syncResults.filter((r) => r.status === 'rejected').length;

    logger.info(`PRD review sync completed: ${successful} successful, ${failed} failed`);

    res.json({
      data: {
        message: `Sync completed: ${successful} reviews synced, ${failed} failed`,
        synced: successful,
        failed,
        total: fetchResult.reviews.length,
      },
    });
  } catch (error) {
    logger.error('Sync PRD reviews error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while syncing PRD reviews',
      },
    });
  }
});

/**
 * POST /prd-reviews/background-sync
 * Background sync endpoint (can be called by cron jobs)
 */
router.post('/background-sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Similar to sync but without requiring authentication (or with service token)
    // For now, require authentication but can be modified for cron jobs
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant',
        },
      });
    }

    // Use the same sync logic
    const config = await getGoogleAppsScriptConfig();
    const fetchResult = await fetchReviewsFromSheets(config);

    if (fetchResult.success && fetchResult.reviews) {
      // Background sync - don't wait for all results
      fetchReviewsFromSheets(config).then((result) => {
        if (result.success && result.reviews) {
          // Process in background
          result.reviews.forEach(async (sheetReview) => {
            try {
              const existing = await prisma.prdReview.findUnique({
                where: { requestId: sheetReview.requestId },
              });

              const reviewData: any = {
                requestId: sheetReview.requestId,
                title: sheetReview.title,
                requesterName: sheetReview.requester,
                status: sheetReview.status || 'DRAFT',
                aiReview: sheetReview.aiReview || null,
                confluenceUrl: sheetReview.confluenceUrl || null,
                pageId: sheetReview.pageId || null,
                syncedAt: new Date(),
              };

              if (existing) {
                await prisma.prdReview.update({
                  where: { id: existing.id },
                  data: reviewData,
                });
              } else {
                await prisma.prdReview.create({
                  data: {
                    ...reviewData,
                    content: '',
                    createdBy: userId,
                  },
                });
              }
            } catch (error) {
              logger.error(`Failed to sync review ${sheetReview.requestId}:`, error);
            }
          });
        }
      });
    }

    res.json({
      data: {
        message: 'Background sync initiated',
      },
    });
  } catch (error) {
    logger.error('Background sync error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while initiating background sync',
      },
    });
  }
});

/**
 * PATCH /prd-reviews/:id
 * Update a PRD review
 */
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const reviewId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update PRD reviews',
        },
      });
    }

    const existing = await prisma.prdReview.findUnique({
      where: { id: reviewId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'PRD_REVIEW_NOT_FOUND',
          message: 'PRD review not found',
        },
      });
    }

    const data = updatePrdReviewSchema.parse(req.body);

    const updateData: any = {
      updatedBy: userId,
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.content !== undefined) updateData.content = data.content.trim();
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Track status changes in metadata
      const metadata = (existing.metadata as any) || {};
      if (!metadata.statusHistory) metadata.statusHistory = [];
      metadata.statusHistory.push({
        from: existing.status,
        to: data.status,
        at: new Date().toISOString(),
        userId: userId.toString(),
      });
      updateData.metadata = metadata;
    }
    if (data.aiReview !== undefined) updateData.aiReview = data.aiReview?.trim() || null;
    if (data.comments !== undefined) updateData.comments = data.comments?.trim() || null;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const prdReview = await prisma.prdReview.update({
      where: { id: reviewId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'prd_review',
          modelId: prdReview.id,
          oldValues: {
            status: existing.status,
            title: existing.title,
          },
          newValues: {
            status: prdReview.status,
            title: prdReview.title,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`PRD review updated: ${prdReview.requestId} by user ${userId}`);

    res.json({
      data: {
        review: {
          id: prdReview.id.toString(),
          requestId: prdReview.requestId,
          title: prdReview.title,
          status: prdReview.status,
          aiReview: prdReview.aiReview,
          updatedAt: prdReview.updatedAt.toISOString(),
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

    logger.error('Update PRD review error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating PRD review',
      },
    });
  }
});

export default router;
