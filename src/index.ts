import express from 'express';
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
    },
  });
});

app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/tokens`, tokenRoutes);

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

