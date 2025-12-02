# PRD Review Feature Documentation

## Overview

The PRD Review feature is an AI-powered system that allows users to submit Product Requirement Documents (PRDs) for automated review and analysis. The system integrates with Google Apps Script and Google Sheets to process review requests, store results, and provide a dashboard for tracking review status and history.

## Core Features

### 1. PRD Review Submission
- **Purpose**: Submit PRD content for AI-powered review and analysis
- **How it works**:
  - Users fill out a form with:
    - Their name
    - PRD title
    - PRD content (minimum 100 characters, maximum 50,000 characters)
    - Optional Confluence URL (must be from atlassian.net domain)
  - The system validates all inputs and sanitizes data
  - Review request is sent to Google Apps Script which processes it via AI (Gemini)
  - A unique request ID is generated (format: `REV-{unique_id}`)
  - The request is logged in Google Sheets and stored in the local database

### 2. Health Check
- **Purpose**: Verify that the Google Apps Script integration is working correctly
- **How it works**:
  - Sends a GET request to the configured Google Apps Script URL
  - Checks if the script responds successfully
  - Returns connection status and service health information
  - Used to diagnose integration issues before submitting reviews

### 3. Test Review
- **Purpose**: Test the review workflow without submitting a full review
- **How it works**:
  - Performs a connection test first
  - Submits test data to Google Apps Script
  - Validates the entire workflow end-to-end
  - Returns test results showing if the integration is working
  - Useful for troubleshooting before actual submissions

### 4. Dashboard & Statistics
- **Purpose**: View review history, statistics, and manage review requests
- **How it works**:
  - Displays statistics:
    - Total reviews requested
    - Draft reviews (status: DRAFT)
    - Processing reviews (status: PROCESSING)
    - Finalized reviews (status: COMPLETED/FINALIZED)
  - Shows recent review requests in a list view
  - Supports pagination for large datasets
  - Provides refresh functionality to sync latest data from Google Sheets

### 5. Data Synchronization
- **Purpose**: Keep local database in sync with Google Sheets
- **How it works**:
  - Multi-layer caching system:
    1. **Redis/Laravel Cache**: Fast in-memory cache (5-minute TTL)
    2. **Database Cache**: Persistent cache table for backup
    3. **Local Database**: Full review records stored locally
    4. **Google Sheets**: Source of truth for review data
  - Automatic sync when:
    - User requests refresh
    - Background sync runs
    - New reviews are fetched
  - Fallback mechanism: If Google Sheets is unavailable, system uses cached or database data

### 6. Review Status Tracking
- **Purpose**: Track the lifecycle of each review request
- **Status Types**:
  - **DRAFT**: Review request created but not yet processed
  - **PROCESSING**: Review is being analyzed by AI
  - **COMPLETED**: Review analysis is complete
  - **FINALIZED**: Review has been finalized and approved
- **How it works**:
  - Each review has a status field that gets updated as it progresses
  - Status changes are tracked in metadata
  - Users can filter and view reviews by status

### 7. Offline Mode Support
- **Purpose**: Allow system to function even when Google Sheets API is unavailable
- **How it works**:
  - System attempts to fetch from Google Sheets first
  - If unavailable, falls back to:
    1. Redis cache
    2. Database cache
    3. Local database
  - Shows offline mode indicator when using cached data
  - Provides retry functionality to reconnect

### 8. Review Content Management
- **Purpose**: Store and display review content efficiently
- **How it works**:
  - Full review content is stored in the database
  - List view shows truncated content (first 500 characters) for performance
  - Full content is available on-demand when viewing individual reviews
  - Content is synced from Google Sheets and stored locally
  - Supports long-form review content from AI analysis

## Data Flow

### Review Submission Flow
```
User submits form
    ↓
Validation (name, title, content, URL format)
    ↓
Generate unique request ID
    ↓
Send to Google Apps Script (via HTTP GET)
    ↓
Google Apps Script processes with AI (Gemini)
    ↓
Results stored in Google Sheets
    ↓
Local database sync (if enabled)
    ↓
Return success response to user
```

### Data Retrieval Flow
```
User requests dashboard data
    ↓
Check Redis cache (fastest)
    ↓
If not found, check database cache
    ↓
If not found, check local database
    ↓
If not found, fetch from Google Sheets
    ↓
Transform and normalize data
    ↓
Store in all cache layers
    ↓
Return to user
```

### Synchronization Flow
```
User clicks "Refresh Data"
    ↓
Clear all cache layers
    ↓
Fetch all reviews from Google Sheets
    ↓
Transform data format
    ↓
Update/Create records in local database
    ↓
Store in cache layers
    ↓
Return updated data to user
```

## Integration Components

### Google Apps Script Integration
- **Role**: Acts as the middleware between the application and Google Sheets/AI services
- **Functions**:
  - Receives review requests via HTTP GET/POST
  - Processes requests with AI (Gemini) integration
  - Writes results to Google Sheets
  - Returns structured JSON responses
- **Actions Supported**:
  - `health_check`: Verify script is running
  - `get_reviews`: Fetch review data from sheets
  - `request_review`: Process new review request
  - `update_review_request`: Update review status

### Google Sheets Integration
- **Role**: Serves as the primary data store for review records
- **Structure**:
  - Columns include: Request ID, When, Requester, Page ID, Title, AI Review, Status, Confluence URL
  - Supports multiple tabs (configurable)
  - Data is read and written via Google Apps Script
- **Benefits**:
  - Easy to view and edit manually
  - Accessible to non-technical users
  - Provides audit trail
  - Can be shared with team members

