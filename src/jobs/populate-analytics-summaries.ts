import { prisma } from '../shared/infrastructure/database';
import { logger } from '../shared/utils/logger';

/**
 * Populate test execution summary for a specific project and date
 */
export async function populateTestExecutionSummary(projectId: bigint, date: Date): Promise<void> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all test runs for this project on this date
    const testRuns = await prisma.testRun.findMany({
      where: {
        projectId,
        executionDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        results: {
          select: {
            status: true,
            executionTime: true,
            testCase: {
              select: {
                automated: true,
              },
            },
          },
        },
      },
    });

    // Calculate aggregates
    const totalRuns = testRuns.length;
    let passedRuns = 0;
    let failedRuns = 0;
    let skippedRuns = 0;
    let blockedRuns = 0;
    let automatedCount = 0;
    let manualCount = 0;
    let totalExecutionTime = 0;
    let executionTimeCount = 0;
    let totalTestCases = 0;

    testRuns.forEach((run) => {
      // Determine run status
      const results = run.results;
      if (results.length === 0) {
        // No results yet
        return;
      }

      const hasFailed = results.some((r) => r.status === 'failed');
      const hasBlocked = results.some((r) => r.status === 'blocked');
      const allSkipped = results.every((r) => r.status === 'skipped');
      const allPassed = results.every((r) => r.status === 'passed');

      if (hasFailed) {
        failedRuns++;
      } else if (hasBlocked) {
        blockedRuns++;
      } else if (allSkipped) {
        skippedRuns++;
      } else if (allPassed) {
        passedRuns++;
      }

      // Count automated vs manual
      results.forEach((result) => {
        if (result.testCase.automated) {
          automatedCount++;
        } else {
          manualCount++;
        }

        if (result.executionTime) {
          totalExecutionTime += result.executionTime;
          executionTimeCount++;
        }
      });

      totalTestCases += results.length;
    });

    const avgExecutionTime = executionTimeCount > 0
      ? totalExecutionTime / executionTimeCount
      : null;

    // Upsert summary
    await prisma.testExecutionSummary.upsert({
      where: {
        projectId_date: {
          projectId,
          date: startOfDay,
        },
      },
      create: {
        projectId,
        date: startOfDay,
        totalRuns,
        passedRuns,
        failedRuns,
        skippedRuns,
        blockedRuns,
        automatedCount,
        manualCount,
        avgExecutionTime: avgExecutionTime ? avgExecutionTime : null,
        totalTestCases,
        lastUpdatedAt: new Date(),
      },
      update: {
        totalRuns,
        passedRuns,
        failedRuns,
        skippedRuns,
        blockedRuns,
        automatedCount,
        manualCount,
        avgExecutionTime: avgExecutionTime ? avgExecutionTime : null,
        totalTestCases,
        lastUpdatedAt: new Date(),
      },
    });

    logger.info(`Populated test execution summary for project ${projectId} on ${date.toISOString().split('T')[0]}`);
  } catch (error) {
    logger.error(`Error populating test execution summary for project ${projectId} on ${date}:`, error);
    throw error;
  }
}

/**
 * Populate bug analytics daily for a specific project and date
 */
export async function populateBugAnalyticsDaily(project: string, projectId: bigint | null, date: Date): Promise<void> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get bugs created on this date
    const bugsCreated = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        createdDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Get bugs resolved on this date
    const bugsResolved = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        resolvedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isOpen: false,
      },
    });

    // Get bugs closed on this date (resolved and closed)
    const bugsClosed = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        resolvedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          in: ['Closed', 'Done', 'Resolved'],
        },
      },
    });

    // Get bugs reopened (updated date changed but was previously resolved)
    // This is a simplified calculation - in reality, you'd track state changes
    const bugsReopened = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        updatedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        isOpen: true,
        resolvedDate: {
          not: null,
        },
      },
    });

    // Get open bugs at end of day
    const openBugs = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        isOpen: true,
        OR: [
          { createdDate: { lte: endOfDay } },
          { updatedDate: { lte: endOfDay } },
        ],
      },
    });

    // Get bugs by priority
    const criticalBugs = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        isOpen: true,
        priority: 'Critical',
      },
    });

    const highPriorityBugs = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        isOpen: true,
        priority: 'High',
      },
    });

    const mediumPriorityBugs = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        isOpen: true,
        priority: 'Medium',
      },
    });

    const lowPriorityBugs = await prisma.bugBudget.count({
      where: {
        project,
        projectId: projectId || undefined,
        isOpen: true,
        priority: 'Low',
      },
    });

    // Calculate average resolution time (in hours) for bugs resolved on this date
    const resolvedBugs = await prisma.bugBudget.findMany({
      where: {
        project,
        projectId: projectId || undefined,
        resolvedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
        createdDate: {
          not: null,
        },
      },
      select: {
        createdDate: true,
        resolvedDate: true,
      },
    });

    let totalResolutionHours = 0;
    let resolutionCount = 0;

    resolvedBugs.forEach((bug) => {
      if (bug.createdDate && bug.resolvedDate) {
        const hours = (bug.resolvedDate.getTime() - bug.createdDate.getTime()) / (1000 * 60 * 60);
        totalResolutionHours += hours;
        resolutionCount++;
      }
    });

    const avgResolutionHours = resolutionCount > 0
      ? totalResolutionHours / resolutionCount
      : null;

    // Upsert summary - use projectId if available, otherwise use project name
    const createData = {
      project,
      projectId,
      date: startOfDay,
      bugsCreated,
      bugsResolved,
      bugsClosed,
      bugsReopened,
      avgResolutionHours: avgResolutionHours ? avgResolutionHours : null,
      openBugs,
      criticalBugs,
      highPriorityBugs,
      mediumPriorityBugs,
      lowPriorityBugs,
      lastUpdatedAt: new Date(),
    };

    const updateData = {
      bugsCreated,
      bugsResolved,
      bugsClosed,
      bugsReopened,
      avgResolutionHours: avgResolutionHours ? avgResolutionHours : null,
      openBugs,
      criticalBugs,
      highPriorityBugs,
      mediumPriorityBugs,
      lowPriorityBugs,
      lastUpdatedAt: new Date(),
    };

    if (projectId) {
      // Try projectId unique constraint first
      try {
        await prisma.bugAnalyticsDaily.upsert({
          where: {
            projectId_date: {
              projectId,
              date: startOfDay,
            },
          },
          create: createData,
          update: updateData,
        });
      } catch (error: any) {
        // If projectId constraint fails, try project name constraint
        if (error.code === 'P2002') {
          await prisma.bugAnalyticsDaily.upsert({
            where: {
              project_date: {
                project,
                date: startOfDay,
              },
            },
            create: createData,
            update: updateData,
          });
        } else {
          throw error;
        }
      }
    } else {
      // Use project name unique constraint
      await prisma.bugAnalyticsDaily.upsert({
        where: {
          project_date: {
            project,
            date: startOfDay,
          },
        },
        create: createData,
        update: updateData,
      });
    }

    logger.info(`Populated bug analytics daily for project ${project} on ${date.toISOString().split('T')[0]}`);
  } catch (error) {
    logger.error(`Error populating bug analytics daily for project ${project} on ${date}:`, error);
    throw error;
  }
}

