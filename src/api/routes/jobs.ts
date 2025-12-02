import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  populateAllAnalyticsSummaries,
  populateYesterdayAnalytics,
  populateRecentAnalytics,
} from '../../jobs/populate-analytics-summaries';
import {
  updateAllTestRunsViews,
  updateRecentTestRunsViews,
  updateTestRunsView,
} from '../../jobs/update-test-runs-view';

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

// Trigger analytics population schema
const populateAnalyticsSchema = z.object({
  startDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform((val) => val ? new Date(val) : undefined),
  days: z.number().int().positive().optional(),
  yesterday: z.boolean().optional(),
});

// Populate analytics summaries
router.post('/jobs/populate-analytics', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to run jobs',
        },
      });
    }

    // TODO: Add permission check for admin users only
    // For now, allow any authenticated user

    const data = populateAnalyticsSchema.parse(req.body);

    // Run job asynchronously
    const jobPromise = (async () => {
      try {
        if (data.yesterday) {
          await populateYesterdayAnalytics();
        } else if (data.days) {
          await populateRecentAnalytics(data.days);
        } else if (data.startDate && data.endDate) {
          await populateAllAnalyticsSummaries(data.startDate, data.endDate);
        } else {
          // Default to yesterday
          await populateYesterdayAnalytics();
        }
        logger.info(`Analytics population job completed by user ${userId}`);
      } catch (error) {
        logger.error('Analytics population job failed:', error);
      }
    })();

    // Don't wait for completion
    jobPromise.catch((err) => logger.error('Job promise error:', err));

    res.json({
      message: 'Analytics population job started',
      status: 'running',
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
    logger.error('Trigger analytics population error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while triggering analytics population',
      },
    });
  }
});

// Update test runs view
router.post('/jobs/update-test-runs-view', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to run jobs',
        },
      });
    }

    const testRunId = req.body.testRunId ? BigInt(req.body.testRunId) : null;
    const days = req.body.days ? parseInt(req.body.days, 10) : null;

    // Run job asynchronously
    const jobPromise = (async () => {
      try {
        if (testRunId) {
          await updateTestRunsView(testRunId);
        } else if (days) {
          await updateRecentTestRunsViews(days);
        } else {
          await updateAllTestRunsViews();
        }
        logger.info(`Test runs view update job completed by user ${userId}`);
      } catch (error) {
        logger.error('Test runs view update job failed:', error);
      }
    })();

    // Don't wait for completion
    jobPromise.catch((err) => logger.error('Job promise error:', err));

    res.json({
      message: 'Test runs view update job started',
      status: 'running',
    });
  } catch (error) {
    logger.error('Trigger test runs view update error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while triggering test runs view update',
      },
    });
  }
});

export default router;

