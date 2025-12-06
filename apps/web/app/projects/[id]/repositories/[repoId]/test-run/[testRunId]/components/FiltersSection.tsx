import { User } from '../types'

interface FiltersSectionProps {
  statusFilter: string
  assigneeFilter: string
  assignees: Array<{ id: string; name: string; email: string }>
  onStatusFilterChange: (value: string) => void
  onAssigneeFilterChange: (value: string) => void
  onResetFilters: () => void
}

export default function FiltersSection({
  statusFilter,
  assigneeFilter,
  assignees,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onResetFilters,
}: FiltersSectionProps) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white shadow-sm hover:shadow-md font-medium text-sm"
        >
          <option value="all">Status: All</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="blocked">Blocked</option>
          <option value="skipped">Skipped</option>
          <option value="toDo">To Do</option>
          <option value="inProgress">In Progress</option>
        </select>
        
        <select
          value={assigneeFilter}
          onChange={(e) => onAssigneeFilterChange(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-white shadow-sm hover:shadow-md font-medium text-sm"
        >
          <option value="all">Assignee: All</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}
            </option>
          ))}
        </select>
        
        <button
          onClick={onResetFilters}
          className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-medium text-sm shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reset Filters
        </button>
      </div>
    </div>
  )
}

