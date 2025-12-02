import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import crypto from 'crypto';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Create token schema
const createTokenSchema = z.object({
  name: z.string().min(1, 'Token name is required'),
  abilities: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional().transform((val) => (val ? new Date(val) : undefined)),
});

// Update token usage schema
const updateTokenUsageSchema = z.object({
  ip: z.string().ip().optional(),
  userAgent: z.string().optional(),
});

// Create personal access token
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const data = createTokenSchema.parse(req.body);

    // Generate token (64 characters)
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');

    // Create token in database
    const token = await prisma.personalAccessToken.create({
      data: {
        tokenableType: 'User',
        tokenableId: userId,
        name: data.name,
        token: plainToken, // Store plain token for first response only
        tokenHash: tokenHash,
        abilities: data.abilities ? JSON.stringify(data.abilities) : null,
        expiresAt: data.expiresAt,
      },
    });

    logger.info(`Personal access token created: ${data.name} for user ${userId}`);

    // Return token only once (plain token)
    res.status(201).json({
      data: {
        token: {
          id: token.id.toString(),
          name: token.name,
          token: plainToken, // Only returned on creation
          abilities: data.abilities || [],
          expiresAt: token.expiresAt,
          createdAt: token.createdAt,
        },
      },
      message: 'Token created successfully. Store this token securely - it will not be shown again.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
    }

    logger.error('Create token error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating token',
      },
    });
  }
});

// List user's personal access tokens
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);

    const tokens = await prisma.personalAccessToken.findMany({
      where: {
        tokenableType: 'User',
        tokenableId: userId,
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        abilities: true,
        lastUsedAt: true,
        lastUsedIp: true,
        lastUsedUserAgent: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      data: {
        tokens: tokens.map((token) => ({
          id: token.id.toString(),
          name: token.name,
          abilities: token.abilities ? JSON.parse(token.abilities) : [],
          lastUsedAt: token.lastUsedAt,
          lastUsedIp: token.lastUsedIp,
          lastUsedUserAgent: token.lastUsedUserAgent,
          expiresAt: token.expiresAt,
          isExpired: token.expiresAt ? token.expiresAt < new Date() : false,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt,
        })),
      },
    });
  } catch (error) {
    logger.error('List tokens error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching tokens',
      },
    });
  }
});

// Get token by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tokenId = BigInt(req.params.id);

    const token = await prisma.personalAccessToken.findFirst({
      where: {
        id: tokenId,
        tokenableType: 'User',
        tokenableId: userId,
      },
      select: {
        id: true,
        name: true,
        abilities: true,
        lastUsedAt: true,
        lastUsedIp: true,
        lastUsedUserAgent: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!token) {
      return res.status(404).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Token not found',
        },
      });
    }

    res.json({
      data: {
        token: {
          id: token.id.toString(),
          name: token.name,
          abilities: token.abilities ? JSON.parse(token.abilities) : [],
          lastUsedAt: token.lastUsedAt,
          lastUsedIp: token.lastUsedIp,
          lastUsedUserAgent: token.lastUsedUserAgent,
          expiresAt: token.expiresAt,
          isExpired: token.expiresAt ? token.expiresAt < new Date() : false,
          isRevoked: !!token.revokedAt,
          createdAt: token.createdAt,
          updatedAt: token.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error('Get token error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching token',
      },
    });
  }
});

// Revoke token
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tokenId = BigInt(req.params.id);

    const token = await prisma.personalAccessToken.findFirst({
      where: {
        id: tokenId,
        tokenableType: 'User',
        tokenableId: userId,
      },
    });

    if (!token) {
      return res.status(404).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Token not found',
        },
      });
    }

    if (token.revokedAt) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_ALREADY_REVOKED',
          message: 'Token is already revoked',
        },
      });
    }

    await prisma.personalAccessToken.update({
      where: { id: tokenId },
      data: {
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });

    logger.info(`Token revoked: ${token.name} (ID: ${tokenId})`);

    res.json({
      message: 'Token revoked successfully',
    });
  } catch (error) {
    logger.error('Revoke token error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while revoking token',
      },
    });
  }
});

// Revoke all tokens for user
router.delete('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);

    const result = await prisma.personalAccessToken.updateMany({
      where: {
        tokenableType: 'User',
        tokenableId: userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });

    logger.info(`All tokens revoked for user: ${userId}`);

    res.json({
      message: `${result.count} token(s) revoked successfully`,
    });
  } catch (error) {
    logger.error('Revoke all tokens error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while revoking tokens',
      },
    });
  }
});

// Update token usage (called when token is used)
router.patch('/:id/usage', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tokenId = BigInt(req.params.id);
    const data = updateTokenUsageSchema.parse(req.body);

    const token = await prisma.personalAccessToken.findFirst({
      where: {
        id: tokenId,
        tokenableType: 'User',
        tokenableId: userId,
      },
    });

    if (!token) {
      return res.status(404).json({
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: 'Token not found',
        },
      });
    }

    await prisma.personalAccessToken.update({
      where: { id: tokenId },
      data: {
        lastUsedAt: new Date(),
        lastUsedIp: data.ip || req.ip || null,
        lastUsedUserAgent: data.userAgent || req.get('user-agent') || null,
      },
    });

    res.json({
      message: 'Token usage updated',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
    }

    logger.error('Update token usage error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating token usage',
      },
    });
  }
});

export default router;

