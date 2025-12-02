import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { checkDatabaseConnection, disconnectDatabase } from './shared/infrastructure/database';
import { logger } from './shared/utils/logger';
import { initializeReadModelListeners } from './shared/events/read-model-listeners';

// Load environment variables
dotenv.config();

// Initialize event listeners for read models (must be done before routes)
initializeReadModelListeners();

const app = express();
const PORT = process.env.PORT || 3001;
const API_VERSION = process.env.API_VERSION || 'v1';

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()) || ['*'];
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // If CORS_ORIGIN is '*', allow all origins
    if (corsOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Also check for localhost variations
    const normalizedOrigin = origin.replace('127.0.0.1', 'localhost');
    if (corsOrigins.some(allowed => allowed.replace('127.0.0.1', 'localhost') === normalizedOrigin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
};

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (avatars, uploads)
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(uploadDir));

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    message: 'QaHub API Server',
    version: API_VERSION,
    status: 'running',
    endpoints: {
      health: '/health',
      api: `/api/${API_VERSION}`,
      auth: `/api/${API_VERSION}/auth/login`,
    },
    documentation: 'See /api/v1 for API details',
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbConnected = await checkDatabaseConnection();
  
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
});

// API routes
import authRoutes from './api/routes/auth';
import userRoutes from './api/routes/users';
import tokenRoutes from './api/routes/tokens';
import invitationRoutes from './api/routes/invitations';
import projectRoutes from './api/routes/projects';
import permissionRoutes from './api/routes/permissions';
import roleRoutes from './api/routes/roles';
import suiteRoutes from './api/routes/suites';
import testCaseRoutes from './api/routes/test-cases';
import testPlanRoutes from './api/routes/test-plans';
import testCaseCommentRoutes from './api/routes/test-case-comments';
import testRunRoutes from './api/routes/test-runs';
import testRunResultRoutes from './api/routes/test-run-results';
import testRunAttachmentRoutes from './api/routes/test-run-attachments';
import testRunCommentRoutes from './api/routes/test-run-comments';
import documentRoutes from './api/routes/documents';
import documentVersionRoutes from './api/routes/document-versions';
import documentCommentRoutes from './api/routes/document-comments';
import documentEngagementRoutes from './api/routes/document-engagements';
import documentTemplateRoutes from './api/routes/document-templates';
import editorImageRoutes from './api/routes/editor-images';
import analyticsRoutes from './api/routes/analytics';
import menuVisibilityRoutes from './api/routes/menu-visibilities';
import notificationRoutes from './api/routes/notifications';
import notificationSSERoutes from './api/routes/notifications-sse';
import settingRoutes from './api/routes/settings';
import testRunsViewRoutes from './api/routes/test-runs-view';
import bugBudgetRoutes from './api/routes/bug-budget';
import bugBudgetMetadataRoutes from './api/routes/bug-budget-metadata';
import jiraFieldRoutes from './api/routes/jira-fields';
import jobsRoutes from './api/routes/jobs';
import changeLogRoutes from './api/routes/change-logs';
import decisionLogRoutes from './api/routes/decision-logs';
import entityMetadataRoutes from './api/routes/entity-metadata';
import prdReviewRoutes from './api/routes/prd-reviews';
import auditEventRoutes from './api/routes/audit-events';
import archiveRoutes from './api/routes/archive';
import analyticsIntegrationsRoutes from './api/routes/analytics-integrations';
import workflowSagaRoutes from './api/routes/workflow-sagas';
import bugBudgetViewRoutes from './api/routes/bug-budget-view';

