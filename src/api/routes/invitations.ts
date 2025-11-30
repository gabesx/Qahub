import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import crypto from 'crypto';
import { logger } from '../../shared/utils/logger';
import { authenticateToken } from '../middleware/auth';
import { emailService } from '../../shared/services/email';
import bcrypt from 'bcrypt';

const router = Router();

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  tenantId: z.string().optional(),
  role: z.string().optional().default('member'),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Invite user
router.post('/', authenticateToken, async (req, res) => {
  try {
    const inviterId = BigInt((req as any).user.userId);
    const data = inviteUserSchema.parse(req.body);

    // Check if inviter is admin or has permission
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
      select: { role: true, name: true },
    });

    if (!inviter || (inviter.role !== 'admin' && !data.tenantId)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to invite users',
        },
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
        },
      });
    }

    // Check if invitation already exists and is pending
    const existingInvitation = await prisma.userInvitation.findFirst({
      where: {
        email: data.email.toLowerCase().trim(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return res.status(409).json({
        error: {
          code: 'INVITATION_EXISTS',
          message: 'An active invitation already exists for this email',
        },
      });
    }

    // Generate invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Get tenant name if tenantId provided
    let tenantName = null;
    if (data.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: BigInt(data.tenantId) },
        select: { name: true },
      });
      tenantName = tenant?.name || null;
    }

    // Create invitation
    const invitation = await prisma.userInvitation.create({
      data: {
        email: data.email.toLowerCase().trim(),
        token: invitationToken,
        tenantId: data.tenantId ? BigInt(data.tenantId) : null,
        invitedBy: inviterId,
        role: data.role,
        expiresAt,
      },
    });

    // Send invitation email
    try {
      await emailService.sendInvitationEmail(
        data.email,
        invitationToken,
        inviter.name || 'Admin',
        tenantName || undefined
      );
    } catch (emailError) {
      logger.warn(`Failed to send invitation email: ${emailError}`);
      // Continue even if email fails
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: inviterId,
        action: 'invited_user',
        modelType: 'user_invitation',
        modelId: invitation.id,
        newValues: { email: data.email, tenantId: data.tenantId, role: data.role },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info(`User invitation sent to: ${data.email} by ${inviter.name}`);

    res.status(201).json({
      data: {
        invitation: {
          id: invitation.id.toString(),
          email: invitation.email,
          expiresAt: invitation.expiresAt.toISOString(),
        },
      },
      message: 'Invitation sent successfully',
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

    logger.error('Invite user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while sending invitation',
      },
    });
  }
});

// List invitations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can view invitations',
        },
      });
    }

    const { status = 'pending', page = '1', limit = '20' } = req.query;

    const whereClause: any = {};

    if (status === 'pending') {
      whereClause.acceptedAt = null;
      whereClause.expiresAt = { gt: new Date() };
    } else if (status === 'accepted') {
      whereClause.acceptedAt = { not: null };
    } else if (status === 'expired') {
      whereClause.acceptedAt = null;
      whereClause.expiresAt = { lte: new Date() };
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [invitations, total] = await Promise.all([
      prisma.userInvitation.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          inviter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.userInvitation.count({ where: whereClause }),
    ]);

    res.json({
      data: {
        invitations: invitations.map(invitation => ({
          id: invitation.id.toString(),
          email: invitation.email,
          role: invitation.role,
          tenant: invitation.tenant ? {
            id: invitation.tenant.id.toString(),
            name: invitation.tenant.name,
            slug: invitation.tenant.slug,
          } : null,
          inviter: {
            id: invitation.inviter.id.toString(),
            name: invitation.inviter.name,
            email: invitation.inviter.email,
          },
          acceptedAt: invitation.acceptedAt?.toISOString() || null,
          expiresAt: invitation.expiresAt.toISOString(),
          createdAt: invitation.createdAt.toISOString(),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('List invitations error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching invitations',
      },
    });
  }
});

// Accept invitation
router.post('/accept', async (req, res) => {
  try {
    const { token, name, password } = acceptInvitationSchema.parse(req.body);

    // Find invitation
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        tenant: true,
        inviter: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired invitation token',
        },
      });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_ACCEPTED',
          message: 'This invitation has already been accepted',
        },
      });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This invitation has expired',
        },
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (existingUser) {
      return res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
        },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: invitation.email,
        password: hashedPassword,
        authProvider: 'email',
        isActive: true,
        emailVerifiedAt: new Date(), // Auto-verify email for invited users
      },
    });

    // Link to tenant if provided
    if (invitation.tenantId) {
      await prisma.tenantUser.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          role: invitation.role || 'member',
          invitedBy: invitation.invitedBy,
        },
      });
    }

    // Mark invitation as accepted
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'accepted_invitation',
        modelType: 'user_invitation',
        modelId: invitation.id,
        newValues: { userId: user.id.toString(), email: user.email },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info(`Invitation accepted: ${user.email}`);

    res.status(201).json({
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
        },
      },
      message: 'Invitation accepted successfully. You can now log in.',
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

    logger.error('Accept invitation error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while accepting invitation',
      },
    });
  }
});

// Resend invitation
router.post('/:id/resend', authenticateToken, async (req, res) => {
  try {
    const inviterId = BigInt((req as any).user.userId);
    const invitationId = BigInt(req.params.id);

    // Check if inviter is admin
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
      select: { role: true, name: true },
    });

    if (inviter?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can resend invitations',
        },
      });
    }

    const invitation = await prisma.userInvitation.findUnique({
      where: { id: invitationId },
      include: {
        tenant: {
          select: { name: true },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
        },
      });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_ACCEPTED',
          message: 'This invitation has already been accepted',
        },
      });
    }

    // Extend expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.userInvitation.update({
      where: { id: invitationId },
      data: { expiresAt },
    });

    // Resend email
    try {
      await emailService.sendInvitationEmail(
        invitation.email,
        invitation.token,
        inviter.name || 'Admin',
        invitation.tenant?.name || undefined
      );
    } catch (emailError) {
      logger.warn(`Failed to resend invitation email: ${emailError}`);
    }

    res.json({
      message: 'Invitation resent successfully',
    });
  } catch (error) {
    logger.error('Resend invitation error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while resending invitation',
      },
    });
  }
});

// Cancel invitation
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);
    const invitationId = BigInt(req.params.id);

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can cancel invitations',
        },
      });
    }

    const invitation = await prisma.userInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return res.status(404).json({
        error: {
          code: 'INVITATION_NOT_FOUND',
          message: 'Invitation not found',
        },
      });
    }

    if (invitation.acceptedAt) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_ACCEPTED',
          message: 'Cannot cancel an accepted invitation',
        },
      });
    }

    await prisma.userInvitation.delete({
      where: { id: invitationId },
    });

    res.json({
      message: 'Invitation cancelled successfully',
    });
  } catch (error) {
    logger.error('Cancel invitation error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while cancelling invitation',
      },
    });
  }
});

export default router;

