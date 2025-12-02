import { Router, Request, Response } from 'express';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Store active SSE connections
interface SSEClient {
  userId: bigint;
  response: Response;
  lastEventId: number;
}

const sseClients = new Map<string, SSEClient>();
let eventIdCounter = 0;

// Clean up disconnected clients
const cleanupClients = () => {
  for (const [clientId, client] of sseClients.entries()) {
    if (client.response.destroyed || client.response.closed) {
      sseClients.delete(clientId);
      logger.debug(`Removed disconnected SSE client: ${clientId}`);
    }
  }
};

// Clean up every 30 seconds
setInterval(cleanupClients, 30000);

// Broadcast notification to all connected clients for a user
export function broadcastNotification(userId: bigint, notification: any) {
  const message = {
    id: eventIdCounter++,
    type: 'notification',
    data: notification,
    timestamp: new Date().toISOString(),
  };

  let sentCount = 0;
  for (const [clientId, client] of sseClients.entries()) {
    if (client.userId === userId) {
      try {
        client.response.write(`id: ${message.id}\n`);
        client.response.write(`event: ${message.type}\n`);
        client.response.write(`data: ${JSON.stringify(message.data)}\n\n`);
        sentCount++;
      } catch (error) {
        logger.warn(`Failed to send SSE message to client ${clientId}:`, error);
        sseClients.delete(clientId);
      }
    }
  }

  if (sentCount > 0) {
    logger.debug(`Broadcasted notification to ${sentCount} client(s) for user ${userId}`);
  }
}

// Broadcast notification stats update
export function broadcastNotificationStats(userId: bigint, stats: any) {
  const message = {
    id: eventIdCounter++,
    type: 'stats',
    data: stats,
    timestamp: new Date().toISOString(),
  };

  for (const [clientId, client] of sseClients.entries()) {
    if (client.userId === userId) {
      try {
        client.response.write(`id: ${message.id}\n`);
        client.response.write(`event: ${message.type}\n`);
        client.response.write(`data: ${JSON.stringify(message.data)}\n\n`);
      } catch (error) {
        logger.warn(`Failed to send SSE stats to client ${clientId}:`, error);
        sseClients.delete(clientId);
      }
    }
  }
}

// SSE endpoint for real-time notifications
router.get('/notifications/stream', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Handle client disconnect
    req.on('close', () => {
      sseClients.delete(clientId);
      logger.debug(`SSE client disconnected: ${clientId}`);
      res.end();
    });

    // Store client connection
    const sseClient: SSEClient = {
      userId,
      response: res,
      lastEventId: 0,
    };
    sseClients.set(clientId, sseClient);

    logger.info(`SSE client connected: ${clientId} for user ${userId}`);

    // Send initial connection message
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ clientId, userId: userId.toString(), timestamp: new Date().toISOString() })}\n\n`);

    // Send initial notification stats
    try {
      const [total, unread, byType] = await Promise.all([
        prisma.notification.count({
          where: {
            notifiableType: 'user',
            notifiableId: userId,
          },
        }),
        prisma.notification.count({
          where: {
            notifiableType: 'user',
            notifiableId: userId,
            readAt: null,
          },
        }),
        prisma.notification.groupBy({
          by: ['type'],
          where: {
            notifiableType: 'user',
            notifiableId: userId,
            readAt: null,
          },
          _count: {
            type: true,
          },
        }),
      ]);

      const stats = {
        total,
        unread,
        read: total - unread,
        byType: byType.map((item) => ({
          type: item.type,
          count: item._count.type,
        })),
      };

      res.write(`event: stats\n`);
      res.write(`data: ${JSON.stringify(stats)}\n\n`);
    } catch (error) {
      logger.warn('Failed to send initial stats:', error);
    }

    // Send recent unread notifications
    try {
      const recentNotifications = await prisma.notification.findMany({
        where: {
          notifiableType: 'user',
          notifiableId: userId,
          readAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      if (recentNotifications.length > 0) {
        res.write(`event: recent\n`);
        res.write(`data: ${JSON.stringify({
          notifications: recentNotifications.map((n) => ({
            id: n.id,
            type: n.type,
            data: n.data,
            createdAt: n.createdAt.toISOString(),
          })),
        })}\n\n`);
      }
    } catch (error) {
      logger.warn('Failed to send recent notifications:', error);
    }

    // Keep connection alive with heartbeat
    const heartbeatInterval = setInterval(() => {
      try {
        if (!res.destroyed && !res.closed) {
          res.write(`: heartbeat\n\n`);
        } else {
          clearInterval(heartbeatInterval);
          sseClients.delete(clientId);
        }
      } catch (error) {
        clearInterval(heartbeatInterval);
        sseClients.delete(clientId);
      }
    }, 30000); // Send heartbeat every 30 seconds

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      sseClients.delete(clientId);
    });
  } catch (error) {
    logger.error('SSE connection error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to establish SSE connection',
        },
      });
    } else {
      res.end();
    }
  }
});

// Get active connections count (admin only - for monitoring)
router.get('/notifications/stream/connections', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);

    // Count connections per user
    const connectionsByUser = new Map<bigint, number>();
    for (const client of sseClients.values()) {
      const count = connectionsByUser.get(client.userId) || 0;
      connectionsByUser.set(client.userId, count + 1);
    }

    res.json({
      data: {
        totalConnections: sseClients.size,
        userConnections: connectionsByUser.get(userId) || 0,
        connectionsByUser: Array.from(connectionsByUser.entries()).map(([uid, count]) => ({
          userId: uid.toString(),
          count,
        })),
      },
    });
  } catch (error) {
    logger.error('Get connections error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching connection information',
      },
    });
  }
});

export default router;

