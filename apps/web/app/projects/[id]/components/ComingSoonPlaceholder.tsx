import React from 'react'

interface ComingSoonPlaceholderProps {
  title?: string
  message?: string
  icon?: React.ReactNode
}

export function ComingSoonPlaceholder({
  title = 'Coming Soon',
  message = 'This section is under development.',
  icon,
}: ComingSoonPlaceholderProps) {
  const defaultIcon = (
    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
      <div className="text-gray-400 mb-4">
        {icon || defaultIcon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{message}</p>
    </div>
  )
}

