import { DomainEvent, DomainEventType, domainEventEmitter } from './event-emitter';
import { logger } from '../utils/logger';

/**
 * Initialize all read model event listeners
 */
export function initializeReadModelListeners(): void {
  logger.info('Initializing read model event listeners...');

  // Test Runs View Listeners
  domainEventEmitter.onEvent(DomainEventType.TEST_RUN_CREATED, async (event: DomainEvent) => {
    try {
      const { updateTestRunsView } = await import('../../jobs/update-test-runs-view');
      await updateTestRunsView(BigInt(event.aggregateId));
      logger.debug(`Test runs view updated after test run created: ${event.aggregateId}`);
    } catch (error) {
      logger.error(`Failed to update test runs view after test run created: ${event.aggregateId}`, error);
    }
  });

  domainEventEmitter.onEvent(DomainEventType.TEST_RUN_UPDATED, async (event: DomainEvent) => {
    try {
      const { updateTestRunsView } = await import('../../jobs/update-test-runs-view');
      await updateTestRunsView(BigInt(event.aggregateId));
      logger.debug(`Test runs view updated after test run updated: ${event.aggregateId}`);
    } catch (error) {
      logger.error(`Failed to update test runs view after test run updated: ${event.aggregateId}`, error);
    }
  });

  domainEventEmitter.onEvent(DomainEventType.TEST_RUN_DELETED, async (event: DomainEvent) => {
    try {
      // Delete from read model
      const { prisma } = await import('../infrastructure/database');
      await prisma.testRunsView.deleteMany({
        where: { id: BigInt(event.aggregateId) },
      });
      logger.debug(`Test runs view deleted after test run deleted: ${event.aggregateId}`);
    } catch (error) {
      logger.error(`Failed to delete test runs view after test run deleted: ${event.aggregateId}`, error);
    }
  });

  // Test Run Result Events - Update parent test run view
  domainEventEmitter.onEvent(DomainEventType.TEST_RUN_RESULT_CREATED, async (event: DomainEvent) => {
    try {
      const testRunId = event.data?.testRunId;
      if (testRunId) {
        const { updateTestRunsView } = await import('../../jobs/update-test-runs-view');
        await updateTestRunsView(BigInt(testRunId));
        logger.debug(`Test runs view updated after test run result created: ${testRunId}`);
      }
    } catch (error) {
      logger.error(`Failed to update test runs view after test run result created:`, error);
    }
  });

  domainEventEmitter.onEvent(DomainEventType.TEST_RUN_RESULT_UPDATED, async (event: DomainEvent) => {
    try {
      const testRunId = event.data?.testRunId;
      if (testRunId) {
        const { updateTestRunsView } = await import('../../jobs/update-test-runs-view');
        await updateTestRunsView(BigInt(testRunId));
        logger.debug(`Test runs view updated after test run result updated: ${testRunId}`);
      }
    } catch (error) {
      logger.error(`Failed to update test runs view after test run result updated:`, error);
    }
  });

  domainEventEmitter.onEvent(DomainEventType.TEST_RUN_RESULT_DELETED, async (event: DomainEvent) => {
    try {
      const testRunId = event.data?.testRunId;
      if (testRunId) {
        const { updateTestRunsView } = await import('../../jobs/update-test-runs-view');
        await updateTestRunsView(BigInt(testRunId));
        logger.debug(`Test runs view updated after test run result deleted: ${testRunId}`);
      }
    } catch (error) {
      logger.error(`Failed to update test runs view after test run result deleted:`, error);
    }
  });

  // Audit Events - Log all domain events to audit_events table
  domainEventEmitter.onEvents(
    [
      DomainEventType.TEST_RUN_CREATED,
      DomainEventType.TEST_RUN_UPDATED,
      DomainEventType.TEST_RUN_DELETED,
      DomainEventType.TEST_RUN_RESULT_CREATED,
      DomainEventType.TEST_RUN_RESULT_UPDATED,
      DomainEventType.TEST_RUN_RESULT_DELETED,
      DomainEventType.TEST_CASE_CREATED,
      DomainEventType.TEST_CASE_UPDATED,
      DomainEventType.TEST_CASE_DELETED,
      DomainEventType.BUG_BUDGET_CREATED,
      DomainEventType.BUG_BUDGET_UPDATED,
      DomainEventType.BUG_BUDGET_DELETED,
      DomainEventType.PROJECT_CREATED,
      DomainEventType.PROJECT_UPDATED,
      DomainEventType.REPOSITORY_CREATED,
      DomainEventType.REPOSITORY_UPDATED,
    ],
    async (event: DomainEvent) => {
      try {
        const { prisma } = await import('../infrastructure/database');
        await prisma.auditEvent.create({
          data: {
            eventType: event.type,
            aggregateType: event.aggregateType,
            aggregateId: typeof event.aggregateId === 'bigint' ? event.aggregateId : BigInt(event.aggregateId),
            userId: event.metadata?.userId || null,
            eventData: event.data,
            metadata: event.metadata || null,
          },
        });
        logger.debug(`Audit event logged: ${event.type} for ${event.aggregateType} ${event.aggregateId}`);
      } catch (error) {
        logger.error(`Failed to log audit event ${event.type}:`, error);
      }
    }
  );

  // Future: Bug Budget View Listeners
  // domainEventEmitter.onEvent(DomainEventType.BUG_BUDGET_CREATED, async (event: DomainEvent) => {
  //   // Update bug_budget_view when implemented
  // });

  logger.info('Read model event listeners initialized');
}

