import React from 'react'
import Link from 'next/link'
import { PaginationState } from '../types'
import { PaginationControls } from './PaginationControls'
import { PageSizeSelector } from './PageSizeSelector'
import { formatTimeAgo } from '../utils/formatTimeAgo'

interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  startedAt: string | null
  completedAt: string | null
  environment: string | null
  buildVersion: string | null
  testPlan: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
  } | null
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
    inProgress?: number
    toDo?: number
    executed?: number
  }
  totalExecutionTime?: number
  createdAt: string
  updatedAt: string
}

interface TestRunsTabProps {
  projectId: string
  testRuns: TestRun[]
  isLoading: boolean
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  openTestRunMenu: string | null
  onOpenTestRunMenu: (testRunId: string | null) => void
  onDeleteTestRun: (testRun: TestRun) => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'running':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'failed':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'cancelled':
      return 'bg-gray-100 text-gray-700 border-gray-200'
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getStatusLabel = (status: string) => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatExecutionTime = (totalSeconds: number | undefined): string => {
  if (!totalSeconds || totalSeconds === 0) return '00:00:00'
  
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TestRunsTab({
  projectId,
  testRuns,
  isLoading,
  pagination,
  onPaginationChange,
  openTestRunMenu,
  onOpenTestRunMenu,
  onDeleteTestRun,
}: TestRunsTabProps) {
  const startIndex = pagination.limit === -1 
    ? 0 
    : (pagination.page - 1) * pagination.limit
  const endIndex = pagination.limit === -1
    ? testRuns.length
    : startIndex + pagination.limit
  const paginatedTestRuns = testRuns.slice(startIndex, endIndex)

  const calculateProgressBar = (testRun: TestRun) => {
    const { total, passed, failed, skipped, blocked, inProgress = 0, toDo = 0, executed: executedFromStats } = testRun.stats
    if (total === 0) return { segments: [], complete: 0 }
    
    // Use executed from stats if available, otherwise calculate it
    const executed = executedFromStats !== undefined 
      ? executedFromStats 
      : passed + failed + skipped + blocked + inProgress
    const complete = total > 0 ? Math.round((executed / total) * 100) : 0
    
    const segments = []
    if (passed > 0) segments.push({ color: 'bg-emerald-500', width: (passed / total) * 100 })
    if (failed > 0) segments.push({ color: 'bg-red-500', width: (failed / total) * 100 })
    if (blocked > 0) segments.push({ color: 'bg-orange-500', width: (blocked / total) * 100 })
    if (inProgress > 0) segments.push({ color: 'bg-yellow-500', width: (inProgress / total) * 100 })
    if (skipped > 0) segments.push({ color: 'bg-blue-500', width: (skipped / total) * 100 })
    if (toDo > 0) segments.push({ color: 'bg-slate-600', width: (toDo / total) * 100 })
    
    return { segments, complete }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Test Runs</h2>
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
            show={!isLoading && testRuns.length > 0}
          />
          <Link
            href={`/projects/${projectId}/test-runs/new`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Test Run
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading test runs...</p>
        </div>
      ) : testRuns.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Test Runs Found</h3>
          <p className="text-gray-600 mb-4">Create your first test run to get started.</p>
          <Link
            href={`/projects/${projectId}/test-runs/new`}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
          >
            Create Test Run
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {paginatedTestRuns.map((testRun) => {
              const { segments, complete } = calculateProgressBar(testRun)
              const { total, passed, failed, skipped, blocked, inProgress = 0, toDo = 0, executed: executedFromStats } = testRun.stats
              // Use executed from stats if available, otherwise calculate it
              const executed = executedFromStats !== undefined 
                ? executedFromStats 
                : passed + failed + skipped + blocked + inProgress
              const executionTime = formatExecutionTime(testRun.totalExecutionTime)
              
              // Build status summary labels
              const statusLabels = []
              if (passed > 0) statusLabels.push({ label: `${passed} Passed`, color: 'bg-emerald-100 text-emerald-800' })
              if (failed > 0) statusLabels.push({ label: `${failed} Failed`, color: 'bg-red-100 text-red-800' })
              if (blocked > 0) statusLabels.push({ label: `${blocked} Blocked`, color: 'bg-orange-100 text-orange-800' })
              if (inProgress > 0) statusLabels.push({ label: `${inProgress} In Progress`, color: 'bg-yellow-100 text-yellow-800' })
              if (skipped > 0) statusLabels.push({ label: `${skipped} Skipped`, color: 'bg-blue-100 text-blue-800' })
              if (toDo > 0) statusLabels.push({ label: `${toDo} To Do`, color: 'bg-slate-600 text-white' })
              
              return (
                <div
                  key={testRun.id}
                  className="block border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white relative"
                >
                  {/* Three-dot Menu Button */}
                  <div className="absolute top-2 right-2 z-10" data-test-run-menu={testRun.id}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        onOpenTestRunMenu(openTestRunMenu === testRun.id ? null : testRun.id)
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Test Run Options"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {openTestRunMenu === testRun.id && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                        <div className="py-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              onOpenTestRunMenu(null)
                              onDeleteTestRun(testRun)
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete Test Run
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Link
                    href={testRun.repository?.id 
                      ? `/projects/${projectId}/repositories/${testRun.repository.id}/test-run/${testRun.id}`
                      : `/projects/${projectId}/test-runs/${testRun.id}`}
                    className="block"
                  >
                    <div className="p-2">
                      <div className="flex items-center">
                        {/* Left Column - Test Run Title and Info */}
                        <div className="flex-1 pr-4">
                          <h5 className="text-lg font-semibold text-gray-900 mb-2">
                            <span className="flex items-center">
                              <svg className="w-5 h-5 text-primary-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {testRun.title}
                            </span>
                          </h5>
                          <div className="text-sm text-gray-600 mb-1">
                            <strong>Source Test Plan:</strong> {testRun.testPlan.title}
                          </div>
                          <div className="text-sm text-gray-600">
                            <strong>Created at:</strong> {formatDate(testRun.createdAt)}
                          </div>
                        </div>

                      {/* Right Column - Execution Statistics */}
                      <div className="flex-1" style={{ fontSize: '14px' }}>
                        {/* Progress Bar */}
                        {total > 0 && (
                          <div className="mt-3">
                            <div className="w-full bg-gray-200 rounded-md overflow-hidden" style={{ height: '12px' }}>
                              <div className="flex h-full">
                                {segments.map((segment, idx) => (
                                  <div
                                    key={idx}
                                    className={segment.color === 'bg-emerald-500' ? 'bg-green-500' : 
                                             segment.color === 'bg-red-500' ? 'bg-red-500' :
                                             segment.color === 'bg-orange-500' ? 'bg-orange-500' :
                                             segment.color === 'bg-yellow-500' ? 'bg-yellow-500' :
                                             segment.color === 'bg-blue-500' ? 'bg-blue-500' : 'bg-gray-500'}
                                    style={{ width: `${segment.width}%` }}
                                    title={segment.color === 'bg-emerald-500' ? `Passed: ${passed}` :
                                           segment.color === 'bg-red-500' ? `Failed: ${failed}` :
                                           segment.color === 'bg-orange-500' ? `Blocked: ${blocked}` :
                                           segment.color === 'bg-yellow-500' ? `In Progress: ${inProgress}` :
                                           segment.color === 'bg-blue-500' ? `Skipped: ${skipped}` : ''}
                                  />
                                ))}
                              </div>
                            </div>
                            
                            {/* Status Badges */}
                            {statusLabels.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {statusLabels.map((item, idx) => {
                                  const badgeColor = item.color.includes('emerald') ? '#11AC4A' :
                                                    item.color.includes('red') ? '#DC2626' :
                                                    item.color.includes('orange') ? '#EA580C' :
                                                    item.color.includes('yellow') ? '#EAB308' :
                                                    item.color.includes('blue') ? '#444BE7' : '#6B7280'
                                  return (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 text-xs font-medium rounded text-white"
                                      style={{ backgroundColor: badgeColor }}
                                    >
                                      {item.label}
                                    </span>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Stats Boxes */}
                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                          {/* Execution Time */}
                          <div className="p-1 bg-gray-50 rounded">
                            <div className={`text-sm font-semibold ${executionTime !== '00:00:00' ? 'text-green-600' : 'text-gray-600'}`}>
                              {executionTime}
                            </div>
                            <div className="text-xs text-gray-500">Execution Time</div>
                          </div>
                          
                          {/* Executing */}
                          <div className="p-1 bg-gray-50 rounded">
                            <div className="text-sm font-semibold text-blue-600">
                              {inProgress}/{total}
                            </div>
                            <div className="text-xs text-gray-500">Executing</div>
                          </div>
                          
                          {/* Complete */}
                          <div className="p-1 bg-gray-50 rounded">
                            <div className={`text-sm font-semibold ${complete === 100 ? 'text-green-600' : 'text-gray-600'}`}>
                              {complete}%
                            </div>
                            <div className="text-xs text-gray-500">Complete</div>
                          </div>
                        </div>
                      </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>

          <PaginationControls
            pagination={pagination}
            onPageChange={(page) => onPaginationChange({ ...pagination, page })}
            itemName="test runs"
          />
        </>
      )}
    </div>
  )
}

