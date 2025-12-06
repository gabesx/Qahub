import React from 'react'

interface TestPlan {
  id: string
  title: string
  repository: {
    id: string
    title: string
  }
}

interface DeleteTestPlanModalProps {
  isOpen: boolean
  testPlan: TestPlan | null
  isDeleting: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}

export function DeleteTestPlanModal({
  isOpen,
  testPlan,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteTestPlanModalProps) {
  if (!isOpen || !testPlan) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">Delete Test Plan</h3>
              <p className="text-sm text-gray-600 mt-1">This action cannot be undone.</p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{testPlan.title}</span>?
            </p>
            <p className="text-xs text-gray-500">
              This will permanently delete the test plan. Test cases will not be deleted, only their association with this test plan.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                'Delete Test Plan'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

