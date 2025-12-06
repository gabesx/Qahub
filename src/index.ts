import express from 'express'
import { testRunWorker, exportWorker, scheduledRunWorker } from './queue/workers';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { checkDatabaseConnection, disconnectDatabase } from './shared/infrastructure/database';
import { logger } from './shared/utils/logger';

// Load environment variables
dotenv.config();

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

// Disable ETag caching for API routes (prevents 304 responses)
app.use(`/api/${API_VERSION}`, (_req, res, next) => {
  res.set('ETag', '');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Serve static files (avatars, uploads)
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(uploadDir));

// Root endpoint - API information
app.get('/', (_req, res) => {
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
app.get('/health', async (_req, res) => {
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

app.get(`/api/${API_VERSION}`, (_req, res) => {
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

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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

