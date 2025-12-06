'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../../../../components/AppHeader'
import { api } from '../../../../../../../../../lib/api'

interface TestSuite {
  id: string
  title: string
}

interface Repository {
  id: string
  title: string
}

interface Project {
  id: string
  title: string
}

export default function CreateTestCasePage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const repoId = params.repoId as string
  const suiteId = params.suiteId as string

  const [project, setProject] = useState<Project | null>(null)
  const [repository, setRepository] = useState<Repository | null>(null)
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    automated: false,
    priority: 2,
    severity: 'Moderate',
    labels: '',
    regression: true,
  })

  const maxTitleLength = 255
  const maxDescriptionLength = 1000
  const titleRemaining = maxTitleLength - formData.title.length
  const descriptionRemaining = maxDescriptionLength - formData.description.length

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchRepository()
    fetchTestSuite()
  }, [projectId, repoId, suiteId, router])

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      if (response.data?.data?.project) {
        setProject(response.data.data.project)
      }
    } catch (err: any) {
      console.error('Fetch project error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    }
  }

  const fetchRepository = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}`)
      if (response.data?.data?.repository) {
        setRepository(response.data.data.repository)
      }
    } catch (err: any) {
      console.error('Fetch repository error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      }
    }
  }

  const fetchTestSuite = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get(`/projects/${projectId}/repositories/${repoId}/suites/${suiteId}`)
      if (response.data?.data?.suite) {
        setTestSuite(response.data.data.suite)
      }
    } catch (err: any) {
      console.error('Fetch test suite error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 404) {
        setError('Test suite not found')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test suite')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await api.post(
        `/projects/${projectId}/repositories/${repoId}/suites/${suiteId}/test-cases`,
        {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          automated: formData.automated,
          priority: formData.priority,
          severity: formData.severity,
          labels: formData.labels.trim() || undefined,
          regression: formData.regression,
        }
      )

      if (response.data?.data?.testCase) {
        router.push(`/projects/${projectId}/repository/${repoId}/suites/${suiteId}/test-cases`)
      }
    } catch (err: any) {
      console.error('Create test case error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.error?.message || 'You do not have permission to create test cases.')
      } else if (err.response?.status === 404) {
        setError('Test suite not found')
      } else if (err.response?.data?.error?.details) {
        const details = err.response.data.error.details
        const errorMessages = Array.isArray(details)
          ? details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')
          : 'Invalid input data'
        setError(errorMessages)
      } else {
        setError(err.response?.data?.error?.message || 'Failed to create test case')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error && !testSuite) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href={`/projects/${projectId}/repository/${repoId}`}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium inline-block"
            >
              Back to Repository
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
            <Link href="/projects" className="hover:text-gray-900 transition-colors">
              Projects
            </Link>
            <span>/</span>
            {project && (
              <>
                <Link href={`/projects/${projectId}`} className="hover:text-gray-900 transition-colors">
                  {project.title}
                </Link>
                <span>/</span>
              </>
            )}
            {repository && (
              <>
                <Link href={`/projects/${projectId}/repository/${repoId}`} className="hover:text-gray-900 transition-colors">
                  {repository.title}
                </Link>
                <span>/</span>
              </>
            )}
            {testSuite && (
              <>
                <Link href={`/projects/${projectId}/repository/${repoId}?suite=${suiteId}`} className="hover:text-gray-900 transition-colors">
                  {testSuite.title}
                </Link>
                <span>/</span>
              </>
            )}
            <Link href={`/projects/${projectId}/repository/${repoId}/suites/${suiteId}/test-cases`} className="hover:text-gray-900 transition-colors">
              Test Cases
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">New</span>
          </nav>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Test Case</h1>
              {testSuite && (
                <p className="text-gray-600">Add a new test case to {testSuite.title}</p>
              )}
            </div>
            <Link
              href={`/projects/${projectId}/repository/${repoId}/suites/${suiteId}/test-cases`}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Cancel
            </Link>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                required
                maxLength={maxTitleLength}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                placeholder="Enter test case title"
              />
              <p className="mt-1 text-xs text-gray-500">
                {titleRemaining} characters remaining
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                rows={6}
                maxLength={maxDescriptionLength}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition resize-y"
                placeholder="Enter test case description (optional)"
              />
              <p className="mt-1 text-xs text-gray-500">
                {descriptionRemaining} characters remaining
              </p>
            </div>

            {/* Priority and Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                >
                  <option value={1}>1 - Critical</option>
                  <option value={2}>2 - High</option>
                  <option value={3}>3 - Medium</option>
                  <option value={4}>4 - Low</option>
                  <option value={5}>5 - Very Low</option>
                </select>
              </div>

              <div>
                <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-2">
                  Severity
                </label>
                <select
                  id="severity"
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                  <option value="Very Low">Very Low</option>
                </select>
              </div>
            </div>

            {/* Labels */}
            <div>
              <label htmlFor="labels" className="block text-sm font-medium text-gray-700 mb-2">
                Labels
              </label>
              <input
                type="text"
                id="labels"
                value={formData.labels}
                onChange={(e) => setFormData({ ...formData, labels: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                placeholder="Enter labels separated by commas (optional)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Separate multiple labels with commas
              </p>
            </div>

            {/* Checkboxes */}
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="automated"
                  checked={formData.automated}
                  onChange={(e) => setFormData({ ...formData, automated: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="automated" className="ml-2 text-sm text-gray-700">
                  Automated test case
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="regression"
                  checked={formData.regression}
                  onChange={(e) => setFormData({ ...formData, regression: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="regression" className="ml-2 text-sm text-gray-700">
                  Include in regression testing
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <Link
                href={`/projects/${projectId}/repository/${repoId}/suites/${suiteId}/test-cases`}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !formData.title.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  'Create Test Case'
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

