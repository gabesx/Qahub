import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Create notification schema
const createNotificationSchema = z.object({
  type: z.string().min(1, 'Type is required').max(255, 'Type must be less than 255 characters'),
  notifiableType: z.string().min(1, 'Notifiable type is required').max(255, 'Notifiable type must be less than 255 characters'),
  notifiableId: z.string().min(1, 'Notifiable ID is required'),
  data: z.string().min(1, 'Data is required'),
});

// Update notification schema (mark as read)
const updateNotificationSchema = z.object({
  readAt: z.string().optional().nullable().transform((val) => val ? new Date(val) : null),
});

// List notifications schema
const listNotificationsSchema = z.object({
  notifiableType: z.string().optional(),
  type: z.string().optional(),
  read: z.string().optional().transform((val) => val === 'true' ? true : val === 'false' ? false : undefined),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['createdAt', 'readAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List notifications for current user
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const query = listNotificationsSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      notifiableType: 'user',
      notifiableId: userId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.read !== undefined) {
      if (query.read) {
        where.readAt = { not: null };
      } else {
        where.readAt = null;
      }
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          notifiableType: n.notifiableType,
          notifiableId: n.notifiableId.toString(),
          data: n.data,
          readAt: n.readAt?.toISOString() || null,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
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
    logger.error('List notifications error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching notifications',
      },
    });
  }
});

// Get notification by ID
router.get('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const notificationId = req.params.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    // Verify user owns this notification
    if (notification.notifiableType !== 'user' || notification.notifiableId !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only access your own notifications',
        },
      });
    }

    res.json({
      data: {
        notification: {
          id: notification.id,
          type: notification.type,
          notifiableType: notification.notifiableType,
          notifiableId: notification.notifiableId.toString(),
          data: notification.data,
          readAt: notification.readAt?.toISOString() || null,
          createdAt: notification.createdAt.toISOString(),
          updatedAt: notification.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get notification error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching notification',
      },
    });
  }
});

// Create notification
router.post('/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createNotificationSchema.parse(req.body);

    const notification = await prisma.notification.create({
      data: {
        id: randomUUID(),
        type: data.type.trim(),
        notifiableType: data.notifiableType.trim(),
        notifiableId: BigInt(data.notifiableId),
        data: data.data.trim(),
      },
    });

    logger.info(`Notification created: ${notification.id} for ${data.notifiableType} ${data.notifiableId} by user ${userId}`);

    // Broadcast to SSE clients if notification is for a user
    if (data.notifiableType === 'user') {
      try {
        const { broadcastNotification, broadcastNotificationStats } = await import('./notifications-sse');
        
        // Broadcast the new notification
        broadcastNotification(BigInt(data.notifiableId), {
          id: notification.id,
          type: notification.type,
          data: notification.data,
          createdAt: notification.createdAt.toISOString(),
        });

        // Update stats
        const [total, unread] = await Promise.all([
          prisma.notification.count({
            where: {
              notifiableType: 'user',
              notifiableId: BigInt(data.notifiableId),
            },
          }),
          prisma.notification.count({
            where: {
              notifiableType: 'user',
              notifiableId: BigInt(data.notifiableId),
              readAt: null,
            },
          }),
        ]);

        broadcastNotificationStats(BigInt(data.notifiableId), {
          total,
          unread,
          read: total - unread,
        });
      } catch (error) {
        logger.warn('Failed to broadcast notification via SSE:', error);
      }
    }

    res.status(201).json({
      data: {
        notification: {
          id: notification.id,
          type: notification.type,
          notifiableType: notification.notifiableType,
          notifiableId: notification.notifiableId.toString(),
          data: notification.data,
          readAt: notification.readAt?.toISOString() || null,
          createdAt: notification.createdAt.toISOString(),
          updatedAt: notification.updatedAt.toISOString(),
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
    logger.error('Create notification error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating notification',
      },
    });
  }
});

