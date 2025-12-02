import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/infrastructure/database';
import { logger } from '../../shared/utils/logger';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Update metadata schema
const updateMetadataSchema = z.object({
  epicHierarchy: z.any().optional().nullable(),
  assigneeDetails: z.any().optional().nullable(),
  dateFields: z.any().optional().nullable(),
  analysisFields: z.any().optional().nullable(),
  classificationFields: z.any().optional().nullable(),
  reportFields: z.any().optional().nullable(),
  storyPointsData: z.any().optional().nullable(),
  versionFields: z.any().optional().nullable(),
  rawJiraData: z.any().optional().nullable(),
});

// Get bug budget metadata
router.get('/bug-budget/:id/metadata', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const bugId = BigInt(req.params.id);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to view bug budget metadata',
        },
      });
    }

    const bug = await prisma.bugBudget.findUnique({
      where: { id: bugId },
    });

    if (!bug) {
      return res.status(404).json({
        error: {
          code: 'BUG_NOT_FOUND',
          message: 'Bug budget not found',
        },
      });
    }

    const metadata = await prisma.bugBudgetMetadata.findUnique({
      where: { bugBudgetId: bugId },
    });

    if (!metadata) {
      return res.status(404).json({
        error: {
          code: 'METADATA_NOT_FOUND',
          message: 'Bug budget metadata not found',
        },
      });
    }

    res.json({
      data: {
        metadata: {
          bugBudgetId: metadata.bugBudgetId.toString(),
          epicHierarchy: metadata.epicHierarchy,
          assigneeDetails: metadata.assigneeDetails,
          dateFields: metadata.dateFields,
          analysisFields: metadata.analysisFields,
          classificationFields: metadata.classificationFields,
          reportFields: metadata.reportFields,
          storyPointsData: metadata.storyPointsData,
          versionFields: metadata.versionFields,
          rawJiraData: metadata.rawJiraData,
          createdAt: metadata.createdAt.toISOString(),
          updatedAt: metadata.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Get bug budget metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while fetching bug budget metadata',
      },
    });
  }
});

// Create or update bug budget metadata
router.put('/bug-budget/:id/metadata', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt((req as AuthRequest).user!.userId);
    const tenantId = await getUserPrimaryTenant(userId);
    const bugId = BigInt(req.params.id);
    const data = updateMetadataSchema.parse(req.body);

    if (!tenantId) {
      return res.status(403).json({
        error: {
          code: 'NO_TENANT',
          message: 'You must belong to a tenant to update bug budget metadata',
        },
      });
    }

    const bug = await prisma.bugBudget.findUnique({
      where: { id: bugId },
    });

    if (!bug) {
      return res.status(404).json({
        error: {
          code: 'BUG_NOT_FOUND',
          message: 'Bug budget not found',
        },
      });
    }

    const existing = await prisma.bugBudgetMetadata.findUnique({
      where: { bugBudgetId: bugId },
    });

    let metadata;
    if (existing) {
      metadata = await prisma.bugBudgetMetadata.update({
        where: { bugBudgetId: bugId },
        data: {
          epicHierarchy: data.epicHierarchy !== undefined ? data.epicHierarchy : existing.epicHierarchy,
          assigneeDetails: data.assigneeDetails !== undefined ? data.assigneeDetails : existing.assigneeDetails,
          dateFields: data.dateFields !== undefined ? data.dateFields : existing.dateFields,
          analysisFields: data.analysisFields !== undefined ? data.analysisFields : existing.analysisFields,
          classificationFields: data.classificationFields !== undefined ? data.classificationFields : existing.classificationFields,
          reportFields: data.reportFields !== undefined ? data.reportFields : existing.reportFields,
          storyPointsData: data.storyPointsData !== undefined ? data.storyPointsData : existing.storyPointsData,
          versionFields: data.versionFields !== undefined ? data.versionFields : existing.versionFields,
          rawJiraData: data.rawJiraData !== undefined ? data.rawJiraData : existing.rawJiraData,
        },
      });
    } else {
      metadata = await prisma.bugBudgetMetadata.create({
        data: {
          bugBudgetId: bugId,
          epicHierarchy: data.epicHierarchy || null,
          assigneeDetails: data.assigneeDetails || null,
          dateFields: data.dateFields || null,
          analysisFields: data.analysisFields || null,
          classificationFields: data.classificationFields || null,
          reportFields: data.reportFields || null,
          storyPointsData: data.storyPointsData || null,
          versionFields: data.versionFields || null,
          rawJiraData: data.rawJiraData || null,
        },
      });
    }

    logger.info(`Bug budget metadata ${existing ? 'updated' : 'created'}: ${bugId} by user ${userId}`);

    res.json({
      data: {
        metadata: {
          bugBudgetId: metadata.bugBudgetId.toString(),
          epicHierarchy: metadata.epicHierarchy,
          assigneeDetails: metadata.assigneeDetails,
          dateFields: metadata.dateFields,
          analysisFields: metadata.analysisFields,
          classificationFields: metadata.classificationFields,
          reportFields: metadata.reportFields,
          storyPointsData: metadata.storyPointsData,
          versionFields: metadata.versionFields,
          rawJiraData: metadata.rawJiraData,
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
    logger.error('Update bug budget metadata error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while updating bug budget metadata',
      },
    });
  }
});

export default router;

