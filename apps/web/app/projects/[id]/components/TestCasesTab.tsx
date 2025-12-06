import React from 'react'
import { PaginationState } from '../types'
import { PaginationControls } from './PaginationControls'
import { PageSizeSelector } from './PageSizeSelector'

interface TestCase {
  id: string
  title: string
  description?: string
  jiraKey?: string
  automated: boolean
  priority: number
  repository: {
    id: string
    title: string
    prefix?: string
  }
  suite: {
    id: string
    title: string
  }
}

interface TestCasesTabProps {
  testCases: TestCase[]
  isLoading: boolean
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  onTestCaseClick: (testCase: TestCase) => void
}

export function TestCasesTab({
  testCases,
  isLoading,
  pagination,
  onPaginationChange,
  onTestCaseClick,
}: TestCasesTabProps) {
  const startIndex = pagination.limit === -1 
    ? 0 
    : (pagination.page - 1) * pagination.limit
  const endIndex = pagination.limit === -1
    ? testCases.length
    : startIndex + pagination.limit
  const paginatedTestCases = testCases.slice(startIndex, endIndex)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Test Cases</h2>
        <PageSizeSelector
          pagination={pagination}
          onLimitChange={(newLimit) => {
            onPaginationChange({
              ...pagination,
              limit: newLimit,
              page: 1,
              totalPages: newLimit === -1 ? 1 : Math.ceil(pagination.total / newLimit),
            })
          }}
          show={!isLoading && testCases.length > 0}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading test cases...</p>
        </div>
      ) : testCases.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Test Cases Found</h3>
          <p className="text-gray-600">No test cases have been created yet.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-6">
            {paginatedTestCases.map((testCase) => (
              <button
                key={testCase.id}
                onClick={() => onTestCaseClick(testCase)}
                className="w-full text-left block border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-primary-600 font-medium">
                        {testCase.jiraKey || `${testCase.repository?.prefix || 'ST'}-${testCase.id}`}
                      </span>
                      <h3 className="text-lg font-semibold text-gray-900">{testCase.title}</h3>
                      {testCase.automated && (
                        <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Automated
                        </span>
                      )}
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${
                          testCase.priority === 1
                            ? 'bg-red-100 text-red-800'
                            : testCase.priority === 2
                            ? 'bg-orange-100 text-orange-800'
                            : testCase.priority === 3
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {testCase.priority === 1
                          ? 'Critical'
                          : testCase.priority === 2
                          ? 'High'
                          : testCase.priority === 3
                          ? 'Medium'
                          : 'Low'}
                      </span>
                    </div>
                    {testCase.description && testCase.description.trim() && testCase.description.toLowerCase() !== 'n/a' && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{testCase.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>{testCase.repository.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{testCase.suite.title}</span>
                      </div>
                      {testCase.jiraKey && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                            {testCase.jiraKey}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <PaginationControls
            pagination={pagination}
            onPageChange={(page) => onPaginationChange({ ...pagination, page })}
            itemName="test cases"
          />
        </>
      )}
    </div>
  )
}

