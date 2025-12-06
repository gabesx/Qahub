# Implementation: Error Message & Execution Logs for Manual Testers

## Overview

Implemented **Option 3 (Hybrid Approach)** from `TEST_RUN_RESULT_FIELDS_EXPLANATION.md`, allowing manual testers to fill `errorMessage` and `logs` fields while keeping `stackTrace` and `screenshots` for automated tests.

## Changes Made

### 1. Frontend State Management
- Added `errorMessage` state variable for storing error messages
- Added `executionLogs` state variable for storing execution logs
- Updated `TestRunResult` interface to include `stackTrace` and `logs` fields

### 2. UI Components

#### Error Message Field
- **Location**: Test case detail view (right column)
- **Visibility**: Shown only when status is "Failed" or "Blocked"
- **Input**: Textarea with red-themed styling
- **Placeholder**: "Enter error message or reason for failure..."
- **Display**: Shows existing error message if status changed from failed/blocked

#### Execution Logs Field
- **Location**: Test case detail view (right column)
- **Visibility**: Always shown (for all statuses)
- **Input**: Textarea with blue-themed styling and monospace font
- **Placeholder**: "Enter execution logs or step-by-step notes..."
- **Display**: Shows existing logs if they exist

### 3. API Integration

#### `handleUpdateStatus` Function Updates
- **Failed/Blocked Status**: Sends `errorMessage` if provided, clears it for "Passed"
- **All Statuses**: Sends `logs` if provided
- **Skipped Status**: Clears `errorMessage` automatically
- **To Do Status**: Clears both `errorMessage` and `logs` when resetting

#### Data Population
- `handleTestCaseRowClick` now populates `errorMessage` and `logs` from the result when a test case is selected
- Fields are cleared when no result exists

### 4. Backend
- ✅ Already returns `errorMessage`, `stackTrace`, and `logs` in list and get endpoints
- ✅ Already accepts these fields in create and update endpoints
- No backend changes needed

## User Workflow

### For Failed/Blocked Tests
1. User clicks "Failed" or "Blocked" status button
2. Error Message field appears below BDD Scenarios
3. User can enter error message describing the failure
4. User can optionally enter execution logs
5. When status is updated, both fields are saved to the database

### For All Tests
1. User can always enter execution logs (step-by-step notes)
2. Logs are saved regardless of status
3. Useful for documenting test execution steps

### Field Behavior
- **Error Message**: 
  - Shown only for Failed/Blocked
  - Cleared when status changes to Passed/Skipped/To Do
  - Preserved when switching between Failed and Blocked
  
- **Execution Logs**:
  - Always available
  - Persists across status changes
  - Can be updated at any time

## Database Fields

| Field | Type | Purpose | Populated By |
|-------|------|---------|--------------|
| `error_message` | TEXT | Error message for failed/blocked tests | Manual testers (UI) |
| `logs` | TEXT | Execution logs/step-by-step notes | Manual testers (UI) |
| `stack_trace` | TEXT | Full stack trace from exceptions | Automated tests (future) |
| `screenshots` | JSONB | Screenshot URLs/JSON | Automated tests (future) |

## Example Usage

### Error Message
```
Login button not found after page load
Timeout waiting for element: #login-button
Assertion failed: expected "Welcome" but got "Error"
```

### Execution Logs
```
Step 1: Navigate to login page ✓
Step 2: Enter username "test@example.com" ✓
Step 3: Enter password "password123" ✓
Step 4: Click login button ✗
  - Error: Button not found
  - Screenshot: attached in comments
```

## Files Modified

1. `apps/web/app/projects/[id]/repositories/[repoId]/test-run/[testRunId]/page.tsx`
   - Added state variables
   - Added UI components
   - Updated `handleUpdateStatus` function
   - Updated `handleTestCaseRowClick` function
   - Updated `TestRunResult` interface

## Testing Checklist

- [x] Error message field appears when status is "Failed"
- [x] Error message field appears when status is "Blocked"
- [x] Error message field hidden for other statuses
- [x] Execution logs field always visible
- [x] Error message saved when updating to Failed/Blocked
- [x] Error message cleared when updating to Passed
- [x] Execution logs saved for all statuses
- [x] Existing error message/logs displayed when test case is selected
- [x] Fields cleared when resetting to "To Do"
- [x] No linter errors

## Future Enhancements

1. **Rich Text Editor**: Consider adding markdown support for execution logs
2. **Log Templates**: Pre-filled templates for common test scenarios
3. **Auto-save**: Save logs as user types (debounced)
4. **Export**: Include error messages and logs in CSV/PDF exports
5. **Search**: Search test runs by error message content

## Notes

- `stackTrace` field remains for automated tests only (no UI input)
- `screenshots` field remains for automated tests (manual testers use Comments/Attachments)
- Error messages are optional but recommended for failed/blocked tests
- Execution logs are optional but useful for documentation

