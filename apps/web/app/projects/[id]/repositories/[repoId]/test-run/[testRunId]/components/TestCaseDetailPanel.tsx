'use client'

import { useState } from 'react'
import { TestCaseWithResult, TestRunResult, Repository, TestCaseStatus } from '../types'
import StatusButtons from './StatusButtons'
import ExecutionTimeline from './ExecutionTimeline'
import CommentsSection from './CommentsSection'
import HistorySection from './HistorySection'
import { formatDateTime } from '../utils/formatters'
import { getStatusBadgeColor } from '../utils/statusHelpers'

interface TestCaseDetailPanelProps {
  selectedTestCase: any | null
  selectedTestRunResult: TestRunResult | null
  repository: Repository | null
  projectId: string
  repoId: string
  testRunId: string
  isLoading: boolean
  currentStatus: TestCaseStatus
  errorMessage: string
  executionLogs: string
  bugTicketUrl: string
  comments: any[]
  newComment: string
  setNewComment: (value: string) => void
  commentFiles: File[]
  filePreviews: Array<{ url: string; type: string; name: string }>
  isSubmittingComment: boolean
  editingCommentId: string | null
  editingCommentText: string
  currentUserId: string | null
  activeTab: 'comments' | 'history'
  history: any[]
  historyPage: number
  historyTotalPages: number
  isLoadingHistory: boolean
  onStatusChange: (status: TestCaseStatus) => void
  onErrorMessageChange: (value: string) => void
  onExecutionLogsChange: (value: string) => void
  onBugTicketUrlChange: (value: string) => void
  onAutoSave: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSubmitComment: () => Promise<void>
  onEditComment: (comment: any) => void
  onCancelEdit: () => void
  onSaveEdit: (commentId: string) => Promise<void>
  onDeleteComment: (comment: any) => void
  onTabChange: (tab: 'comments' | 'history') => void
  onHistoryPageChange: (page: number) => void
  onError: (error: string) => void
}

