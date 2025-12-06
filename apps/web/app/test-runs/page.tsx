'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AppHeader from '../components/AppHeader'
import { api } from '../../lib/api'

interface TestRun {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  executionDate: string | null
  startedAt: string | null
  completedAt: string | null
  environment: string | null
  buildVersion: string | null
  project: {
    id: string
    title: string
  }
  testPlan: {
    id: string
    title: string
  }
  repository: {
    id: string
    title: string
  } | null
  stats: {
    total: number
    passed: number
    failed: number
    skipped: number
    blocked: number
  }
  createdAt: string
  updatedAt: string
}

interface Project {
  id: string
  title: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function TestRunsPage() {
  const router = useRouter()
  const [testRuns, setTestRuns] = useState<TestRun[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'>('all')
  const [environmentFilter, setEnvironmentFilter] = useState<string>('all')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/')
      return
    }
    // Load view preference from localStorage
    const savedViewMode = localStorage.getItem('testRunsViewMode') as 'detailed' | 'compact' | null
    if (savedViewMode === 'compact' || savedViewMode === 'detailed') {
      setViewMode(savedViewMode)
    }
    fetchTestRuns()
  }, [router])

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      if (pagination.page === 1) {
        fetchTestRuns()
      } else {
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, statusFilter, environmentFilter])

  useEffect(() => {
    fetchTestRuns()
  }, [pagination.page, pagination.limit])

  const fetchTestRuns = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch all projects first
      const projectsResponse = await api.get('/projects', {
        params: { page: 1, limit: 100 }, // Get all projects
      })

      const projects: Project[] = projectsResponse.data?.data?.projects || []

      if (projects.length === 0) {
        setTestRuns([])
        setPagination(prev => ({ ...prev, total: 0, totalPages: 0 }))
        setIsLoading(false)
        return
      }

      // Fetch test runs for each project
      const testRunsPromises = projects.map((project) =>
        api
          .get(`/projects/${project.id}/test-runs`, {
            params: {
              page: 1,
              limit: 100, // Get all test runs from this project
              ...(search.trim() && { search: search.trim() }),
              ...(statusFilter !== 'all' && { status: statusFilter }),
              ...(environmentFilter !== 'all' && { environment: environmentFilter }),
              sortBy: 'updatedAt',
              sortOrder: 'desc',
            },
          })
          .then((response) => {
            const testRuns = response.data?.data?.testRuns || []
            return testRuns.map((tr: any) => ({
              ...tr,
              project: { id: project.id, title: project.title },
            }))
          })
          .catch(() => [])
      )

      const testRunsArrays = await Promise.all(testRunsPromises)
      let allTestRuns = testRunsArrays.flat()

      // Sort by updatedAt descending
      allTestRuns = allTestRuns.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )

      // Apply pagination
      const total = allTestRuns.length
      const totalPages = Math.ceil(total / pagination.limit)
      const startIndex = (pagination.page - 1) * pagination.limit
      const endIndex = startIndex + pagination.limit
      const paginatedTestRuns = allTestRuns.slice(startIndex, endIndex)

      setTestRuns(paginatedTestRuns)
      setPagination(prev => ({
        ...prev,
        total,
        totalPages,
      }))
    } catch (err: any) {
      console.error('Fetch test runs error:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('token')
        router.push('/')
      } else {
        setError(err.response?.data?.error?.message || 'Failed to fetch test runs')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleViewModeChange = (mode: 'detailed' | 'compact') => {
    setViewMode(mode)
    localStorage.setItem('testRunsViewMode', mode)
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

    if (diffInDays === 0) {
      return 'Today'
    } else if (diffInDays === 1) {
      return 'Yesterday'
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      case 'running':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-actions-dropdown]')) {
        setOpenActionsDropdown(null)
      }
    }

    if (openActionsDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openActionsDropdown])

  // Get unique environments from test runs
  const getUniqueEnvironments = () => {
    const environments = new Set<string>()
    testRuns.forEach(tr => {
      if (tr.environment) {
        environments.add(tr.environment)
      }
    })
    return Array.from(environments).sort()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Runs</h1>
              <p className="text-gray-600">View and manage test run executions of your test plans</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center gap-4">
              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('detailed')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'detailed'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Detailed view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleViewModeChange('compact')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'compact'
                      ? 'bg-white text-primary-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Compact view"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>
              {/* Search Bar */}
              <div className="relative flex-1 sm:flex-initial sm:w-80">
                <input
                  type="text"
                  placeholder="Search test runs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Environment Filter */}
              <select
                value={environmentFilter}
                onChange={(e) => setEnvironmentFilter(e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition bg-white"
              >
                <option value="all">All Environments</option>
                {getUniqueEnvironments().map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Test Runs List */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading test runs...</p>
          </div>
        ) : testRuns.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full border-4 border-gray-200 flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Test Runs Found</h3>
              <p className="text-gray-600 mb-6 max-w-md">
                {search || statusFilter !== 'all' || environmentFilter !== 'all'
                  ? 'No test runs match your search criteria. Try adjusting your filters.'
                  : 'Create your first test run to start executing tests.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Test Runs Display */}
            {viewMode === 'compact' ? (
              /* Compact Table View */
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Project</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Test Plan</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Results</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Environment</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Updated</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {testRuns.map((testRun) => (
                        <tr key={testRun.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            {testRun.repository ? (
                              <Link
                                href={`/projects/${testRun.project.id}/repositories/${testRun.repository.id}/test-run/${testRun.id}`}
                                className="text-sm font-medium text-gray-900 hover:text-primary-600 transition-colors"
                              >
                                {testRun.title}
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-gray-900">{testRun.title}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Link
                              href={`/projects/${testRun.project.id}`}
                              className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
                            >
                              {testRun.project.title}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{testRun.testPlan.title}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                                testRun.status
                              )}`}
                            >
                              {getStatusLabel(testRun.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {testRun.stats.total > 0 ? (
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-emerald-600 font-medium">{testRun.stats.passed}</span>
                                {testRun.stats.failed > 0 && (
                                  <span className="text-red-600 font-medium">{testRun.stats.failed}</span>
                                )}
                                {testRun.stats.skipped > 0 && (
                                  <span className="text-yellow-600 font-medium">{testRun.stats.skipped}</span>
                                )}
                                <span className="text-gray-400">/</span>
                                <span className="text-gray-600 font-medium">{testRun.stats.total}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-600">{testRun.environment || '-'}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-500">{formatDate(testRun.updatedAt)}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="relative inline-block" data-actions-dropdown>
                              <button
                                onClick={() => setOpenActionsDropdown(openActionsDropdown === testRun.id ? null : testRun.id)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                              </button>
                              {openActionsDropdown === testRun.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                                {testRun.repository ? (
                                  <Link
                                    href={`/projects/${testRun.project.id}/repositories/${testRun.repository.id}/test-run/${testRun.id}`}
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                    onClick={() => setOpenActionsDropdown(null)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      View Test Run
                                    </div>
                                  </Link>
                                ) : (
                                  <div className="px-4 py-2 text-sm text-gray-400">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      View Test Run (No Repository)
                                    </div>
                                  </div>
                                )}
                                <Link
                                  href={`/projects/${testRun.project.id}`}
                                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                  onClick={() => setOpenActionsDropdown(null)}
                                >
                                  <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    View Project
                                  </div>
                                </Link>
                              </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Detailed Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testRuns.map((testRun) => (
                <div
                  key={testRun.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow relative"
                >
                  {/* Actions Menu */}
                  <div className="absolute top-4 right-4" data-actions-dropdown>
                    <button
                      onClick={() => setOpenActionsDropdown(openActionsDropdown === testRun.id ? null : testRun.id)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    {openActionsDropdown === testRun.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1">
                        {testRun.repository ? (
                          <Link
                            href={`/projects/${testRun.project.id}/repositories/${testRun.repository.id}/test-run/${testRun.id}`}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setOpenActionsDropdown(null)}
                          >
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Test Run
                            </div>
                          </Link>
                        ) : (
                          <div className="px-4 py-2 text-sm text-gray-400">
                            <div className="flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View Test Run (No Repository)
                            </div>
                          </div>
                        )}
                        <Link
                          href={`/projects/${testRun.project.id}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setOpenActionsDropdown(null)}
                        >
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            View Project
                          </div>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Test Run Title */}
                  <div className="mb-4 pr-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{testRun.title}</h3>
                    <p className="text-sm text-gray-500">
                      {testRun.project.title} • {testRun.testPlan.title}
                      {testRun.repository && ` • ${testRun.repository.title}`}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span
                      className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(
                        testRun.status
                      )}`}
                    >
                      {getStatusLabel(testRun.status)}
                    </span>
                  </div>

                  {/* Statistics */}
                  {testRun.stats.total > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <div>
                          <p className="text-xs text-gray-500">Passed</p>
                          <p className="text-sm font-semibold text-gray-900">{testRun.stats.passed}</p>
                        </div>
                      </div>
                      {testRun.stats.failed > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <div>
                            <p className="text-xs text-gray-500">Failed</p>
                            <p className="text-sm font-semibold text-gray-900">{testRun.stats.failed}</p>
                          </div>
                        </div>
                      )}
                      {testRun.stats.skipped > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <div>
                            <p className="text-xs text-gray-500">Skipped</p>
                            <p className="text-sm font-semibold text-gray-900">{testRun.stats.skipped}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <div>
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-sm font-semibold text-gray-900">{testRun.stats.total}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Environment and Build Info */}
                  <div className="mb-6 pt-4 border-t border-gray-100">
                    {testRun.environment && (
                      <p className="text-xs text-gray-500 mb-1">Environment</p>
                    )}
                    {testRun.environment && (
                      <p className="text-sm font-medium text-gray-900">{testRun.environment}</p>
                    )}
                    {testRun.buildVersion && (
                      <p className="text-xs text-gray-500 mt-1">Build: {testRun.buildVersion}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">{formatDate(testRun.updatedAt)}</p>
                  </div>

                  {/* Open Test Run Button */}
                  {testRun.repository ? (
                    <Link
                      href={`/projects/${testRun.project.id}/repositories/${testRun.repository.id}/test-run/${testRun.id}`}
                      className="block w-full bg-primary-600 text-white text-center py-2.5 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <span>View Test Run</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ) : (
                    <div className="block w-full bg-gray-300 text-gray-500 text-center py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 cursor-not-allowed">
                      <span>View Test Run (No Repository)</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}

            {/* Pagination */}
            {(pagination.totalPages > 1 || pagination.total > 0) && (
              <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {(pagination.page - 1) * pagination.limit + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Show:</label>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                    >
                      <option value={20}>20</option>
                      <option value={40}>40</option>
                      <option value={60}>60</option>
                    </select>
                  </div>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                            onClick={() => handlePageChange(pageNum)}
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
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

