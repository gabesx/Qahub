import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Storage type configuration: 'database', 'filesystem', or 's3'
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'filesystem';

// Configure multer based on storage type
let upload: multer.Multer;

if (STORAGE_TYPE === 'database') {
  // For database storage, use memory storage (don't save to disk)
  const memoryStorage = multer.memoryStorage();
  upload = multer({
    storage: memoryStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit (increased for videos)
    },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        // Videos
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-ms-wmv'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images and videos are allowed.'));
      }
    },
  });
} else {
  // For filesystem storage, use disk storage
  const uploadDir = process.env.UPLOAD_DIR || 'uploads';
  const imagesDir = path.join(uploadDir, 'editor-images');

  // Ensure upload directories exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, imagesDir);
    },
    filename: (_req, _file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(_file.originalname);
      cb(null, `img-${uniqueSuffix}${ext}`);
    },
  });

  upload = multer({
    storage: diskStorage,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB limit (increased for videos)
    },
    fileFilter: (_req, file, cb) => {
      const allowedMimes = [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        // Videos
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-ms-wmv'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only images and videos are allowed.'));
      }
    },
  });
}

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

          // Generate URL based on storage type
          const imageUrl = img.storageType === 'database'
            ? `/api/editor-images/${img.id.toString()}/file`
            : `/uploads/editor-images/${img.filename}`;

          return {
            id: img.id.toString(),
            filename: img.filename,
            originalName: img.originalName,
            path: img.path,
            url: imageUrl,
            mimeType: img.mimeType,
            size: img.size,
            storageType: img.storageType,
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

    // Generate URL based on storage type
    const imageUrl = image.storageType === 'database'
      ? `/api/editor-images/${image.id.toString()}/file`
      : `/uploads/editor-images/${image.filename}`;

    res.json({
      data: {
        image: {
          id: image.id.toString(),
          filename: image.filename,
          originalName: image.originalName,
          path: image.path,
          url: imageUrl,
          mimeType: image.mimeType,
          size: image.size,
          storageType: image.storageType,
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

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(req.file.originalname);
    const filename = `img-${uniqueSuffix}${ext}`;
    const filePath = STORAGE_TYPE === 'database' 
      ? `database://${filename}` 
      : req.file.path;

    // Prepare image data
    const imageData: any = {
      filename,
      originalName: req.file.originalname,
      path: filePath,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storageType: STORAGE_TYPE,
      uploadedBy: userId,
    };

    // If storing in database, include binary data
    if (STORAGE_TYPE === 'database' && req.file.buffer) {
      imageData.data = req.file.buffer;
    }

    const image = await prisma.editorImage.create({
      data: imageData,
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

    logger.info(`Editor image uploaded: ${image.filename} by user ${userId} (storage: ${STORAGE_TYPE})`);

    // Generate URL based on storage type
    let imageUrl: string;
    if (STORAGE_TYPE === 'database') {
      // For database storage, use Next.js API route to serve the file (with auth)
      // The frontend will proxy this through /api/editor-images/[id]/file
      imageUrl = `/api/editor-images/${image.id.toString()}/file`;
    } else {
      // For filesystem storage, use static file serving
      imageUrl = `/uploads/editor-images/${image.filename}`;
    }

    res.status(201).json({
      data: {
        image: {
          id: image.id.toString(),
          filename: image.filename,
          originalName: image.originalName,
          path: image.path,
          url: imageUrl,
          mimeType: image.mimeType,
          size: image.size,
          storageType: image.storageType,
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

// Serve file from database (for database storage type)
router.get('/editor/images/:imageId/file', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const imageId = BigInt(req.params.imageId);

    const image = await prisma.editorImage.findFirst({
      where: {
        id: imageId,
        storageType: 'database',
      },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        data: true,
        uploadedBy: true,
      },
    });

    if (!image) {
      return res.status(404).json({
        error: {
          code: 'IMAGE_NOT_FOUND',
          message: 'Image not found or not stored in database',
        },
      });
    }

    // Check if user has access (uploaded by them or admin)
    // For now, allow access if user uploaded it
    if (image.uploadedBy && image.uploadedBy !== userId) {
      // Could add admin check here
      return res.status(403).json({
        error: {
          code: 'ACCESS_DENIED',
          message: 'You do not have access to this image',
        },
      });
    }

    if (!image.data) {
      return res.status(404).json({
        error: {
          code: 'DATA_NOT_FOUND',
          message: 'Image data not found in database',
        },
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Content-Length', image.data.length);
    res.setHeader('Content-Disposition', `inline; filename="${image.filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Send binary data
    res.send(Buffer.from(image.data));
  } catch (error) {
    logger.error('Serve image file error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while serving image file',
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

    // Delete file from filesystem (only for filesystem storage)
    if (image.storageType === 'filesystem' && image.path) {
      const filePath = image.path;
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          logger.info(`File deleted from filesystem: ${filePath}`);
        } catch (fileError) {
          logger.warn(`Failed to delete file ${filePath}:`, fileError);
          // Don't fail the request if file deletion fails
        }
      }
    }
    // For database storage, the data is deleted when the record is deleted (CASCADE)

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

