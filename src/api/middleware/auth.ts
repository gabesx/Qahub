import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId?: string;
  };
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        },
      });
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

    // Verify JWT token
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      tenantId?: string;
    };

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or inactive user',
        },
      });
      return;
    }

    // Attach user info to request
    (req as AuthRequest).user = {
      userId: decoded.userId,
      email: decoded.email,
      tenantId: decoded.tenantId,
    };

    // Track token usage for personal access tokens (if using PAT instead of JWT)
    // Note: This is for PATs, JWT tokens don't need usage tracking
    // But we can track JWT usage by storing in a session table if needed
    // For now, we'll track PAT usage when token hash matches
    try {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.personalAccessToken.updateMany({
        where: {
          tokenHash,
          tokenableType: 'User',
          tokenableId: BigInt(decoded.userId),
          revokedAt: null,
        },
        data: {
          lastUsedAt: new Date(),
          lastUsedIp: req.ip || req.socket.remoteAddress || null,
          lastUsedUserAgent: req.get('user-agent') || null,
        },
      });
    } catch (trackError) {
      // Don't fail the request if tracking fails
      logger.debug('Token usage tracking failed:', trackError);
    }

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      });
      return;
    }

    logger.error('Authentication error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during authentication',
      },
    });
  }
};

