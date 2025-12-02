import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { getUserPrimaryTenant } from '../../shared/utils/tenant';

const router = Router();

// Validation schemas
const createMetadataSchema = z.object({
  entityType: z.string().min(1).max(255),
  entityId: z.string().min(1),
  metaKey: z.string().min(1).max(255),
  metaValue: z.string(),
});

const updateMetadataSchema = z.object({
  metaValue: z.string(),
});

const bulkUpdateMetadataSchema = z.object({
  metadata: z.array(
    z.object({
      metaKey: z.string().min(1).max(255),
      metaValue: z.string(),
    })
  ),
});

const querySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  metaKey: z.string().optional(),
  metaValue: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

// Valid entity types (can be extended)
const VALID_ENTITY_TYPES = [
  'test_case',
  'document',
  'bug_budget',
  'test_run',
  'test_plan',
  'suite',
  'project',
  'repository',
  'user',
  'decision_log',
] as const;

/**
 * GET /entity-metadata
 * List entity metadata with filtering
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view entity metadata',
        },
      });
    }

    const query = querySchema.parse(req.query);
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = BigInt(query.entityId);
    }

    if (query.metaKey) {
      where.metaKey = query.metaKey;
    }

    if (query.metaValue) {
      where.metaValue = { contains: query.metaValue, mode: 'insensitive' };
    }

    // Get total count
    const total = await prisma.entityMetadata.count({ where });

    // Get metadata
    const metadata = await prisma.entityMetadata.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    res.json({
      data: {
        metadata: metadata.map((item) => ({
          id: item.id.toString(),
          entityType: item.entityType,
          entityId: item.entityId.toString(),
          metaKey: item.metaKey,
          metaValue: item.metaValue,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
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

    logger.error('List entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching entity metadata',
      },
    });
  }
});

/**
 * GET /entity-metadata/entity/:entityType/:entityId
 * Get all metadata for a specific entity
 */
router.get('/entity/:entityType/:entityId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view entity metadata',
        },
      });
    }

    const entityType = req.params.entityType;
    const entityId = BigInt(req.params.entityId);

    const metadata = await prisma.entityMetadata.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        metaKey: 'asc',
      },
    });

    // Convert to key-value object
    const metadataObject = metadata.reduce(
      (acc, item) => {
        acc[item.metaKey] = item.metaValue;
        return acc;
      },
      {} as Record<string, string>
    );

    res.json({
      data: {
        entityType,
        entityId: entityId.toString(),
        metadata: metadataObject,
        items: metadata.map((item) => ({
          id: item.id.toString(),
          metaKey: item.metaKey,
          metaValue: item.metaValue,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    logger.error('Get entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching entity metadata',
      },
    });
  }
});

/**
 * GET /entity-metadata/:id
 * Get a specific metadata entry by ID
 */
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view entity metadata',
        },
      });
    }

    const metadataId = BigInt(req.params.id);

    const metadata = await prisma.entityMetadata.findUnique({
      where: { id: metadataId },
    });

    if (!metadata) {
      return res.status(404).json({
        error: {
          code: 'METADATA_NOT_FOUND',
          message: 'Metadata entry not found',
        },
      });
    }

    res.json({
      data: {
        metadata: {
          id: metadata.id.toString(),
          entityType: metadata.entityType,
          entityId: metadata.entityId.toString(),
          metaKey: metadata.metaKey,
          metaValue: metadata.metaValue,
          createdAt: metadata.createdAt.toISOString(),
          updatedAt: metadata.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching metadata',
      },
    });
  }
});

