import { User } from '../types'

interface BulkAssigneeSelectorProps {
  users: User[]
  selectedCount: number
  bulkAssignee: string
  onAssigneeChange: (userId: string | null) => void
  hasTestCases: boolean
}

export default function BulkAssigneeSelector({
  users,
  selectedCount,
  bulkAssignee,
  onAssigneeChange,
  hasTestCases,
}: BulkAssigneeSelectorProps) {
  if (!hasTestCases || selectedCount === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 mb-4">
      <select
        value={bulkAssignee}
        onChange={(e) => {
          const userId = e.target.value || null
          onAssigneeChange(userId)
        }}
        className="form-select form-select-sm border border-gray-300 rounded px-3 py-2 bg-white"
        style={{ width: '200px', fontSize: '14px' }}
      >
        <option value="" disabled>Select Assignee</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-600">
        ({selectedCount} test case{selectedCount !== 1 ? 's' : ''} selected)
      </span>
    </div>
  )
}

