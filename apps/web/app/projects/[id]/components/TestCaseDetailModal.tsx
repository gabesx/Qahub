import React from 'react'
import { Repository } from '../types'

interface TestCaseData {
  id: string
  title: string
  jiraKey?: string
  automated: boolean
  priority: number
  severity?: string
  regression: boolean
  epicLink?: string
  releaseVersion?: string
  linkedIssue?: string
  labels?: string
  description?: string
  platform?: string
  data?: {
    preconditions?: string
    bddScenarios?: string
  }
  createdAt: string
  updatedAt: string
  createdBy?: {
    name: string
  }
  updatedBy?: {
    name: string
  }
}

interface TestCaseDetailModalProps {
  isOpen: boolean
  isLoading: boolean
  testCase: TestCaseData | null
  repository: Repository | null
  onClose: () => void
}

export function TestCaseDetailModal({
  isOpen,
  isLoading,
  testCase,
  repository,
  onClose,
}: TestCaseDetailModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading test case details...</p>
          </div>
        ) : testCase ? (
          <>
            {/* Modal Header */}
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {testCase.automated ? (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                <span className="text-primary-600">
                  {testCase.jiraKey || `${repository?.prefix || 'ST'}-${testCase.id}`}
                </span>
                <span>{testCase.title}</span>
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <div className="py-4">
                <strong className="text-lg font-semibold block mb-4">Details Test Case</strong>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Test Type</span>
                      <span className="text-sm font-medium text-gray-900">
                        {testCase.automated ? 'Automated' : 'Manual'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Platform</span>
                      <span className="flex items-center gap-1">
                        {(() => {
                          let platforms: string[] = []
                          try {
                            if (testCase.platform) {
                              platforms = JSON.parse(testCase.platform)
                            }
                          } catch {
                            if (testCase.platform) {
                              platforms = [testCase.platform]
                            }
                          }
                          if (platforms.length === 0) return <span className="text-gray-400">—</span>
                          return platforms.map((platform, idx) => {
                            const platformLower = platform.toLowerCase()
                            return (
                              <span key={idx} className="flex items-center" title={platform}>
                                {platformLower === 'android' && (
                                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                                  </svg>
                                )}
                                {platformLower === 'ios' && (
                                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                                  </svg>
                                )}
                                {(platformLower === 'web' || platformLower === 'mweb') && (
                                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                  </svg>
                                )}
                              </span>
                            )
                          })
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Priority</span>
                      <span className="text-sm font-medium text-gray-900">
                        {testCase.priority === 1 ? 'Low' :
                         testCase.priority === 2 ? 'Medium' :
                         testCase.priority === 3 ? 'High' : 'Critical'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Regression</span>
                      <span>
                        {testCase.regression ? (
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 4.97 6.9a.75.75 0 0 0-1.08 1.04l3.25 3.5a.75.75 0 0 0 1.08.02l5.25-5.5a.75.75 0 0 0-.022-1.08z"/>
                          </svg>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                  {/* Right Column */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Epic Link</span>
                      <span className="text-sm font-medium text-gray-900">
                        {testCase.epicLink ? (
                          <a
                            href={testCase.epicLink.startsWith('http') ? testCase.epicLink : `https://allofresh.atlassian.net/browse/${testCase.epicLink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {testCase.epicLink}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Fix Version</span>
                      <span className="text-sm font-medium text-gray-900">
                        {testCase.releaseVersion || <span className="text-gray-400">—</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Severity</span>
                      <span className="text-sm font-medium text-gray-900">{testCase.severity || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                      <span className="text-sm text-gray-700">Linked Issue</span>
                      <span className="text-sm font-medium text-gray-900">
                        {testCase.linkedIssue ? (
                          <a
                            href={testCase.linkedIssue.startsWith('http') ? testCase.linkedIssue : `https://allofresh.atlassian.net/browse/${testCase.linkedIssue}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:text-primary-700 hover:underline"
                          >
                            {testCase.linkedIssue}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <strong className="text-lg font-semibold block mb-3 mt-4">Labels</strong>
                <div className="border border-gray-200 p-3 rounded mb-4">
                  <div className="flex flex-wrap gap-2">
                    {testCase.labels ? (
                      testCase.labels.split(',').map((label: string, idx: number) => (
                        <span key={idx} className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-sm">
                          {label.trim()}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">None</span>
                    )}
                  </div>
                </div>

                <strong className="text-lg font-semibold block mb-3">Description</strong>
                <div className="border border-gray-200 p-3 rounded mb-4">
                  <div className="text-sm text-gray-700">
                    {testCase.description && testCase.description.toLowerCase() !== 'n/a' ? testCase.description : 'n/a'}
                  </div>
                </div>

                <strong className="text-lg font-semibold block mb-3">Preconditions</strong>
                <div className="border border-gray-200 p-3 rounded mb-4">
                  <div className="text-sm text-gray-700">
                    {testCase.data?.preconditions ? (
                      <div 
                        className="[&_a]:text-primary-600 [&_a]:hover:text-primary-700 [&_a]:hover:underline [&_a]:cursor-pointer [&_a]:font-medium"
                        dangerouslySetInnerHTML={{ __html: testCase.data.preconditions }}
                      />
                    ) : (
                      <span className="text-gray-400 italic">No preconditions provided</span>
                    )}
                  </div>
                </div>

                <strong className="text-base font-semibold block mb-3">BDD Scenarios</strong>
                <div className="border border-gray-200 p-2 rounded mb-4">
                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                    {testCase.data?.bddScenarios || 'No BDD scenarios provided'}
                  </div>
                </div>

                {/* Information Container */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-4 py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600 w-28">Created By</span>
                    <span className="text-sm font-medium text-gray-900">
                      {testCase.createdBy?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(testCase.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      }).replace(',', '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 py-2">
                    <span className="text-sm font-medium text-gray-600 w-28">Updated By</span>
                    <span className="text-sm font-medium text-gray-900">
                      {testCase.updatedBy?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500 ml-auto">
                      {new Date(testCase.updatedAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      }).replace(',', '')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="p-12 text-center">
            <p className="text-gray-600">Failed to load test case details</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