/**
 * POST /entity-metadata
 * Create a new metadata entry
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to create entity metadata',
        },
      });
    }

    const data = createMetadataSchema.parse(req.body);

    // Validate entity type (optional but recommended)
    if (!VALID_ENTITY_TYPES.includes(data.entityType as any)) {
      logger.warn(`Unknown entity type: ${data.entityType}`);
    }

    // Upsert (create or update if exists)
    const metadata = await prisma.entityMetadata.upsert({
      where: {
        entityType_entityId_metaKey: {
          entityType: data.entityType,
          entityId: BigInt(data.entityId),
          metaKey: data.metaKey,
        },
      },
      create: {
        entityType: data.entityType,
        entityId: BigInt(data.entityId),
        metaKey: data.metaKey.trim(),
        metaValue: data.metaValue,
      },
      update: {
        metaValue: data.metaValue,
      },
    });

    logger.info(`Entity metadata ${metadata.metaKey} created/updated for ${data.entityType}:${data.entityId} by user ${userId}`);

    res.status(201).json({
      data: {
        metadata: {
          id: metadata.id.toString(),
          entityType: metadata.entityType,
          entityId: metadata.entityId.toString(),
          metaKey: metadata.metaKey,
          metaValue: metadata.metaValue,
          createdAt: metadata.createdAt.toISOString(),
          updatedAt: metadata.updatedAt.toISOString(),
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

    logger.error('Create entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while creating entity metadata',
      },
    });
  }
});

/**
 * PATCH /entity-metadata/:id
 * Update a metadata entry
 */
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update entity metadata',
        },
      });
    }

    const metadataId = BigInt(req.params.id);
    const data = updateMetadataSchema.parse(req.body);

    const metadata = await prisma.entityMetadata.update({
      where: { id: metadataId },
      data: {
        metaValue: data.metaValue,
      },
    });

    logger.info(`Entity metadata ${metadata.metaKey} updated for ${metadata.entityType}:${metadata.entityId} by user ${userId}`);

    res.json({
      data: {
        metadata: {
          id: metadata.id.toString(),
          entityType: metadata.entityType,
          entityId: metadata.entityId.toString(),
          metaKey: metadata.metaKey,
          metaValue: metadata.metaValue,
          createdAt: metadata.createdAt.toISOString(),
          updatedAt: metadata.updatedAt.toISOString(),
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

    if ((error as any).code === 'P2025') {
      return res.status(404).json({
        error: {
          code: 'METADATA_NOT_FOUND',
          message: 'Metadata entry not found',
        },
      });
    }

    logger.error('Update entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating entity metadata',
      },
    });
  }
});

/**
 * PUT /entity-metadata/entity/:entityType/:entityId/bulk
 * Bulk update metadata for an entity
 */
router.put('/entity/:entityType/:entityId/bulk', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update entity metadata',
        },
      });
    }

    const entityType = req.params.entityType;
    const entityId = BigInt(req.params.entityId);
    const data = bulkUpdateMetadataSchema.parse(req.body);

    // Use transaction to update all metadata
    const results = await prisma.$transaction(
      data.metadata.map((item) =>
        prisma.entityMetadata.upsert({
          where: {
            entityType_entityId_metaKey: {
              entityType,
              entityId,
              metaKey: item.metaKey,
            },
          },
          create: {
            entityType,
            entityId,
            metaKey: item.metaKey.trim(),
            metaValue: item.metaValue,
          },
          update: {
            metaValue: item.metaValue,
          },
        })
      )
    );

    logger.info(`Bulk metadata updated for ${entityType}:${entityId} by user ${userId}`);

    res.json({
      data: {
        entityType,
        entityId: entityId.toString(),
        metadata: results.map((item) => ({
          id: item.id.toString(),
          metaKey: item.metaKey,
          metaValue: item.metaValue,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
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

    logger.error('Bulk update entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating entity metadata',
      },
    });
  }
});

/**
 * DELETE /entity-metadata/:id
 * Delete a metadata entry
 */
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete entity metadata',
        },
      });
    }

    const metadataId = BigInt(req.params.id);

    const metadata = await prisma.entityMetadata.findUnique({
      where: { id: metadataId },
    });

    if (!metadata) {
      return res.status(404).json({
        error: {
          code: 'METADATA_NOT_FOUND',
          message: 'Metadata entry not found',
        },
      });
    }

    await prisma.entityMetadata.delete({
      where: { id: metadataId },
    });

    logger.info(`Entity metadata ${metadata.metaKey} deleted for ${metadata.entityType}:${metadata.entityId} by user ${userId}`);

    res.json({
      message: 'Metadata entry deleted successfully',
    });
  } catch (error) {
    logger.error('Delete entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting entity metadata',
      },
    });
  }
});

/**
 * DELETE /entity-metadata/entity/:entityType/:entityId
 * Delete all metadata for an entity
 */
router.delete('/entity/:entityType/:entityId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to delete entity metadata',
        },
      });
    }

    const entityType = req.params.entityType;
    const entityId = BigInt(req.params.entityId);

    const result = await prisma.entityMetadata.deleteMany({
      where: {
        entityType,
        entityId,
      },
    });

    logger.info(`All metadata deleted for ${entityType}:${entityId} by user ${userId}`);

    res.json({
      message: 'All metadata entries deleted successfully',
      deletedCount: result.count,
    });
  } catch (error) {
    logger.error('Delete entity metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while deleting entity metadata',
      },
    });
  }
});

export default router;