// Mark notification as read/unread
router.patch('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const notificationId = req.params.id;

    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      return res.status(404).json({
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    // Verify user owns this notification
    if (existing.notifiableType !== 'user' || existing.notifiableId !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only update your own notifications',
        },
      });
    }

    const data = updateNotificationSchema.parse(req.body);

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: data.readAt !== undefined ? data.readAt : (existing.readAt ? null : new Date()),
      },
    });

    logger.info(`Notification updated: ${notificationId} by user ${userId}`);

    // Broadcast stats update to SSE clients
    try {
      const { broadcastNotificationStats } = await import('./notifications-sse');
      
      const [total, unread] = await Promise.all([
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
      ]);

      broadcastNotificationStats(userId, {
        total,
        unread,
        read: total - unread,
      });
    } catch (error) {
      logger.warn('Failed to broadcast stats update via SSE:', error);
    }

    res.json({
      data: {
        notification: {
          id: notification.id,
          type: notification.type,
          notifiableType: notification.notifiableType,
          notifiableId: notification.notifiableId.toString(),
          data: notification.data,
          readAt: notification.readAt?.toISOString() || null,
          createdAt: notification.createdAt.toISOString(),
          updatedAt: notification.updatedAt.toISOString(),
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
    logger.error('Update notification error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating notification',
      },
    });
  }
});

// Mark all notifications as read
router.post('/notifications/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);

    const result = await prisma.notification.updateMany({
      where: {
        notifiableType: 'user',
        notifiableId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    logger.info(`Marked ${result.count} notifications as read for user ${userId}`);

    // Broadcast stats update to SSE clients
    try {
      const { broadcastNotificationStats } = await import('./notifications-sse');
      
      const [total, unread] = await Promise.all([
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
      ]);

      broadcastNotificationStats(userId, {
        total,
        unread,
        read: total - unread,
      });
    } catch (error) {
      logger.warn('Failed to broadcast stats update via SSE:', error);
    }

    res.json({
      message: `${result.count} notifications marked as read`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Mark all notifications as read error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while marking notifications as read',
      },
    });
  }
});

// Get notification statistics
router.get('/notifications/stats', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);

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

    res.json({
      data: {
        total,
        unread,
        read: total - unread,
        byType: byType.map((item) => ({
          type: item.type,
          count: item._count.type,
        })),
      },
    });
  } catch (error) {
    logger.error('Get notification stats error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching notification statistics',
      },
    });
  }
});

// Delete multiple notifications
router.delete('/notifications/bulk', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const notificationIds = z.array(z.string().uuid()).parse(req.body.ids || []);

    if (notificationIds.length === 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one notification ID is required',
        },
      });
    }

    // Verify all notifications belong to the user
    const notifications = await prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        notifiableType: 'user',
        notifiableId: userId,
      },
    });

    if (notifications.length !== notificationIds.length) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Some notifications do not belong to you',
        },
      });
    }

    const result = await prisma.notification.deleteMany({
      where: {
        id: { in: notificationIds },
      },
    });

    logger.info(`Deleted ${result.count} notifications for user ${userId}`);

    // Broadcast stats update to SSE clients
    try {
      const { broadcastNotificationStats } = await import('./notifications-sse');
      
      const [total, unread] = await Promise.all([
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
      ]);

      broadcastNotificationStats(userId, {
        total,
        unread,
        read: total - unread,
      });
    } catch (error) {
      logger.warn('Failed to broadcast stats update via SSE:', error);
    }

    res.json({
      message: `${result.count} notifications deleted successfully`,
      count: result.count,
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
    logger.error('Bulk delete notifications error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting notifications',
      },
    });
  }
});

// Delete notification
router.delete('/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const notificationId = req.params.id;

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return res.status(404).json({
        error: {
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'Notification not found',
        },
      });
    }

    // Verify user owns this notification
    if (notification.notifiableType !== 'user' || notification.notifiableId !== userId) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only delete your own notifications',
        },
      });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    logger.info(`Notification deleted: ${notificationId} by user ${userId}`);

    // Broadcast stats update to SSE clients
    try {
      const { broadcastNotificationStats } = await import('./notifications-sse');
      
      const [total, unread] = await Promise.all([
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
      ]);

      broadcastNotificationStats(userId, {
        total,
        unread,
        read: total - unread,
      });
    } catch (error) {
      logger.warn('Failed to broadcast stats update via SSE:', error);
    }

    res.json({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Delete notification error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting notification',
      },
    });
  }
});

export default router;