export default function TestCaseDetailPanel({
  selectedTestCase,
  selectedTestRunResult,
  repository,
  projectId,
  repoId,
  testRunId,
  isLoading,
  currentStatus,
  errorMessage,
  executionLogs,
  bugTicketUrl,
  comments,
  newComment,
  setNewComment,
  commentFiles,
  filePreviews,
  isSubmittingComment,
  editingCommentId,
  editingCommentText,
  currentUserId,
  activeTab,
  history,
  historyPage,
  historyTotalPages,
  isLoadingHistory,
  onStatusChange,
  onErrorMessageChange,
  onExecutionLogsChange,
  onBugTicketUrlChange,
  onAutoSave,
  onFileSelect,
  onSubmitComment,
  onEditComment,
  onCancelEdit,
  onSaveEdit,
  onDeleteComment,
  onTabChange,
  onHistoryPageChange,
  onError,
}: TestCaseDetailPanelProps) {
  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-600">Loading test case details...</p>
      </div>
    )
  }

  if (!selectedTestCase) {
    return (
      <div className="p-12 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-600 font-medium">Select a test case to view details</p>
        <p className="text-sm text-gray-400 mt-1">Click on any test case from the list to see its information</p>
      </div>
    )
  }

  const testCaseId = selectedTestCase.jiraKey || `${repository?.prefix || 'ST'}-${selectedTestCase.id}`

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <StatusButtons currentStatus={currentStatus} onStatusChange={onStatusChange} />

      <div className="flex-1 overflow-y-auto p-6">
        <ExecutionTimeline selectedTestRunResult={selectedTestRunResult} currentStatus={currentStatus} />

        {/* Test Case Title */}
        <div className="mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-start gap-3 flex-wrap">
            <span
              className={`text-sm font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all ${getStatusBadgeColor(currentStatus)} text-white`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/repositories/${repoId}/test-run/${testRunId}?testCase=${selectedTestCase.id}`)
              }}
              title="Click to copy link"
            >
              {testCaseId}
            </span>
            <span className="text-lg font-semibold text-gray-900 leading-relaxed flex-1">
              {selectedTestCase.title}
            </span>
          </div>
        </div>

        {/* Preconditions */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Preconditions
          </h4>
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {selectedTestCase.data?.preconditions ? (
                <div 
                  className="[&_a]:text-primary-600 [&_a]:hover:text-primary-700 [&_a]:hover:underline [&_a]:cursor-pointer [&_a]:font-medium"
                  dangerouslySetInnerHTML={{ __html: selectedTestCase.data.preconditions }}
                />
              ) : (
                <span className="text-gray-400 italic">No preconditions provided</span>
              )}
            </div>
          </div>
        </div>

        {/* BDD Scenarios */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            BDD Scenarios
          </h4>
          <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
              {selectedTestCase.data?.bddScenarios || 'No BDD scenarios provided'}
            </div>
          </div>
        </div>

        {/* Error Message (shown for Failed/Blocked statuses) */}
        {(currentStatus === 'failed' || currentStatus === 'blocked') && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Error Message
            </h4>
            <textarea
              value={errorMessage}
              onChange={(e) => onErrorMessageChange(e.target.value)}
              onBlur={onAutoSave}
              placeholder="Enter error message or reason for failure..."
              className="w-full min-h-[100px] px-4 py-3 border border-red-200 rounded-xl bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm text-gray-900 placeholder-gray-400 resize-y"
            />
            {selectedTestRunResult?.errorMessage && !errorMessage && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Current error message:</p>
                <p className="text-sm text-gray-700">{selectedTestRunResult.errorMessage}</p>
              </div>
            )}
          </div>
        )}

        {/* Bug Ticket URL (shown for Failed/Blocked statuses) */}
        {(currentStatus === 'failed' || currentStatus === 'blocked') && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Bug Ticket URL
              <span className="text-xs font-normal text-gray-500 ml-2">(Jira, TestRail, etc.)</span>
            </h4>
            <input
              type="url"
              value={bugTicketUrl}
              onChange={(e) => onBugTicketUrlChange(e.target.value)}
              onBlur={onAutoSave}
              placeholder="https://jira.example.com/browse/PROJ-123 or https://testrail.example.com/index.php?/cases/view/456"
              className="w-full px-4 py-3 border border-orange-200 rounded-xl bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm text-gray-900 placeholder-gray-400"
            />
            {selectedTestRunResult?.bugTicketUrl && !bugTicketUrl && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Current bug ticket:</p>
                <a 
                  href={selectedTestRunResult.bugTicketUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {selectedTestRunResult.bugTicketUrl}
                </a>
              </div>
            )}
            {bugTicketUrl && (
              <div className="mt-2">
                <a 
                  href={bugTicketUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open Bug Ticket
                </a>
              </div>
            )}
          </div>
        )}

        {/* Display existing bug ticket URL if status changed from failed/blocked */}
        {selectedTestRunResult?.bugTicketUrl && 
         currentStatus !== 'failed' && 
         currentStatus !== 'blocked' && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Bug Ticket
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <a 
                href={selectedTestRunResult.bugTicketUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {selectedTestRunResult.bugTicketUrl}
              </a>
            </div>
          </div>
        )}

        {/* Display existing error message if status changed from failed/blocked */}
        {selectedTestRunResult?.errorMessage && 
         currentStatus !== 'failed' && 
         currentStatus !== 'blocked' && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Previous Error Message
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-700">{selectedTestRunResult.errorMessage}</p>
            </div>
          </div>
        )}

        {/* Execution Logs */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Execution Logs
            <span className="text-xs font-normal text-gray-500 ml-2">(Optional step-by-step notes)</span>
          </h4>
          <textarea
            value={executionLogs}
            onChange={(e) => onExecutionLogsChange(e.target.value)}
            onBlur={onAutoSave}
            placeholder="Enter execution logs or step-by-step notes (e.g., Step 1: Navigate to login page ✓&#10;Step 2: Enter credentials ✓&#10;Step 3: Click login button ✗)"
            className="w-full min-h-[120px] px-4 py-3 border border-blue-200 rounded-xl bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 resize-y font-mono"
          />
          {selectedTestRunResult?.logs && !executionLogs && (
            <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Current execution logs:</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">{selectedTestRunResult.logs}</pre>
            </div>
          )}
        </div>

        {/* Display existing logs if they exist */}
        {selectedTestRunResult?.logs && executionLogs !== selectedTestRunResult.logs && (
          <div className="mb-6">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Previous Execution Logs
            </h4>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">{selectedTestRunResult.logs}</pre>
            </div>
          </div>
        )}

        {/* Comments & History Section */}
        <div className="mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
            <button
              onClick={() => onTabChange('comments')}
              className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'comments'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Comments
              </div>
            </button>
            <button
              onClick={() => onTabChange('history')}
              className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === 'history'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </div>
            </button>
          </div>

          {/* Comments Tab Content */}
          {activeTab === 'comments' && (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              <CommentsSection
                comments={comments}
                newComment={newComment}
                setNewComment={setNewComment}
                commentFiles={commentFiles}
                filePreviews={filePreviews}
                isSubmittingComment={isSubmittingComment}
                editingCommentId={editingCommentId}
                editingCommentText={editingCommentText}
                currentUserId={currentUserId}
                testRunId={testRunId}
                testCaseId={selectedTestCase?.id || null}
                onFileSelect={onFileSelect}
                onSubmitComment={onSubmitComment}
                onEditComment={onEditComment}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onDeleteComment={onDeleteComment}
                onError={onError}
              />
            </div>
          )}

          {/* History Tab Content */}
          {activeTab === 'history' && (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
              <HistorySection
                history={history}
                historyPage={historyPage}
                historyTotalPages={historyTotalPages}
                isLoadingHistory={isLoadingHistory}
                selectedTestRunResultId={selectedTestRunResult?.id || null}
                onPageChange={onHistoryPageChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

