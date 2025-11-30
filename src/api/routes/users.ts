import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import bcrypt from 'bcrypt';
import { logger } from '../../shared/utils/logger';
import { authenticateToken } from '../middleware/auth';

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
          createdAt: user.createdAt,
        },
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

    logger.error('Registration error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred during registration',
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

    // Revoke all personal access tokens (security best practice)
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

    logger.info(`Password changed for user: ${user.email}`);

    res.json({
      message: 'Password changed successfully',
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

export default router;