/**
 * Populate test case analytics for a specific repository and date
 */
export async function populateTestCaseAnalytics(projectId: bigint, repositoryId: bigint, date: Date): Promise<void> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all test cases for this repository (not deleted)
    const testCases = await prisma.testCase.findMany({
      where: {
        suite: {
          repositoryId,
        },
        deletedAt: null,
        OR: [
          { createdAt: { lte: endOfDay } },
          { updatedAt: { lte: endOfDay } },
        ],
      },
      select: {
        automated: true,
        priority: true,
        regression: true,
      },
    });

    // Calculate aggregates
    const totalCases = testCases.length;
    let automatedCases = 0;
    let manualCases = 0;
    let highPriorityCases = 0;
    let mediumPriorityCases = 0;
    let lowPriorityCases = 0;
    let regressionCases = 0;

    testCases.forEach((tc) => {
      if (tc.automated) {
        automatedCases++;
      } else {
        manualCases++;
      }

      if (tc.priority === 'high' || tc.priority === 'critical') {
        highPriorityCases++;
      } else if (tc.priority === 'medium') {
        mediumPriorityCases++;
      } else if (tc.priority === 'low') {
        lowPriorityCases++;
      }

      if (tc.regression) {
        regressionCases++;
      }
    });

    // Upsert summary
    await prisma.testCaseAnalytics.upsert({
      where: {
        projectId_repositoryId_date: {
          projectId,
          repositoryId,
          date: startOfDay,
        },
      },
      create: {
        projectId,
        repositoryId,
        date: startOfDay,
        totalCases,
        automatedCases,
        manualCases,
        highPriorityCases,
        mediumPriorityCases,
        lowPriorityCases,
        regressionCases,
        lastUpdatedAt: new Date(),
      },
      update: {
        totalCases,
        automatedCases,
        manualCases,
        highPriorityCases,
        mediumPriorityCases,
        lowPriorityCases,
        regressionCases,
        lastUpdatedAt: new Date(),
      },
    });

    logger.info(`Populated test case analytics for repository ${repositoryId} on ${date.toISOString().split('T')[0]}`);
  } catch (error) {
    logger.error(`Error populating test case analytics for repository ${repositoryId} on ${date}:`, error);
    throw error;
  }
}

/**
 * Populate all analytics summaries for a date range
 */
export async function populateAllAnalyticsSummaries(startDate: Date, endDate: Date): Promise<void> {
  try {
    logger.info(`Starting analytics summary population for date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Get all projects
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        title: true,
      },
    });

    // Get all repositories
    const repositories = await prisma.repository.findMany({
      select: {
        id: true,
        projectId: true,
        title: true,
      },
    });

    // Get unique projects from bug budgets
    const bugProjects = await prisma.bugBudget.findMany({
      select: {
        project: true,
        projectId: true,
      },
      distinct: ['project', 'projectId'],
    });

    // Process each date in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      // Populate test execution summaries
      for (const project of projects) {
        await populateTestExecutionSummary(project.id, currentDate);
      }

      // Populate bug analytics
      for (const bugProject of bugProjects) {
        await populateBugAnalyticsDaily(
          bugProject.project,
          bugProject.projectId,
          currentDate
        );
      }

      // Populate test case analytics
      for (const repository of repositories) {
        await populateTestCaseAnalytics(
          repository.projectId,
          repository.id,
          currentDate
        );
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    logger.info(`Completed analytics summary population for date range`);
  } catch (error) {
    logger.error('Error populating all analytics summaries:', error);
    throw error;
  }
}

/**
 * Populate analytics summaries for yesterday (for daily scheduled job)
 */
export async function populateYesterdayAnalytics(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  await populateAllAnalyticsSummaries(yesterday, yesterday);
}

/**
 * Populate analytics summaries for the last N days
 */
export async function populateRecentAnalytics(days: number = 7): Promise<void> {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  await populateAllAnalyticsSummaries(startDate, endDate);
}

