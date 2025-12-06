import { TestRunResult, TestCaseStatus } from '../types'
import { formatDateTime, formatDuration } from '../utils/formatters'

interface ExecutionTimelineProps {
  selectedTestRunResult: TestRunResult | null
  currentStatus: TestCaseStatus
}

export default function ExecutionTimeline({ selectedTestRunResult, currentStatus }: ExecutionTimelineProps) {
  const hasStartedAt = selectedTestRunResult?.executedAt
  const isSkipped = currentStatus === 'skipped'
  const isToDo = currentStatus === 'toDo'
  
  // Don't show timeline for skipped or toDo
  if (isSkipped || (isToDo && !hasStartedAt)) {
    return null
  }
  
  // Calculate completed time from executedAt + executionTime for final statuses
  let completedAt: string | null = null
  if (hasStartedAt && selectedTestRunResult?.executionTime != null && selectedTestRunResult?.executedAt &&
      (currentStatus === 'passed' || currentStatus === 'failed' || currentStatus === 'blocked')) {
    try {
      const startTime = new Date(selectedTestRunResult.executedAt).getTime()
      const executionTimeMs = selectedTestRunResult.executionTime * 1000
      const completedTime = new Date(startTime + executionTimeMs)
      completedAt = completedTime.toISOString()
    } catch (err) {
      console.error('Error calculating completedAt:', err)
      completedAt = null
    }
  }
  
  return (
    <div className="mb-6 pb-4 border-b border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 rounded-xl border-2 shadow-sm">
      <div className="p-5">
        <h6 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          Execution Timeline
        </h6>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <small className="text-gray-600 block mb-1">Started At:</small>
            <div className="font-semibold text-primary-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M6.271 5.055a.5.5 0 0 1 .5 0L11 7.373l-4.229 2.318a.5.5 0 0 1-.5 0L2 7.373l4.271-2.318zM2.5 8.5a.5.5 0 0 1 .271-.445L7 10.373l4.229-2.318a.5.5 0 0 1 .5 0L16 10.373l-4.5 2.5a.5.5 0 0 1-.5 0l-4.5-2.5a.5.5 0 0 1-.271-.445z"/>
              </svg>
              {selectedTestRunResult?.executedAt 
                ? formatDateTime(selectedTestRunResult.executedAt) 
                : 'N/A'}
            </div>
          </div>
          <div>
            <small className="text-gray-600 block mb-1">Completed At:</small>
            <div className="font-semibold text-green-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 4.97 6.9a.75.75 0 0 0-1.08 1.04l3.25 3.5a.75.75 0 0 0 1.08.02l5.25-5.5a.75.75 0 0 0-.022-1.08z"/>
              </svg>
              {completedAt ? formatDateTime(completedAt) : 'N/A'}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <small className="text-gray-600 block mb-1">Duration:</small>
          <div className="font-semibold text-blue-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8.5 5.5a.5.5 0 0 0-1 0v3.362l-1.429 1.38a.5.5 0 1 0 .858.515l1.5-1.45A.5.5 0 0 0 8.5 9V5.5z"/>
              <path d="M6.5 0a.5.5 0 0 0 0 1H7v1.07a7.001 7.001 0 0 0-3.273 12.474l-.602.602a.5.5 0 0 0 .707.708l.746-.746A6.97 6.97 0 0 0 8 16a6.97 6.97 0 0 0 3.422-.892l.746.746a.5.5 0 0 0 .707-.708l-.602-.602A7.001 7.001 0 0 0 9 2.07V1h.5a.5.5 0 0 0 0-1h-3zm1.038 3.018a6.093 6.093 0 0 1 .924 0 6 6 0 1 1-.924 0zM0 3.5c0 .753.333 1.429.86 1.887A8.035 8.035 0 0 1 4.4 9.069a.5.5 0 1 0 .8-.588A7.035 7.035 0 0 0 1.5 4.5c0-.636.224-1.22.6-1.682a.5.5 0 0 0-.6-.818A7.967 7.967 0 0 0 0 3.5z"/>
            </svg>
            {selectedTestRunResult?.executedAt && selectedTestRunResult?.executionTime 
              ? formatDuration(selectedTestRunResult.executionTime)
              : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  )
}

