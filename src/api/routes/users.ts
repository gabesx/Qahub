import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import bcrypt from 'bcrypt';
import { logger } from '../../shared/utils/logger';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { emailService } from '../../shared/services/email';

const router = Router();

// Register schema
const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  jobRole: z.string().optional(),
  tenantId: z.string().optional(),
});

// Update profile schema
const updateProfileSchema = z.object({
  name: z.union([z.string().min(1), z.literal(''), z.null()]).optional(),
  jobRole: z.union([z.string(), z.literal(''), z.null()]).optional(),
  avatar: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
});

// Change password schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

// List users query schema
const listUsersSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  search: z.string().optional(),
  isActive: z.string().optional().transform((val) => val === 'true'),
  tenantId: z.string().optional(),
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);

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

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase().trim(),
        password: hashedPassword,
        jobRole: data.jobRole,
        authProvider: 'email',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        jobRole: true,
        isActive: true,
        createdAt: true,
      },
    });

    // If tenantId provided, link user to tenant
    if (data.tenantId) {
      try {
        await prisma.tenantUser.create({
          data: {
            tenantId: BigInt(data.tenantId),
            userId: user.id,
            role: 'member',
          },
        });
      } catch (error) {
        logger.warn(`Failed to link user to tenant: ${error}`);
        // Continue even if tenant linking fails
      }
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours

    // Store verification token (reuse password_resets table)
    await prisma.passwordReset.create({
      data: {
        email: user.email,
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken, user.name);
    } catch (emailError) {
      logger.warn(`Failed to send verification email: ${emailError}`);
      // Continue even if email fails
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'registered',
        modelType: 'user',
        modelId: user.id,
        newValues: { email: user.email, name: user.name },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          jobRole: user.jobRole,
          isActive: user.isActive,
          emailVerifiedAt: null,
          createdAt: user.createdAt,
        },
      },
      message: 'Registration successful. Please check your email to verify your account.',
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

    logger.error('Registration error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during registration',
      },
    });
  }
});

// Configure multer for file uploads (must be before routes that use it)
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const avatarDir = path.join(uploadDir, 'avatars');