app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    message: 'QaHub API',
    version: API_VERSION,
    status: 'running',
    endpoints: {
      auth: {
        login: `POST /api/${API_VERSION}/auth/login`,
        register: `POST /api/${API_VERSION}/users/register`,
        verify: `GET /api/${API_VERSION}/auth/verify`,
        forgotPassword: `POST /api/${API_VERSION}/auth/forgot-password`,
        resetPassword: `POST /api/${API_VERSION}/auth/reset-password`,
      },
      users: {
        me: `GET /api/${API_VERSION}/users/me`,
        updateProfile: `PATCH /api/${API_VERSION}/users/me`,
        changePassword: `POST /api/${API_VERSION}/users/change-password`,
        list: `GET /api/${API_VERSION}/users`,
        getById: `GET /api/${API_VERSION}/users/:id`,
      },
      tokens: {
        create: `POST /api/${API_VERSION}/tokens`,
        list: `GET /api/${API_VERSION}/tokens`,
        getById: `GET /api/${API_VERSION}/tokens/:id`,
        revoke: `DELETE /api/${API_VERSION}/tokens/:id`,
        revokeAll: `DELETE /api/${API_VERSION}/tokens`,
      },
      permissions: {
        list: `GET /api/${API_VERSION}/permissions`,
        getById: `GET /api/${API_VERSION}/permissions/:id`,
        create: `POST /api/${API_VERSION}/permissions`,
        update: `PATCH /api/${API_VERSION}/permissions/:id`,
        delete: `DELETE /api/${API_VERSION}/permissions/:id`,
      },
      roles: {
        list: `GET /api/${API_VERSION}/roles`,
        getById: `GET /api/${API_VERSION}/roles/:id`,
        create: `POST /api/${API_VERSION}/roles`,
        update: `PATCH /api/${API_VERSION}/roles/:id`,
        delete: `DELETE /api/${API_VERSION}/roles/:id`,
        assignPermissions: `POST /api/${API_VERSION}/roles/:id/permissions`,
        removePermission: `DELETE /api/${API_VERSION}/roles/:id/permissions/:permissionId`,
      },
      projects: {
        list: `GET /api/${API_VERSION}/projects`,
        getById: `GET /api/${API_VERSION}/projects/:id`,
        create: `POST /api/${API_VERSION}/projects`,
        update: `PATCH /api/${API_VERSION}/projects/:id`,
        delete: `DELETE /api/${API_VERSION}/projects/:id`,
        repositories: {
          list: `GET /api/${API_VERSION}/projects/:id/repositories`,
          getById: `GET /api/${API_VERSION}/projects/:id/repositories/:repoId`,
          create: `POST /api/${API_VERSION}/projects/:id/repositories`,
        },
        suites: {
          list: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites`,
          getById: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId`,
          create: `POST /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites`,
          update: `PATCH /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId`,
          delete: `DELETE /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId`,
        },
        testCases: {
          list: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases`,
          getById: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId`,
          create: `POST /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases`,
          update: `PATCH /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId`,
          delete: `DELETE /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId`,
          restore: `POST /api/${API_VERSION}/projects/:projectId/repositories/:repoId/suites/:suiteId/test-cases/:testCaseId/restore`,
        },
        testPlans: {
          list: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans`,
          getById: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans/:testPlanId`,
          create: `POST /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans`,
          update: `PATCH /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans/:testPlanId`,
          delete: `DELETE /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans/:testPlanId`,
          addTestCases: `POST /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans/:testPlanId/test-cases`,
          removeTestCase: `DELETE /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans/:testPlanId/test-cases/:testCaseId`,
          updateOrder: `PATCH /api/${API_VERSION}/projects/:projectId/repositories/:repoId/test-plans/:testPlanId/test-cases/:testCaseId/order`,
        },
      },
      testCaseComments: {
        list: `GET /api/${API_VERSION}/test-cases/:testCaseId/comments`,
        getById: `GET /api/${API_VERSION}/test-cases/:testCaseId/comments/:commentId`,
        create: `POST /api/${API_VERSION}/test-cases/:testCaseId/comments`,
        update: `PATCH /api/${API_VERSION}/test-cases/:testCaseId/comments/:commentId`,
        delete: `DELETE /api/${API_VERSION}/test-cases/:testCaseId/comments/:commentId`,
        restore: `POST /api/${API_VERSION}/test-cases/:testCaseId/comments/:commentId/restore`,
      },
      testRuns: {
        list: `GET /api/${API_VERSION}/projects/:projectId/test-runs`,
        getById: `GET /api/${API_VERSION}/projects/:projectId/test-runs/:testRunId`,
        create: `POST /api/${API_VERSION}/projects/:projectId/test-runs`,
        update: `PATCH /api/${API_VERSION}/projects/:projectId/test-runs/:testRunId`,
        delete: `DELETE /api/${API_VERSION}/projects/:projectId/test-runs/:testRunId`,
        results: {
          list: `GET /api/${API_VERSION}/test-runs/:testRunId/results`,
          getById: `GET /api/${API_VERSION}/test-runs/:testRunId/results/:resultId`,
          create: `POST /api/${API_VERSION}/test-runs/:testRunId/results`,
          update: `PATCH /api/${API_VERSION}/test-runs/:testRunId/results/:resultId`,
        },
        attachments: {
          list: `GET /api/${API_VERSION}/test-runs/:testRunId/attachments`,
          create: `POST /api/${API_VERSION}/test-runs/:testRunId/attachments`,
          delete: `DELETE /api/${API_VERSION}/test-runs/:testRunId/attachments/:attachmentId`,
        },
        comments: {
          list: `GET /api/${API_VERSION}/test-runs/:testRunId/comments`,
          getById: `GET /api/${API_VERSION}/test-runs/:testRunId/comments/:commentId`,
          create: `POST /api/${API_VERSION}/test-runs/:testRunId/comments`,
          update: `PATCH /api/${API_VERSION}/test-runs/:testRunId/comments/:commentId`,
          delete: `DELETE /api/${API_VERSION}/test-runs/:testRunId/comments/:commentId`,
        },
      },
      documents: {
        list: `GET /api/${API_VERSION}/projects/:projectId/documents`,
        getById: `GET /api/${API_VERSION}/projects/:projectId/documents/:documentId`,
        create: `POST /api/${API_VERSION}/projects/:projectId/documents`,
        update: `PATCH /api/${API_VERSION}/projects/:projectId/documents/:documentId`,
        delete: `DELETE /api/${API_VERSION}/projects/:projectId/documents/:documentId`,
        versions: {
          list: `GET /api/${API_VERSION}/documents/:documentId/versions`,
          getById: `GET /api/${API_VERSION}/documents/:documentId/versions/:versionId`,
          create: `POST /api/${API_VERSION}/documents/:documentId/versions`,
        },
        comments: {
          list: `GET /api/${API_VERSION}/documents/:documentId/comments`,
          getById: `GET /api/${API_VERSION}/documents/:documentId/comments/:commentId`,
          create: `POST /api/${API_VERSION}/documents/:documentId/comments`,
          update: `PATCH /api/${API_VERSION}/documents/:documentId/comments/:commentId`,
          delete: `DELETE /api/${API_VERSION}/documents/:documentId/comments/:commentId`,
        },
        engagements: {
          list: `GET /api/${API_VERSION}/documents/:documentId/engagements`,
          create: `POST /api/${API_VERSION}/documents/:documentId/engagements`,
          delete: `DELETE /api/${API_VERSION}/documents/:documentId/engagements/:engagementId`,
        },
      },
      documentTemplates: {
        list: `GET /api/${API_VERSION}/document-templates`,
        getById: `GET /api/${API_VERSION}/document-templates/:templateId`,
        create: `POST /api/${API_VERSION}/document-templates`,
        update: `PATCH /api/${API_VERSION}/document-templates/:templateId`,
        delete: `DELETE /api/${API_VERSION}/document-templates/:templateId`,
      },
      editorImages: {
        list: `GET /api/${API_VERSION}/editor/images`,
        getById: `GET /api/${API_VERSION}/editor/images/:imageId`,
        upload: `POST /api/${API_VERSION}/editor/images`,
        delete: `DELETE /api/${API_VERSION}/editor/images/:imageId`,
      },
      analytics: {
        testExecution: `GET /api/${API_VERSION}/projects/:projectId/analytics/test-execution`,
        bugs: `GET /api/${API_VERSION}/projects/:projectId/analytics/bugs`,
        testCases: `GET /api/${API_VERSION}/projects/:projectId/repositories/:repositoryId/analytics/test-cases`,
      },
      menuVisibilities: {
        list: `GET /api/${API_VERSION}/menu-visibilities`,
        getByKey: `GET /api/${API_VERSION}/menu-visibilities/:menuKey`,
        getTree: `GET /api/${API_VERSION}/menu-visibilities/tree`,
        create: `POST /api/${API_VERSION}/menu-visibilities`,
        update: `PATCH /api/${API_VERSION}/menu-visibilities/:menuKey`,
        bulkUpdate: `PATCH /api/${API_VERSION}/menu-visibilities/bulk`,
        delete: `DELETE /api/${API_VERSION}/menu-visibilities/:menuKey`,
      },
      notifications: {
        list: `GET /api/${API_VERSION}/notifications`,
        getById: `GET /api/${API_VERSION}/notifications/:id`,
        getStats: `GET /api/${API_VERSION}/notifications/stats`,
        create: `POST /api/${API_VERSION}/notifications`,
        update: `PATCH /api/${API_VERSION}/notifications/:id`,
        markAllRead: `POST /api/${API_VERSION}/notifications/mark-all-read`,
        bulkDelete: `DELETE /api/${API_VERSION}/notifications/bulk`,
        delete: `DELETE /api/${API_VERSION}/notifications/:id`,
        stream: `GET /api/${API_VERSION}/notifications/stream` + ' (SSE - Server-Sent Events)',
        connections: `GET /api/${API_VERSION}/notifications/stream/connections`,
      },
      settings: {
        list: `GET /api/${API_VERSION}/settings`,
        getByKey: `GET /api/${API_VERSION}/settings/:key`,
        getByCategory: `GET /api/${API_VERSION}/settings/category/:category`,
        create: `POST /api/${API_VERSION}/settings`,
        update: `PATCH /api/${API_VERSION}/settings/:key`,
        bulkUpdate: `PATCH /api/${API_VERSION}/settings/bulk`,
        delete: `DELETE /api/${API_VERSION}/settings/:key`,
      },
      testRunsView: {
        list: `GET /api/${API_VERSION}/test-runs-view`,
        getById: `GET /api/${API_VERSION}/test-runs-view/:id`,
      },
      bugBudget: {
        list: `GET /api/${API_VERSION}/bug-budget`,
        getById: `GET /api/${API_VERSION}/bug-budget/:id`,
        create: `POST /api/${API_VERSION}/bug-budget`,
        update: `PATCH /api/${API_VERSION}/bug-budget/:id`,
        delete: `DELETE /api/${API_VERSION}/bug-budget/:id`,
        metadata: {
          get: `GET /api/${API_VERSION}/bug-budget/:id/metadata`,
          update: `PUT /api/${API_VERSION}/bug-budget/:id/metadata`,
        },
      },
      jiraFields: {
        list: `GET /api/${API_VERSION}/jira-fields`,
        getById: `GET /api/${API_VERSION}/jira-fields/:id`,
        create: `POST /api/${API_VERSION}/jira-fields`,
        update: `PATCH /api/${API_VERSION}/jira-fields/:id`,
        delete: `DELETE /api/${API_VERSION}/jira-fields/:id`,
      },
      jobs: {
        populateAnalytics: `POST /api/${API_VERSION}/jobs/populate-analytics`,
        updateTestRunsView: `POST /api/${API_VERSION}/jobs/update-test-runs-view`,
      },
      changeLogs: {
        list: `GET /api/${API_VERSION}/change-logs`,
        getById: `GET /api/${API_VERSION}/change-logs/:id`,
        getRecordHistory: `GET /api/${API_VERSION}/change-logs/table/:tableName/record/:recordId`,
        statistics: `GET /api/${API_VERSION}/change-logs/statistics/summary`,
      },
      decisionLogs: {
        list: `GET /api/${API_VERSION}/decision-logs`,
        getById: `GET /api/${API_VERSION}/decision-logs/:id`,
        create: `POST /api/${API_VERSION}/decision-logs`,
        update: `PATCH /api/${API_VERSION}/decision-logs/:id`,
        delete: `DELETE /api/${API_VERSION}/decision-logs/:id`,
      },
      entityMetadata: {
        list: `GET /api/${API_VERSION}/entity-metadata`,
        getById: `GET /api/${API_VERSION}/entity-metadata/:id`,
        getByEntity: `GET /api/${API_VERSION}/entity-metadata/entity/:entityType/:entityId`,
        create: `POST /api/${API_VERSION}/entity-metadata`,
        update: `PATCH /api/${API_VERSION}/entity-metadata/:id`,
        bulkUpdate: `PUT /api/${API_VERSION}/entity-metadata/entity/:entityType/:entityId/bulk`,
        delete: `DELETE /api/${API_VERSION}/entity-metadata/:id`,
        deleteByEntity: `DELETE /api/${API_VERSION}/entity-metadata/entity/:entityType/:entityId`,
      },
      prdReviews: {
        healthCheck: `GET /api/${API_VERSION}/prd-reviews/health-check`,
        testReview: `POST /api/${API_VERSION}/prd-reviews/test-review`,
        statistics: `GET /api/${API_VERSION}/prd-reviews/statistics`,
        list: `GET /api/${API_VERSION}/prd-reviews`,
        getById: `GET /api/${API_VERSION}/prd-reviews/:id`,
        create: `POST /api/${API_VERSION}/prd-reviews`,
        update: `PATCH /api/${API_VERSION}/prd-reviews/:id`,
        sync: `POST /api/${API_VERSION}/prd-reviews/sync`,
        backgroundSync: `POST /api/${API_VERSION}/prd-reviews/background-sync`,
      },
      auditEvents: {
        list: `GET /api/${API_VERSION}/audit-events`,
        getById: `GET /api/${API_VERSION}/audit-events/:id`,
        getByAggregate: `GET /api/${API_VERSION}/audit-events/aggregate/:aggregateType/:aggregateId`,
        create: `POST /api/${API_VERSION}/audit-events`,
      },
      archive: {
        auditLogs: {
          list: `GET /api/${API_VERSION}/archive/audit-logs`,
          getById: `GET /api/${API_VERSION}/archive/audit-logs/:id`,
        },
        jiraHistory: {
          list: `GET /api/${API_VERSION}/archive/jira-history`,
          getById: `GET /api/${API_VERSION}/archive/jira-history/:id`,
        },
      },
      analytics: {
        allureReports: {
          list: `GET /api/${API_VERSION}/analytics/allure-reports`,
          create: `POST /api/${API_VERSION}/analytics/allure-reports`,
        },
        gitlab: {
          mrLeadTimes: `GET /api/${API_VERSION}/analytics/gitlab/mr-lead-times`,
          contributors: `GET /api/${API_VERSION}/analytics/gitlab/contributors`,
        },
        jira: {
          leadTimes: `GET /api/${API_VERSION}/analytics/jira/lead-times`,
        },
        monthlyContributions: `GET /api/${API_VERSION}/analytics/monthly-contributions`,
      },
      workflowSagas: {
        list: `GET /api/${API_VERSION}/workflow-sagas`,
        getById: `GET /api/${API_VERSION}/workflow-sagas/:id`,
        create: `POST /api/${API_VERSION}/workflow-sagas`,
        update: `PATCH /api/${API_VERSION}/workflow-sagas/:id`,
      },
      bugBudgetView: {
        list: `GET /api/${API_VERSION}/bug-budget-view`,
        getById: `GET /api/${API_VERSION}/bug-budget-view/:id`,
      },
    },
  });
});

