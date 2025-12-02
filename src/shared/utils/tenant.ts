import { prisma } from '../infrastructure/database';
import { logger } from './logger';

/**
 * Get the primary tenant ID for a user
 * Returns the first tenant the user belongs to, or null if none found
 */
export async function getUserPrimaryTenant(userId: bigint): Promise<bigint | null> {
  try {
    const tenantUser = await prisma.tenantUser.findFirst({
      where: {
        userId,
      },
      select: {
        tenantId: true,
      },
      orderBy: {
        joinedAt: 'asc', // Get the first tenant the user joined
      },
    });

    return tenantUser?.tenantId || null;
  } catch (error) {
    logger.error('Error getting user primary tenant:', error);
    return null;
  }
}

/**
 * Get all tenant IDs for a user
 */
export async function getUserTenants(userId: bigint): Promise<bigint[]> {
  try {
    const tenantUsers = await prisma.tenantUser.findMany({
      where: {
        userId,
      },
      select: {
        tenantId: true,
      },
    });

    return tenantUsers.map((tu) => tu.tenantId);
  } catch (error) {
    logger.error('Error getting user tenants:', error);
    return [];
  }
}

/**
 * Check if a user belongs to a specific tenant
 */
export async function userBelongsToTenant(
  userId: bigint,
  tenantId: bigint
): Promise<boolean> {
  try {
    const tenantUser = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
        },
      },
    });

    return !!tenantUser;
  } catch (error) {
    logger.error('Error checking user tenant membership:', error);
    return false;
  }
}

