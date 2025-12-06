import { TestRun } from '../types'

interface TestRunMetadataProps {
  testRun: TestRun | null
  isEditing: boolean
  editedMetadata: {
    executionDate: string
    environment: string
    buildVersion: string
  }
  onMetadataChange: (metadata: { executionDate: string; environment: string; buildVersion: string }) => void
  onSave: () => Promise<void>
  onCancel: () => void
}

export default function TestRunMetadata({
  testRun,
  isEditing,
  editedMetadata,
  onMetadataChange,
  onSave,
  onCancel,
}: TestRunMetadataProps) {
  if (isEditing) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200 mb-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit Test Run Metadata
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Execution Date
            </label>
            <input
              type="date"
              value={editedMetadata.executionDate}
              onChange={(e) => onMetadataChange({ ...editedMetadata, executionDate: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Environment
            </label>
            <input
              type="text"
              value={editedMetadata.environment}
              onChange={(e) => onMetadataChange({ ...editedMetadata, environment: e.target.value })}
              placeholder="e.g., Development, Staging, Production"
              maxLength={100}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Build Version
            </label>
            <input
              type="text"
              value={editedMetadata.buildVersion}
              onChange={(e) => onMetadataChange({ ...editedMetadata, buildVersion: e.target.value })}
              placeholder="e.g., v1.2.3, build-1234"
              maxLength={100}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white shadow-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-medium shadow-md hover:shadow-lg"
          >
            Save Metadata
          </button>
        </div>
      </div>
    )
  }

  if (!testRun) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="text-xs font-medium text-gray-500 mb-1">Execution Date</div>
        <div className="text-sm font-semibold text-gray-900">
          {testRun.executionDate ? new Date(testRun.executionDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) : 'Not set'}
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="text-xs font-medium text-gray-500 mb-1">Environment</div>
        <div className="text-sm font-semibold text-gray-900">
          {testRun.environment || 'Not set'}
        </div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
        <div className="text-xs font-medium text-gray-500 mb-1">Build Version</div>
        <div className="text-sm font-semibold text-gray-900">
          {testRun.buildVersion || 'Not set'}
        </div>
      </div>
    </div>
  )
}

