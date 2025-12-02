# PRD Review Feature - Quick Reference Guide

## What is PRD Review?

An AI-powered system that automatically reviews Product Requirement Documents (PRDs) and provides feedback on completeness, clarity, and technical feasibility.

## Key Features at a Glance

| Feature | Description | How to Use |
|---------|-------------|------------|
| **Submit Review** | Submit PRD content for AI analysis | Fill form with PRD content, click "Request Review" |
| **Health Check** | Verify system connectivity | Click "System Health" button |
| **Test Review** | Test workflow without full submission | Click "Quick Review" button |
| **View Dashboard** | See all reviews and statistics | Navigate to PRD Review page |
| **Refresh Data** | Sync latest data from Google Sheets | Click "Refresh Data" button |
| **View in Sheets** | Open Google Sheets directly | Click "View in Google Sheets" link |

## User Workflow

### Step 1: Configure Settings
1. Go to Settings → PRD Review
2. Enter Google Apps Script URL
3. Enter Google Sheets ID
4. Enter Confluence URL (optional)
5. Click "Test Connection" to verify
6. Save settings

### Step 2: Submit a Review
1. Go to PRD Review page
2. Fill in:
   - Your name (pre-filled)
   - Confluence URL (optional)
   - PRD content (paste full PRD text)
3. Click "Quick Review" for test or submit full review
4. Wait for AI processing
5. View results in dashboard

### Step 3: View Results
1. Review appears in "AI Reviewed" section
2. Click to expand and view full review content
3. Check status (DRAFT, PROCESSING, COMPLETED, FINALIZED)
4. Click Confluence URL to view original document

## Status Types

- **DRAFT**: Review request created, waiting to be processed
- **PROCESSING**: AI is analyzing the PRD
- **COMPLETED**: Review finished, results available
- **FINALIZED**: Review approved and finalized

## Data Sources

The system uses multiple data sources in this order:
1. **Redis Cache** (fastest, 5-minute cache)
2. **Database Cache** (backup cache)
3. **Local Database** (full records)
4. **Google Sheets** (source of truth)

## Common Tasks

### Check System Status
- Click "System Health" button
- Green = Working, Red = Issue

### Refresh Review List
- Click "Refresh Data" button
- Syncs latest from Google Sheets

### View Full Review
- Click on any review in the list
- Content expands to show full AI analysis

### Open in Google Sheets
- Click "View in Google Sheets" link
- Opens in new tab for manual editing

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Health check fails | Verify Google Script URL in settings |
| Review not appearing | Click "Refresh Data" to sync |
| Offline mode shown | System using cached data, click "Retry" |
| Form validation errors | Check character limits and URL format |
| Slow loading | System may be syncing, wait a moment |

## Configuration Requirements

### Required
- ✅ Google Apps Script URL
- ✅ Google Sheets ID

### Optional
- ⚪ Confluence URL
- ⚪ Sheet Tab Name

## Permissions

- Requires `ACCESS_PRD_REVIEW` permission
- Must be authenticated user

## Data Limits

- **PRD Title**: Max 500 characters
- **PRD Content**: 100-50,000 characters
- **Confluence URL**: Max 2048 characters
- **Name**: Alphanumeric, spaces, hyphens, underscores, dots only

## Performance Tips

1. **Use Refresh Sparingly**: Only refresh when needed to avoid API rate limits
2. **View Cached Data**: System shows cached data immediately for fast loading
3. **Background Sync**: Fresh data loads automatically after page load
4. **Compact View**: Use summary view for faster browsing

## Integration Flow

```
User → Application → Google Apps Script → AI (Gemini) → Google Sheets → Application → User
```

## Support

For detailed documentation, see: `PRD_REVIEW_FEATURES.md`
For setup instructions, see: `tests/Document/PRD_REVIEW_SETUP.md`

