import { TestCaseStatus } from '../types'

interface StatusButtonsProps {
  currentStatus: TestCaseStatus
  onStatusChange: (status: TestCaseStatus) => void
}

export default function StatusButtons({ currentStatus, onStatusChange }: StatusButtonsProps) {
  const buttons: Array<{ status: TestCaseStatus; label: string; disabled?: boolean }> = [
    { status: 'passed', label: 'Passed', disabled: currentStatus === 'toDo' },
    { status: 'failed', label: 'Failed', disabled: currentStatus === 'toDo' },
    { status: 'blocked', label: 'Blocked', disabled: currentStatus === 'toDo' },
    { status: 'toDo', label: 'To Do' },
    { status: 'skipped', label: 'Skipped' },
    { status: 'inProgress', label: 'In Progress' },
  ]

  const getButtonClasses = (status: TestCaseStatus, disabled: boolean) => {
    const baseClasses = 'px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-sm'
    
    if (disabled) {
      return `${baseClasses} bg-gray-100 text-gray-400 border-2 border-gray-300 cursor-not-allowed opacity-60`
    }
    
    const isActive = currentStatus === status
    
    const statusClasses = {
      passed: isActive 
        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
        : 'bg-white text-green-700 border-2 border-green-600 hover:bg-green-50 hover:shadow-md',
      failed: isActive
        ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
        : 'bg-white text-red-700 border-2 border-red-600 hover:bg-red-50 hover:shadow-md',
      blocked: isActive
        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
        : 'bg-white text-orange-700 border-2 border-orange-600 hover:bg-orange-50 hover:shadow-md',
      toDo: isActive
        ? 'bg-gradient-to-r from-gray-600 to-slate-600 text-white shadow-md'
        : 'bg-white text-gray-700 border-2 border-gray-600 hover:bg-gray-50 hover:shadow-md',
      skipped: isActive
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
        : 'bg-white text-blue-700 border-2 border-blue-600 hover:bg-blue-50 hover:shadow-md',
      inProgress: isActive
        ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-md'
        : 'bg-white text-purple-700 border-2 border-purple-600 hover:bg-purple-50 hover:shadow-md',
    }
    
    return `${baseClasses} ${statusClasses[status]}`
  }

  return (
    <div className="border-b border-gray-200 px-6 py-5 bg-gradient-to-r from-gray-50 to-slate-50">
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {buttons.map(({ status, label, disabled }) => (
          <button
            key={status}
            onClick={() => !disabled && onStatusChange(status)}
            disabled={disabled}
            className={getButtonClasses(status, disabled || false)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

