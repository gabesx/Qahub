import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';

const router = Router();

// ========================================
// ALLURE REPORTS
// ========================================

const allureReportQuerySchema = z.object({
  status: z.string().optional(),
  name: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

const createAllureReportSchema = z.object({
  name: z.string().min(1).max(255),
  version: z.string().max(255).optional().nullable(),
  summary: z.any().optional().nullable(),
  status: z.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  executionStartedAt: z.string().datetime().optional().nullable(),
  executionStoppedAt: z.string().datetime().optional().nullable(),
});

/**
 * GET /analytics/allure-reports
 * List Allure reports
 */
router.get('/allure-reports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view Allure reports',
        },
      });
    }

    const query = allureReportQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' };

    const [reports, total] = await prisma.$transaction([
      prisma.allureReport.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          updater: { select: { id: true, name: true, email: true } },
          scenarios: {
            include: {
              steps: true,
            },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.allureReport.count({ where }),
    ]);

    res.json({
      data: {
        reports: reports.map((r) => ({
          id: r.id.toString(),
          name: r.name,
          version: r.version,
          summary: r.summary,
          status: r.status,
          executionStartedAt: r.executionStartedAt?.toISOString() || null,
          executionStoppedAt: r.executionStoppedAt?.toISOString() || null,
          createdBy: r.createdBy?.toString() || null,
          creator: r.creator,
          updatedBy: r.updatedBy?.toString() || null,
          updater: r.updater,
          scenarios: r.scenarios.map((s) => ({
            id: s.id.toString(),
            name: s.name,
            status: s.status,
            duration: s.duration,
            steps: s.steps.map((st) => ({
              id: st.id.toString(),
              name: st.name,
              status: st.status,
              duration: st.duration,
              errorMessage: st.errorMessage,
            })),
          })),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
      });
    }
    logger.error('List Allure reports error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while fetching Allure reports' },
    });
  }
});

/**
 * POST /analytics/allure-reports
 * Create Allure report
 */
router.post('/allure-reports', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: { code: 'NO_TENANT', message: 'You must belong to a tenant to create Allure reports' },
      });
    }

    const data = createAllureReportSchema.parse(req.body);

    const report = await prisma.allureReport.create({
      data: {
        name: data.name.trim(),
        version: data.version?.trim() || null,
        summary: data.summary || null,
        status: data.status || 'pending',
        executionStartedAt: data.executionStartedAt ? new Date(data.executionStartedAt) : null,
        executionStoppedAt: data.executionStoppedAt ? new Date(data.executionStoppedAt) : null,
        createdBy: userId,
        updatedBy: userId,
      },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      data: {
        report: {
          id: report.id.toString(),
          name: report.name,
          version: report.version,
          summary: report.summary,
          status: report.status,
          executionStartedAt: report.executionStartedAt?.toISOString() || null,
          executionStoppedAt: report.executionStoppedAt?.toISOString() || null,
          createdBy: report.createdBy?.toString() || null,
          creator: report.creator,
          createdAt: report.createdAt.toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input data', details: error.errors },
      });
    }
    logger.error('Create Allure report error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while creating Allure report' },
    });
  }
});

// ========================================
// GITLAB MR LEAD TIMES
// ========================================

const gitlabMrQuerySchema = z.object({
  projectName: z.string().optional(),
  projectId: z.string().optional(),
  author: z.string().optional(),
  authorId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /analytics/gitlab/mr-lead-times
 * List GitLab MR lead times
 */
router.get('/gitlab/mr-lead-times', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: { code: 'NO_TENANT', message: 'You must belong to a tenant to view GitLab MR lead times' },
      });
    }

    const query = gitlabMrQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.projectName) where.projectName = query.projectName;
    if (query.projectId) where.projectId = BigInt(query.projectId);
    if (query.author) where.author = query.author;
    if (query.authorId) where.authorId = BigInt(query.authorId);
    if (query.startDate || query.endDate) {
      where.mrCreatedAt = {};
      if (query.startDate) where.mrCreatedAt.gte = new Date(query.startDate);
      if (query.endDate) where.mrCreatedAt.lte = new Date(query.endDate);
    }

    const [leadTimes, total] = await prisma.$transaction([
      prisma.gitlabMrLeadTime.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          authorUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { mrCreatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gitlabMrLeadTime.count({ where }),
    ]);

    res.json({
      data: {
        leadTimes: leadTimes.map((lt) => ({
          id: lt.id.toString(),
          projectName: lt.projectName,
          projectId: lt.projectId?.toString() || null,
          project: lt.project,
          mrId: lt.mrId,
          title: lt.title,
          author: lt.author,
          authorId: lt.authorId?.toString() || null,
          authorUser: lt.authorUser,
          mrCreatedAt: lt.mrCreatedAt.toISOString(),
          mergedAt: lt.mergedAt?.toISOString() || null,
          leadTimeHours: lt.leadTimeHours,
          createdAt: lt.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
      });
    }
    logger.error('List GitLab MR lead times error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while fetching GitLab MR lead times' },
    });
  }
});

// ========================================
// GITLAB MR CONTRIBUTORS
// ========================================

