'use client'

import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { TestCaseWithResult, User } from '../types'
import { getStatusLabel, getStatusBadgeColor } from '../utils/statusHelpers'

interface TestSuite {
  id: string
  title: string
  testCases: TestCaseWithResult[]
}

interface TestSuiteListProps {
  testCasesBySuite: Record<string, TestSuite>
  expandedSuites: Set<string>
  selectedTestCaseIds: Set<string>
  selectedTestCaseForModal: any
  users: User[]
  testRunId: string
  onSuiteToggle: (suiteId: string) => void
  onSuiteSelect: (suiteId: string, suiteTestCases: TestCaseWithResult[]) => void
  onTestCaseSelect: (testCaseId: string) => void
  onTestCaseClick: (testCase: TestCaseWithResult) => void
  onAssignUser: (testCaseId: string, userId: string | null) => void
  isSuiteFullySelected: (suiteTestCases: TestCaseWithResult[]) => boolean
  isSuitePartiallySelected: (suiteTestCases: TestCaseWithResult[]) => boolean
  isLoading: boolean
}

export default function TestSuiteList({
  testCasesBySuite,
  expandedSuites,
  selectedTestCaseIds,
  selectedTestCaseForModal,
  users,
  testRunId,
  onSuiteToggle,
  onSuiteSelect,
  onTestCaseSelect,
  onTestCaseClick,
  onAssignUser,
  isSuiteFullySelected,
  isSuitePartiallySelected,
  isLoading,
}: TestSuiteListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const flattenedTestCases = useMemo(() => {
    const flattened: Array<{ type: 'suite' | 'testCase'; suiteId?: string; suiteTitle?: string; testCase?: TestCaseWithResult }> = []
    
    Object.values(testCasesBySuite).forEach((suite) => {
      const isExpanded = expandedSuites.has(suite.id)
      flattened.push({
        type: 'suite',
        suiteId: suite.id,
        suiteTitle: suite.title,
      })
      
      if (isExpanded) {
        suite.testCases.forEach((testCase) => {
          flattened.push({
            type: 'testCase',
            suiteId: suite.id,
            testCase,
          })
        })
      }
    })
    
    return flattened
  }, [testCasesBySuite, expandedSuites])

  const virtualizer = useVirtualizer({
    count: flattenedTestCases.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedTestCases[index]
      return item.type === 'suite' ? 40 : 60
    },
    overscan: 10,
  })

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <p className="mt-4 text-gray-600">Loading test cases...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto" ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = flattenedTestCases[virtualItem.index]
          
          if (item.type === 'suite') {
            const suite = testCasesBySuite[item.suiteId!]
            const isExpanded = expandedSuites.has(suite.id)
            const isFullySelected = isSuiteFullySelected(suite.testCases)
            const isPartiallySelected = isSuitePartiallySelected(suite.testCases)
            
            return (
              <div
                key={`suite-${suite.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="mb-2"
              >
                <div 
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    suite.id === '__deleted__' 
                      ? 'bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 shadow-sm' 
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="form-check mb-0">
                    <input
                      type="checkbox"
                      checked={isFullySelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = isPartiallySelected
                        }
                      }}
                      onChange={() => onSuiteSelect(suite.id, suite.testCases)}
                      onClick={(e) => e.stopPropagation()}
                      className="form-check-input rounded border-gray-400 cursor-pointer"
                      style={{ width: '16px', height: '16px' }}
                    />
                  </div>
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => onSuiteToggle(suite.id)}
                  >
                    <svg 
                      className={`w-4 h-4 ${suite.id === '__deleted__' ? 'text-red-500' : 'text-gray-500'} transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {suite.id === '__deleted__' ? (
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11z"/>
                        <path d="M5.5 6a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h4a.5.5 0 0 1 0 1H6a.5.5 0 0 1-.5-.5z"/>
                      </svg>
                    )}
                    <span className={`font-semibold ${suite.id === '__deleted__' ? 'text-red-700' : 'text-gray-900'}`}>
                      {suite.title}
                    </span>
                    <span className={`ms-auto ${suite.id === '__deleted__' ? 'text-red-600' : 'text-muted'}`} style={{ fontSize: '14px' }}>
                      {suite.testCases.length} Test Case{suite.testCases.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )
          } else {
            const testCase = item.testCase!
            const prefix = testCase.repository?.prefix || 'ST'
            const testCaseId = testCase.jiraKey || `${prefix}-${testCase.id}`
            const isSelected = selectedTestCaseIds.has(testCase.id)
            const isDetailSelected = selectedTestCaseForModal?.id === testCase.id
            
            return (
              <div
                key={`testcase-${testCase.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                  cursor: 'pointer',
                }}
                onClick={() => onTestCaseClick(testCase)}
                className={`tree_test_case tree_test_case_content py-3 px-4 flex items-center justify-between rounded-lg transition-all ${
                  isDetailSelected 
                    ? 'selected bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-md' 
                    : 'hover:bg-gray-50 border border-transparent hover:border-gray-200'
                }`}
              >
                <div className="form-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onTestCaseSelect(testCase.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="form-check-input rounded border-gray-400 cursor-pointer"
                    style={{ width: '16px', height: '16px' }}
                    data-test_suite_id={item.suiteId}
                    data-test_case_id={testCase.id}
                  />
                </div>
                <span>
                  {testCase.automated ? (
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M6 12.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5ZM3 8.062C3 6.76 4.235 5.765 5.53 5.886a26.58 26.58 0 0 0 4.94 0C11.765 5.765 13 6.76 13 8.062v1.157a.933.933 0 0 1-.765.935c-.845.147-2.34.346-4.235.346-1.895 0-3.39-.2-4.235-.346A.933.933 0 0 1 3 9.219V8.062Zm4.542-.827a.25.25 0 0 0-.217.068l-.92.9a24.767 24.767 0 0 1-1.871-.183.25.25 0 0 0-.068.495c.55.076 1.232.149 2.02.193a.25.25 0 0 0 .189-.071l.754-.736a.25.25 0 0 0 .033-.11c0-.163.128-.288.288-.288a.27.27 0 0 1 .018.015L11.37 7.05a.25.25 0 0 0 .154-.098l.83-.87a.25.25 0 0 0-.154-.247l-.649-.233a26.767 26.767 0 0 0-1.88-.175.25.25 0 0 0-.068.494c.55.077 1.232.15 2.02.194a.25.25 0 0 0 .188-.072l.754-.736a.25.25 0 0 0 .033-.11c0-.163.128-.288.288-.288Z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4Zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10Z"/>
                    </svg>
                  )}
                </span>
                <span className={`ps-1 pe-2 ${testCase.isValid === false ? 'text-red-500 line-through' : 'text-muted'}`} style={{ fontSize: '14px' }}>
                  {testCaseId}
                </span>
                <span 
                  className={`text-truncate flex-1 ${testCase.isValid === false ? 'text-red-500 line-through opacity-60' : ''}`}
                  style={{ 
                    maxWidth: '320px', 
                    display: 'inline-block', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    fontSize: '14px'
                  }}
                >
                  {testCase.title}
                  {testCase.isValid === false && (
                    <span className="ml-2 text-xs text-red-600 font-semibold">(Deleted)</span>
                  )}
                </span>
                <div className="result_badge mx-2" data-test_case_id={testCase.id}>
                  <span
                    className={`badge px-3 py-1.5 text-xs font-semibold rounded-lg text-white shadow-sm ${getStatusBadgeColor(testCase.status)}`}
                  >
                    {getStatusLabel(testCase.status)}
                  </span>
                </div>
                <select
                  className="form-select form-select-sm border border-gray-300 rounded px-2 py-1 bg-white"
                  style={{ width: '110px', fontSize: '12px' }}
                  value={testCase.executedBy?.id || ''}
                  onChange={(e) => {
                    e.stopPropagation()
                    onAssignUser(testCase.id, e.target.value || null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  data-testcase={testCase.id}
                  data-testrun={testRunId}
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          }
        })}
      </div>
    </div>
  )
}

