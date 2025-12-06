import { formatTotalExecutionTime } from '../utils/formatters'

interface TestRunStatsProps {
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
    toDo: number
    inProgress: number
  }
  totalExecutionTime: number
}

export default function TestRunStats({ stats, totalExecutionTime }: TestRunStatsProps) {
  const segments = []
  if (stats.passed > 0) segments.push({ color: 'bg-green-500', width: (stats.passed / stats.total) * 100, count: stats.passed })
  if (stats.failed > 0) segments.push({ color: 'bg-red-500', width: (stats.failed / stats.total) * 100, count: stats.failed })
  if (stats.blocked > 0) segments.push({ color: 'bg-orange-500', width: (stats.blocked / stats.total) * 100, count: stats.blocked })
  if (stats.skipped > 0) segments.push({ color: 'bg-blue-500', width: (stats.skipped / stats.total) * 100, count: stats.skipped })

  const executed = stats.passed + stats.failed + stats.blocked + stats.skipped
  const complete = stats.total > 0 ? Math.round((executed / stats.total) * 100) : 0

  return (
    <>
      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {stats.passed > 0 && (
              <div className="relative group">
                <span className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white cursor-help shadow-md hover:shadow-lg transition-shadow">
                  {stats.passed} Passed
                </span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                    Passed: {stats.passed}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {stats.skipped > 0 && (
              <div className="relative group">
                <span className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 text-white cursor-help shadow-md hover:shadow-lg transition-shadow">
                  {stats.skipped} Skipped
                </span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                    Skipped: {stats.skipped}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {stats.failed > 0 && (
              <div className="relative group">
                <span className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white cursor-help shadow-md hover:shadow-lg transition-shadow">
                  {stats.failed} Failed
                </span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                    Failed: {stats.failed}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {stats.blocked > 0 && (
              <div className="relative group">
                <span className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white cursor-help shadow-md hover:shadow-lg transition-shadow">
                  {stats.blocked} Blocked
                </span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                    Blocked: {stats.blocked}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full overflow-hidden shadow-inner" style={{ height: '16px' }}>
            <div className="flex h-full">
              {segments.map((segment, idx) => (
                <div
                  key={idx}
                  className={`${segment.color} transition-all duration-300 hover:brightness-110`}
                  style={{ width: `${segment.width}%` }}
                  title={`${segment.count} test cases`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Boxes */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Execution Time */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className={`text-xl font-bold ${totalExecutionTime > 0 ? 'text-green-700' : 'text-gray-600'}`}>
              {formatTotalExecutionTime(totalExecutionTime)}
            </div>
            <div className="text-xs font-medium text-gray-600 mt-1">Execution Time</div>
          </div>
          
          {/* Executed */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-xl font-bold text-blue-700">
              {executed}/{stats.total}
            </div>
            <div className="text-xs font-medium text-gray-600 mt-1">Executed</div>
          </div>
          
          {/* Complete */}
          <div className={`rounded-xl p-4 border shadow-sm hover:shadow-md transition-shadow ${
            stats.total > 0 && executed === stats.total 
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100' 
              : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-100'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <svg className={`w-5 h-5 ${stats.total > 0 && executed === stats.total ? 'text-emerald-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className={`text-xl font-bold ${
              stats.total > 0 && executed === stats.total 
                ? 'text-emerald-700' 
                : 'text-gray-700'
            }`}>
              {complete}%
            </div>
            <div className="text-xs font-medium text-gray-600 mt-1">Complete</div>
          </div>
        </div>
      )}
    </>
  )
}

