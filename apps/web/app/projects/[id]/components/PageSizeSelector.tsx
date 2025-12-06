import React from 'react'
import { PaginationState } from '../types'

interface PageSizeSelectorProps {
  pagination: PaginationState
  onLimitChange: (limit: number) => void
  show: boolean
}

export function PageSizeSelector({ pagination, onLimitChange, show }: PageSizeSelectorProps) {
  if (!show) return null

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600">Items per page:</span>
      <select
        value={pagination.limit === -1 ? 'all' : pagination.limit}
        onChange={(e) => {
          const newLimit = e.target.value === 'all' ? -1 : parseInt(e.target.value, 10)
          onLimitChange(newLimit)
        }}
        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white text-sm"
      >
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100">100</option>
        <option value="all">All</option>
      </select>
    </div>
  )
}

