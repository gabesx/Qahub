'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../../../../../components/AppHeader'
import { api } from '../../../../../../lib/api'

interface TestRunResult {
  id: string
  status: 'passed' | 'failed' | 'skipped' | 'blocked'
  executionTime: number
  errorMessage: string | null
  stackTrace: string | null
  testCase: {
    id: string
    title: string
    priority: number
    severity: string | null
  }
  createdAt: string
}

interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  environment: string | null
  buildVersion: string | null
  testPlan?: {
    id: string
    title: string
  }
  createdAt: string
}

interface Project {
  id: string
  title: string
}

export default function TestRunDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string
  const testRunId = params.testRunId as string

  const [project, setProject] = useState<Project | null>(null)
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  const [results, setResults] = useState<TestRunResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    fetchProject()
    fetchTestRun()
    fetchResults()
  }, [projectId, testRunId, router, statusFilter])

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${projectId}`)
      setProject(response.data.data.project)
    } catch (err: any) {
      console.error('Failed to fetch project:', err)
    }
  }

  const fetchTestRun = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/test-runs/${testRunId}`)
      setTestRun(response.data.data.testRun)
    } catch (err: any) {
      console.error('Failed to fetch test run:', err)
      setError(err.response?.data?.error?.message || 'Failed to fetch test run')
    }
  }

  const fetchResults = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)

      const response = await api.get(
        `/test-runs/${testRunId}/results?${params.toString()}`
      )
      setResults(response.data.data.results)
    } catch (err: any) {
      console.error('Failed to fetch results:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800'
      case 'blocked':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRunStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const stats = {
    total: results.length,
    passed: results.filter((r) => r.status === 'passed').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    blocked: results.filter((r) => r.status === 'blocked').length,
  }

  if (isLoading && !testRun) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading test run...</p>
          </div>
        </main>
      </div>
    )
  }

  if (error || !testRun) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <p className="text-red-600">{error || 'Test run not found'}</p>
            <Link
              href={`/projects/${projectId}/test-runs`}
              className="mt-4 inline-block text-primary-600 hover:text-primary-700"
            >
              Back to Test Runs
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Link href="/projects" className="hover:text-gray-900">Projects</Link>
            <span>/</span>
            <Link href={`/projects/${projectId}`} className="hover:text-gray-900">
              {project?.title || 'Project'}
            </Link>
            <span>/</span>
            <Link href={`/projects/${projectId}/test-runs`} className="hover:text-gray-900">
              Test Runs
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">{testRun.title}</span>
          </div>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{testRun.title}</h1>
              <div className="flex items-center gap-4 mt-3">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${getRunStatusColor(
                    testRun.status
                  )}`}
                >
                  {testRun.status}
                </span>
                {testRun.testPlan && (
                  <span className="text-sm text-gray-600">
                    Test Plan: {testRun.testPlan.title}
                  </span>
                )}
                {testRun.environment && (
                  <span className="text-sm text-gray-600">
                    Environment: {testRun.environment}
                  </span>
                )}
                {testRun.buildVersion && (
                  <span className="text-sm text-gray-600">
                    Build: {testRun.buildVersion}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-500">Total</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-green-200 p-4">
            <div className="text-sm font-medium text-green-600">Passed</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.passed}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-4">
            <div className="text-sm font-medium text-red-600">Failed</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.failed}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-4">
            <div className="text-sm font-medium text-yellow-600">Skipped</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">{stats.skipped}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm font-medium text-gray-600">Blocked</div>
            <div className="text-2xl font-bold text-gray-600 mt-1">{stats.blocked}</div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        {/* Results List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading results...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Results</h3>
            <p className="text-gray-600">
              Test results will appear here once the test run is executed
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test Case
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Execution Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {result.testCase.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Priority {result.testCase.priority}
                        {result.testCase.severity && ` • ${result.testCase.severity}`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          result.status
                        )}`}
                      >
                        {result.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.executionTime}ms
                    </td>
                    <td className="px-6 py-4">
                      {result.errorMessage ? (
                        <div className="text-sm text-red-600">
                          <div className="font-medium">{result.errorMessage}</div>
                          {result.stackTrace && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-gray-500">
                                View stack trace
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                                {result.stackTrace}
                              </pre>
                            </details>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

