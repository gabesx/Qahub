import { prisma } from '../shared/infrastructure/database';
import { logger } from '../shared/utils/logger';

/**
 * Update test runs view (CQRS read model) for a specific test run
 */
export async function updateTestRunsView(testRunId: bigint): Promise<void> {
  try {
    const testRun = await prisma.testRun.findUnique({
      where: { id: testRunId },
      include: {
        testPlan: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        repository: {
          select: {
            id: true,
            title: true,
          },
        },
        results: {
          select: {
            status: true,
            executionTime: true,
          },
        },
      },
    });

    // Fetch user details separately
    const createdByUser = testRun.createdBy ? await prisma.user.findUnique({
      where: { id: testRun.createdBy },
      select: {
        id: true,
        name: true,
      },
    }) : null;

    if (!testRun) {
      logger.warn(`Test run ${testRunId} not found for view update`);
      return;
    }

    // Calculate statistics
    const totalCases = testRun.results.length;
    const passedCases = testRun.results.filter((r) => r.status === 'passed').length;
    const failedCases = testRun.results.filter((r) => r.status === 'failed').length;
    const skippedCases = testRun.results.filter((r) => r.status === 'skipped').length;
    const blockedCases = testRun.results.filter((r) => r.status === 'blocked').length;

    // Calculate execution duration (sum of all execution times)
    const executionDuration = testRun.results.reduce((sum, r) => {
      return sum + (r.executionTime || 0);
    }, 0);

    // Upsert into read model
    await prisma.testRunsView.upsert({
      where: { id: testRunId },
      create: {
        id: testRunId,
        testPlanId: testRun.testPlanId,
        testPlanTitle: testRun.testPlan.title,
        projectId: testRun.projectId,
        projectTitle: testRun.project.title,
        repositoryId: testRun.repositoryId || BigInt(0),
        repositoryTitle: testRun.repository?.title || '',
        title: testRun.title,
        totalCases,
        passedCases,
        failedCases,
        skippedCases,
        blockedCases,
        executionDate: testRun.executionDate,
        executionDuration: executionDuration > 0 ? executionDuration : null,
        createdById: testRun.createdBy,
        createdByName: testRun.createdBy ? (testRun.createdBy as any).name : null,
        lastUpdatedAt: new Date(),
      },
      update: {
        testPlanId: testRun.testPlanId,
        testPlanTitle: testRun.testPlan.title,
        projectId: testRun.projectId,
        projectTitle: testRun.project.title,
        repositoryId: testRun.repositoryId || BigInt(0),
        repositoryTitle: testRun.repository?.title || '',
        title: testRun.title,
        totalCases,
        passedCases,
        failedCases,
        skippedCases,
        blockedCases,
        executionDate: testRun.executionDate,
        executionDuration: executionDuration > 0 ? executionDuration : null,
        createdById: testRun.createdBy,
        createdByName: testRun.createdBy ? (testRun.createdBy as any).name : null,
        lastUpdatedAt: new Date(),
      },
    });

    logger.info(`Updated test runs view for test run ${testRunId}`);
  } catch (error) {
    logger.error(`Error updating test runs view for test run ${testRunId}:`, error);
    throw error;
  }
}

/**
 * Update all test runs views (for initial population or full refresh)
 */
export async function updateAllTestRunsViews(): Promise<void> {
  try {
    logger.info('Starting full test runs view update');

    const testRuns = await prisma.testRun.findMany({
      select: { id: true },
    });

    for (const testRun of testRuns) {
      await updateTestRunsView(testRun.id);
    }

    logger.info(`Completed test runs view update for ${testRuns.length} test runs`);
  } catch (error) {
    logger.error('Error updating all test runs views:', error);
    throw error;
  }
}

/**
 * Update test runs view for recent test runs (last N days)
 */
export async function updateRecentTestRunsViews(days: number = 7): Promise<void> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const testRuns = await prisma.testRun.findMany({
      where: {
        OR: [
          { createdAt: { gte: cutoffDate } },
          { updatedAt: { gte: cutoffDate } },
        ],
      },
      select: { id: true },
    });

    logger.info(`Updating ${testRuns.length} recent test runs views`);

    for (const testRun of testRuns) {
      await updateTestRunsView(testRun.id);
    }

    logger.info(`Completed recent test runs view update`);
  } catch (error) {
    logger.error('Error updating recent test runs views:', error);
    throw error;
  }
}

