# Event-Driven Architecture for CQRS Read Models

## Overview

QaHub uses an event-driven architecture to automatically update CQRS (Command Query Responsibility Segregation) read models when write operations occur. This ensures read models stay in sync with the write models without requiring manual updates or polling.

## Architecture

### Domain Events

Domain events represent important business events that occur in the system. When a write operation happens (create, update, delete), a domain event is emitted.

**Event Types:**
- `TEST_RUN_CREATED` - Test run created
- `TEST_RUN_UPDATED` - Test run updated
- `TEST_RUN_DELETED` - Test run deleted
- `TEST_RUN_RESULT_CREATED` - Test run result created
- `TEST_RUN_RESULT_UPDATED` - Test run result updated
- `TEST_RUN_RESULT_DELETED` - Test run result deleted
- `TEST_CASE_CREATED` - Test case created
- `TEST_CASE_UPDATED` - Test case updated
- `TEST_CASE_DELETED` - Test case deleted
- `BUG_BUDGET_CREATED` - Bug budget created
- `BUG_BUDGET_UPDATED` - Bug budget updated
- `BUG_BUDGET_DELETED` - Bug budget deleted
- `PROJECT_CREATED` - Project created
- `PROJECT_UPDATED` - Project updated
- `REPOSITORY_CREATED` - Repository created
- `REPOSITORY_UPDATED` - Repository updated

### Event Emitter

The `DomainEventEmitter` is a singleton EventEmitter instance that manages all domain events.

**Location:** `src/shared/events/event-emitter.ts`

**Features:**
- Type-safe event emission
- Async event handlers
- Error handling per event
- Configurable max listeners

**Usage:**

```typescript
import { domainEventEmitter, DomainEventType } from './shared/events/event-emitter';

// Emit an event
domainEventEmitter.emitEvent({
  type: DomainEventType.TEST_RUN_CREATED,
  aggregateType: 'test_run',
  aggregateId: testRun.id,
  data: {
    testRunId: testRun.id.toString(),
    projectId: testRun.projectId.toString(),
  },
  metadata: {
    userId,
    timestamp: new Date(),
  },
});
```

### Read Model Listeners

Read model listeners subscribe to domain events and update the corresponding read models.

**Location:** `src/shared/events/read-model-listeners.ts`

**Current Listeners:**

1. **Test Runs View Listener**
   - Listens to: `TEST_RUN_CREATED`, `TEST_RUN_UPDATED`, `TEST_RUN_DELETED`
   - Updates: `test_runs_view` table
   - Also listens to test run result events to update parent test run view

2. **Future Listeners** (commented out, ready for implementation):
   - Bug Budget View Listener
   - Analytics Summary Listeners

## Implementation Details

### Event Flow

```
Write Operation (API Route)
    ↓
Emit Domain Event
    ↓
Event Emitter
    ↓
Read Model Listeners
    ↓
Update Read Model (Async)
```

### Example: Test Run Created

1. **API Route** (`test-runs.ts`):
   ```typescript
   const testRun = await prisma.testRun.create({ ... });
   
   // Emit event
   domainEventEmitter.emitEvent({
     type: DomainEventType.TEST_RUN_CREATED,
     aggregateType: 'test_run',
     aggregateId: testRun.id,
     data: { ... },
   });
   ```

2. **Event Listener** (`read-model-listeners.ts`):
   ```typescript
   domainEventEmitter.onEvent(DomainEventType.TEST_RUN_CREATED, async (event) => {
     await updateTestRunsView(BigInt(event.aggregateId));
   });
   ```

3. **Read Model Update** (`update-test-runs-view.ts`):
   ```typescript
   await prisma.testRunsView.upsert({
     where: { id: testRunId },
     create: { ... },
     update: { ... },
   });
   ```

## Benefits

1. **Decoupling** - Write operations don't need to know about read models
2. **Automatic Sync** - Read models stay up-to-date automatically
3. **Extensibility** - Easy to add new read models and listeners
4. **Performance** - Async updates don't block write operations
5. **Reliability** - Error handling per listener prevents cascading failures

## Adding New Read Models

### Step 1: Create Read Model Update Function

```typescript
// src/jobs/update-my-read-model.ts
export async function updateMyReadModel(aggregateId: bigint): Promise<void> {
  // Fetch data from write model
  // Calculate denormalized fields
  // Upsert into read model
}
```

### Step 2: Add Event Listener

```typescript
// src/shared/events/read-model-listeners.ts
domainEventEmitter.onEvent(DomainEventType.MY_AGGREGATE_CREATED, async (event) => {
  try {
    const { updateMyReadModel } = await import('../../jobs/update-my-read-model');
    await updateMyReadModel(BigInt(event.aggregateId));
  } catch (error) {
    logger.error('Failed to update my read model:', error);
  }
});
```

### Step 3: Emit Events in API Routes

```typescript
// src/api/routes/my-aggregate.ts
domainEventEmitter.emitEvent({
  type: DomainEventType.MY_AGGREGATE_CREATED,
  aggregateType: 'my_aggregate',
  aggregateId: myAggregate.id,
  data: { ... },
});
```

## Error Handling

- Each event listener has its own try-catch block
- Errors in one listener don't affect others
- Failed updates are logged but don't fail the write operation
- Manual job endpoints available for recovery

## Performance Considerations

### Async Updates

- Read model updates are asynchronous
- Write operations complete immediately
- Read models update in the background

### Batch Updates

For bulk operations, consider:
- Emitting a single batch event
- Processing multiple updates in one listener call
- Using database transactions for consistency

### Future Enhancements

1. **Message Queue** - For high-volume systems, use Redis/RabbitMQ
2. **Event Store** - Persist events for replay and audit
3. **Event Sourcing** - Rebuild read models from event history
4. **Debouncing** - Batch rapid updates to reduce database load

## Testing

### Manual Testing

1. Create a test run via API
2. Check `test_runs_view` table is updated
3. Update test run
4. Verify view is updated again
5. Delete test run
6. Verify view is deleted

### Integration Testing

```typescript
// Example test
it('should update test runs view when test run is created', async () => {
  const testRun = await createTestRun();
  
  // Wait for async update
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const view = await prisma.testRunsView.findUnique({
    where: { id: testRun.id },
  });
  
  expect(view).toBeDefined();
  expect(view.title).toBe(testRun.title);
});
```

## Monitoring

- Event emission is logged at debug level
- Listener errors are logged at error level
- Manual job endpoints available for recovery
- Connection monitoring for future message queue integration

## Migration from Manual Updates

The system was migrated from manual `import()` calls to event-driven architecture:

**Before:**
```typescript
import('../../jobs/update-test-runs-view').then(({ updateTestRunsView }) => {
  updateTestRunsView(testRun.id);
});
```

**After:**
```typescript
domainEventEmitter.emitEvent({
  type: DomainEventType.TEST_RUN_CREATED,
  aggregateType: 'test_run',
  aggregateId: testRun.id,
  data: { ... },
});
```

This provides:
- Better separation of concerns
- Easier testing
- More maintainable code
- Extensibility for future read models

