import React, { RefObject } from 'react'
import Link from 'next/link'
import { Repository, UploadResults, UploadProgress } from '../types'

interface TestSuite {
  id: string
  title: string
  counts?: {
    testCases?: number
    children?: number
  }
}

interface ImportTestCasesModalProps {
  isOpen: boolean
  projectId: string
  repository: Repository | null
  uploadedFile: File | null
  parsedTestCases: any[]
  isUploading: boolean
  uploadProgress: UploadProgress
  uploadResults: UploadResults
  error: string | null
  testSuites: TestSuite[]
  isLoadingSuites: boolean
  fileInputRef: RefObject<HTMLInputElement>
  onClose: () => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBulkImport: (repoId: string, suiteId: string) => void
}

export function ImportTestCasesModal({
  isOpen,
  projectId,
  repository,
  uploadedFile,
  parsedTestCases,
  isUploading,
  uploadProgress,
  uploadResults,
  error,
  testSuites,
  isLoadingSuites,
  fileInputRef,
  onClose,
  onFileSelect,
  onBulkImport,
}: ImportTestCasesModalProps) {
  if (!isOpen || !repository) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Import Test Cases</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Repository: <span className="font-semibold text-gray-900">{repository.title}</span>
            </p>
          </div>

          {!uploadedFile && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select CSV File
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Click to upload CSV file</p>
                    <p className="text-xs text-gray-500">CSV files only</p>
                  </div>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv"
                className="hidden"
                onChange={onFileSelect}
              />
            </div>
          )}

          {uploadedFile && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{uploadedFile.name}</span>
                <span className="text-gray-500">({parsedTestCases.length} test cases found)</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {isUploading ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
                <p className="text-sm text-gray-600">
                  Uploading test cases... {uploadProgress.current} of {uploadProgress.total}
                </p>
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : uploadResults.success > 0 || uploadResults.failed > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Import completed!</span>
                </div>
                <div className="text-sm text-green-700">
                  <p>Successfully imported: {uploadResults.success} test case{uploadResults.success !== 1 ? 's' : ''}</p>
                  {uploadResults.created > 0 && (
                    <p className="mt-1">• Created: {uploadResults.created} new test case{uploadResults.created !== 1 ? 's' : ''}</p>
                  )}
                  {uploadResults.updated > 0 && (
                    <p className="mt-1">• Updated: {uploadResults.updated} existing test case{uploadResults.updated !== 1 ? 's' : ''}</p>
                  )}
                  {uploadResults.failed > 0 && (
                    <p className="text-red-600 mt-1">Failed: {uploadResults.failed} test case{uploadResults.failed !== 1 ? 's' : ''}</p>
                  )}
                </div>
              </div>

              {uploadResults.errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                  <h3 className="text-sm font-medium text-red-700 mb-2">Errors:</h3>
                  <ul className="text-xs text-red-600 space-y-1">
                    {uploadResults.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {uploadResults.errors.length > 10 && (
                      <li className="text-gray-500">... and {uploadResults.errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {uploadedFile && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Test Suite
                  </label>
                  {isLoadingSuites ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                    </div>
                  ) : testSuites.length === 0 ? (
                    <div className="text-center py-8 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600 mb-4">No test suites available</p>
                      <Link
                        href={`/projects/${projectId}/repository/${repository.id}`}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Create a test suite first
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {testSuites.map((suite) => (
                        <button
                          key={suite.id}
                          onClick={() => onBulkImport(repository.id, suite.id)}
                          className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 truncate">{suite.title}</h3>
                              {(suite.counts?.testCases > 0 || suite.counts?.children > 0) && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {suite.counts.testCases} test case{suite.counts.testCases !== 1 ? 's' : ''}
                                </p>
                              )}
                            </div>
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

