import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../../shared/utils/logger';
import { emailService } from '../../shared/services/email';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        tenantUsers: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Your account has been disabled',
        },
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    // Get user's primary tenant (first tenant or default)
    const primaryTenant = user.tenantUsers[0]?.tenant;

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
    const token = jwt.sign(
      {
        userId: user.id.toString(),
        email: user.email,
        tenantId: primaryTenant?.id.toString(),
      },
      jwtSecret,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info(`User logged in: ${user.email}`);

    // Return success response
    res.json({
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
        tenant: primaryTenant
          ? {
              id: primaryTenant.id.toString(),
              name: primaryTenant.name,
              slug: primaryTenant.slug,
              plan: primaryTenant.plan,
            }
          : null,
        token,
      },
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

    logger.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during login',
      },
    });
  }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        },
      });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      tenantId?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: BigInt(decoded.userId) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or inactive user',
        },
      });
    }

    res.json({
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      },
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
});

// Forgot password endpoint
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // For security, don't reveal if email exists or not
    // Always return success message
    if (!user) {
      // Log the attempt but don't reveal to client
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      // Still return success to prevent email enumeration
      logger.warn(`Password reset requested for inactive account: ${email}`);
      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Store reset token in database
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        email: user.email,
        token: resetToken,
        expiresAt,
        createdAt: new Date(),
      },
    });

    logger.info(`Password reset token generated for: ${email}`);

    // Send password reset email
    try {
      logger.info(`Attempting to send password reset email to: ${email}`);
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.name);
      logger.info(`✅ Password reset email sent successfully to: ${email}`);
    } catch (emailError: any) {
      // Log error but don't reveal to client
      logger.error(`❌ Failed to send password reset email to ${email}:`, {
        error: emailError?.message || 'Unknown error',
        code: emailError?.code,
        stack: emailError?.stack,
      });
      // Still return success to prevent email enumeration
    }

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email address',
          details: error.errors,
        },
      });
    }

    logger.error('Forgot password error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while processing your request',
      },
    });
  }
});

// Verify reset token endpoint
router.get('/verify-reset-token', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Reset token is required',
        },
      });
    }

    // Find reset token in database
    const passwordReset = await prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    if (!passwordReset) {
      return res.status(404).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token',
        },
      });
    }

    // Check if token has been used
    if (passwordReset.usedAt) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_USED',
          message: 'This reset token has already been used',
        },
      });
    }

    // Check if token has expired
    if (passwordReset.expiresAt && passwordReset.expiresAt < new Date()) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This reset token has expired',
        },
      });
    }

    // Check if user is active
    if (!passwordReset.user?.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'This account has been disabled',
        },
      });
    }

    res.json({
      data: {
        valid: true,
        email: passwordReset.email,
      },
    });
  } catch (error) {
    logger.error('Verify reset token error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while verifying the token',
      },
    });
  }
});

// Reset password endpoint
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);

    // Find reset token in database
    const passwordReset = await prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: true,
      },
    });

    if (!passwordReset) {
      return res.status(404).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired reset token',
        },
      });
    }

    // Check if token has been used
    if (passwordReset.usedAt) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_USED',
          message: 'This reset token has already been used',
        },
      });
    }

    // Check if token has expired
    if (passwordReset.expiresAt && passwordReset.expiresAt < new Date()) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This reset token has expired',
        },
      });
    }

    // Check if user exists and is active
    if (!passwordReset.user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with this token not found',
        },
      });
    }

    if (!passwordReset.user.isActive) {
      return res.status(403).json({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'This account has been disabled',
        },
      });
    }

    // Check password history (prevent reuse of last 5 passwords)
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId: passwordReset.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const history of passwordHistory) {
      const isReused = await bcrypt.compare(password, history.passwordHash);
      if (isReused) {
        return res.status(400).json({
          error: {
            code: 'PASSWORD_REUSED',
            message: 'You cannot reuse a recently used password',
          },
        });
      }
    }

    // Store old password in history before changing
    await prisma.passwordHistory.create({
      data: {
        userId: passwordReset.user.id,
        passwordHash: passwordReset.user.password,
        passwordResetId: passwordReset.id, // Link to the password reset record
      },
    });

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    await prisma.user.update({
      where: { id: passwordReset.user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    // Mark token as used
    await prisma.passwordReset.update({
      where: { token },
      data: {
        usedAt: new Date(),
      },
    });

    // Revoke all personal access tokens (security best practice)
    await prisma.personalAccessToken.updateMany({
      where: {
        tokenableType: 'User',
        tokenableId: passwordReset.user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedBy: passwordReset.user.id,
      },
    });

    logger.info(`Password reset successful for user: ${passwordReset.user.email}`);

    res.json({
      message: 'Password has been reset successfully',
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

    logger.error('Reset password error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while resetting your password',
      },
    });
  }
});

export default router;