// Ensure upload directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).user?.userId;
    const ext = path.extname(file.originalname);
    const filename = `avatar-${userId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif, webp) are allowed!'));
    }
  },
});

// Get recent activities for current user (must be before /me route)
router.get('/me/activities', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    const activities = await prisma.auditLog.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      select: {
        id: true,
        action: true,
        modelType: true,
        modelId: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
      },
    });

    // Format activities for frontend
    const formattedActivities = activities.map((activity) => {
      const action = activity.action;
      const feature = activity.modelType || 'user';
      let title = '';
      let icon = 'circle';

      // Determine title and icon based on action and feature
      if (feature === 'user' && action === 'created') {
        title = 'Created user';
        icon = 'circle';
      } else if (feature === 'user_profile' && action === 'uploaded_avatar') {
        title = 'Updated profile photo';
        icon = 'user-gear';
      } else if (feature === 'user_profile' && action === 'removed_avatar') {
        title = 'Removed profile photo';
        icon = 'user-gear';
      } else if (feature === 'user' && action === 'updated') {
        title = 'Updated user';
        icon = 'circle';
      } else {
        title = `${action} ${feature}`;
      }

      return {
        id: activity.id.toString(),
        title,
        action,
        feature,
        modelId: activity.modelId?.toString() || null,
        createdAt: activity.createdAt.toISOString(),
        icon,
      };
    });

    res.json({
      data: {
        activities: formattedActivities,
      },
    });
  } catch (error) {
    logger.error('Get activities error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching activities',
      },
    });
  }
});

// Upload avatar (must be before /me route)
router.post('/me/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded',
        },
      });
    }

    // Get current user to check old avatar
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    const oldAvatar = user?.avatar;

    // Create avatar URL - use relative path, Next.js will proxy to backend
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    // Use relative URL - Next.js rewrites will proxy to backend
    const fullAvatarUrl = avatarUrl;

    // Update user avatar
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: fullAvatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        updatedAt: true,
      },
    });

    // Create audit log entry
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'uploaded_avatar',
          modelType: 'user_profile',
          modelId: userId,
          oldValues: oldAvatar ? { avatar: oldAvatar } : null,
          newValues: { avatar: fullAvatarUrl },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log for avatar upload:', auditError);
      // Don't fail the request if audit log fails
    }

    // Delete old avatar file if it exists and is local
    if (oldAvatar && oldAvatar.includes('/uploads/avatars/')) {
      const oldFilename = path.basename(oldAvatar);
      const oldFilePath = path.join(avatarDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    logger.info(`Avatar uploaded for user: ${updatedUser.email}`);

    res.json({
      data: {
        user: {
          id: updatedUser.id.toString(),
          name: updatedUser.name,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
      },
    });
  } catch (error: any) {
    // Delete uploaded file if there was an error
    if (req.file) {
      const filePath = path.join(avatarDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (error.message && error.message.includes('Only image files')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
    }

    logger.error('Upload avatar error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while uploading avatar',
      },
    });
  }
});

// Remove avatar (must be before /me route)
router.delete('/me/avatar', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const oldAvatar = user.avatar;

    // Update user to remove avatar
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatar: null },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        updatedAt: true,
      },
    });

    // Create audit log entry
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'removed_avatar',
          modelType: 'user_profile',
          modelId: userId,
          oldValues: oldAvatar ? { avatar: oldAvatar } : null,
          newValues: { avatar: null },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log for avatar removal:', auditError);
    }

    // Delete avatar file if it exists and is local
    if (oldAvatar && oldAvatar.includes('/uploads/avatars/')) {
      const oldFilename = path.basename(oldAvatar);
      const oldFilePath = path.join(avatarDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    logger.info(`Avatar removed for user: ${updatedUser.email}`);

    res.json({
      data: {
        user: {
          id: updatedUser.id.toString(),
          name: updatedUser.name,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Remove avatar error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while removing avatar',
      },
    });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenantUsers: {
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                plan: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
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
          jobRole: user.jobRole,
          isActive: user.isActive,
          emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
          lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
          passwordChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
          createdAt: user.createdAt ? user.createdAt.toISOString() : null,
          updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
          tenants: user.tenantUsers.map((tu) => ({
            id: tu.tenant.id.toString(),
            name: tu.tenant.name,
            slug: tu.tenant.slug,
            plan: tu.tenant.plan,
            status: tu.tenant.status,
            role: tu.role,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching profile',
      },
    });
  }
});

// Update user profile
router.patch('/me', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);
    const data = updateProfileSchema.parse(req.body);

    // Build update data object
    const updateData: any = {};
    if (data.name !== undefined) {
      updateData.name = data.name || null;
    }
    if (data.jobRole !== undefined) {
      updateData.jobRole = data.jobRole || null;
    }
    if (data.avatar !== undefined) {
      updateData.avatar = data.avatar || null;
    }

    // If no fields to update, return current user
    if (Object.keys(updateData).length === 0) {
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          jobRole: true,
          updatedAt: true,
        },
      });

      if (!currentUser) {
        return res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        });
      }

      return res.json({
        data: {
          user: {
            id: currentUser.id.toString(),
            name: currentUser.name,
            email: currentUser.email,
            role: currentUser.role,
            avatar: currentUser.avatar,
            jobRole: currentUser.jobRole,
            updatedAt: currentUser.updatedAt,
          },
        },
      });
    }

    // Get old values for audit log
    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        jobRole: true,
        avatar: true,
      },
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        jobRole: true,
        updatedAt: true,
      },
    });

    // Create audit log entry
    try {
      const oldValues: any = {};
      const newValues: any = {};
      
      if (data.name !== undefined) {
        oldValues.name = oldUser?.name || null;
        newValues.name = user.name;
      }
      if (data.jobRole !== undefined) {
        oldValues.jobRole = oldUser?.jobRole || null;
        newValues.jobRole = user.jobRole;
      }
      if (data.avatar !== undefined) {
        oldValues.avatar = oldUser?.avatar || null;
        newValues.avatar = user.avatar;
      }

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'updated',
          modelType: 'user',
          modelId: userId,
          oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
          newValues: Object.keys(newValues).length > 0 ? newValues : null,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log for profile update:', auditError);
      // Don't fail the request if audit log fails
    }

    logger.info(`User profile updated: ${user.email}`);

    res.json({
      data: {
        user: {
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          jobRole: user.jobRole,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Update profile validation error:', {
        errors: error.errors,
        body: req.body,
      });
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
    }

    logger.error('Update profile error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating profile',
      },
    });
  }
});

// Change password (with password history check)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: {
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect',
        },
      });
    }

    // Check password history (prevent reuse of last 5 passwords)
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    for (const history of passwordHistory) {
      const isReused = await bcrypt.compare(newPassword, history.passwordHash);
      if (isReused) {
        return res.status(400).json({
          error: {
            code: 'PASSWORD_REUSED',
            message: 'You cannot reuse a recently used password',
          },
        });
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Store old password in history
    await prisma.passwordHistory.create({
      data: {
        userId: user.id,
        passwordHash: user.password,
      },
    });

    // Update user password
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke all personal access tokens EXCEPT the current session token (security best practice)
    // Note: JWT tokens cannot be revoked server-side, but we can revoke PATs
    // The current JWT session will remain valid until it expires naturally
    const currentToken = req.headers.authorization?.substring(7);
    if (currentToken) {
      // Get current token hash if it's a PAT
      const tokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
      const currentSession = await prisma.personalAccessToken.findFirst({
        where: {
          tokenableType: 'User',
          tokenableId: user.id,
          tokenHash,
          revokedAt: null,
        },
        select: { id: true },
      });

      // Revoke all PATs except current session
      const whereClause: any = {
        tokenableType: 'User',
        tokenableId: user.id,
        revokedAt: null,
      };

      if (currentSession) {
        whereClause.id = { not: currentSession.id };
      }

      await prisma.personalAccessToken.updateMany({
        where: whereClause,
        data: {
          revokedAt: new Date(),
          revokedBy: user.id,
        },
      });
    } else {
      // No current token, revoke all
      await prisma.personalAccessToken.updateMany({
        where: {
          tokenableType: 'User',
          tokenableId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedBy: user.id,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'changed_password',
        modelType: 'user',
        modelId: user.id,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info(`Password changed for user: ${user.email}`);

    res.json({
      message: 'Password changed successfully',
      data: {
        // Return a message indicating current session remains active
        sessionActive: true,
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

    logger.error('Change password error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while changing password',
      },
    });
  }
});

// List users (admin only - add admin check middleware later)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const query = listUsersSchema.parse(req.query);
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.tenantId) {
      where.tenantUsers = {
        some: {
          tenantId: BigInt(query.tenantId),
        },
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          jobRole: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      data: {
        users: users.map((user) => ({
          id: user.id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          jobRole: user.jobRole,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
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

    logger.error('List users error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching users',
      },
    });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        jobRole: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
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
          jobRole: user.jobRole,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching user',
      },
    });
  }
});

// ========================================
// USER DEACTIVATION/REACTIVATION
// ========================================

// Deactivate user (Admin only)
router.post('/:id/deactivate', authenticateToken, async (req, res) => {
  try {
    const currentUserId = BigInt((req as any).user.userId);
    const targetUserId = BigInt(req.params.id);

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can deactivate users',
        },
      });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    if (!targetUser.isActive) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_DEACTIVATED',
          message: 'User is already deactivated',
        },
      });
    }

    // Deactivate user
    await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'deactivated_user',
        modelType: 'user',
        modelId: targetUserId,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info(`User deactivated: ${targetUser.email} by ${currentUser.role}`);

    res.json({
      message: 'User deactivated successfully',
    });
  } catch (error) {
    logger.error('Deactivate user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deactivating user',
      },
    });
  }
});

// Reactivate user (Admin only)
router.post('/:id/activate', authenticateToken, async (req, res) => {
  try {
    const currentUserId = BigInt((req as any).user.userId);
    const targetUserId = BigInt(req.params.id);

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can reactivate users',
        },
      });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    if (targetUser.isActive) {
      return res.status(400).json({
        error: {
          code: 'ALREADY_ACTIVE',
          message: 'User is already active',
        },
      });
    }

    // Reactivate user
    await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: true },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: currentUserId,
        action: 'reactivated_user',
        modelType: 'user',
        modelId: targetUserId,
        oldValues: { isActive: false },
        newValues: { isActive: true },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    logger.info(`User reactivated: ${targetUser.email} by ${currentUser.role}`);

    res.json({
      message: 'User reactivated successfully',
    });
  } catch (error) {
    logger.error('Reactivate user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while reactivating user',
      },
    });
  }
});

// ========================================
// USER BULK OPERATIONS
// ========================================

const bulkOperationSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
});

// Bulk activate users
router.post('/bulk-activate', authenticateToken, async (req, res) => {
  try {
    const currentUserId = BigInt((req as any).user.userId);
    const { userIds } = bulkOperationSchema.parse(req.body);

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can perform bulk operations',
        },
      });
    }

    const userIdsBigInt = userIds.map(id => BigInt(id));
    const results = { successful: [] as string[], failed: [] as string[] };

    for (const userId of userIdsBigInt) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: true },
        });
        results.successful.push(userId.toString());

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: currentUserId,
            action: 'bulk_activated_user',
            modelType: 'user',
            modelId: userId,
            newValues: { isActive: true },
            ipAddress: req.ip || req.socket.remoteAddress || null,
            userAgent: req.get('user-agent') || null,
          },
        });
      } catch (error) {
        results.failed.push(userId.toString());
      }
    }

    res.json({
      message: `Bulk activation completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results,
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

    logger.error('Bulk activate error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during bulk activation',
      },
    });
  }
});

