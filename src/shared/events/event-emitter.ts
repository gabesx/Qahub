import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Domain Event Types
 */
export enum DomainEventType {
  // Test Run Events
  TEST_RUN_CREATED = 'test_run.created',
  TEST_RUN_UPDATED = 'test_run.updated',
  TEST_RUN_DELETED = 'test_run.deleted',
  
  // Test Run Result Events
  TEST_RUN_RESULT_CREATED = 'test_run_result.created',
  TEST_RUN_RESULT_UPDATED = 'test_run_result.updated',
  TEST_RUN_RESULT_DELETED = 'test_run_result.deleted',
  
  // Test Case Events
  TEST_CASE_CREATED = 'test_case.created',
  TEST_CASE_UPDATED = 'test_case.updated',
  TEST_CASE_DELETED = 'test_case.deleted',
  
  // Bug Budget Events
  BUG_BUDGET_CREATED = 'bug_budget.created',
  BUG_BUDGET_UPDATED = 'bug_budget.updated',
  BUG_BUDGET_DELETED = 'bug_budget.deleted',
  
  // Project Events
  PROJECT_CREATED = 'project.created',
  PROJECT_UPDATED = 'project.updated',
  
  // Repository Events
  REPOSITORY_CREATED = 'repository.created',
  REPOSITORY_UPDATED = 'repository.updated',
}

/**
 * Domain Event Payload
 */
export interface DomainEvent {
  type: DomainEventType;
  aggregateType: string;
  aggregateId: bigint | string;
  data: any;
  metadata?: {
    userId?: bigint;
    timestamp?: Date;
    [key: string]: any;
  };
}

/**
 * Global Event Emitter Instance
 */
class DomainEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50); // Allow up to 50 listeners
  }

  /**
   * Emit a domain event
   */
  emitEvent(event: DomainEvent): void {
    try {
      this.emit(event.type, event);
      logger.debug(`Domain event emitted: ${event.type} for ${event.aggregateType} ${event.aggregateId}`);
    } catch (error) {
      logger.error(`Error emitting domain event ${event.type}:`, error);
    }
  }

  /**
   * Subscribe to a domain event type
   */
  onEvent(eventType: DomainEventType, handler: (event: DomainEvent) => void | Promise<void>): void {
    this.on(eventType, async (event: DomainEvent) => {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Error handling domain event ${eventType}:`, error);
      }
    });
  }

  /**
   * Subscribe to multiple event types
   */
  onEvents(eventTypes: DomainEventType[], handler: (event: DomainEvent) => void | Promise<void>): void {
    eventTypes.forEach((eventType) => {
      this.onEvent(eventType, handler);
    });
  }
}

export const domainEventEmitter = new DomainEventEmitter();

