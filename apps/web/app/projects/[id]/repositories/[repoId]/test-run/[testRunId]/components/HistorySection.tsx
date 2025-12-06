import { HistoryEntry } from '../types'
import { formatDateTime } from '../utils/formatters'
import { getHistoryStatusColor, getHistoryStatusLabel } from '../utils/statusHelpers'

interface HistorySectionProps {
  history: HistoryEntry[]
  historyPage: number
  historyTotalPages: number
  isLoadingHistory: boolean
  selectedTestRunResultId: string | null
  onPageChange: (page: number) => void
}

export default function HistorySection({
  history,
  historyPage,
  historyTotalPages,
  isLoadingHistory,
  selectedTestRunResultId,
  onPageChange,
}: HistorySectionProps) {
  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647A7.962 7.962 0 0112 20a7.962 7.962 0 01-8-8H4z"></path>
        </svg>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic text-center py-4">No history available for this test case.</p>
    )
  }

  return (
    <>
      {history.map((entry) => (
        <div key={entry.id} className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow mb-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900">
                {entry.executedBy?.name || 'System'}
              </span>
              <span className="text-xs text-gray-500">
                {formatDateTime(entry.createdAt)}
              </span>
            </div>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getHistoryStatusColor(entry.action === 'created' ? entry.newStatus : entry.newStatus)}`}>
              {entry.action === 'created' ? 'Created' : entry.action === 'updated' ? 'Updated' : 'Deleted'}
            </span>
          </div>
          
          {entry.action === 'updated' && (entry.oldStatus || entry.newStatus) && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-gray-600">Status changed:</span>
              {entry.oldStatus && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getHistoryStatusColor(entry.oldStatus)}`}>
                  {getHistoryStatusLabel(entry.oldStatus)}
                </span>
              )}
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              {entry.newStatus && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getHistoryStatusColor(entry.newStatus)}`}>
                  {getHistoryStatusLabel(entry.newStatus)}
                </span>
              )}
            </div>
          )}
          
          {entry.action === 'created' && entry.newStatus && (
            <div className="mt-2 text-sm">
              <span className="text-gray-600">Initial status:</span>
              <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${getHistoryStatusColor(entry.newStatus)}`}>
                {getHistoryStatusLabel(entry.newStatus)}
              </span>
            </div>
          )}
        </div>
      ))}
      
      {/* Pagination */}
      {historyTotalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <button
            onClick={() => onPageChange(historyPage - 1)}
            disabled={historyPage === 1 || isLoadingHistory}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {historyPage} of {historyTotalPages}
          </span>
          <button
            onClick={() => onPageChange(historyPage + 1)}
            disabled={historyPage >= historyTotalPages || isLoadingHistory}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}