app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/tokens`, tokenRoutes);
app.use(`/api/${API_VERSION}/invitations`, invitationRoutes);
app.use(`/api/${API_VERSION}/projects`, projectRoutes);
app.use(`/api/${API_VERSION}/permissions`, permissionRoutes);
app.use(`/api/${API_VERSION}/roles`, roleRoutes);
app.use(`/api/${API_VERSION}`, suiteRoutes);
app.use(`/api/${API_VERSION}`, testCaseRoutes);
app.use(`/api/${API_VERSION}`, testPlanRoutes);
app.use(`/api/${API_VERSION}`, testCaseCommentRoutes);
app.use(`/api/${API_VERSION}`, testRunRoutes);
app.use(`/api/${API_VERSION}`, testRunResultRoutes);
app.use(`/api/${API_VERSION}`, testRunAttachmentRoutes);
app.use(`/api/${API_VERSION}`, testRunCommentRoutes);
app.use(`/api/${API_VERSION}`, documentRoutes);
app.use(`/api/${API_VERSION}`, documentVersionRoutes);
app.use(`/api/${API_VERSION}`, documentCommentRoutes);
app.use(`/api/${API_VERSION}`, documentEngagementRoutes);
app.use(`/api/${API_VERSION}`, documentTemplateRoutes);
app.use(`/api/${API_VERSION}`, editorImageRoutes);
app.use(`/api/${API_VERSION}`, analyticsRoutes);
app.use(`/api/${API_VERSION}`, menuVisibilityRoutes);
app.use(`/api/${API_VERSION}`, notificationRoutes);
app.use(`/api/${API_VERSION}`, notificationSSERoutes);
app.use(`/api/${API_VERSION}`, settingRoutes);
app.use(`/api/${API_VERSION}`, testRunsViewRoutes);
app.use(`/api/${API_VERSION}`, bugBudgetRoutes);
app.use(`/api/${API_VERSION}`, bugBudgetMetadataRoutes);
app.use(`/api/${API_VERSION}`, jiraFieldRoutes);
app.use(`/api/${API_VERSION}`, jobsRoutes);
app.use(`/api/${API_VERSION}`, changeLogRoutes);
app.use(`/api/${API_VERSION}`, decisionLogRoutes);
app.use(`/api/${API_VERSION}`, entityMetadataRoutes);
app.use(`/api/${API_VERSION}/prd-reviews`, prdReviewRoutes);
app.use(`/api/${API_VERSION}`, auditEventRoutes);
app.use(`/api/${API_VERSION}`, archiveRoutes);
app.use(`/api/${API_VERSION}/analytics`, analyticsIntegrationsRoutes);
app.use(`/api/${API_VERSION}`, workflowSagaRoutes);
app.use(`/api/${API_VERSION}`, bugBudgetViewRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An internal server error occurred' 
        : err.message,
    },
  });
});

// Start server
async function startServer() {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 API available at http://localhost:${PORT}/api/${API_VERSION}`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await disconnectDatabase();
  process.exit(0);
});

// Start the server
startServer();

export default app;

