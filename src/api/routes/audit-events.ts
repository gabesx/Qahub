import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';
import { domainEventEmitter, DomainEventType } from '../../shared/events/event-emitter';

const router = Router();

// Validation schemas
const querySchema = z.object({
  eventType: z.string().optional(),
  aggregateType: z.string().optional(),
  aggregateId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /audit-events
 * List audit events with filtering and pagination
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view audit events',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.aggregateType) {
      where.aggregateType = query.aggregateType;
    }

    if (query.aggregateId) {
      where.aggregateId = BigInt(query.aggregateId);
    }

    if (query.userId) {
      where.userId = BigInt(query.userId);
    }

    if (query.startDate || query.endDate) {
      where.occurredAt = {};
      if (query.startDate) {
        where.occurredAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.occurredAt.lte = new Date(query.endDate);
      }
    }

    // Get total count
    const total = await prisma.auditEvent.count({ where });

    // Get audit events
    const auditEvents = await prisma.auditEvent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        occurredAt: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: {
        auditEvents: auditEvents.map((event) => ({
          id: event.id.toString(),
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId.toString(),
          userId: event.userId?.toString() || null,
          user: event.user
            ? {
                id: event.user.id.toString(),
                name: event.user.name,
                email: event.user.email,
              }
            : null,
          eventData: event.eventData,
          metadata: event.metadata,
          occurredAt: event.occurredAt.toISOString(),
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

    logger.error('List audit events error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching audit events',
      },
    });
  }
});

/**
 * GET /audit-events/:id
 * Get a specific audit event by ID
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view audit events',
        },
      });
    }

    const eventId = BigInt(req.params.id);

    const auditEvent = await prisma.auditEvent.findUnique({
      where: { id: eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!auditEvent) {
      return res.status(404).json({
        error: {
          code: 'AUDIT_EVENT_NOT_FOUND',
          message: 'Audit event not found',
        },
      });
    }

    res.json({
      data: {
        auditEvent: {
          id: auditEvent.id.toString(),
          eventType: auditEvent.eventType,
          aggregateType: auditEvent.aggregateType,
          aggregateId: auditEvent.aggregateId.toString(),
          userId: auditEvent.userId?.toString() || null,
          user: auditEvent.user
            ? {
                id: auditEvent.user.id.toString(),
                name: auditEvent.user.name,
                email: auditEvent.user.email,
              }
            : null,
          eventData: auditEvent.eventData,
          metadata: auditEvent.metadata,
          occurredAt: auditEvent.occurredAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get audit event error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching audit event',
      },
    });
  }
});

/**
 * GET /audit-events/aggregate/:aggregateType/:aggregateId
 * Get all events for a specific aggregate (time-travel query)
 */
router.get('/aggregate/:aggregateType/:aggregateId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view audit events',
        },
      });
    }

    const aggregateType = req.params.aggregateType;
    const aggregateId = BigInt(req.params.aggregateId);

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        aggregateType,
        aggregateId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        occurredAt: 'asc', // Chronological order for time-travel
      },
    });

    res.json({
      data: {
        aggregateType,
        aggregateId: aggregateId.toString(),
        events: auditEvents.map((event) => ({
          id: event.id.toString(),
          eventType: event.eventType,
          userId: event.userId?.toString() || null,
          user: event.user
            ? {
                id: event.user.id.toString(),
                name: event.user.name,
                email: event.user.email,
              }
            : null,
          eventData: event.eventData,
          metadata: event.metadata,
          occurredAt: event.occurredAt.toISOString(),
        })),
        totalEvents: auditEvents.length,
      },
    });
  } catch (error) {
    logger.error('Get aggregate audit events error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching aggregate audit events',
      },
    });
  }
});

/**
 * POST /audit-events
 * Create an audit event (typically called by event system, but exposed for manual creation)
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create audit events',
        },
      });
    }

    const createSchema = z.object({
      eventType: z.string().min(1),
      aggregateType: z.string().min(1),
      aggregateId: z.string().min(1),
      eventData: z.any(),
      metadata: z.any().optional().nullable(),
    });

    const data = createSchema.parse(req.body);

    const auditEvent = await prisma.auditEvent.create({
      data: {
        eventType: data.eventType,
        aggregateType: data.aggregateType,
        aggregateId: BigInt(data.aggregateId),
        userId,
        eventData: data.eventData,
        metadata: data.metadata || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    logger.info(`Audit event created: ${data.eventType} for ${data.aggregateType}:${data.aggregateId} by user ${userId}`);

    res.status(201).json({
      data: {
        auditEvent: {
          id: auditEvent.id.toString(),
          eventType: auditEvent.eventType,
          aggregateType: auditEvent.aggregateType,
          aggregateId: auditEvent.aggregateId.toString(),
          userId: auditEvent.userId?.toString() || null,
          user: auditEvent.user
            ? {
                id: auditEvent.user.id.toString(),
                name: auditEvent.user.name,
                email: auditEvent.user.email,
              }
            : null,
          eventData: auditEvent.eventData,
          metadata: auditEvent.metadata,
          occurredAt: auditEvent.occurredAt.toISOString(),
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

    logger.error('Create audit event error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating audit event',
      },
    });
  }
});

export default router;