const gitlabContributorQuerySchema = z.object({
  projectName: z.string().optional(),
  projectId: z.string().optional(),
  username: z.string().optional(),
  userId: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /analytics/gitlab/contributors
 * List GitLab MR contributors
 */
router.get('/gitlab/contributors', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: { code: 'NO_TENANT', message: 'You must belong to a tenant to view GitLab contributors' },
      });
    }

    const query = gitlabContributorQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.projectName) where.projectName = query.projectName;
    if (query.projectId) where.projectId = BigInt(query.projectId);
    if (query.username) where.username = query.username;
    if (query.userId) where.userId = BigInt(query.userId);

    const [contributors, total] = await prisma.$transaction([
      prisma.gitlabMrContributor.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { contributions: 'desc' },
        skip,
        take: limit,
      }),
      prisma.gitlabMrContributor.count({ where }),
    ]);

    res.json({
      data: {
        contributors: contributors.map((c) => ({
          id: c.id.toString(),
          projectName: c.projectName,
          projectId: c.projectId?.toString() || null,
          project: c.project,
          username: c.username,
          userId: c.userId?.toString() || null,
          user: c.user,
          name: c.name,
          email: c.email,
          contributions: c.contributions,
          createdAt: c.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
      });
    }
    logger.error('List GitLab contributors error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while fetching GitLab contributors' },
    });
  }
});

// ========================================
// JIRA LEAD TIMES
// ========================================

const jiraLeadTimeQuerySchema = z.object({
  projectKey: z.string().optional(),
  projectId: z.string().optional(),
  issueKey: z.string().optional(),
  bugBudgetId: z.string().optional(),
  status: z.string().optional(),
  issueType: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /analytics/jira/lead-times
 * List Jira lead times
 */
router.get('/jira/lead-times', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: { code: 'NO_TENANT', message: 'You must belong to a tenant to view Jira lead times' },
      });
    }

    const query = jiraLeadTimeQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.projectKey) where.projectKey = query.projectKey;
    if (query.projectId) where.projectId = BigInt(query.projectId);
    if (query.issueKey) where.issueKey = query.issueKey;
    if (query.bugBudgetId) where.bugBudgetId = BigInt(query.bugBudgetId);
    if (query.status) where.status = query.status;
    if (query.issueType) where.issueType = query.issueType;
    if (query.startDate || query.endDate) {
      where.issueCreatedAt = {};
      if (query.startDate) where.issueCreatedAt.gte = new Date(query.startDate);
      if (query.endDate) where.issueCreatedAt.lte = new Date(query.endDate);
    }

    const [leadTimes, total] = await prisma.$transaction([
      prisma.jiraLeadTime.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          bugBudget: { select: { id: true, jiraKey: true, summary: true } },
        },
        orderBy: { issueCreatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.jiraLeadTime.count({ where }),
    ]);

    res.json({
      data: {
        leadTimes: leadTimes.map((lt) => ({
          id: lt.id.toString(),
          projectKey: lt.projectKey,
          projectId: lt.projectId?.toString() || null,
          project: lt.project,
          issueKey: lt.issueKey,
          bugBudgetId: lt.bugBudgetId?.toString() || null,
          bugBudget: lt.bugBudget,
          issueType: lt.issueType,
          status: lt.status,
          issueCreatedAt: lt.issueCreatedAt.toISOString(),
          resolvedAt: lt.resolvedAt?.toISOString() || null,
          leadTimeHours: lt.leadTimeHours,
          createdAt: lt.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
      });
    }
    logger.error('List Jira lead times error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while fetching Jira lead times' },
    });
  }
});

// ========================================
// MONTHLY CONTRIBUTIONS
// ========================================

const monthlyContributionQuerySchema = z.object({
  year: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  month: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  username: z.string().optional(),
  userId: z.string().optional(),
  squad: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /analytics/monthly-contributions
 * List monthly contributions
 */
router.get('/monthly-contributions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: { code: 'NO_TENANT', message: 'You must belong to a tenant to view monthly contributions' },
      });
    }

    const query = monthlyContributionQuerySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.year) where.year = query.year;
    if (query.month) where.month = query.month;
    if (query.username) where.username = query.username;
    if (query.userId) where.userId = BigInt(query.userId);
    if (query.squad) where.squad = query.squad;

    const [contributions, total] = await prisma.$transaction([
      prisma.monthlyContribution.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { totalEvents: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.monthlyContribution.count({ where }),
    ]);

    res.json({
      data: {
        contributions: contributions.map((c) => ({
          id: c.id.toString(),
          year: c.year,
          month: c.month,
          monthName: c.monthName,
          username: c.username,
          userId: c.userId?.toString() || null,
          user: c.user,
          name: c.name,
          squad: c.squad,
          mrCreated: c.mrCreated,
          mrApproved: c.mrApproved,
          repoPushes: c.repoPushes,
          totalEvents: c.totalEvents,
          createdAt: c.createdAt.toISOString(),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.errors },
      });
    }
    logger.error('List monthly contributions error:', error);
    res.status(500).json({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'An error occurred while fetching monthly contributions' },
    });
  }
});

export default router;

