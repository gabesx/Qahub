import { useState } from 'react'
import Link from 'next/link'
import { TestRun } from '../types'

interface TestRunHeaderProps {
  testRun: TestRun | null
  projectId: string
  onTitleUpdate: (title: string) => Promise<void>
  onMetadataEdit: () => void
  isEditingMetadata: boolean
}

export default function TestRunHeader({
  testRun,
  projectId,
  onTitleUpdate,
  onMetadataEdit,
  isEditingMetadata,
}: TestRunHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')

  const handleStartEditingTitle = () => {
    if (testRun) {
      setEditedTitle(testRun.title)
      setIsEditingTitle(true)
    }
  }

  const handleSaveTitle = async () => {
    if (!testRun || !editedTitle.trim()) {
      setIsEditingTitle(false)
      return
    }

    if (editedTitle.trim() === testRun.title) {
      setIsEditingTitle(false)
      return
    }

    try {
      await onTitleUpdate(editedTitle.trim())
      setIsEditingTitle(false)
    } catch (err) {
      setEditedTitle(testRun.title)
      setIsEditingTitle(false)
    }
  }

  const handleCancelEditingTitle = () => {
    if (testRun) {
      setEditedTitle(testRun.title)
    }
    setIsEditingTitle(false)
  }

  return (
    <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-md">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-500">Test Run</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            {isEditingTitle ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSaveTitle()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleCancelEditingTitle()
                  }
                }}
                className="text-2xl font-bold text-gray-900 border-2 border-primary-500 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-600 bg-white shadow-sm"
                style={{ minWidth: '300px' }}
                autoFocus
              />
            ) : (
              <h1
                onDoubleClick={handleStartEditingTitle}
                className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent cursor-pointer hover:from-primary-600 hover:to-primary-700 transition-all"
                title="Double-click to edit"
              >
                {testRun?.title || 'Loading...'}
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onMetadataEdit}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium shadow-sm hover:shadow-md"
            title="Edit test run metadata"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {isEditingMetadata ? 'Cancel' : 'Edit Metadata'}
          </button>
          <Link
            href={`/projects/${projectId}?tab=testRuns`}
            className="flex items-center gap-2 px-5 py-2.5 text-gray-700 hover:text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all font-medium shadow-sm hover:shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Test Runs
          </Link>
        </div>
      </div>
  )
}