### Local Database Storage
- **Purpose**: Improve performance and provide offline capability
- **Tables**:
  - `prd_reviews`: Stores review records with full details
  - `prd_review_cache`: Stores cached data with expiration
- **Benefits**:
  - Fast queries without external API calls
  - Works offline
  - Supports complex filtering and pagination
  - Reduces load on Google Sheets API

## User Interface Features

### Main Dashboard
- **Statistics Cards**: Display total, drafts, processing, and finalized counts
- **Review List**: Shows recent reviews with:
  - Request ID
  - Requester name
  - Page title
  - Review content (truncated)
  - Status badge
  - Confluence URL link
  - Timestamp
- **View Modes**:
  - **Full View**: Detailed information for each review
  - **Compact View**: Summary information only
- **Actions**:
  - Refresh data button
  - Link to Google Sheets
  - Expand/collapse review content
  - Filter by status (future enhancement)

### Review Submission Form
- **Fields**:
  - User Name (pre-filled from account)
  - Confluence URL (pre-filled from config)
  - PRD Content (large textarea)
- **Actions**:
  - Health Check button
  - Quick Review button (test mode)
  - Full Review submission (via separate endpoint)
- **Validation**:
  - Real-time form validation
  - Character count limits
  - URL format validation
  - Required field indicators

### Settings Page
- **Configuration Options**:
  - Google Apps Script URL
  - Google Sheets ID
  - Confluence Base URL
  - Sheet Tab Name (optional)
- **Features**:
  - Test connection button
  - Current configuration display
  - Setup help and instructions
  - Link to example Google Sheet

## Performance Optimizations

### Caching Strategy
- **Multi-layer caching**: Redis → Database Cache → Local Database → Google Sheets
- **Cache TTL**: 5 minutes default (configurable)
- **Cache invalidation**: On refresh or after sync
- **Smart caching**: Only caches frequently accessed data

### Progressive Loading
- **Initial Load**: Shows cached data immediately for fast page load
- **Background Sync**: Loads fresh data asynchronously after page load
- **Lazy Loading**: Full review content loaded on-demand
- **Pagination**: Limits data transfer for large datasets

### Error Handling
- **Graceful Degradation**: Falls back to cached data if API fails
- **Retry Logic**: Automatic retries for failed requests (max 2 retries)
- **Timeout Management**: 10-second timeout for API calls
- **User Feedback**: Clear error messages and loading states

## Security Features

### Input Validation
- **Sanitization**: All user inputs are sanitized
- **Validation Rules**:
  - Name: Alphanumeric, spaces, hyphens, underscores, dots only
  - PRD Title: Max 500 characters
  - PRD Content: 100-50,000 characters
  - Confluence URL: Must be from atlassian.net domain
- **CSRF Protection**: All forms protected with CSRF tokens

### Authorization
- **Permission-based Access**: Requires `ACCESS_PRD_REVIEW` permission
- **User Authentication**: All endpoints require authenticated users
- **Request Validation**: Server-side validation for all inputs

## Configuration

### Required Settings
- **GOOGLE_SCRIPT_URL**: Google Apps Script deployment URL
- **GOOGLE_SHEETS_ID**: Google Sheets document ID
- **CONFLUENCE_URL**: Base Confluence URL (optional)

### Optional Settings
- **GOOGLE_SHEETS_TAB_NAME**: Specific sheet tab name (default: "Review AI")
- **Cache TTL**: Cache expiration time (default: 5 minutes)

### Environment Variables
Settings can be configured via:
1. Database settings table (preferred)
2. Environment variables (.env file)
3. Configuration files

## Maintenance

### Cache Cleanup
- **Command**: `php artisan prd:clear-expired-cache`
- **Purpose**: Removes expired cache entries from database
- **Frequency**: Can be scheduled via cron

### Background Sync
- **Endpoint**: `/prd-review/background-sync`
- **Purpose**: Periodic synchronization with Google Sheets
- **Usage**: Can be called by cron jobs or scheduled tasks

### Database Optimization
- **Indexes**: Optimized indexes on `created_at` and `status` columns
- **Composite Indexes**: For common query patterns (status + created_at)
- **Query Optimization**: Selects only needed columns for list views

## Troubleshooting

### Common Issues

1. **Health Check Fails**
   - Verify Google Script URL is correct
   - Ensure script is deployed as web app
   - Check script permissions (must be "Anyone")

2. **Review Submission Fails**
   - Check all required fields are filled
   - Verify PRD content meets length requirements
   - Ensure Confluence URL is valid format
   - Check Google Apps Script logs

3. **Data Not Refreshing**
   - Clear cache manually
   - Check Google Sheets permissions
   - Verify sheet tab name is correct
   - Check network connectivity

4. **Offline Mode Active**
   - System is using cached data
   - Click "Retry" to reconnect
   - Check Google Sheets API status
   - Verify network connection

## Future Enhancements

### Planned Features
- Email notifications for review completion
- Integration with Confluence for automatic PRD updates
- Custom review templates
- Team collaboration features
- Review history and analytics dashboard
- Advanced filtering and search
- Export functionality (CSV, PDF)
- Review comparison tools
- AI-powered suggestions and recommendations

### Technical Improvements
- Real-time updates via WebSockets
- Batch review processing
- Advanced caching strategies
- API rate limiting
- Enhanced error reporting
- Performance monitoring
- Automated testing suite

## Summary

The PRD Review feature provides a comprehensive solution for automated PRD analysis using AI. It combines the flexibility of Google Sheets with the power of local database storage, ensuring fast performance and offline capability. The multi-layer caching system and graceful error handling make it robust and user-friendly, while the integration with Google Apps Script allows for seamless AI processing and data management.

