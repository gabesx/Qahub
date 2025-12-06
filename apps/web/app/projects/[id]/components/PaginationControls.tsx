import React from 'react'
import { PaginationState } from '../types'

interface PaginationControlsProps {
  pagination: PaginationState
  onPageChange: (page: number) => void
  itemName: string
}

export function PaginationControls({ pagination, onPageChange, itemName }: PaginationControlsProps) {
  if (pagination.limit === -1 || pagination.totalPages <= 1) {
    return null
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
      <div className="text-sm text-gray-600">
        Showing{' '}
        <span className="font-medium">
          {(pagination.page - 1) * pagination.limit + 1}
        </span>{' '}
        to{' '}
        <span className="font-medium">
          {Math.min(pagination.page * pagination.limit, pagination.total)}
        </span>{' '}
        of <span className="font-medium">{pagination.total}</span> {itemName}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
          disabled={pagination.page === 1}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            let pageNum: number
            if (pagination.totalPages <= 7) {
              pageNum = i + 1
            } else if (pagination.page <= 4) {
              pageNum = i + 1
            } else if (pagination.page >= pagination.totalPages - 3) {
              pageNum = pagination.totalPages - 6 + i
            } else {
              pageNum = pagination.page - 3 + i
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  pagination.page === pageNum
                    ? 'bg-primary-600 text-white'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => onPageChange(Math.min(pagination.totalPages, pagination.page + 1))}
          disabled={pagination.page === pagination.totalPages}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}

