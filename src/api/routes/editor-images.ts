import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const imagesDir = path.join(uploadDir, 'editor-images');

// Ensure upload directories exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `img-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

// List images schema
const listImagesSchema = z.object({
  mimeType: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('50'),
  sortBy: z.enum(['filename', 'originalName', 'createdAt', 'size']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

// List editor images
router.get('/editor/images', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const query = listImagesSchema.parse(req.query);
    const page = parseInt(query.page, 10);
    const limit = parseInt(query.limit, 10);
    const skip = (page - 1) * limit;

    const where: any = {
      uploadedBy: userId, // Users can only see their own images
    };

    if (query.mimeType) {
      where.mimeType = query.mimeType;
    }

    if (query.search) {
      where.OR = [
        { filename: { contains: query.search, mode: 'insensitive' } },
        { originalName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [images, total] = await Promise.all([
      prisma.editorImage.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        },
      }),
      prisma.editorImage.count({ where }),
    ]);

    // Fetch user details
    const userIds = new Set<bigint>();
    images.forEach((img) => {
      if (img.uploadedBy) userIds.add(img.uploadedBy);
    });

    const users = userIds.size > 0 ? await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    }) : [];

    const userMap = new Map(users.map((u) => [u.id.toString(), u]));

    res.json({
      data: {
        images: images.map((img) => {
          const uploadedByUser = img.uploadedBy ? userMap.get(img.uploadedBy.toString()) : null;

          return {
            id: img.id.toString(),
            filename: img.filename,
            originalName: img.originalName,
            path: img.path,
            url: `/uploads/editor-images/${img.filename}`, // Public URL
            mimeType: img.mimeType,
            size: img.size,
            uploadedBy: uploadedByUser ? {
              id: uploadedByUser.id.toString(),
              name: uploadedByUser.name,
              email: uploadedByUser.email,
            } : null,
            createdAt: img.createdAt.toISOString(),
            updatedAt: img.updatedAt.toISOString(),
          };
        }),
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
    logger.error('List editor images error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching editor images',
      },
    });
  }
});

// Get editor image by ID
router.get('/editor/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const imageId = BigInt(req.params.imageId);

    const image = await prisma.editorImage.findFirst({
      where: {
        id: imageId,
        uploadedBy: userId, // Users can only access their own images
      },
    });

    if (!image) {
      return res.status(404).json({
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Editor image not found',
        },
      });
    }

    // Fetch user details
    const uploadedByUser = image.uploadedBy ? await prisma.user.findFirst({
      where: { id: image.uploadedBy },
      select: { id: true, name: true, email: true },
    }) : null;

    res.json({
      data: {
        image: {
          id: image.id.toString(),
          filename: image.filename,
          originalName: image.originalName,
          path: image.path,
          url: `/uploads/editor-images/${image.filename}`, // Public URL
          mimeType: image.mimeType,
          size: image.size,
          uploadedBy: uploadedByUser ? {
            id: uploadedByUser.id.toString(),
            name: uploadedByUser.name,
            email: uploadedByUser.email,
          } : null,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get editor image error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching editor image',
      },
    });
  }
});

// Upload editor image
router.post('/editor/images', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No image file provided',
        },
      });
    }

    const image = await prisma.editorImage.create({
      data: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: userId,
      },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'created',
          modelType: 'editor_image',
          modelId: image.id,
          oldValues: {},
          newValues: {
            filename: image.filename,
            originalName: image.originalName,
          },
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    // Fetch user details
    const uploadedByUser = await prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    logger.info(`Editor image uploaded: ${image.filename} by user ${userId}`);

    res.status(201).json({
      data: {
        image: {
          id: image.id.toString(),
          filename: image.filename,
          originalName: image.originalName,
          path: image.path,
          url: `/uploads/editor-images/${image.filename}`, // Public URL
          mimeType: image.mimeType,
          size: image.size,
          uploadedBy: uploadedByUser ? {
            id: uploadedByUser.id.toString(),
            name: uploadedByUser.name,
            email: uploadedByUser.email,
          } : null,
          createdAt: image.createdAt.toISOString(),
          updatedAt: image.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Upload editor image error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while uploading editor image',
      },
    });
  }
});

// Delete editor image
router.delete('/editor/images/:imageId', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const imageId = BigInt(req.params.imageId);

    const image = await prisma.editorImage.findFirst({
      where: {
        id: imageId,
        uploadedBy: userId, // Users can only delete their own images
      },
    });

    if (!image) {
      return res.status(404).json({
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Editor image not found',
        },
      });
    }

    // Delete file from filesystem
    const filePath = path.join(imagesDir, image.filename);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (fileError) {
        logger.warn(`Failed to delete file ${filePath}:`, fileError);
      }
    }

    await prisma.editorImage.delete({
      where: { id: imageId },
    });

    // Create audit log
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'deleted',
          modelType: 'editor_image',
          modelId: imageId,
          oldValues: {
            filename: image.filename,
            originalName: image.originalName,
          },
          newValues: {},
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
        },
      });
    } catch (auditError) {
      logger.warn('Failed to create audit log:', auditError);
    }

    logger.info(`Editor image deleted: ${image.filename} by user ${userId}`);

    res.json({
      message: 'Editor image deleted successfully',
    });
  } catch (error) {
    logger.error('Delete editor image error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting editor image',
      },
    });
  }
});

export default router;