// Bulk deactivate users
router.post('/bulk-deactivate', authenticateToken, async (req, res) => {
  try {
    const currentUserId = BigInt((req as any).user.userId);
    const { userIds } = bulkOperationSchema.parse(req.body);

    // Check if current user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Only administrators can perform bulk operations',
        },
      });
    }

    const userIdsBigInt = userIds.map(id => BigInt(id));
    const results = { successful: [] as string[], failed: [] as string[] };

    for (const userId of userIdsBigInt) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
        });
        results.successful.push(userId.toString());

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: currentUserId,
            action: 'bulk_deactivated_user',
            modelType: 'user',
            modelId: userId,
            oldValues: { isActive: true },
            newValues: { isActive: false },
            ipAddress: req.ip || req.socket.remoteAddress || null,
            userAgent: req.get('user-agent') || null,
          },
        });
      } catch (error) {
        results.failed.push(userId.toString());
      }
    }

    res.json({
      message: `Bulk deactivation completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      data: results,
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

    logger.error('Bulk deactivate error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during bulk deactivation',
      },
    });
  }
});

// ========================================
// USER PREFERENCES
// ========================================

const preferencesSchema = z.object({
  preferences: z.record(z.any()).optional(),
});

// Get user preferences
router.get('/me/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    res.json({
      data: {
        preferences: user.preferences || {},
      },
    });
  } catch (error) {
    logger.error('Get preferences error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching preferences',
      },
    });
  }
});

// Update user preferences
router.patch('/me/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);
    const { preferences } = preferencesSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Merge with existing preferences
    const currentPreferences = (user.preferences as Record<string, any>) || {};
    const updatedPreferences = { ...currentPreferences, ...preferences };

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPreferences },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'updated_preferences',
        modelType: 'user_preferences',
        modelId: userId,
        oldValues: { preferences: currentPreferences },
        newValues: { preferences: updatedPreferences },
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
      },
    });

    res.json({
      data: {
        preferences: updatedPreferences,
      },
      message: 'Preferences updated successfully',
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

    logger.error('Update preferences error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating preferences',
      },
    });
  }
});

// ========================================
// SESSION MANAGEMENT
// ========================================

// List active sessions (personal access tokens)
router.get('/me/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);

    const sessions = await prisma.personalAccessToken.findMany({
      where: {
        tokenableType: 'User',
        tokenableId: userId,
        revokedAt: null,
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        name: true,
        lastUsedAt: true,
        lastUsedIp: true,
        lastUsedUserAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    res.json({
      data: {
        sessions: sessions.map(session => ({
          id: session.id.toString(),
          name: session.name,
          lastUsedAt: session.lastUsedAt?.toISOString() || null,
          lastUsedIp: session.lastUsedIp,
          lastUsedUserAgent: session.lastUsedUserAgent,
          createdAt: session.createdAt.toISOString(),
          expiresAt: session.expiresAt?.toISOString() || null,
        })),
      },
    });
  } catch (error) {
    logger.error('Get sessions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching sessions',
      },
    });
  }
});

// Revoke specific session
router.delete('/me/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);
    const sessionId = BigInt(req.params.id);

    const session = await prisma.personalAccessToken.findFirst({
      where: {
        id: sessionId,
        tokenableType: 'User',
        tokenableId: userId,
        revokedAt: null,
      },
    });

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found',
        },
      });
    }

    await prisma.personalAccessToken.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });

    res.json({
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error('Revoke session error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while revoking session',
      },
    });
  }
});

// Revoke all other sessions (keep current one)
router.delete('/me/sessions/others', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as any).user.userId);
    const currentToken = req.headers.authorization?.substring(7);

    if (!currentToken) {
      return res.status(400).json({
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Current token is required',
        },
      });
    }

    // Get current token ID
    const tokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
    const currentSession = await prisma.personalAccessToken.findFirst({
      where: {
        tokenableType: 'User',
        tokenableId: userId,
        tokenHash,
        revokedAt: null,
      },
      select: { id: true },
    });

    // Revoke all other sessions
    const whereClause: any = {
      tokenableType: 'User',
      tokenableId: userId,
      revokedAt: null,
    };

    if (currentSession) {
      whereClause.id = { not: currentSession.id };
    }

    const result = await prisma.personalAccessToken.updateMany({
      where: whereClause,
      data: {
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });

    res.json({
      message: `${result.count} session(s) revoked successfully`,
    });
  } catch (error) {
    logger.error('Revoke other sessions error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while revoking sessions',
      },
    });
  }
});

// ========================================
// ADVANCED ACTIVITY TRACKING
// ========================================

// Get user activities with filters
router.get('/:id/activities', authenticateToken, async (req, res) => {
  try {
    const currentUserId = BigInt((req as any).user.userId);
    const targetUserId = BigInt(req.params.id);

    // Check if user can view activities (own activities or admin)
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true },
    });

    if (currentUserId !== targetUserId && currentUser?.role !== 'admin') {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You can only view your own activities',
        },
      });
    }

    const { action, modelType, startDate, endDate, page = '1', limit = '20' } = req.query;

    const whereClause: any = {
      userId: targetUserId,
    };

    if (action) {
      whereClause.action = action as string;
    }

    if (modelType) {
      whereClause.modelType = modelType as string;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate as string);
      }
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [activities, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        select: {
          id: true,
          action: true,
          modelType: true,
          modelId: true,
          oldValues: true,
          newValues: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    res.json({
      data: {
        activities: activities.map(activity => ({
          id: activity.id.toString(),
          action: activity.action,
          modelType: activity.modelType,
          modelId: activity.modelId?.toString() || null,
          oldValues: activity.oldValues,
          newValues: activity.newValues,
          ipAddress: activity.ipAddress,
          userAgent: activity.userAgent,
          createdAt: activity.createdAt.toISOString(),
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
    logger.error('Get activities error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching activities',
      },
    });
  }
});

export default router;

