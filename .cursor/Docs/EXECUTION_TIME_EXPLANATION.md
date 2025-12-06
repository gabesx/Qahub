# Execution Time Storage Explanation

## Database Tables

### 1. `test_runs` Table
**Purpose**: Stores metadata about the overall test run execution session.

**Relevant Fields**:
- `started_at` (timestamp, nullable): When the entire test run execution started
- `completed_at` (timestamp, nullable): When the entire test run execution completed
- `execution_date` (date, nullable): The date when the test run was executed
- `status`: Overall test run status (pending, running, completed, failed, cancelled)

**Use Case**: 
- Tracks when a test run session begins and ends
- Used for overall test run statistics and reporting
- Example: "Test Run started at 2025-12-05 10:00:00 and completed at 2025-12-05 14:30:00"

### 2. `test_run_results` Table
**Purpose**: Stores individual test case execution results within a test run.

**Relevant Fields**:
- `executed_at` (timestamp, nullable): When this specific test case execution started
- `execution_time` (integer, nullable): Duration in seconds for this specific test case
- `executed_by` (bigint, nullable): User ID who executed this test case
- `status`: Individual test case status (passed, failed, skipped, blocked, inProgress, toDo)

**Use Case**:
- Tracks when each individual test case started execution
- Stores the duration of each test case execution
- Allows tracking which user executed which test case
- Example: "Test Case A started at 2025-12-05 10:15:00 and took 45 seconds"

## Why "Started At" is in `test_run_results` Table

The "Started At" field displayed in the test case detail view (`executedAt`) is stored in the `test_run_results` table because:

1. **Granularity**: Each test case can be started at different times within the same test run
   - Test Case A might start at 10:00:00
   - Test Case B might start at 10:05:00
   - Test Case C might start at 10:10:00

2. **Individual Tracking**: Different test cases can be executed by different users
   - User A executes Test Case 1 at 10:00:00
   - User B executes Test Case 2 at 10:15:00

3. **Parallel Execution**: Multiple test cases can run in parallel, each with their own start time

4. **Status Transitions**: The `executed_at` timestamp is set when a test case moves from "To Do" to "In Progress" status, which happens independently for each test case

5. **Data Normalization**: Following database normalization principles:
   - `test_runs` = One row per test run (aggregate level)
   - `test_run_results` = One row per test case execution (detail level)

## Data Flow

```
User Action: Change test case status to "In Progress"
    ↓
Frontend: handleUpdateStatus('inProgress')
    ↓
API Call: POST/PATCH /test-runs/:testRunId/results
    ↓
Backend: test-run-results.ts
    ↓
Database: INSERT/UPDATE test_run_results.executed_at
    ↓
Frontend: Displays executedAt as "Started At"
```

## When "Started At" Shows "N/A"

The "Started At" field shows "N/A" when:
- `test_run_results.executed_at` is `NULL` in the database
- This happens when:
  - Test case status is still "To Do" (not started yet)
  - Test case was set to "Skipped" (which clears executedAt)
  - Test case result doesn't exist yet (no row in test_run_results table)

## Duration Display Logic

The "Duration" field in the Execution Timeline follows this logic:
- **Shows duration** only if BOTH `executedAt` AND `executionTime` are present
- **Shows "N/A"** if either `executedAt` is null OR `executionTime` is null/0

**Why?** You cannot have a valid duration without knowing when the execution started. If `executedAt` is null, the duration is meaningless even if `executionTime` has a value (which could be from an inconsistent data state).

**Data Consistency Rule**: 
- If `executedAt` is null → Duration must be "N/A" (regardless of `executionTime` value)
- If `executedAt` exists → Duration can be calculated from `executionTime`

## Summary

- **Table**: `test_run_results` (not `test_runs`)
- **Column**: `executed_at` (timestamp, nullable)
- **Why**: Each test case has its own execution timeline, independent of the overall test run timeline
- **Display**: Shown as "Started At" in the test case detail view

