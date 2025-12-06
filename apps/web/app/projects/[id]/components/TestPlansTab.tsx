import React from 'react'
import Link from 'next/link'
import { PaginationState } from '../types'
import { PaginationControls } from './PaginationControls'
import { PageSizeSelector } from './PageSizeSelector'

interface TestPlan {
  id: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'archived'
  updatedAt: string
  repository: {
    id: string
    title: string
  }
  counts?: {
    testCases?: number
    testRuns?: number
  }
  createdBy?: {
    id: string
    name: string
    email: string
  } | null
}

interface TestPlansTabProps {
  projectId: string
  testPlans: TestPlan[]
  isLoading: boolean
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  openTestPlanMenu: string | null
  onOpenTestPlanMenu: (testPlanId: string | null) => void
  isDownloadingTestPlan: string | null
  onViewTestPlan: (testPlan: TestPlan) => void
  onDownloadTestPlan: (testPlan: TestPlan) => Promise<void>
  onDeleteTestPlan: (testPlan: TestPlan) => void
}

export function TestPlansTab({
  projectId,
  testPlans,
  isLoading,
  pagination,
  onPaginationChange,
  openTestPlanMenu,
  onOpenTestPlanMenu,
  isDownloadingTestPlan,
  onViewTestPlan,
  onDownloadTestPlan,
  onDeleteTestPlan,
}: TestPlansTabProps) {
  const startIndex = pagination.limit === -1 
    ? 0 
    : (pagination.page - 1) * pagination.limit
  const endIndex = pagination.limit === -1
    ? testPlans.length
    : startIndex + pagination.limit
  const paginatedTestPlans = testPlans.slice(startIndex, endIndex)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Test Plans</h2>
        <div className="flex items-center gap-3">
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
            show={!isLoading && testPlans.length > 0}
          />
          <Link
            href={`/projects/${projectId}/test-plans/new`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Test Plan
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading test plans...</p>
        </div>
      ) : testPlans.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Test Plans Found</h3>
          <p className="text-gray-600 mb-4">Create your first test plan to get started.</p>
          <Link
            href={`/projects/${projectId}/test-plans/new`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
          >
            Create Test Plan
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {paginatedTestPlans.map((testPlan) => (
              <div
                key={testPlan.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col relative"
              >
                {/* Three-dot Menu Button */}
                <div className="absolute top-4 right-4 z-10" data-test-plan-menu={testPlan.id}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenTestPlanMenu(openTestPlanMenu === testPlan.id ? null : testPlan.id)
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Test Plan Options"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {openTestPlanMenu === testPlan.id && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                      <div className="py-1">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            onOpenTestPlanMenu(null)
                            await onDownloadTestPlan(testPlan)
                          }}
                          disabled={isDownloadingTestPlan === testPlan.id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDownloadingTestPlan === testPlan.id ? (
                            <>
                              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Download Test Plan</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="border-t border-gray-200"></div>
                      <div className="py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenTestPlanMenu(null)
                            onDeleteTestPlan(testPlan)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Test Plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href={`/projects/${projectId}/repositories/${testPlan.repository.id}/test-plans/${testPlan.id}`}
                  className="flex flex-col flex-1"
                >
                  <div className="flex items-start justify-between mb-3 pr-12">
                    <h3 className="text-lg font-semibold text-gray-900 flex-1 line-clamp-2">{testPlan.title}</h3>
                    <span
                      className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                        testPlan.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : testPlan.status === 'archived'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {testPlan.status}
                    </span>
                  </div>
                  {testPlan.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{testPlan.description}</p>
                  )}
                  <div className="mt-auto pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>{testPlan.counts?.testCases || 0} test cases</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>{testPlan.counts?.testRuns || 0} runs</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{testPlan.repository.title}</span>
                      {testPlan.createdBy && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Created by {testPlan.createdBy.name}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>

          <PaginationControls
            pagination={pagination}
            onPageChange={(page) => onPaginationChange({ ...pagination, page })}
            itemName="test plans"
          />
        </>
      )}
    </div>
  )
}

