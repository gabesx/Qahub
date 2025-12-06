import { TestCaseStatus } from '../types'

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'passed':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'failed':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'blocked':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'skipped':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'toDo':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'inProgress':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'passed':
      return 'Passed'
    case 'failed':
      return 'Failed'
    case 'blocked':
      return 'Blocked'
    case 'skipped':
      return 'Skipped'
    case 'toDo':
      return 'To Do'
    case 'inProgress':
      return 'In Progress'
    default:
      return 'Unknown'
  }
}

export const getStatusBadgeColor = (status: TestCaseStatus): string => {
  switch (status) {
    case 'passed':
      return 'bg-gradient-to-r from-green-500 to-emerald-500'
    case 'failed':
      return 'bg-gradient-to-r from-red-500 to-rose-500'
    case 'blocked':
      return 'bg-gradient-to-r from-orange-500 to-amber-500'
    case 'skipped':
      return 'bg-gradient-to-r from-blue-500 to-indigo-500'
    case 'inProgress':
      return 'bg-gradient-to-r from-purple-500 to-violet-500'
    default:
      return 'bg-gradient-to-r from-gray-500 to-slate-500'
  }
}

export const getHistoryStatusColor = (status: string | null | undefined): string => {
  if (!status) return 'bg-gray-100 text-gray-700'
  switch (status.toLowerCase()) {
    case 'passed': return 'bg-green-100 text-green-800'
    case 'failed': return 'bg-red-100 text-red-800'
    case 'blocked': return 'bg-yellow-100 text-yellow-800'
    case 'skipped': return 'bg-gray-100 text-gray-800'
    case 'inprogress': return 'bg-blue-100 text-blue-800'
    case 'todo': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-100 text-gray-700'
  }
}

export const getHistoryStatusLabel = (status: string | null | undefined): string => {
  if (!status) return 'N/A'
  switch (status.toLowerCase()) {
    case 'inprogress': return 'In Progress'
    case 'todo': return 'To Do'
    default: return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
  }
}

