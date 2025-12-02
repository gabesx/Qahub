import axios, { AxiosError } from 'axios';
import { logger } from './logger';

export interface GoogleAppsScriptConfig {
  scriptUrl: string;
  sheetsId?: string;
  confluenceUrl?: string;
  sheetTabName?: string;
}

export interface HealthCheckResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

export interface ReviewSubmissionResponse {
  success: boolean;
  requestId?: string;
  message: string;
  data?: any;
}

export interface GoogleSheetsReview {
  requestId: string;
  when: string;
  requester: string;
  pageId?: string;
  title: string;
  aiReview?: string;
  status: string;
  confluenceUrl?: string;
}

/**
 * Health check for Google Apps Script
 */
export async function healthCheck(config: GoogleAppsScriptConfig): Promise<HealthCheckResponse> {
  try {
    const url = `${config.scriptUrl}?action=health_check`;
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
    });

    return {
      success: response.status === 200,
      message: response.data?.message || 'Health check successful',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error('Google Apps Script health check failed:', axiosError.message);
    return {
      success: false,
      message: axiosError.response?.data?.message || axiosError.message || 'Health check failed',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Submit PRD review request to Google Apps Script
 */
export async function submitReviewRequest(
  config: GoogleAppsScriptConfig,
  data: {
    requesterName: string;
    title: string;
    content: string;
    confluenceUrl?: string;
  }
): Promise<ReviewSubmissionResponse> {
  try {
    const url = `${config.scriptUrl}?action=request_review`;
    const params = new URLSearchParams({
      requester: data.requesterName,
      title: data.title,
      content: data.content,
    });

    if (data.confluenceUrl) {
      params.append('confluence_url', data.confluenceUrl);
    }

    const response = await axios.get(`${url}&${params.toString()}`, {
      timeout: 30000, // 30 second timeout for AI processing
    });

    if (response.data?.success) {
      return {
        success: true,
        requestId: response.data.requestId || response.data.request_id,
        message: response.data.message || 'Review request submitted successfully',
        data: response.data,
      };
    }

    return {
      success: false,
      message: response.data?.message || 'Review request failed',
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error('Google Apps Script review submission failed:', axiosError.message);
    return {
      success: false,
      message: axiosError.response?.data?.message || axiosError.message || 'Review submission failed',
    };
  }
}

/**
 * Test review workflow (quick test without full submission)
 */
export async function testReview(config: GoogleAppsScriptConfig): Promise<ReviewSubmissionResponse> {
  try {
    const testData = {
      requesterName: 'Test User',
      title: 'Test PRD Review',
      content: 'This is a test PRD content to verify the review workflow is functioning correctly.',
    };

    return await submitReviewRequest(config, testData);
  } catch (error) {
    logger.error('Test review failed:', error);
    return {
      success: false,
      message: 'Test review failed',
    };
  }
}

/**
 * Fetch reviews from Google Sheets via Google Apps Script
 */
export async function fetchReviewsFromSheets(
  config: GoogleAppsScriptConfig
): Promise<{ success: boolean; reviews?: GoogleSheetsReview[]; message?: string }> {
  try {
    const url = `${config.scriptUrl}?action=get_reviews`;
    if (config.sheetsId) {
      const params = new URLSearchParams({ sheets_id: config.sheetsId });
      if (config.sheetTabName) {
        params.append('tab_name', config.sheetTabName);
      }
      const response = await axios.get(`${url}&${params.toString()}`, {
        timeout: 15000,
      });

      if (response.data?.success && Array.isArray(response.data.reviews)) {
        return {
          success: true,
          reviews: response.data.reviews.map((r: any) => ({
            requestId: r.requestId || r.request_id || r['Request ID'],
            when: r.when || r.When || r.created_at,
            requester: r.requester || r.Requester || r.requester_name,
            pageId: r.pageId || r.page_id || r['Page ID'],
            title: r.title || r.Title,
            aiReview: r.aiReview || r.ai_review || r['AI Review'],
            status: r.status || r.Status || 'DRAFT',
            confluenceUrl: r.confluenceUrl || r.confluence_url || r['Confluence URL'],
          })),
        };
      }

      return {
        success: false,
        message: response.data?.message || 'Failed to parse reviews from response',
      };
    }

    return {
      success: false,
      message: 'Google Sheets ID not configured',
    };
  } catch (error) {
    const axiosError = error as AxiosError;
    logger.error('Failed to fetch reviews from Google Sheets:', axiosError.message);
    return {
      success: false,
      message: axiosError.response?.data?.message || axiosError.message || 'Failed to fetch reviews',
    };
  }
}

/**
 * Generate unique request ID (format: REV-{unique_id})
 */
export function generateRequestId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `REV-${timestamp}-${random}`;
}

